// useLivePresence — the mesh room: broadcast where I am (adaptive heartbeat +
// action piggyback), receive the room via SSE + poll safety net, hysteresis
// grace on every transition, join/leave moments, action replays, and your
// Meshi's ambient behaviour mood. Extracted AS-IS from the old mesh-scene.tsx
// (PR6 rebuilds this on live/presence-client.ts; this slice only moves it).

"use client";

import { useEffect, useState } from "react";
import type { MeshiMood } from "@/components/meshi/meshi-mascot";
import type { MeshiPreferences } from "@/hooks/use-meshi-preferences";
import { readGhostMode } from "@/lib/ghost-mode";
import { playSound } from "@/lib/sound";
import { cameraCenterWorld, projectPoint, unprojectPoint } from "../core/camera";
import type { ViewerCaps } from "../core/viewer";
import type { LeavingMeshi, MeshRuntimeRef, RemotePresence } from "../scene/runtime";
import { spawnBurst, spawnHeart } from "./hearts";

export interface LivePresence {
  remotePresences: RemotePresence[];
  ownerLive: boolean;
  leavingMeshis: LeavingMeshi[];
  behaviorMood: MeshiMood | null;
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
  // Whether the viewed mesh's owner is present IN THIS ROOM right now (browsing
  // their own mesh) — their heart Meshi wakes and tracks their real position on
  // this, and sleeps at home when they're away. Held through a short grace
  // window (see presence.ownerSeenAt) so one dropped heartbeat can't blink them out.
  const [ownerLive, setOwnerLive] = useState(false);
  // Join/leave moments: who just materialized, who's fading out.
  const [leavingMeshis, setLeavingMeshis] = useState<LeavingMeshi[]>([]);
  // A gentle mood driven by the room: warm when another Meshi is close, a
  // look-around fidget then a doze when you go quiet. null = your resting face.
  const [behaviorMood, setBehaviorMood] = useState<MeshiMood | null>(null);

  // Honour reduced-motion for the extra body-language (gaze lean): it stays on
  // the runtime so the per-frame loop reads it without re-subscribing.
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

  // Your Meshi's inner life, sampled a few times a second (never per frame, so
  // it costs almost nothing and never thrashes React): it warms up when another
  // Meshi drifts close, looks around when you've gone quiet, and dozes off if
  // you stay away. The chosen mood also rides your presence broadcast, so the
  // room sees you reacting to them too. The mood rides the presence
  // broadcast, so it only grows where the viewer may broadcast at all — the
  // read-only Global view grows no behaviours.
  useEffect(() => {
    if (!viewer.canBroadcastPresence) return;
    const rt = rtRef.current;
    const WARM: MeshiMood[] = ["giggle", "love", "wink", "happy"];
    let warmIdx = 0;
    const tick = () => {
      const now = performance.now();
      const self = rt.presence.selfScreen;
      let nearest = Infinity;
      if (self) {
        rt.presence.lastScreenPos.forEach((p) => {
          const d = Math.hypot(p.x - self.x, p.y - self.y);
          if (d < nearest) nearest = d;
        });
        // The host's Meshi counts as a neighbour when you're visiting them.
        if (!isOwnMesh && rt.presence.ownerScreen) {
          const d = Math.hypot(rt.presence.ownerScreen.x - self.x, rt.presence.ownerScreen.y - self.y);
          if (d < nearest) nearest = d;
        }
      }
      let next: MeshiMood | null = null;
      // Hysteresis: warm up when a neighbour comes within 118px, but stay warm
      // until they drift past 165px — so a Meshi hovering near the boundary
      // can't flip the face on and off between samples.
      const wasWarm = rt.presence.behaviorMood != null && WARM.includes(rt.presence.behaviorMood);
      if (self && nearest < (wasWarm ? 165 : 118)) {
        // Someone's right here — react warmly, but hold each beat so it reads
        // as a reaction rather than a flicker.
        if (now > rt.presence.socialUntil) {
          warmIdx = (warmIdx + 1) % WARM.length;
          rt.presence.socialUntil = now + 2600;
        }
        next = WARM[warmIdx];
      } else {
        rt.presence.socialUntil = 0;
        const idleFor = rt.lastInputAt ? now - rt.lastInputAt : 0;
        if (idleFor > 22000) next = "sleepy";
        else if (idleFor > 7000) next = Math.floor(now / 3400) % 2 === 0 ? "thinking" : "searching";
      }
      rt.presence.behaviorMood = next;
      setBehaviorMood((prev) => (prev === next ? prev : next));
    };
    const id = window.setInterval(tick, 700);
    return () => {
      window.clearInterval(id);
      rt.presence.behaviorMood = null;
      // Reset the STATE too, or a mood set just before leaving (or switching to
      // the read-only Global view, where this effect early-returns) would stick
      // to the Meshi's face forever.
      setBehaviorMood(null);
    };
  }, [rtRef, viewer.canBroadcastPresence, isOwnMesh]);

