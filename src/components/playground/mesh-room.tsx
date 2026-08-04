"use client";

// THE PLAYGROUND. A PLACE, NOT A CHART.
//
// Three attempts at this surface were infographics: a ring of urgency, then a
// hub of platforms. Both answered "what is going on with YOU", and both were
// solo. This is the actual product — a room your Meshi stands in, that other
// people's Meshis stand in at the same time, where being seen is the point.
//
// The Club Penguin mechanic is the specific thing that was missing, and it is
// not a camera panning over a diagram: YOU CLICK, YOUR BODY WALKS THERE, AND
// EVERYONE IN THE ROOM WATCHES IT HAPPEN. Movement is the social act. Take it
// away and you have a chart with faces on it, which is what I kept building.
//
// ── EVERYTHING HARD HERE WAS ALREADY BUILT ─────────────────────────────────
//
// None of the transport is new. `presence-client` runs the heartbeat and the
// stream with the reconnect and backoff already tuned; `roster` reconciles
// sightings and holds the grace period that stops people flickering when a
// single payload drops; `meshi-machine` eases a body toward a target so it
// TRAVELS instead of teleporting. This wires them to a room and draws it.
//
// ── WHY POSITIONS ARE NORMALISED, NOT PIXELS ───────────────────────────────
//
// A room is a shared space, so two people on a phone and a monitor have to
// agree about where somebody is standing. `viewportPosition` is already 0..1
// on the wire; pixels would put you by the fountain on one screen and in the
// wall on another. Everything below is in that space until the last moment.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";
import { useMeshiPreferences } from "@/hooks/use-meshi-preferences";
import { createPresenceClient } from "@/components/mesh/live/presence-client";
import { applySightings, createRoster, sweepRoster, type RemotePresence } from "@/components/mesh/live/roster";
import { readRoomPeople } from "@/components/mesh/live/room-payload";
import { applySighting, createSprite, stepSpriteToward, type MeshiSprite } from "@/components/mesh/live/meshi-machine";
import { setCanvasMeshi } from "@/components/mesh/live/meshi-presence";

/** Something standing in the room that is not a person — a post, a platform,
 * whatever the room is about. Walkable-to, not clickable-through. */
export type RoomProp = {
  id: string;
  label: string;
  /** Normalised room position, so props sit in the same place for everyone. */
  vx: number;
  vy: number;
  href?: string;
  imageUrl?: string | null;
};

