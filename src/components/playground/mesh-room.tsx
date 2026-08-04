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
  const meRef = useRef<HTMLDivElement | null>(null);
  const prefs = useMeshiPreferences();

  // ── EVERYTHING THAT CHANGES EVERY FRAME LIVES IN REFS ────────────────────
  //
  // A busy room repainting React 60 times a second is a slideshow. Positions
  // are written straight to element transforms; React only runs when the SET
  // of people changes, which is rare.
  const roster = useRef(createRoster());
  const sprites = useRef(new Map<string, MeshiSprite>());
  const elements = useRef(new Map<string, HTMLDivElement>());
  // Where I am and where I am heading, in room space.
  const me = useRef({ x: 0.5, y: 0.62 });
  const target = useRef({ x: 0.5, y: 0.62 });
  const facing = useRef(1);

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
    const host = hostRef.current;
    if (!host) return;
    const box = host.getBoundingClientRect();
    const x = clamp01((clientX - box.left) / box.width);
    const y = clamp01((clientY - box.top) / box.height);
    if (x > me.current.x) facing.current = 1;
    else if (x < me.current.x) facing.current = -1;
    target.current = { x, y };
  }, []);

  // ── PRESENCE ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewerId) return;

    const client = createPresenceClient({
      getRoom: () => roomUserId,
      isVisible: () => typeof document === "undefined" || document.visibilityState === "visible",
      buildBody: () => ({
        viewingMesh: roomUserId,
        surface: "mesh",
        // Broadcast where I actually AM, not where I am heading — so everyone
        // watches the same walk rather than seeing me appear at the end of it.
        viewportPosition: { vx: me.current.x, vy: me.current.y },
        meshiColor: prefs?.color,
        meshiHat: prefs?.hat,
        meshiHair: prefs?.hair,
        meshiAccessory: prefs?.accessory,
        meshiEyeStyle: prefs?.eye,
        meshiBadge: prefs?.badge,
        meshiMood: "happy",
      }),
      getMovement: () => ({ x: me.current.x, y: me.current.y, zoom: 1 }),
      onPayload: (payload) => {
        // Never render yourself twice: you are drawn from your own position,
        // not from your echo in the room payload.
        const people = readPeople(payload).filter((p) => p.userId !== viewerId);
        const events = applySightings(roster.current, people, Date.now());
        if (events.changed) bump.current();
        for (const person of people) {
          let sprite = sprites.current.get(person.userId);
          if (!sprite) {
            // A new arrival appears where they are, then walks from there.
            sprite = createSprite(Date.now(), { x: person.viewportPosition.vx, y: person.viewportPosition.vy });
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
  }, [roomUserId, viewerId, prefs]);

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
      // payload does not make somebody blink out and back.
      const sweep = sweepRoster(roster.current, Date.now());
      for (const person of sweep.left) {
        sprites.current.delete(person.userId);
        elements.current.delete(person.userId);
      }
      // `changed` is the roster telling us membership or an appearance moved —
      // the ONLY reason to touch React. Positions never do.
      if (sweep.changed) bump.current();
      for (const [id, sprite] of sprites.current) {
        const pos = stepSpriteToward(sprite, sprite.target.x, sprite.target.y, dt, 0.02);
        place(elements.current.get(id) ?? null, pos.x, pos.y, 1);
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const [people, setPeople] = useState<RemotePresence[]>([]);
  const bump = useRef<() => void>(() => {});
  bump.current = () => setPeople([...roster.current.entries.values()]);

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
        <MeshiMascot {...meshiProps} />
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
  );
}

/** Write a body's position straight to its transform. Percentages of the room,
 * so the same normalised point lands correctly at any size. */
function place(el: HTMLDivElement | null, x: number, y: number, facing: number) {
  if (!el) return;
  el.style.left = `${x * 100}%`;
  el.style.top = `${y * 100}%`;
  el.style.transform = `translate3d(-50%, -50%, 0) scaleX(${facing})`;
  // Nearer the bottom of the room reads as nearer the viewer.
  el.style.zIndex = String(Math.round(y * 100));
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Read the room payload defensively — the wire is shared with older clients. */
function readPeople(payload: unknown): RemotePresence[] {
  if (!payload || typeof payload !== "object") return [];
  const people = (payload as { people?: unknown }).people;
  if (!Array.isArray(people)) return [];
  return people.filter(
    (p): p is RemotePresence =>
      !!p && typeof p === "object" && typeof (p as RemotePresence).userId === "string",
  );
}