  // --- Live presence: broadcast where I am and show Meshis of users viewing this same mesh ---
  useEffect(() => {
    // GLOBAL VIEW IS STRICTLY READ-ONLY: never broadcast presence, never poll
    // or stream the room, never DELETE on unmount. A Global viewer must not be
    // tracked, must not form a synthetic "global" presence room, and must not
    // surface mutual connections' live cursors (isConnectedOnlineAnywhere) —
    // any of which would leak viewer activity the zero-new-visibility invariant
    // forbids. Disabling only the POST is insufficient (the GET/SSE poll leak
    // too), so the WHOLE effect no-ops here. viewMode is in the dep array, so
    // switching mesh→global tears down the prior room before this returns.
    if (!viewer.canBroadcastPresence) return;
    const rt = rtRef.current;
    let stopped = false;

    // One global throttle across every trigger (fast lane, hover blips,
    // action beats) so bursts can't stack into a POST flood.
    let lastBeatAt = 0;
    const heartbeat = async () => {
      const meshOwner = rt.meshOwnerId;
      if (!meshOwner || document.visibilityState !== "visible") return;
      const beatNow = Date.now();
      if (beatNow - lastBeatAt < 250) return;
      lastBeatAt = beatNow;
      const vp = rt.cursorVp;
      try {
        await fetch("/api/mesh/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meshiColor: prefs.color,
            meshiHat: prefs.hat,
            meshiHair: prefs.hair,
            meshiAccessory: prefs.accessory,
            meshiEyeStyle: prefs.eye,
            meshiBadge: prefs.badge,
            meshiOutfit: prefs.outfit,
            // Broadcast what you're DOING, not just your default face — this
            // is how others see you being alive on the internet. The richer the
            // read (smitten after a like, sleepy once you go quiet, focused
            // while you write), the more your Meshi feels like you.
            meshiMood: (() => {
              const nowM = Date.now();
              if (rt.pendingAction && nowM - rt.pendingAction.at < 4000) {
                // A heart-throw beams love; a wave or reaction burst reads as excited.
                return rt.pendingAction.kind === "heart" ? "love" : "excited";
              }
              if (rt.composing) return "thinking";
              if (rt.hoverId) return "excited";
              if (rt.selectedId) return "learning";
              // Your reaction to the room (warm when someone's near, a fidget or
              // doze when you're quiet) rides along so others see it too.
              if (rt.presence.behaviorMood) return rt.presence.behaviorMood;
              if (rt.lastInputAt && performance.now() - rt.lastInputAt > 15000) return "sleepy";
              return prefs.face;
            })(),
            viewportPosition: rt.coarse ? { vx: 0.5, vy: 0.5 } : vp,
            // Touch broadcasts the world point the camera is centred on;
            // fine pointers broadcast the cursor's world target.
            position: rt.coarse
              ? cameraCenterWorld(rt.camera)
              : { x: rt.cursorWorldTarget.x, y: rt.cursorWorldTarget.y },
            viewingMesh: meshOwner,
            surface: "mesh",
            activeNodeId: rt.selectedId,
            ghostMode: readGhostMode(),
            // A recent world action (heart-throw, reaction burst, or wave)
            // rides along until the room has had a chance to see it (receivers
            // dedupe by its timestamp).
            action:
              rt.pendingAction && Date.now() - rt.pendingAction.at < 8000
                ? {
                    type: rt.pendingAction.kind,
                    targetId: rt.pendingAction.targetId,
                    at: rt.pendingAction.at,
                  }
                : null,
          }),
        });
      } catch {
        // Presence is best-effort.
      }
    };
    rt.heartbeatNow = () => void heartbeat();

    const processPayload = (data: { presences?: unknown }) => {
      const meshOwner = rt.meshOwnerId;
      if (stopped || !meshOwner) return;
      {
        const list: RemotePresence[] = Array.isArray(data.presences) ? (data.presences as RemotePresence[]) : [];
        const online = list.filter((p) => p.isOnline);
        // Only people IN THIS ROOM appear as full Meshis. Connections online
        // elsewhere become discrete canvas indicators at their node — an
        // online ring plus a small chip naming the mesh they're exploring.
        // The owner is represented once — by the static owner Meshi at the
        // heart (see setOwnerLive below). Exclude them from the roaming
        // live-presence roster so a friend browsing their OWN mesh from another
        // session doesn't ALSO appear as a second, wandering copy of themselves.
        const visible = online.filter((p) => p.viewingMesh === meshOwner && p.surface === "mesh" && p.userId !== meshOwner);
        const visibleIds = new Set(visible.map((p) => p.userId));

        // Presence hysteresis. A Meshi only LEAVES once it's been absent for a
        // grace window — so a single dropped payload (the 2s poll and the SSE
        // stream landing on different serverless instances, or an SSE reconnect
        // onto a cold instance) can't make the whole room blink out and back.
        // Sightings register instantly; only sustained absence removes anyone.
        const nowSeen = Date.now();
        const PRESENCE_GRACE_MS = 4500;
        for (const p of visible) {
          rt.presence.seenAt.set(p.userId, nowSeen);
          rt.presence.obj.set(p.userId, p);
        }
        const effectiveVisible: RemotePresence[] = [];
        for (const [id, seenAt] of rt.presence.seenAt) {
          if (nowSeen - seenAt > PRESENCE_GRACE_MS) {
            rt.presence.seenAt.delete(id);
            rt.presence.obj.delete(id);
            continue;
          }
          const obj = visibleIds.has(id) ? null : rt.presence.obj.get(id);
          if (obj) effectiveVisible.push(obj);
        }
        // Fresh sightings first (live data), then the still-in-grace stragglers.
        effectiveVisible.unshift(...visible);
        const effectiveIds = new Set(effectiveVisible.map((p) => p.userId));
        // Is the owner actually IN THIS ROOM right now (browsing their own mesh),
        // versus merely online somewhere else on mesh.me? Their Meshi should read
        // as awake-and-present only when they're genuinely here — otherwise it
        // rests at their home node as a calm "away" marker instead of looking
        // like they're idling at their own center. When they ARE here, their
        // broadcast world coordinate is the one truth every viewer shares, so we
        // capture it and their dedicated heart Meshi tracks them for real.
        const ownerPresence = online.find(
          (p) => p.userId === meshOwner && p.viewingMesh === meshOwner && p.surface === "mesh",
        );
        if (ownerPresence) {
          rt.presence.ownerSeenAt = nowSeen;
          if (ownerPresence.position) {
            rt.presence.ownerHereWorld = { x: ownerPresence.position.x, y: ownerPresence.position.y };
          }
          setOwnerLive(true);
        } else if (nowSeen - rt.presence.ownerSeenAt > PRESENCE_GRACE_MS) {
          // Absent past the grace window → they've really left the room.
          rt.presence.ownerHereWorld = null;
          setOwnerLive(false);
        }
        // else: within grace — keep the last known position and awake state.
        rt.presence.info.clear();
        for (const p of online) {
          if (visibleIds.has(p.userId)) continue;
          // The owner is shown by their static heart Meshi — never as an
          // "online elsewhere" ring/chip on their own node.
          if (p.userId === meshOwner) continue;
          rt.presence.info.set(p.userId, {
            where: p.surface === "mesh" ? p.viewingMesh : null,
            route: p.activeRoute ?? null,
          });
        }

        // Replay room actions: someone's Meshi threw a heart at a post (it
        // flies from their Meshi and ticks the count on landing), reacted with
        // a star/spark/wow burst, or waved hello on arrival (a flourish that
        // blooms at their Meshi). The first poll only records a baseline so
        // stale actions never replay.
        for (const p of visible) {
          if (!p.lastAction) continue;
          const [kind, targetId, atRaw] = p.lastAction.split("|");
          const at = Number(atRaw);
          if (!kind || !Number.isFinite(at)) continue;
          const prevAt = rt.presence.seenActions.get(p.userId) ?? 0;
          if (at <= prevAt) continue;
          rt.presence.seenActions.set(p.userId, at);
          if (!rt.presence.actionBaseline) continue;
          if (Date.now() - at > 12000) continue;

          // Where the sender's Meshi sits in world units — a heart launches
          // from here, a burst blooms here.
          let sx: number | null = null;
          let sy: number | null = null;
          const world =
            rt.presence.worldPos.get(p.userId) ?? rt.presence.world.get(p.userId);
          const c = rt.containerEl;
          const cam = rt.camera;
          if (world) {
            sx = world.x;
            sy = world.y;
          } else {
            // Perched or viewport-anchored: unproject their current screen spot.
            const perch = rt.presence.perchPos.get(p.userId);
            if (perch && c) {
              const w = unprojectPoint(cam, c.clientWidth, c.clientHeight, perch.x, perch.y);
              sx = w.x;
              sy = w.y;
            } else {
              const vp =
                rt.presence.pos.get(p.userId) ?? rt.presence.targets.get(p.userId);
              if (vp && c) {
                const w = unprojectPoint(cam, c.clientWidth, c.clientHeight, vp.vx * c.clientWidth, vp.vy * c.clientHeight);
                sx = w.x;
                sy = w.y;
              }
            }
          }

          if (kind === "heart") {
            if (!targetId) continue;
            const target = rt.model?.nodes.get(targetId);
            if (!target) continue;
            if (sx != null && sy != null) {
              spawnHeart(rt, sx, sy, targetId);
            } else {
              spawnHeart(rt, target.dx, target.dy - 220, targetId);
            }
          } else if (kind === "star" || kind === "spark" || kind === "wow" || kind === "wave") {
            // Targetless flourish — only replay when we know where they are, so
            // it never blooms at a wrong spot.
            if (sx != null && sy != null) spawnBurst(rt, sx, sy - 12, kind, 5);
          }
        }
        rt.presence.actionBaseline = true;
        for (const p of visible) {
          // What is this person DOING? Reading a specific post pins their
          // Meshi to that post (visibly watching it); otherwise they roam
          // the room as a live cursor. Mode changes hand off the last drawn
          // position so a Meshi always TRAVELS to its next spot — never
          // teleports.
          const watching =
            p.activeNodeId && rt.model?.nodes.has(p.activeNodeId) ? p.activeNodeId : null;
          const inRoom = !watching;
          const nextMode: "room" | "perch" = watching ? "perch" : "room";
          const nextPerch = watching ?? "";
          const prevMode = rt.presence.mode.get(p.userId);
          const prevPerch = rt.presence.perchNode.get(p.userId);
          if (
            prevMode !== undefined &&
            (prevMode !== nextMode || (nextMode === "perch" && prevPerch !== nextPerch))
          ) {
            const last = rt.presence.lastScreenPos.get(p.userId);
            const c = rt.containerEl;
            const cam = rt.camera;
            if (last && c) {
              const worldFromLast = unprojectPoint(cam, c.clientWidth, c.clientHeight, last.x, last.y);
              if (nextMode === "room") {
                rt.presence.worldPos.set(p.userId, worldFromLast);
              } else {
                rt.presence.perchWorldPos.set(p.userId, worldFromLast);
                rt.presence.perchPos.set(p.userId, { x: last.x, y: last.y });
              }
            }
          }
          rt.presence.mode.set(p.userId, nextMode);
          rt.presence.perchNode.set(p.userId, nextPerch);
          if (inRoom) {
            // World coordinates anchor their Meshi to the actual mesh, so it
            // stays put on the web while you pan — and, crucially, so EVERY
            // viewer of this room sees this person in the SAME spot. Anyone in
            // the room is world-anchored, including someone resting at the
            // heart (world origin): a heartbeat always carries a position, so
            // we use it directly. (The old guard treated a legitimate origin
            // position as "unset" and fell back to a fraction of the VIEWER's
            // own screen, which put the same person in a different place on
            // every screen — the "their Meshi isn't where they are" bug.)
            if (p.position) {
              rt.presence.world.set(p.userId, { x: p.position.x, y: p.position.y });
              rt.presence.targets.delete(p.userId);
            } else if (!rt.presence.world.has(p.userId)) {
              rt.presence.targets.set(p.userId, {
                vx: Math.min(0.97, Math.max(0.03, p.viewportPosition?.vx ?? 0.5)),
                vy: Math.min(0.95, Math.max(0.05, p.viewportPosition?.vy ?? 0.5)),
              });
            }
          } else {
            rt.presence.targets.delete(p.userId);
            rt.presence.world.delete(p.userId);
          }
        }
        // Entering and leaving are MOMENTS: newcomers materialize with a
        // burst, departures fade out right where they stood, and your own
        // mesh quietly announces who walked in. (Positions are captured here,
        // before the cleanup below forgets them.)
        const prevIds = rt.presence.prevIds;
        if (prevIds) {
          for (const p of effectiveVisible) {
            if (prevIds.has(p.userId)) continue;
            rt.presence.joinStamp.set(p.userId, Date.now());
            if (!viewUserId && p.viewingMesh === meshOwner && p.surface === "mesh") {
              onPresenceToast(`@${p.username} entered your mesh`);
              playSound("chime");
              // Your Meshi visibly delights at the new arrival.
              const o = rt.ownerWorldPos;
              spawnBurst(rt, o.x, o.y - 22, "wow", 4);
            }
          }
          const departed = rt.presence.prevList.filter((q) => !effectiveIds.has(q.userId));
          if (departed.length) {
            const c = rt.containerEl;
            const cam = rt.camera;
            const leaves: LeavingMeshi[] = [];
            for (const q of departed) {
              let x: number | null = null;
              let y: number | null = null;
              const world = rt.presence.worldPos.get(q.userId) ?? rt.presence.world.get(q.userId);
              if (world && c) {
                const s = projectPoint(cam, c.clientWidth, c.clientHeight, world.x, world.y);
                x = s.x;
                y = s.y;
              } else {
                const perch = rt.presence.perchPos.get(q.userId);
                if (perch) {
                  x = perch.x;
                  y = perch.y;
                } else {
                  // Viewport-anchored visitor (never broadcast a world spot).
                  const vp = rt.presence.pos.get(q.userId) ?? rt.presence.targets.get(q.userId);
                  if (vp && c) {
                    x = vp.vx * c.clientWidth;
                    y = vp.vy * c.clientHeight;
                  }
                }
              }
              if (x != null && y != null) {
                leaves.push({
                  key: `${q.userId}:${Date.now()}`,
                  x,
                  y,
                  s: Math.max(0.5, Math.min(cam.zoom, 2.2)),
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
        }
        rt.presence.prevIds = effectiveIds;
        rt.presence.prevList = effectiveVisible;

        rt.presence.targets.forEach((_, id) => {
          if (!effectiveIds.has(id)) {
            rt.presence.targets.delete(id);
            rt.presence.pos.delete(id);
          }
        });
        rt.presence.mode.forEach((_, id) => {
          if (!effectiveIds.has(id)) {
            rt.presence.mode.delete(id);
            rt.presence.perchPos.delete(id);
            rt.presence.perchWorldPos.delete(id);
            rt.presence.world.delete(id);
            rt.presence.worldPos.delete(id);
            rt.presence.avoidOffset.delete(id);
            // Pure position/animation bookkeeping — safe to forget on departure
            // (long sessions would otherwise accumulate every visitor ever).
            rt.presence.perchNode.delete(id);
            rt.presence.lastScreenPos.delete(id);
            rt.presence.look.delete(id);
            rt.presence.joinStamp.delete(id);
          }
        });
        // Action-dedupe entries must OUTLIVE a brief departure (a flickering
        // visitor's heart would replay on rejoin), so prune by age instead:
        // anything older than 60s is far beyond the 12s replay gate.
        rt.presence.seenActions.forEach((at, id) => {
          if (nowSeen - at > 60000) rt.presence.seenActions.delete(id);
        });

        // Re-render the Meshi layer only when the roster or someone's
        // appearance/mood changes — never for a bare position update (those
        // ride the imperative glide loop), so live movement stays smooth.
        const sig = effectiveVisible
          .map(
            (p) =>
              `${p.userId}:${p.meshiColor}:${p.meshiHat}:${p.meshiHair}:${p.meshiAccessory}:${p.meshiEyeStyle}:${p.meshiBadge}:${p.meshiOutfit}:${p.meshiMood}:${p.isPro ? 1 : 0}:${p.username}`,
          )
          .sort()
          .join("|");
        if (sig !== rt.presence.remoteSig) {
          rt.presence.remoteSig = sig;
          setRemotePresences(effectiveVisible);
        }
      }
    };

    const poll = async () => {
      const meshOwner = rt.meshOwnerId;
      if (!meshOwner || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/mesh/presence?meshOwner=${encodeURIComponent(meshOwner)}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (stopped || !data) return;
        processPayload(data);
      } catch {
        // Presence is best-effort.
      }
    };

    // INSTANT lane: the presence stream pushes the room's every movement the
    // moment the server sees it. The poll stays as the cross-instance safety
    // net (serverless instances can't always signal each other).
    let es: EventSource | null = null;
    const openStream = () => {
      if (es || stopped) return;
      const meshOwner = rt.meshOwnerId;
      if (!meshOwner) return;
      try {
        es = new EventSource(`/api/mesh/presence/stream?meshOwner=${encodeURIComponent(meshOwner)}`);
        es.addEventListener("presence", (e) => {
          try {
            processPayload(JSON.parse((e as MessageEvent).data));
          } catch {
            // Malformed frame — the next push or poll corrects it.
          }
        });
        // EventSource retries transient drops itself, but a FATAL close (auth
        // expiry, proxy giving up) parks it at CLOSED forever — and with `es`
        // still truthy, openStream would never reopen. Release the slot so the
        // esKick interval can establish a fresh stream.
        es.onerror = () => {
          if (es && es.readyState === EventSource.CLOSED) {
            es.close();
            es = null;
          }
        };
      } catch {
        es = null;
      }
    };
    const esKick = setInterval(openStream, 1200);

    // Adaptive heartbeat: while the cursor is actually moving, broadcast at
    // ~350ms so the room sees live motion instead of 2-second snapshots; when
    // idle, drop to a slow keepalive. Movement is measured in world units so
    // zoom level doesn't change the threshold's feel.
    let lastSent = { x: Number.NaN, y: Number.NaN };
    let lastFullBeat = 0;
    const hb = setInterval(() => {
      const now = Date.now();
      const cur = rt.coarse
        ? cameraCenterWorld(rt.camera)
        : { x: rt.cursorWorldTarget.x, y: rt.cursorWorldTarget.y };
      const moved = Math.hypot(cur.x - lastSent.x, cur.y - lastSent.y);
      const due = now - lastFullBeat >= 2000;
      if (!due && !(moved > 6 / Math.max(rt.camera.zoom, 0.2))) return;
      lastSent = cur;
      lastFullBeat = now;
      void heartbeat();
    }, 350);
    const pl = setInterval(poll, 2000);
    const kick = setTimeout(() => {
      void heartbeat();
      void poll();
      openStream();
    }, 400);

    // Wave hello on arrival. The mesh data loads asynchronously, so poll until
    // the room id is known, then greet ONCE per room: your Meshi waves and the
    // action rides the heartbeat so anyone already here sees you walk in.
    const greet = setInterval(() => {
      const meshOwner = rt.meshOwnerId;
      if (!meshOwner || rt.presence.greetedRoom === meshOwner) return;
      if (!prefs.enabled || document.visibilityState !== "visible") return;
      rt.presence.greetedRoom = meshOwner;
      const o = !isOwnMesh ? rt.cursorWorldPos : rt.ownerWorldPos;
      spawnBurst(rt, o.x, o.y - 20, "wave", 5);
      rt.pendingAction = { kind: "wave", targetId: "", at: Date.now() };
      rt.heartbeatNow?.();
    }, 500);

    return () => {
      stopped = true;
      rt.heartbeatNow = null;
      clearInterval(hb);
      clearInterval(pl);
      clearInterval(esKick);
      clearInterval(greet);
      clearTimeout(kick);
      es?.close();
    };
  }, [rtRef, viewUserId, viewMode, viewer.canBroadcastPresence, isOwnMesh, prefs.enabled, prefs.color, prefs.hat, prefs.hair, prefs.accessory, prefs.eye, prefs.badge, prefs.outfit, prefs.face, onPresenceToast]);

  useEffect(() => {
    // A viewer who never broadcast presence (the read-only Global view) must
    // never DELETE it either — no authenticated write to the tracking
    // endpoint from a read-only surface. (On a mesh→global switch this effect
    // re-runs and the prior mesh cleanup correctly clears the presence you
    // had while on your mesh.)
    if (!viewer.canBroadcastPresence) return;
    return () => {
      fetch("/api/mesh/presence", { method: "DELETE" }).catch(() => {});
    };
  }, [viewer.canBroadcastPresence]);

  return { remotePresences, ownerLive, leavingMeshis, behaviorMood };
}
