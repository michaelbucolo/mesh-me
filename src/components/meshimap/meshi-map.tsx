"use client";

// MESHIMAP — a map you can walk around, drawn in the same hand as everything
// else.
//
// No tile service. That is a product decision before it is a technical one:
// a tile provider would see every pan of every user, which turns a feature
// built specifically to not know where people are into one that tells a third
// party where they are looking. The land is drawn from a coarse coastline
// path, which is enough to answer "roughly where in the world is this" and is
// deliberately not enough to answer "which street".
//
// It also just looks like MeshiMap rather than like Google Maps with our pins
// on it, which is the point of the art style.
//
// ── WHAT IS AND IS NOT IN HERE ─────────────────────────────────────────────
//
// Projection is arithmetic and lives in meshimap/project.ts, where it is
// gated. Privacy is in meshimap/coarse.ts, and by the time pins arrive here
// they have already been through it — this component NEVER sees a raw
// coordinate and has no way to ask for one.

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";
import type { MapPin } from "@/lib/meshimap/coarse";
import {
  clampZoom,
  clusterByCell,
  fanOut,
  latToY,
  lngToX,
  panCamera,
  project,
  type Camera,
} from "@/lib/meshimap/project";
import { ShareWhere } from "./share-where";
import { WORLD_PATH } from "./world-path";

export function MeshiMap({
  pins,
  you,
  nowMs,
}: {
  pins: MapPin[];
  /** Your own pin, so the map opens where you are and you can see what you
   * are broadcasting. Null when you are not sharing. */
  you: MapPin | null;
  nowMs: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [camera, setCamera] = useState<Camera>(() => ({
    // Opening on YOU when you share, and on the whole world when you do not —
    // a map centred on the Atlantic when your friends are all in one city is
    // a map you have to fix before you can use it.
    lat: you?.at.lat ?? pins[0]?.at.lat ?? 20,
    lng: you?.at.lng ?? pins[0]?.at.lng ?? 0,
    zoom: you || pins.length ? 9 : 2,
  }));
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [selected, setSelected] = useState<MapPin | null>(null);

  const measure = useCallback((el: HTMLDivElement | null) => {
    hostRef.current = el;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
  }, []);

  // ── DRAG ─────────────────────────────────────────────────────────────────
  //
  // Pointer events rather than mouse+touch: one code path means the map cannot
  // behave differently under a finger than under a trackpad, which is how
  // "the map is janky on mobile" usually happens.
  const drag = useRef<{ id: number; x: number; y: number; moved: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    d.moved += Math.abs(dx) + Math.abs(dy);
    setCamera((c) => panCamera(c, dx, dy));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    // A drag that ends on the background closes the card; a TAP that ends on
    // the background also closes it. Distinguishing them by distance stops a
    // pan from being read as a dismissal mid-gesture.
    if (d && d.moved < 6) setSelected(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const zoomBy = (delta: number) =>
    setCamera((c) => ({ ...c, zoom: clampZoom(c.zoom + delta) }));

  // Cells rather than pins: everyone in a cell shares one coordinate by
  // design, so without grouping a populated cell would draw one Meshi and
  // hide everybody behind it.
  const cells = useMemo(() => clusterByCell(pins), [pins]);

  const scale = 2 ** camera.zoom;

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "#081226" }}>
      <div
        ref={measure}
        data-testid="meshi-map"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute inset-0 touch-none select-none"
        style={{ cursor: "grab" }}
      >
        {/* THE SEA, then the land. Drawn in the map's own projection so the
            coastline and the pins cannot disagree. */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${Math.max(size.width, 1)} ${Math.max(size.height, 1)}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="meshimap-sea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0d1c38" />
              <stop offset="100%" stopColor="#060d1c" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#meshimap-sea)" />
          <g
            // One transform for the whole world instead of re-projecting every
            // vertex on each frame: the path is in unit map space, so panning
            // and zooming are a translate and a scale the compositor can do.
            transform={`translate(${size.width / 2 - lngToX(camera.lng) * scale * 256}, ${
              size.height / 2 - latToY(camera.lat) * scale * 256
            }) scale(${(scale * 256) / 1000})`}
          >
            <path d={WORLD_PATH} fill="#16305a" stroke="#2b5590" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
          </g>
        </svg>

        {size.width > 0 &&
          cells.map((cell) =>
            cell.members.map((pin, i) => {
              const base = project(pin.at, camera, size);
              const off = fanOut(i, cell.members.length);
              const x = base.x + off.dx;
              const y = base.y + off.dy;
              // Off-screen bodies are not rendered at all. At world zoom the
              // list is short; at street zoom it would otherwise be hundreds
              // of mounted Meshis nobody can see.
              if (x < -60 || y < -60 || x > size.width + 60 || y > size.height + 60) return null;
              const isYou = you?.userId === pin.userId;
              return (
                <button
                  key={pin.userId}
                  type="button"
                  data-testid="map-meshi"
                  data-user={pin.userId}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setSelected(pin)}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                  style={{ left: x, top: y, zIndex: Math.round(y) }}
                  aria-label={`${pin.displayName || pin.username} on the map`}
                >
                  <MeshiMascot
                    {...({ size: isYou ? 40 : 34, animate: true } as React.ComponentProps<typeof MeshiMascot>)}
                  />
                  <span
                    className="mt-0.5 whitespace-nowrap rounded-full px-1.5"
                    style={{
                      fontSize: 11,
                      color: isYou ? "#04060c" : "#e8edf8",
                      background: isYou ? "#60a5fa" : "#0a1120cc",
                    }}
                  >
                    {isYou ? "you" : pin.displayName || pin.username}
                  </span>
                </button>
              );
            }),
          )}
      </div>

      {/* Zoom. Buttons rather than scroll-only, because a map you cannot zoom
          without a wheel is a map half the devices cannot zoom. */}
      <div className="absolute right-3 top-3 flex flex-col gap-1">
        <MapButton label="Zoom in" onClick={() => zoomBy(1)}>
          +
        </MapButton>
        <MapButton label="Zoom out" onClick={() => zoomBy(-1)}>
          −
        </MapButton>
      </div>

      {/* WHAT THE MAP IS HONEST ABOUT. A pin is a cell, not a person's spot,
          and saying so is the difference between a feature people can trust
          and one they find out about later. */}
      <div
        className="pointer-events-none absolute left-3 top-3 rounded-lg px-2.5 py-1.5"
        style={{ background: "#0a1120cc", color: "#93a0bb", fontSize: 11.5 }}
      >
        {pins.length === 0
          ? "Nobody is sharing where they are right now."
          : `${pins.length} ${pins.length === 1 ? "person" : "people"} nearby · everyone shows at their area, never their address`}
      </div>

      <ShareWhere initiallySharing={!!you} />

      {selected && <PinCard pin={selected} nowMs={nowMs} isYou={selected.userId === you?.userId} />}
    </div>
  );
}

