// WHERE EVERYTHING LANDS IN PIXELS, AND WHAT THAT IS NOT ALLOWED TO DO.
//
// rings.ts decided which band a thing belongs to. This turns bands into
// coordinates, and it exists as a separate, pure module for one reason: the
// three worst things about the surface it replaces were all geometry, and all
// three are checkable.
//
//   • A panel floated over the world and CLIPPED the cards behind it.
//   • On a phone, cards were cut off at both edges of the screen.
//   • On a phone, the centre of the mesh was not visible at all.
//
// None of those is a taste question. They are "two things occupy one place",
// "a thing is outside the box" and "the most important thing is off-screen" —
// arithmetic, all of it. So they are invariants here rather than intentions,
// and the gate holds them at every viewport down to 390x844.
//
// ── TRIM FROM THE OUTSIDE, NEVER FROM THE INSIDE ────────────────────────────
//
// A small screen cannot hold everything. The question is what gives, and the
// answer has to be the outer field — the context — never the ring of things
// that want you. A phone that hides an unanswered message to make room for a
// nine-day-old post has inverted the whole point of the surface.
//
// So fitting is done by dropping outward-in, and `dropped` is reported rather
// than silently absorbed.
//
// ── ANGLE CARRIES RANK ──────────────────────────────────────────────────────
//
// Within a band the most pressing item sits at twelve o'clock and the rest fan
// out alternately left and right. Reading order on a radial surface is not
// obvious, so it is made obvious: the top of the ring is the front of the
// queue, and the eye starts where it already wanted to.

import type { Field, Ring } from "./rings";
import { RINGS } from "./rings";

export type Viewport = { width: number; height: number };

type Placement = {
  id: string;
  ring: Ring;
  /** Centre of the node, in viewport pixels. */
  x: number;
  y: number;
  /** The node's own radius. Hit area and drawn size are the same thing. */
  radius: number;
};

export type Geometry = {
  /** The reserved core. Nothing else may intrude on it. */
  core: { x: number; y: number; radius: number };
  placements: Placement[];
  /**
   * Items that did not fit, outermost first. Reported, never silent: a surface
   * that quietly hides part of your world has lied about being your world.
   */
  dropped: string[];
};

/** Gap between any two nodes, and between a node and the core. */
const BREATH = 10;

/** Margin from the viewport edge, so nothing is ever clipped by the frame. */
const EDGE = 16;

/**
 * Tolerance for the geometric tests below, in pixels.
 *
 * Not a fudge factor — a necessity, and its absence was a real bug. A band's
 * distance is computed as `core + radius + BREATH`, and `clearsCore` then
 * checks that same sum reached by a different route: `cos(-PI/2)` is 6.1e-17
 * rather than 0, and `hypot` reintroduces error of its own. An item placed
 * exactly at the minimum therefore landed on an equality boundary decided by
 * rounding, and the gate caught the result — a phone dropping the single most
 * urgent item from twelve o'clock while keeping the ones beside it.
 *
 * A sub-pixel tolerance cannot hide a real overlap: anything within a
 * thousandth of a pixel of touching is touching, and no screen can draw the
 * difference.
 */
const TOLERANCE = 0.001;

/**
 * Node radius per band.
 *
 * Inner is bigger — size and distance say the same thing rather than competing.
 * These are radii at a reference width; `scaleFor` shrinks them together on
 * small screens so the RELATIONSHIP survives even when the absolute sizes
 * cannot.
 */
const RADIUS: Readonly<Record<Ring, number>> = Object.freeze({
  needsYou: 34,
  happening: 28,
  fresh: 24,
  field: 16,
});

/** Distance of each band's centreline, as a fraction of the usable radius. */
const BAND: Readonly<Record<Ring, number>> = Object.freeze({
  needsYou: 0.34,
  happening: 0.56,
  fresh: 0.76,
  field: 0.95,
});

/** The core has to stay legible on a phone; it never shrinks below this. */
const MIN_CORE = 52;

function scaleFor(viewport: Viewport): number {
  const shortest = Math.min(viewport.width, viewport.height);
  // 1 at 900px and above, easing down to 0.62 at 360. Below that the surface is
  // not being made smaller, it is being made fewer — see the drop loop.
  return Math.max(0.62, Math.min(1, shortest / 900));
}

