"use client";

/**
 * Live presence for the ring field.
 *
 * The old surface's presence hook (`mesh/live/use-live-presence`) is welded to
 * the canvas runtime: it reads a camera, projects world points, and writes into
 * a mutable scene ref. None of that survives here, because this field has no
 * camera and no world — it lays out in viewport space.
 *
 * What DOES survive, unchanged, is everything that was never really about the
 * canvas:
 *
 *   - `live/presence-client` — the heartbeat/SSE/poll transport. Fully
 *     injectable, zero runtime imports.
 *   - `live/roster`        — sighting reconciliation, appearance signatures,
 *                            and the grace period that stops people flickering.
 *   - `live/meshi-machine` — the eased "travel, never teleport" glide. It eases
 *                            plain numbers against a caller-supplied max step,
 *                            so feeding it PIXELS instead of world units is a
 *                            unit change, not a port.
 *   - `lib/ghost-mode` / `lib/where-share` — the privacy flags.
 *
 * Rebuilding any of those would have meant a second copy of a rule that already
 * has one home, so this hook asks them instead of re-deciding.
 *
 * The wire format needed no change either: `RemotePresence.viewportPosition`
 * is already normalised 0..1, so it survives the loss of the world coordinate
 * system intact — and it is in fact the BETTER channel of the two, because two
 * clients on differently-sized screens agree about a normalised point while
 * they never agreed about a world one.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MeshiPreferences } from "@/hooks/use-meshi-preferences";
import { readGhostMode } from "@/lib/ghost-mode";
import { readWhereShare } from "@/lib/where-share";
import { createSprite, stepSpriteToward, type MeshiSprite } from "@/components/mesh/live/meshi-machine";
import { deriveBroadcastMood } from "@/components/mesh/live/mood";
import { createPresenceClient, type LiveLink } from "@/components/mesh/live/presence-client";
import { readRoomPeople } from "@/components/mesh/live/room-payload";
import {
  applySightings,
  createRoster,
  sweepRoster,
  type RemotePresence,
} from "@/components/mesh/live/roster";

/** Pixels per second a Meshi may glide. Tuned for viewport-space travel: fast
 * enough not to lag a heartbeat, slow enough to read as walking. */
const GLIDE_PX_PER_S = 420;

/** How long a Meshi may drift before the mood ladder calls it idle. */
const SWEEP_MS = 1000;

export interface FieldPresenceOptions {
  /** Whose mesh this is — the room. Null until the page knows. */
  roomUserId: string | null;
  /** The signed-in viewer, excluded from the roaming roster (their own Meshi
   * is drawn locally at their cursor — no round trip, and no duplicate). */
  viewerId: string | null;
  /** Cosmetics to broadcast. Null while preferences are still loading. */
  prefs: MeshiPreferences | null;
  /** The field element — positions are relative to its box. */
  containerRef: { current: HTMLElement | null };
  /** The node the viewer is reading, broadcast so others can perch nearby. */
  activeNodeId?: string | null;
  /** Whether a node is hovered — feeds the broadcast mood ladder. */
  hovering?: boolean;
  enabled?: boolean;
}

export interface FieldPresence {
  /** Everyone else in this room. Object identities are stable while a
   * person's appearance is unchanged, so `memo` on a Meshi actually holds. */
  people: RemotePresence[];
  link: LiveLink;
  /** Ref factory: hand each Meshi's element back so the glide loop can write
   * its transform directly. Positions never pass through React — a 60fps
   * re-render of the whole field would cost more than the field is worth. */
  registerNode: (userId: string) => (el: HTMLElement | null) => void;
}