/** Tapping a Meshi opens the way into their mesh — the point of the feature.
 * The card exists rather than navigating on the first tap because a map is
 * something you browse, and one stray tap should not throw you out of it. */
function PinCard({ pin, nowMs, isYou }: { pin: MapPin; nowMs: number; isYou: boolean }) {
  return (
    <div
      data-testid="map-pin-card"
      className="absolute inset-x-3 bottom-3 rounded-2xl p-3.5"
      style={{ background: "#0d1730", border: "1px solid #ffffff1f" }}
    >
      <div style={{ color: "#e8edf8", fontSize: 15, fontWeight: 600 }}>
        {pin.displayName || pin.username}
      </div>
      <div style={{ color: "#93a0bb", fontSize: 12 }}>
        @{pin.username} · around here {describeAge(nowMs - pin.atMs)}
      </div>
      <div className="mt-3 flex gap-2">
        <Link
          href={`/mesh?user=${encodeURIComponent(pin.username)}`}
          data-testid="map-visit-mesh"
          className="rounded-full px-3.5 py-1.5"
          style={{ background: "#60a5fa", color: "#04060c", fontSize: 13, fontWeight: 600 }}
        >
          {isYou ? "Your mesh" : "Walk into their mesh"}
        </Link>
        <Link
          href={`/profile/${encodeURIComponent(pin.username)}`}
          className="rounded-full px-3.5 py-1.5"
          style={{ background: "#182642", color: "#dce4f5", fontSize: 13 }}
        >
          Profile
        </Link>
      </div>
    </div>
  );
}

function MapButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg"
      style={{ background: "#0d1730", border: "1px solid #ffffff1f", color: "#dce4f5", fontSize: 16 }}
    >
      {children}
    </button>
  );
}

/** Never a clock time. "About an hour ago" is all anyone needs and all the
 * map is willing to say — a timestamp beside a location is a movement log. */
function describeAge(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 2) return "just now";
  if (minutes < 55) return `about ${Math.round(minutes / 5) * 5} minutes ago`;
  return "within the hour";
}
