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

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";
import type { MapPin } from "@/lib/meshimap/coarse";
import type { Doodle } from "@/lib/meshimap/doodles";
import { decodeInk } from "@/lib/meshimap/ink";
import { DoodlePad, InkPreview } from "./doodle-pad";
import {
  clampZoom,
  clusterByCell,
  fanOut,
  fitCamera,
  latToY,
  lngToX,
  panCamera,
  project,
  type Camera,
} from "@/lib/meshimap/project";
import { ShareWhere } from "./share-where";
import { WORLD_PATH } from "./world-path";

const WORLD_VIEW: Camera = { lat: 20, lng: 0, zoom: 2 };

export function MeshiMap({
  pins,
  you,
  nowMs,
  doodles = [],
}: {
  pins: MapPin[];
  /** What people near you have drawn. Already gated — each one is here only
   * because its author's pin survived the privacy rules. */
  doodles?: Doodle[];
  /** Your own pin, so the map opens where you are and you can see what you
   * are broadcasting. Null when you are not sharing. */
  you: MapPin | null;
  nowMs: number;
}) {
  const router = useRouter();
  const hostRef = useRef<HTMLDivElement | null>(null);
  // The opening view FRAMES EVERYONE rather than picking a number. A fixed
  // zoom is wrong both ways — too tight and the map opens on an empty patch
  // with your friends off-screen, too loose and everyone is three pixels
  // apart — and this basemap is a coarse world outline, so a fixed
  // street-level zoom would show no land at all and read as broken.
  //
  // Fitted once, on the first real measurement: refitting on every resize
  // would yank the camera back every time you panned away and the window
  // twitched.
  // Null until you move it yourself. The view is DERIVED from the pins and the
  // measured viewport until then, rather than being state written by an
  // effect — which is both the honest description of it (it is a function of
  // its inputs) and the thing that stops a re-frame from fighting a pan.
  const [userCamera, setUserCamera] = useState<Camera | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [selected, setSelected] = useState<MapPin | null>(null);
  const [padOpen, setPadOpen] = useState(false);

  // THE MAP HAS TO KEEP MEASURING ITSELF.
  //
  // This was a ref callback that measured once on mount, and every pin was
  // invisible because of it: projection needs the viewport size, the size was
  // 0 at the moment the callback ran (the flex layout had not resolved), and
  // nothing ever measured again — so `size.width > 0` stayed false and the
  // component rendered a coastline over an empty sea forever. A rotation or a
  // sidebar collapse would have done the same thing later.
  //
  // A ResizeObserver is the fix rather than a resize listener: the window size
  // is not what changed when a sidebar opens or a keyboard appears.
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const read = () => {
      const rect = el.getBoundingClientRect();
      setSize((prev) =>
        prev.width === rect.width && prev.height === rect.height
          ? prev
          : { width: rect.width, height: rect.height },
      );
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
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
    setUserCamera((c) => panCamera(c ?? camera, dx, dy));
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
    setUserCamera((c) => {
      const from = c ?? camera;
      return { ...from, zoom: clampZoom(from.zoom + delta) };
    });

  // The opening view FRAMES EVERYONE rather than picking a number. A fixed
  // zoom is wrong both ways — too tight and the map opens on an empty patch
  // with your friends off-screen, too loose and everyone is three pixels
  // apart — and this basemap is a coarse world outline, so a fixed
  // street-level zoom would show no land at all and read as broken.
  const fitted = useMemo(
    () => (size.width > 0 ? fitCamera(pins.map((p) => p.at), size, WORLD_VIEW) : WORLD_VIEW),
    [pins, size],
  );
  const camera = userCamera ?? fitted;

  // Cells rather than pins: everyone in a cell shares one coordinate by
  // design, so without grouping a populated cell would draw one Meshi and
  // hide everybody behind it.
  const cells = useMemo(() => clusterByCell(pins), [pins]);

  const scale = 2 ** camera.zoom;

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "#081226" }}>
      <div
        ref={hostRef}
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
            <path data-testid="map-land" d={WORLD_PATH} fill="#16305a" stroke="#2b5590" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
          </g>
        </svg>

        {/* WHAT PEOPLE DREW, floating above the person who drew it. Rendered
            in the same projected space as the bodies, so a doodle and its
            author move together when the map pans. */}
        {size.width > 0 &&
          doodles.map((d) => {
            const decoded = decodeInk(d.ink);
            if (!decoded.ok) return null;
            const at = project(d.at, camera, size);
            if (at.x < -120 || at.y < -120 || at.x > size.width + 120 || at.y > size.height + 120) return null;
            return (
              <div
                key={d.id}
                data-testid="map-doodle"
                data-user={d.userId}
                className="pointer-events-none absolute"
                style={{
                  left: at.x,
                  top: at.y - 74,
                  width: 104,
                  height: 52,
                  transform: "translateX(-50%)",
                  zIndex: Math.round(at.y) + 1,
                }}
              >
                <div
                  className="relative h-full w-full overflow-hidden rounded-lg"
                  style={{ background: "#0b1526e6", border: "1px solid #ffffff1f" }}
                >
                  <InkPreview strokes={decoded.ink.strokes} />
                </div>
              </div>
            );
          })}

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
                <div
                  key={pin.userId}
                  data-testid="map-meshi"
                  data-user={pin.userId}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: x, top: y, zIndex: Math.round(y) }}
                >
                  {/* THE HIT TARGET IS THE BODY, NOTHING ELSE.
                      This used to be one button wrapping the Meshi AND its name,
                      which made its box as wide as the longest display name and
                      about twice as tall as the Meshi. Neighbouring boxes then
                      overlapped, so a tap aimed squarely at somebody's face was
                      swallowed by the invisible margin of the person beside
                      them — the card opened for the wrong person, or for nobody.
                      The label is a sibling now, and it never takes a pointer. */}
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setSelected(pin)}
                    className="block"
                    style={{ width: isYou ? 40 : 34, height: isYou ? 40 : 34 }}
                    aria-label={`${pin.displayName || pin.username} on the map`}
                  >
                    <MeshiMascot
                      {...({ size: isYou ? 40 : 34, animate: true } as React.ComponentProps<typeof MeshiMascot>)}
                    />
                  </button>
                  <span
                    className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap rounded-full px-1.5"
                    style={{
                      fontSize: 11,
                      color: isYou ? "#04060c" : "#e8edf8",
                      background: isYou ? "#60a5fa" : "#0a1120cc",
                    }}
                  >
                    {isYou ? "you" : pin.displayName || pin.username}
                  </span>
                </div>
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

      {/* Only offered when you are ON the map: a drawing goes where you are,
          so without a pin there is nowhere for it to land. Saying so by not
          offering the button beats offering it and then refusing the send. */}
      {you && !padOpen && (
        <button
          type="button"
          data-testid="doodle-open"
          onClick={() => setPadOpen(true)}
          className="absolute bottom-3 right-3 rounded-full px-3.5 py-2"
          style={{ background: "#182642", color: "#dce4f5", fontSize: 13, fontWeight: 600 }}
        >
          Draw
        </button>
      )}

      {padOpen && <DoodlePad onSent={() => router.refresh()} onClose={() => setPadOpen(false)} />}

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