export function MeshRoom({
  roomUserId,
  roomLabel,
  viewerId,
  props: roomProps,
}: {
  /** Whose room this is. Presence is scoped to it — walking into someone
   * else's mesh means appearing in THEIR room, which is the whole point. */
  roomUserId: string;
  roomLabel: string;
  viewerId: string | null;
  props: RoomProp[];
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const floorRef = useRef<HTMLDivElement | null>(null);
  const meRef = useRef<HTMLDivElement | null>(null);
  const prefs = useMeshiPreferences();

  // ── THE FLOOR IS NOT THE ELEMENT ─────────────────────────────────────────
  //
  // The room fills its container, and the app's own chrome floats ON TOP of
  // it: a 72px sticky header on desktop, a 56px tab bar at the bottom of a
  // phone. Measured, not guessed — the room element's box starts at y=0 with
  // the header covering its first 72px, so anyone standing at vy≈0.02 was
  // literally behind the search bar, and on a phone vy≈0.98 was behind the
  // tab bar. A body you cannot see is not presence.
  //
  // So normalised 0..1 maps onto a SAFE BOX inset by whatever actually
  // overlaps, rather than onto the raw element. Furniture and bodies both map
  // through the same box, so the shared space stays consistent — only the
  // pixels differ per device, which was already true of any two screen sizes.
  const [inset, setInset] = useState({ top: 0, bottom: 0 });
  useEffect(() => {
    const measure = () => {
      const host = hostRef.current;
      if (!host) return;
      const box = host.getBoundingClientRect();
      let top = 0;
      let bottom = 0;
      // Selectors rather than fixed heights: the header grows on some
      // breakpoints and the tab bar carries a safe-area inset on notched
      // phones, so anything hardcoded is wrong on some real device.
      for (const selector of ["header.mesh-topbar", ".mobile-bottom-nav"]) {
        const el = document.querySelector(selector);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.height <= 0) continue;
        // Only the part that actually overlaps this room counts.
        if (r.bottom > box.top && r.top <= box.top) top = Math.max(top, r.bottom - box.top);
        if (r.top < box.bottom && r.bottom >= box.bottom) bottom = Math.max(bottom, box.bottom - r.top);
      }
      setInset((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
    };
    measure();
    window.addEventListener("resize", measure);
    // The chrome itself changes size (mobile nav hides on scroll, safe areas
    // shift on rotate), and a ResizeObserver on the room alone would miss it.
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (observer && hostRef.current) observer.observe(hostRef.current);
    for (const selector of ["header.mesh-topbar", ".mobile-bottom-nav"]) {
      const el = document.querySelector(selector);
      if (observer && el) observer.observe(el);
    }
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, []);

  // ── EVERYTHING THAT CHANGES EVERY FRAME LIVES IN REFS ────────────────────
  //
  // A busy room repainting React 60 times a second is a slideshow. Positions
  // are written straight to element transforms; React only runs when the SET
  // of people changes, which is rare.
  const roster = useRef(createRoster());
  const sprites = useRef(new Map<string, MeshiSprite>());
  const elements = useRef(new Map<string, HTMLDivElement>());
  // Which way each remote body is walking, so people face their direction of
  // travel instead of always facing right. Screen-only, so it stays out of the
  // sprite record and off the wire.
  const remoteFacing = useRef(new Map<string, number>());
  // Where I am and where I am heading, in room space.
  const me = useRef({ x: 0.5, y: 0.62 });
  const target = useRef({ x: 0.5, y: 0.62 });
  const facing = useRef(1);
  // WHEN A PAYLOAD LAST LANDED — the eviction evidence the roster requires.
  // Both the stream and the client dedupe byte-identical payloads, so a room
  // where everyone is parked and reading delivers ZERO frames while every
  // member is still heartbeating. Sweeping against `now` (the default) reads
  // that silence as absence and fades out people who never left. Zero until
  // the first payload, which also means nobody can be evicted before one.
  const lastPayloadAt = useRef(0);

  // The only React state in the room: WHO is here. Positions never come
  // through here — they are written straight to transforms in the frame loop.
  // Stable identity, so the effects below can depend on it without restarting.
  const [people, setPeople] = useState<RemotePresence[]>([]);
  const publish = useCallback(() => {
    setPeople([...roster.current.entries.values()]);
  }, []);

  const registerElement = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) elements.current.set(id, el);
    else elements.current.delete(id);
  }, []);

  // The room draws its own Meshis, so the floating one stands down.
  useEffect(() => {
    setCanvasMeshi(true);
    return () => setCanvasMeshi(false);
  }, []);

  // ── WALK ─────────────────────────────────────────────────────────────────
  //
  // Tap anywhere and your body goes there. Deliberately a target rather than a
  // teleport: the WALK is what other people see, and an instant jump would
  // remove the only thing that makes the room feel inhabited.
  const walkTo = useCallback((clientX: number, clientY: number) => {
    // The FLOOR, not the host: a tap is resolved against the same safe box the
    // bodies are drawn in, so tapping under your finger puts you under your
    // finger rather than a header's height above it.
    const host = floorRef.current;
    if (!host) return;
    const box = host.getBoundingClientRect();
    const x = clamp01((clientX - box.left) / box.width);
    const y = clamp01((clientY - box.top) / box.height);
    if (x > me.current.x) facing.current = 1;
    else if (x < me.current.x) facing.current = -1;
    target.current = { x, y };
  }, []);

  // Cosmetics are read through a ref inside buildBody rather than closed over,
  // so preferences arriving (or a hat changing) never tears down and restarts
  // the transport — a restart drops the stream, re-runs the backoff, and makes
  // you blink out of everyone else's room for a beat.
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  // ── PRESENCE ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewerId) return;

    const client = createPresenceClient({
      getRoom: () => roomUserId,
      isVisible: () => typeof document === "undefined" || document.visibilityState === "visible",
      buildBody: () => {
        const p = prefsRef.current;
        return {
          viewingMesh: roomUserId,
          surface: "mesh",
          // Broadcast where I actually AM, not where I am heading — so everyone
          // watches the same walk rather than seeing me appear at the end of it.
          viewportPosition: { vx: me.current.x, vy: me.current.y },
          meshiColor: p?.color,
          meshiHat: p?.hat,
          meshiHair: p?.hair,
          meshiAccessory: p?.accessory,
          meshiEyeStyle: p?.eye,
          meshiBadge: p?.badge,
          meshiMood: "happy",
        };
      },
      getMovement: () => ({ x: me.current.x, y: me.current.y, zoom: 1 }),
      onPayload: (payload) => {
        // One admission rule, shared with the field: online, in THIS room, on
        // the mesh surface, and never your own echo.
        const people = readRoomPeople(payload, { room: roomUserId, viewerId });
        const now = Date.now();
        lastPayloadAt.current = now;
        const events = applySightings(roster.current, people, now);
        if (events.changed) publish();
        for (const person of people) {
          let sprite = sprites.current.get(person.userId);
          if (!sprite) {
            // A new arrival appears where they are, then walks from there.
            sprite = createSprite(now, { x: person.viewportPosition.vx, y: person.viewportPosition.vy });
            sprites.current.set(person.userId, sprite);
          }
          applySighting(sprite, {
            world: { x: person.viewportPosition.vx, y: person.viewportPosition.vy },
            perchNodeId: person.activeNodeId ?? null,
          });
        }
      },
      onLink: () => {},
    });

    client.start();
    return () => client.stop();
  }, [roomUserId, viewerId, publish]);

  // ── THE LOOP ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const frame = (t: number) => {
      const dt = Math.min(64, t - last);
      last = t;

      // Me: ease toward wherever I tapped.
      const step = dt / 900;
      me.current.x += (target.current.x - me.current.x) * Math.min(1, step * 6);
      me.current.y += (target.current.y - me.current.y) * Math.min(1, step * 6);
      place(meRef.current, me.current.x, me.current.y, facing.current);

      // Everyone else: ease toward their broadcast position. Same machine, so
      // a remote Meshi moves exactly the way yours does.
      //
      // The sweep also applies the grace period, which is why a dropped
      // payload does not make somebody blink out and back. `lastPayloadAt` is
      // what makes it evidence-based rather than clock-based — see the ref.
      const sweep = sweepRoster(roster.current, Date.now(), lastPayloadAt.current);
      for (const person of sweep.left) {
        sprites.current.delete(person.userId);
        elements.current.delete(person.userId);
        remoteFacing.current.delete(person.userId);
      }
      // `changed` is the roster telling us membership or an appearance moved —
      // the ONLY reason to touch React. Positions never do.
      if (sweep.changed) publish();
      for (const [id, sprite] of sprites.current) {
        const before = sprite.world ? sprite.world.x : null;
        const pos = stepSpriteToward(sprite, sprite.target.x, sprite.target.y, dt, 0.02);
        // Only turn on real horizontal travel: a body that flipped on float
        // noise would shimmer in place instead of standing still.
        if (before !== null && Math.abs(pos.x - before) > 0.0005) {
          remoteFacing.current.set(id, pos.x > before ? 1 : -1);
        }
        place(elements.current.get(id) ?? null, pos.x, pos.y, remoteFacing.current.get(id) ?? 1);
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [publish]);

  const meshiProps = useMemo(
    () =>
      ({
        size: 46,
        color: prefs?.color,
        hat: prefs?.hat,
        hair: prefs?.hair,
        accessory: prefs?.accessory,
        eyeStyle: prefs?.eye,
        badge: prefs?.badge,
        animate: true,
      }) as React.ComponentProps<typeof MeshiMascot>,
    [prefs],
  );

  return (
    <div
      ref={hostRef}
      data-testid="mesh-room"
      onPointerDown={(e) => walkTo(e.clientX, e.clientY)}
      className="relative h-full w-full cursor-pointer overflow-hidden select-none"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 30%, #12203a 0%, #0a1120 55%, #05080f 100%)",
      }}
    >
      {/* THE FLOOR. Everything with a position lives in here, so normalised
          0..1 spans the part of the room that is actually visible rather than
          the part hidden behind the app's own chrome. */}
      <div
        ref={floorRef}
        data-testid="room-floor"
        className="absolute inset-x-0"
        style={{ top: inset.top, bottom: inset.bottom }}
      >
      {/* The ground. A room needs a floor or everyone is falling. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{ height: "46%", background: "linear-gradient(180deg, #ffffff00 0%, #4a7bd10f 40%, #4a7bd11a 100%)" }}
      />

      {/* Props: what this room is about, standing in it. */}
      {roomProps.map((p) => (
        <a
          key={p.id}
          href={p.href ?? "#"}
          data-testid="room-prop"
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
          style={{ left: `${p.vx * 100}%`, top: `${p.vy * 100}%` }}
        >
          <span
            className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl"
            style={{ background: "#101c30", border: "1px solid #ffffff1f" }}
          >
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span style={{ color: "#dce4f5", fontSize: 13, fontWeight: 600 }}>
                {p.label.slice(0, 2).toUpperCase()}
              </span>
            )}
          </span>
          <span className="mt-1 max-w-[120px] truncate text-center" style={{ color: "#93a0bb", fontSize: 11 }}>
            {p.label}
          </span>
        </a>
      ))}

      {/* Everyone else who is here right now. */}
      {people.map((person) => (
        <div
          key={person.userId}
          ref={(el) => registerElement(person.userId, el)}
          data-testid="room-meshi"
          data-user={person.userId}
          className="pointer-events-none absolute left-0 top-0 flex flex-col items-center will-change-transform"
        >
          {/* First child: the body `place` mirrors. The label is a sibling so
              it never flips with them. */}
          <span className="block">
            <MeshiMascot
              {...({
                size: 42,
                color: person.meshiColor,
                hat: person.meshiHat,
                hair: person.meshiHair,
                accessory: person.meshiAccessory,
                eyeStyle: person.meshiEyeStyle,
                badge: person.meshiBadge,
                animate: true,
              } as React.ComponentProps<typeof MeshiMascot>)}
            />
          </span>
          <span
            className="mt-0.5 whitespace-nowrap rounded-full px-1.5"
            style={{ color: "#e8edf8", fontSize: 11, background: "#0a1120aa" }}
          >
            {person.displayName || person.username}
          </span>
        </div>
      ))}

      {/* You. Drawn last so you are never behind somebody else. */}
      <div
        ref={meRef}
        data-testid="room-me"
        className="pointer-events-none absolute left-0 top-0 z-10 flex flex-col items-center will-change-transform"
      >
        <span className="block">
          <MeshiMascot {...meshiProps} />
        </span>
        <span
          className="mt-0.5 whitespace-nowrap rounded-full px-1.5 font-medium"
          style={{ color: "#04060c", fontSize: 11, background: "#60a5fa" }}
        >
          you
        </span>
      </div>

      <div className="pointer-events-none absolute left-4 top-4" style={{ color: "#93a0bb", fontSize: 12.5 }}>
        {roomLabel}
        <span className="ml-2" style={{ color: "#5f6b83" }}>
          · tap anywhere to walk
        </span>
      </div>
      </div>
    </div>
  );
}

/** Write a body's position straight to its transform. Percentages of the room,
 * so the same normalised point lands correctly at any size.
 *
 * FACING GOES ON THE BODY, NOT THE CONTAINER. Mirroring the whole node would
 * mirror the name label with it and print the person's name backwards every
 * time they walked left. */
function place(el: HTMLDivElement | null, x: number, y: number, facing: number) {
  if (!el) return;
  el.style.left = `${x * 100}%`;
  el.style.top = `${y * 100}%`;
  el.style.transform = "translate3d(-50%, -50%, 0)";
  // Nearer the bottom of the room reads as nearer the viewer.
  el.style.zIndex = String(Math.round(y * 100));
  const body = el.firstElementChild as HTMLElement | null;
  if (body) body.style.transform = `scaleX(${facing})`;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