export function useFieldPresence(options: FieldPresenceOptions): FieldPresence {
  const { roomUserId, viewerId, prefs, containerRef, activeNodeId = null, hovering = false, enabled = true } = options;

  const [people, setPeople] = useState<RemotePresence[]>([]);
  const [link, setLink] = useState<LiveLink>("idle");

  // Everything the render loop touches lives in refs — the loop must not be a
  // reason to re-render.
  const rosterRef = useRef(createRoster());
  const spritesRef = useRef(new Map<string, MeshiSprite>());
  const nodesRef = useRef(new Map<string, HTMLElement | null>());
  const refCbRef = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const sizeRef = useRef({ w: 0, h: 0 });
  const cursorVpRef = useRef({ vx: 0.5, vy: 0.5 });
  const coarseRef = useRef(false);
  const lastInputAtRef = useRef(0);

  // Live mirrors of props the transport callbacks close over once. Seeded at
  // their first value and refreshed after every render — the refresh is an
  // effect rather than an assignment during render, which React forbids.
  // Declared BEFORE the transport effect so the mirrors are already current
  // the first time a heartbeat is built.
  const prefsRef = useRef(prefs);
  const roomRef = useRef(roomUserId);
  const viewerRef = useRef(viewerId);
  const activeNodeRef = useRef(activeNodeId);
  const hoveringRef = useRef(hovering);
  useEffect(() => {
    prefsRef.current = prefs;
    roomRef.current = roomUserId;
    viewerRef.current = viewerId;
    activeNodeRef.current = activeNodeId;
    hoveringRef.current = hovering;
  });

  const registerNode = useCallback((userId: string) => {
    let cb = refCbRef.current.get(userId);
    if (!cb) {
      // Stable per user, or React would detach and re-attach every render.
      cb = (el: HTMLElement | null) => {
        if (el) nodesRef.current.set(userId, el);
        else nodesRef.current.delete(userId);
      };
      refCbRef.current.set(userId, cb);
    }
    return cb;
  }, []);

  // Track the container's box so normalised broadcasts can become pixels.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      sizeRef.current = { w: r.width, h: r.height };
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  // Track the viewer's pointer in the field's own normalised space. Coarse
  // pointers have no hover position at all, so they broadcast the centre —
  // the same concession the canvas made, for the same reason.
  useEffect(() => {
    if (!enabled) return;
    coarseRef.current = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
    const onMove = (e: PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      cursorVpRef.current = {
        vx: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
        vy: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
      };
      lastInputAtRef.current = performance.now();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled, containerRef]);

  // The transport. One client for the life of the room.
  useEffect(() => {
    if (!enabled || !roomUserId) return;
    let stopped = false;
    let lastPayloadAt = 0;

    const publish = () => {
      if (stopped) return;
      // A new array each time, but the ENTRIES keep their identity while their
      // appearance signature holds — that is what makes memoisation work.
      setPeople(Array.from(rosterRef.current.entries.values()));
    };

    const client = createPresenceClient({
      getRoom: () => roomRef.current,
      isVisible: () => document.visibilityState === "visible",
      buildBody: () => {
        const p = prefsRef.current;
        const vp = coarseRef.current ? { vx: 0.5, vy: 0.5 } : cursorVpRef.current;
        return {
          meshiColor: p?.color,
          meshiHat: p?.hat,
          meshiHair: p?.hair,
          meshiAccessory: p?.accessory,
          meshiEyeStyle: p?.eye,
          meshiBadge: p?.badge,
          // No `meshiOutfit`: the wire carries the field, but nothing sources
          // it (there is no such preference) and nothing renders it (the
          // mascot has no such prop). The old surface sent `undefined` here
          // every beat; this just stops pretending.
          meshiMood: deriveBroadcastMood({
            now: Date.now(),
            pendingAction: null,
            composing: false,
            hovering: hoveringRef.current,
            nodeOpen: !!activeNodeRef.current,
            behaviorMood: null,
            idleForMs: lastInputAtRef.current ? performance.now() - lastInputAtRef.current : 0,
            restingFace: p?.face ?? "happy",
          }),
          viewportPosition: vp,
          viewingMesh: roomRef.current,
          surface: "mesh",
          activeNodeId: activeNodeRef.current,
          ghostMode: readGhostMode(),
          shareWhere: readWhereShare(),
        };
      },
      // Movement is measured in the same normalised space it is sent in, so
      // the transport's threshold stays meaningful. Zoom is constant here —
      // this field does not have one.
      getMovement: () => {
        const vp = coarseRef.current ? { vx: 0.5, vy: 0.5 } : cursorVpRef.current;
        return { x: vp.vx, y: vp.vy, zoom: 1 };
      },
      onPayload: (data) => {
        if (stopped) return;
        const room = roomRef.current;
        if (!room) return;
        // Admission is decided in ONE place for every surface that draws
        // bodies (live/room-payload) — this hook used to hold the only correct
        // copy while the room held a broken one, and a rule that exists twice
        // is only ever guarded once.
        const visible = readRoomPeople(data, { room, viewerId: viewerRef.current });
        const now = Date.now();
        lastPayloadAt = now;
        const isBaseline = rosterRef.current.prevIds === null;

        for (const p of visible) {
          let sprite = spritesRef.current.get(p.userId);
          if (!sprite) {
            const { w, h } = sizeRef.current;
            // Seed AT the broadcast point: someone already here appears where
            // they are rather than sliding in from a corner.
            sprite = createSprite(isBaseline ? 0 : now, {
              x: p.viewportPosition.vx * w,
              y: p.viewportPosition.vy * h,
            });
            spritesRef.current.set(p.userId, sprite);
          }
          // Target only — `world` is untouched, which is the no-teleport
          // guarantee the machine documents.
          const { w, h } = sizeRef.current;
          sprite.target.x = p.viewportPosition.vx * w;
          sprite.target.y = p.viewportPosition.vy * h;
        }

        applySightings(rosterRef.current, visible, now);
        publish();
      },
      onLink: (l) => setLink(l),
    });
    client.start();

    // Grace expiry on our own clock, so a leaver fades on time even when the
    // transport has gone quiet. `lastPayloadAt` is the eviction evidence: a
    // payload-static room delivers no frames, and that silence must never fade
    // out people who are simply reading.
    const sweep = setInterval(() => {
      if (stopped || rosterRef.current.prevIds === null) return;
      const now = Date.now();
      const events = sweepRoster(rosterRef.current, now, lastPayloadAt);
      if (events.left.length) {
        for (const p of events.left) spritesRef.current.delete(p.userId);
        publish();
      }
    }, SWEEP_MS);

    // Captured now rather than read in the cleanup: the Map identity is stable
    // for the life of the hook, but reading `.current` at teardown is the
    // pattern that goes wrong when it isn't, so it is not worth the exception.
    const sprites = spritesRef.current;
    return () => {
      stopped = true;
      clearInterval(sweep);
      client.stop();
      rosterRef.current = createRoster();
      sprites.clear();
      setPeople([]);
    };
  }, [enabled, roomUserId]);

  // The glide loop. Writes transforms straight to the DOM; no React involved.
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let last = performance.now();
    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const maxStep = GLIDE_PX_PER_S * dt;
      spritesRef.current.forEach((sprite, userId) => {
        const el = nodesRef.current.get(userId);
        if (!el) return;
        const pos = stepSpriteToward(sprite, sprite.target.x, sprite.target.y, dt, maxStep);
        el.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  return useMemo(() => ({ people, link, registerNode }), [people, link, registerNode]);
}