/**
 * Angles for n items around a band: twelve o'clock first, then alternating out.
 *
 * Deliberately not evenly spread from zero — the eye starts at the top, so the
 * front of the queue is put where the eye already is.
 */
function anglesFor(count: number): number[] {
  if (count <= 0) return [];
  const step = (Math.PI * 2) / Math.max(count, 3);
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const rank = Math.ceil(i / 2);
    const side = i % 2 === 0 ? 1 : -1;
    // -90deg is twelve o'clock in screen coordinates.
    out.push(-Math.PI / 2 + side * rank * step);
  }
  return out;
}

function overlaps(a: Placement, b: Placement): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy) < a.radius + b.radius + BREATH - TOLERANCE;
}

function insideViewport(p: Placement, viewport: Viewport): boolean {
  return (
    p.x - p.radius >= EDGE - TOLERANCE &&
    p.y - p.radius >= EDGE - TOLERANCE &&
    p.x + p.radius <= viewport.width - EDGE + TOLERANCE &&
    p.y + p.radius <= viewport.height - EDGE + TOLERANCE
  );
}

function clearsCore(p: Placement, core: Geometry["core"]): boolean {
  return Math.hypot(p.x - core.x, p.y - core.y) >= core.radius + p.radius + BREATH - TOLERANCE;
}

/**
 * Lay the field out.
 *
 * Pure: same field and same viewport give the same pixels, so a resize that
 * changes nothing moves nothing.
 */
export function layOut(field: Field, viewport: Viewport): Geometry {
  const scale = scaleFor(viewport);
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;

  const core = {
    x: cx,
    y: cy,
    radius: Math.max(MIN_CORE, 76 * scale),
  };

  // Usable radius is bounded by the NEAREST edge, so a wide-but-short window
  // does not fling the outer band off the top and bottom.
  const usable = Math.min(cx, cy) - EDGE;

  const placements: Placement[] = [];
  const dropped: string[] = [];

  // ── BANDS STACK OUTWARD, EACH CLEARING THE LAST ───────────────────────────
  //
  // A band's preferred distance is a fraction of the usable radius, but that
  // preference has to yield to two things: clearing the core, and clearing the
  // band inside it.
  //
  // Computing them independently was a real bug. On a phone the innermost band
  // was floored outward to clear the core — from its preferred 61px to 83px —
  // while the next band stayed at its preferred 100px. The first reached out to
  // 104px and the second began at 83px, so they occupied the same ring of
  // pixels and the outer one lost every item to collision. Distance stopped
  // meaning urgency because two different urgencies were in the same place.
  //
  // Tracking the outer edge as we go makes separation structural: each band
  // starts beyond where the previous one ended, so the ordering cannot be
  // undone by a floor that only applies to one of them.
  let outerEdge = core.radius;

  for (const ring of RINGS) {
    const items = field.byRing[ring];
    const angles = anglesFor(items.length);
    const radius = Math.max(10, RADIUS[ring] * scale);
    const distance = Math.max(outerEdge + radius + BREATH, usable * BAND[ring]);
    outerEdge = distance + radius;

    items.forEach((item, i) => {
      placements.push({
        id: item.id,
        ring,
        x: cx + Math.cos(angles[i]) * distance,
        y: cy + Math.sin(angles[i]) * distance,
        radius,
      });
    });
  }

  // ── FITTING, OUTSIDE-IN ───────────────────────────────────────────────────
  //
  // Walk from the outermost band inward and drop whatever cannot sit clear of
  // the frame, the core, or something already placed. The inner bands are
  // visited last and therefore survive: a phone gives up context before it
  // gives up an obligation.
  const kept: Placement[] = [];
  const ordered = [...placements].sort(
    (a, b) => RINGS.indexOf(a.ring) - RINGS.indexOf(b.ring),
  );

  for (const p of ordered) {
    if (!insideViewport(p, viewport) || !clearsCore(p, core)) {
      dropped.push(p.id);
      continue;
    }
    if (kept.some((other) => overlaps(p, other))) {
      dropped.push(p.id);
      continue;
    }
    kept.push(p);
  }

  return { core, placements: kept, dropped };
}
