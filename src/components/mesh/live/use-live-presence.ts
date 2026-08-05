// useLivePresence — the mesh room, rebuilt on the PR6 live stack:
//
//   presence-client  ONE transport (SSE primary, poll fallback-only,
//                    jittered reconnect backoff, 429 "live paused", payload
//                    dedupe, 500ms-floor adaptive heartbeat)
//   roster           who's here (grace hysteresis, join/leave events,
//                    per-user appearance signatures)
//   action-bus       versioned action envelope out, legacy parse at the
//                    edge, unknown verbs ignored
//   meshi-machine    per-Meshi sprites, WORLD COORDS ONLY
//   mood             behaviour + broadcast mood ladders, pure
//
// This hook is the wiring: it feeds observations in, maps roster events to
// React state and room MOMENTS (arrive bursts, "entered your mesh" toasts,
// departure fades), and replays room actions. Two sanctioned improvements
// over the old 480-line effect (everything else is behaviour-identical):
// cosmetic pref changes no longer tear down the transport (prefs ride a
// ref, killing the reconnect churn), and grace expiry runs on its own 1s
// sweep — gated on payload EVIDENCE (a member is evicted only once a
// delivered payload omitted them), so a leaver fades on time even when the
// transport goes quiet after the frame that dropped them, while a
// payload-static room (byte-identical frames deduped at both the SSE route
// and the transport) never fades out members who are simply idle.

"use client";

import { useEffect, useRef, useState } from "react";
import type { MeshiMood } from "@/components/meshi/meshi-mascot";
import type { MeshiPreferences } from "@/hooks/use-meshi-preferences";
import { readGhostMode } from "@/lib/ghost-mode";
import { readWhereShare } from "@/lib/where-share";
import { playSound } from "@/lib/sound";
import { cameraCenterWorld, projectPoint, unprojectPoint } from "../core/camera";
import type { ViewerCaps } from "../core/viewer";
import type { LeavingMeshi, MeshRuntimeRef } from "../scene/runtime";
import { admitRoomAction, createReplayGate, encodeActionEnvelope, pruneReplayGate, sealReplayBaseline } from "./action-bus";
import { spawnBurst, spawnCosmeticHeart, spawnHeart, spawnReactionTrail } from "./hearts";
import { applySighting, createSprite } from "./meshi-machine";
import { deriveBroadcastMood, stepBehaviorMood } from "./mood";
import { createPresenceClient, type LiveLink } from "./presence-client";
import { applySightings, PRESENCE_GRACE_MS, resetRoster, sweepRoster, type RemotePresence, type RosterEvents } from "./roster";

/** A staged world action rides the heartbeat for this long (receivers
 * dedupe by its timestamp, so lingering is safe and covers packet loss). */
const ACTION_RIDE_MS = 8000;

export interface LivePresence {
  remotePresences: RemotePresence[];
  ownerLive: boolean;
  leavingMeshis: LeavingMeshi[];
  behaviorMood: MeshiMood | null;
  /** Transport state — "paused" surfaces the rate-limit pip. */
  liveLink: LiveLink;
}

export function useLivePresence(
  rtRef: MeshRuntimeRef,
  opts: {
    viewer: ViewerCaps;
    viewUserId?: string;
    viewMode: "mesh" | "global";
    prefs: MeshiPreferences;
    /** "@user entered your mesh" — surfaced through the chrome marquee. */
    onPresenceToast: (text: string) => void;
  },
): LivePresence {
  const { viewer, viewUserId, viewMode, prefs, onPresenceToast } = opts;
  const isOwnMesh = viewer.isOwner;

  const [remotePresences, setRemotePresences] = useState<RemotePresence[]>([]);
  // Whether the viewed mesh's owner is present IN THIS ROOM right now
  // (browsing their own mesh) — their heart Meshi wakes and tracks their real
  // position, and sleeps at home when they're away. Held through the grace
  // window so one dropped heartbeat can't blink them out.
  const [ownerLive, setOwnerLive] = useState(false);
  const [leavingMeshis, setLeavingMeshis] = useState<LeavingMeshi[]>([]);
  // A gentle mood driven by the room: warm when another Meshi is close, a
  // look-around fidget then a doze when you go quiet. null = resting face.
  const [behaviorMood, setBehaviorMood] = useState<MeshiMood | null>(null);
  const [liveLink, setLiveLink] = useState<LiveLink>("idle");

  // Cosmetic prefs ride a ref so changing your hat doesn't tear down the
  // room transport (the old effect's dependency list caused a full SSE
  // reconnect per cosmetic change — needless churn, called out in the audit).
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  // Honour reduced-motion for the extra body-language (gaze lean): it stays
  // on the runtime so the per-frame loop reads it without re-subscribing.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const rt = rtRef.current;
    rt.reducedMotion = mq.matches;
    const on = () => {
      rt.reducedMotion = mq.matches;
    };
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [rtRef]);

  // Your Meshi's inner life, sampled a few times a second (never per frame):
  // warmth, fidget, doze — the policy lives pure in live/mood; this ticker
  // only feeds it observations. Distances are measured between WORLD
  // positions scaled by the zoom (projection is a uniform scale, so this IS
  // the screen distance). The chosen mood rides the presence broadcast, so
  // it only grows where the viewer may broadcast at all — the read-only
  // Global view grows no behaviours.
  useEffect(() => {
    if (!viewer.canBroadcastPresence) return;
    const rt = rtRef.current;
    const tick = () => {
      const now = performance.now();
      const zoom = Math.max(rt.camera.zoom, 0.05);
      const selfPlaced = isOwnMesh || rt.cursorWorldTarget.seen;
      const self = isOwnMesh ? rt.ownerWorldPos : rt.cursorWorldPos;
      let nearestPx = Infinity;
      if (selfPlaced) {
        rt.presence.sprites.forEach((s) => {
          if (!s.world) return;
          const d = Math.hypot(s.world.x - self.x, s.world.y - self.y) * zoom;
          if (d < nearestPx) nearestPx = d;
        });
        // The host's Meshi counts as a neighbour when you're visiting them.
        if (!isOwnMesh && rt.ownerMeshiEl) {
          const d = Math.hypot(rt.ownerWorldPos.x - self.x, rt.ownerWorldPos.y - self.y) * zoom;
          if (d < nearestPx) nearestPx = d;
        }
      }
      const idleForMs = rt.lastInputAt ? now - rt.lastInputAt : 0;
      const next = stepBehaviorMood(rt.presence.behavior, { now, nearestMeshiPx: nearestPx, idleForMs });
      setBehaviorMood((prev) => (prev === next ? prev : next));
    };
    const id = window.setInterval(tick, 700);
    return () => {
      window.clearInterval(id);
      rt.presence.behavior.mood = null;
      // Reset the STATE too, or a mood set just before leaving (or switching
      // to the read-only Global view, where this effect early-returns) would
      // stick to the Meshi's face forever.
      setBehaviorMood(null);
    };
  }, [rtRef, viewer.canBroadcastPresence, isOwnMesh]);

  // --- The live room: broadcast where I am, receive everyone else ---
  useEffect(() => {
    // GLOBAL VIEW IS STRICTLY READ-ONLY: never broadcast presence, never poll
    // or stream the room, never DELETE on unmount. A Global viewer must not
    // be tracked, must not form a synthetic "global" presence room, and must
    // not surface mutual connections' live cursors — any of which would leak
    // viewer activity the zero-new-visibility invariant forbids. Disabling
    // only the POST is insufficient (the GET/SSE poll leak too), so the WHOLE
    // transport is never instantiated here — capability-by-construction.
    // viewMode is in the dep array, so switching mesh→global tears down the
    // prior room before this returns.
    if (!viewer.canBroadcastPresence) return;
    const rt = rtRef.current;
    let stopped = false;

    // Fresh room, fresh runtime state: no phantom visitors, stale
    // where-chips, or replayable action stamps carry across a room switch.
    // (The React roster/owner state is cleared in this effect's CLEANUP, so
    // the switch never renders the old room's Meshis into the new one.)
    rt.presence.sprites.clear();
    resetRoster(rt.presence.roster);
    rt.presence.info.clear();
    rt.presence.actionGate = createReplayGate();
    rt.presence.ownerHereWorld = null;
    rt.presence.ownerSeenAt = 0;

    // When the last DELIVERED payload arrived — the sweep's eviction
    // evidence. Both the SSE route and the transport dedupe byte-identical
    // payloads, so a payload-static room (everyone parked reading) delivers
    // zero frames while all members still heartbeat; the sweep must never
    // treat that silence as absence. Any real leave changes the payload and
    // produces a frame, so gating eviction on "a payload arrived AFTER this
    // member was last seen" keeps leavers fading on time without flapping
    // idle members.
    let lastPayloadAt = 0;

    /** Viewport fraction → world, converted ONCE at the edge (the sprite
     * machine speaks world only). Falls back to the camera centre. */
    const vpToWorld = (vp: { vx?: number; vy?: number } | undefined) => {
      const c = rt.containerEl;
      if (!c) return cameraCenterWorld(rt.camera);
      const vx = Math.min(0.97, Math.max(0.03, vp?.vx ?? 0.5));
      const vy = Math.min(0.95, Math.max(0.05, vp?.vy ?? 0.5));
      return unprojectPoint(rt.camera, c.clientWidth, c.clientHeight, vx * c.clientWidth, vy * c.clientHeight);
    };

    /** Map roster events to React state + room MOMENTS. Runs on every
     * payload AND on the sweep, so grace expiry never waits for traffic. */
    const applyRosterEvents = (events: RosterEvents, nowSeen: number) => {
      const meshOwner = rt.meshOwnerId;
      // Entering is a MOMENT: newcomers materialize with a burst (the layer
      // reads sprite.joinedAt), and your own mesh quietly announces them.
      for (const p of events.joined) {
        if (!viewUserId && p.viewingMesh === meshOwner && p.surface === "mesh") {
          onPresenceToast(`@${p.username} entered your mesh`);
          playSound("chime");
          // Your Meshi visibly delights at the new arrival.
          const o = rt.ownerWorldPos;
          spawnBurst(rt, o.x, o.y - 22, "wow", 4);
        }
      }
      // Leaving is a MOMENT too: departures fade out right where they stood.
      // The sprite's eased world spot is captured BEFORE it's forgotten.
      if (events.left.length) {
        const c = rt.containerEl;
        const leaves: LeavingMeshi[] = [];
        for (const q of events.left) {
          const sprite = rt.presence.sprites.get(q.userId);
          rt.presence.sprites.delete(q.userId);
          const world = sprite?.world ?? sprite?.target ?? null;
          if (world && c) {
            const s = projectPoint(rt.camera, c.clientWidth, c.clientHeight, world.x, world.y);
            leaves.push({
              key: `${q.userId}:${nowSeen}`,
              x: s.x + (sprite?.avoid.x ?? 0),
              y: s.y + (sprite?.avoid.y ?? 0),
              s: Math.max(0.5, Math.min(rt.camera.zoom, 2.2)),
              p: q,
            });
          }
        }
        if (leaves.length) {
          playSound("leave");
          setLeavingMeshis((cur) => [...cur, ...leaves]);
          const keys = new Set(leaves.map((l) => l.key));
          setTimeout(() => setLeavingMeshis((cur) => cur.filter((l) => !keys.has(l.key))), 780);
        }
      }
      // Owner presence has the same grace as everyone else — and the same
      // payload-evidence gate: only a delivered payload that no longer
      // carried the owner starts their clock, so an idle owner's heart
      // Meshi can't flap to sleep in a payload-static room.
      if (
        nowSeen - rt.presence.ownerSeenAt > PRESENCE_GRACE_MS &&
        lastPayloadAt > rt.presence.ownerSeenAt
      ) {
        rt.presence.ownerHereWorld = null;
        setOwnerLive(false);
      }
      pruneReplayGate(rt.presence.actionGate, nowSeen);
      // Re-render the Meshi layer only when the roster or someone's
      // appearance/mood changed — never for a bare position update (those
      // ride the sprite machine + domSync), so live movement stays smooth.
      if (events.changed) setRemotePresences(events.effective);
    };

    const processPayload = (data: { presences?: unknown }) => {
      const meshOwner = rt.meshOwnerId;
      if (stopped || !meshOwner) return;
      const list: RemotePresence[] = Array.isArray(data.presences) ? (data.presences as RemotePresence[]) : [];
      const online = list.filter((p) => p.isOnline);
      // Only people IN THIS ROOM appear as full Meshis. Connections online
      // elsewhere become discrete canvas indicators at their node. The owner
      // is represented once — by the heart Meshi (ownerLive below) — so
      // they're excluded from the roaming roster.
      const visible = online.filter((p) => p.viewingMesh === meshOwner && p.surface === "mesh" && p.userId !== meshOwner);
      const nowSeen = Date.now();
      lastPayloadAt = nowSeen;
      const isBaseline = rt.presence.roster.prevIds === null;

      // Sprites: one world-coordinate state machine per person. Mode/perch
      // transitions keep the eased position, so travel — never teleport —
      // is structural (see live/meshi-machine).
      for (const p of visible) {
        const watching = p.activeNodeId && rt.model?.nodes.has(p.activeNodeId) ? p.activeNodeId : null;
        let sprite = rt.presence.sprites.get(p.userId);
        if (!sprite) {
          const world = p.position ? { x: p.position.x, y: p.position.y } : vpToWorld(p.viewportPosition);
          // Baseline members were already here — no arrive burst for them.
          sprite = createSprite(isBaseline ? 0 : nowSeen, world);
          rt.presence.sprites.set(p.userId, sprite);
        }
        applySighting(sprite, {
          // World coordinates anchor their Meshi to the actual mesh, so it
          // stays put while you pan — and every viewer of this room sees
          // this person in the SAME spot. A heartbeat always carries a
          // position (a legitimate origin position included); the viewport
          // fraction is a first-sighting fallback only, converted to world
          // above so there is exactly ONE coordinate space.
          world: p.position ? { x: p.position.x, y: p.position.y } : null,
          perchNodeId: watching,
        });
      }

      // Is the owner actually IN THIS ROOM right now (browsing their own
      // mesh), versus merely online somewhere else? Their broadcast world
      // coordinate is the one truth every viewer shares.
      const ownerPresence = online.find(
        (p) => p.userId === meshOwner && p.viewingMesh === meshOwner && p.surface === "mesh",
      );
      if (ownerPresence) {
        rt.presence.ownerSeenAt = nowSeen;
        if (ownerPresence.position) {
          rt.presence.ownerHereWorld = { x: ownerPresence.position.x, y: ownerPresence.position.y };
        }
        setOwnerLive(true);
      }

      // Connections online ELSEWHERE: the canvas ring + where-chip data.
      // (The server already redacts "where" for anyone who hasn't opted in.)
      const visibleIds = new Set(visible.map((p) => p.userId));
      rt.presence.info.clear();
      for (const p of online) {
        if (visibleIds.has(p.userId)) continue;
        // The owner is shown by their heart Meshi — never as a ring/chip.
        if (p.userId === meshOwner) continue;
        rt.presence.info.set(p.userId, {
          where: p.surface === "mesh" ? p.viewingMesh : null,
          route: p.activeRoute ?? null,
        });
      }

      // Replay room actions through the versioned bus: dedupe by sender +
      // timestamp, baseline on the first payload, 12s age gate — and the
      // mixed-version rule: UNKNOWN VERBS ARE IGNORED (their dedupe slot is
      // still consumed, so they can't replay later either).
      for (const p of visible) {
        const ev = admitRoomAction(rt.presence.actionGate, p.userId, p.lastAction, nowSeen);
        if (!ev) continue;
        const sprite = rt.presence.sprites.get(p.userId);
        const at = sprite?.world ?? sprite?.target ?? null;
        if (ev.verb === "heart" || ev.verb === "fling") {
          if (!ev.targetId) continue;
          const target = rt.model?.nodes.get(ev.targetId);
          if (!target) continue;
          // A `heart` accompanies a real like write, so its landing ticks the
          // displayed count toward truth; a `fling` is a fun verb with NO
          // write behind it, so it spawns the non-counting variant — same
          // flight and flourish, Likes tick untouched.
          const spawn = ev.verb === "fling" ? spawnCosmeticHeart : spawnHeart;
          const ox = at ? at.x : target.dx;
          const oy = at ? at.y : target.dy - 220;
          spawn(rt, ox, oy, ev.targetId);
          // The comet trail — the reaction visibly travels from the SENDER
          // to its target (canvas fx layer; tier-budgeted, reduced-motion
          // skipped, hard-capped inside).
          spawnReactionTrail(rt, ox, oy, ev.targetId);
        } else if (at) {
          // Targetless flourish — blooms at the sender's Meshi.
          spawnBurst(rt, at.x, at.y - 12, ev.verb, 5);
        }
      }
      sealReplayBaseline(rt.presence.actionGate);

      applyRosterEvents(applySightings(rt.presence.roster, visible, nowSeen), nowSeen);
    };

    // The heartbeat body — what the room learns about you, each beat.
    const buildBody = (): Record<string, unknown> => {
      const p = prefsRef.current;
      return {
        meshiColor: p.color,
        meshiHat: p.hat,
        meshiHair: p.hair,
        meshiAccessory: p.accessory,
        meshiEyeStyle: p.eye,
        meshiBadge: p.badge,
        // No `meshiOutfit`: the wire (and the MeshPresence row behind it) still
        // carries the field, but the outfit cosmetic was retired platform-wide
        // — nothing sources it, since there is no such preference any more, and
        // nothing renders it, since the mascot has no such prop. Sending it
        // would only beat `undefined` at the room forever, so it is dropped
        // here rather than pretended at. Every other cosmetic still rides the
        // heartbeat unchanged, so hats and hair keep changing live.
        // Broadcast what you're DOING, not just your default face — the
        // ladder lives pure in live/mood.
        meshiMood: deriveBroadcastMood({
          now: Date.now(),
          pendingAction: rt.pendingAction,
          composing: rt.composing,
          hovering: !!rt.hoverId,
          nodeOpen: !!rt.selectedId,
          behaviorMood: rt.presence.behavior.mood,
          idleForMs: rt.lastInputAt ? performance.now() - rt.lastInputAt : 0,
          restingFace: p.face,
        }),
        viewportPosition: rt.coarse ? { vx: 0.5, vy: 0.5 } : rt.cursorVp,
        // Touch broadcasts the world point the camera is centred on; fine
        // pointers broadcast the cursor's world target.
        position: rt.coarse
          ? cameraCenterWorld(rt.camera)
          : { x: rt.cursorWorldTarget.x, y: rt.cursorWorldTarget.y },
        viewingMesh: rt.meshOwnerId,
        surface: "mesh",
        activeNodeId: rt.selectedId,
        ghostMode: readGhostMode(),
        // The opt-in "where" chip flag — server-enforced either way.
        shareWhere: readWhereShare(),
        // A recent world action rides along (versioned envelope; receivers
        // dedupe by its timestamp) until the room has had a chance to see it.
        action:
          rt.pendingAction && Date.now() - rt.pendingAction.at < ACTION_RIDE_MS
            ? encodeActionEnvelope({
                kind: rt.pendingAction.kind,
                targetId: rt.pendingAction.targetId,
                at: rt.pendingAction.at,
              })
            : null,
      };
    };

    const client = createPresenceClient({
      getRoom: () => rt.meshOwnerId,
      isVisible: () => document.visibilityState === "visible",
      buildBody,
      getMovement: () => {
        const cur = rt.coarse
          ? cameraCenterWorld(rt.camera)
          : { x: rt.cursorWorldTarget.x, y: rt.cursorWorldTarget.y };
        return { x: cur.x, y: cur.y, zoom: rt.camera.zoom };
      },
      onPayload: (data) => processPayload(data as { presences?: unknown }),
      onLink: (link) => setLiveLink(link),
    });
    client.start();
    rt.heartbeatNow = () => client.beat();

    // Grace expiry on our own clock: a leaver fades on time even when the
    // transport has gone quiet AFTER the frame that dropped them (the old
    // code only noticed on the next payload — strictly less jank now). The
    // sweep passes `lastPayloadAt` as eviction evidence: members whose
    // seenAt matches the last delivered payload are still here — a
    // payload-static room delivers no frames (byte-identical dedupe at both
    // the SSE route and the transport), and that silence must never fade
    // out people who are simply idle/reading.
    const sweep = setInterval(() => {
      if (stopped || rt.presence.roster.prevIds === null) return;
      const now = Date.now();
      applyRosterEvents(sweepRoster(rt.presence.roster, now, lastPayloadAt), now);
    }, 1000);

    // Wave hello on arrival. The mesh data loads asynchronously, so poll
    // until the room id is known, then greet ONCE per room: your Meshi waves
    // and the action rides the heartbeat so anyone already here sees you
    // walk in.
    const greet = setInterval(() => {
      const meshOwner = rt.meshOwnerId;
      if (!meshOwner || rt.presence.greetedRoom === meshOwner) return;
      if (!prefsRef.current.enabled || document.visibilityState !== "visible") return;
      rt.presence.greetedRoom = meshOwner;
      const o = !isOwnMesh ? rt.cursorWorldPos : rt.ownerWorldPos;
      spawnBurst(rt, o.x, o.y - 20, "wave", 5);
      rt.pendingAction = { kind: "wave", targetId: "", at: Date.now() };
      rt.heartbeatNow?.();
    }, 500);

    return () => {
      stopped = true;
      rt.heartbeatNow = null;
      clearInterval(sweep);
      clearInterval(greet);
      client.stop();
      // Never leak this room's roster or chips into the next view (the
      // read-only Global view must not inherit a stale info map, and a room
      // switch must not render the old room's Meshis into the new one).
      rt.presence.info.clear();
      setRemotePresences([]);
      setOwnerLive(false);
      setLiveLink("idle");
    };
  }, [rtRef, viewUserId, viewMode, viewer.canBroadcastPresence, isOwnMesh, onPresenceToast]);

  useEffect(() => {
    // A viewer who never broadcast presence (the read-only Global view) must
    // never DELETE it either — no authenticated write to the tracking
    // endpoint from a read-only surface. (On a mesh→global switch this
    // effect re-runs and the prior mesh cleanup correctly clears the
    // presence you had while on your mesh.)
    if (!viewer.canBroadcastPresence) return;
    return () => {
      fetch("/api/mesh/presence", { method: "DELETE" }).catch(() => {});
    };
  }, [viewer.canBroadcastPresence]);

  return { remotePresences, ownerLive, leavingMeshis, behaviorMood, liveLink };
}
