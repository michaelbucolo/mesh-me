// The strand STRUM — sweep across a filament and it twangs.
//
// Your presence point (the cursor's world target on fine pointers; the
// camera-centre the touch Meshi rides during a pan/fling) traces a segment
// through the world each frame. When that segment crosses a strand, the
// strand is strummed: its physics control point takes a perpendicular kick
// (a REAL twang through the existing filament spring — no new animation
// system), a traveling shimmer is queued for the fx layer, and a pentatonic
// tone is offered to the caller (the pitch falls as strands get longer, like
// real strings).
//
// COSMETIC-ONLY, by construction: a strum touches strand control points and
// an fx map — never a node's laid-out x/y, never ordering — so the golden
// layout-determinism gate is untouched. Nothing is broadcast: a strum is a
// local instrument, not a social verb.
//
// Budget: the whole pass early-outs while you're still (one distance check).
// While moving it is O(E) scalar segment tests against each strand's two
// chords — no allocation beyond the physics-identical edge-key strings.
// Rate caps: per-strand cooldown, max chords per step, and the tone cadence
// cap in audio/sound-kit.
//
// Reduced motion: no kick and no shimmer is ever recorded for the painter
// (the caller passes the strum map to paint only when motion is allowed) —
// but the map still takes the cooldown stamp and the tone still sounds:
// sound is not motion.

import type { SceneModel } from "../scene/scene-model";
import type { PhysicsState } from "./physics";

/** How long a strummed strand's shimmer runs (paint reads the same window). */
export const STRUM_WAVE_MS = 620;
/** A strand can't be re-strummed while it's still ringing. */
const STRUM_COOLDOWN_MS = 550;
/** Crossing a whole fan of strands in one step strums at most this many —
 * a chord, not a cluster bomb. */
const MAX_STRUMS_PER_STEP = 3;
/** A jump longer than this is a teleport (fly-to, fit, room switch) — reset
 * the trace instead of strumming everything along the way. */
const TELEPORT_WU = 260;
/** Micro-motion accumulates rather than tests — zero cost while ~still. */
const MIN_STEP_WU = 0.6;
/** One-shot perpendicular velocity kick on the strand's control point. */
const STRUM_KICK = 240;

export interface StrumState {
  seeded: boolean;
  px: number;
  py: number;
}

export function createStrumState(): StrumState {
  return { seeded: false, px: 0, py: 0 };
}

/** Proper segment-segment intersection (strict crossing) — pure scalars. */
function segsCross(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const abx = bx - ax;
  const aby = by - ay;
  const cdx = dx - cx;
  const cdy = dy - cy;
  const d1 = abx * (cy - ay) - aby * (cx - ax);
  const d2 = abx * (dy - ay) - aby * (dx - ax);
  if ((d1 > 0 && d2 > 0) || (d1 < 0 && d2 < 0)) return false;
  const d3 = cdx * (ay - cy) - cdy * (ax - cx);
  const d4 = cdx * (by - cy) - cdy * (bx - cx);
  if ((d3 > 0 && d4 > 0) || (d3 < 0 && d4 < 0)) return false;
  return true;
}

/** Shorter strands ring higher — pentatonic degree 0 (low) … 7 (high). */
function noteForLength(len: number): number {
  const note = Math.round(7 - (len - 60) / 55);
  return note < 0 ? 0 : note > 7 ? 7 : note;
}

/**
 * Per-frame step (sim phase, right after the toys): trace the presence point
 * and strum every strand the trace crossed. `onStrum` receives the pentatonic
 * degree for each new strum (the caller owns sound policy).
 */
export function stepStrum(
  model: SceneModel | null,
  physics: PhysicsState,
  state: StrumState,
  strums: Map<string, number>,
  x: number,
  y: number,
  nowMs: number,
  reducedMotion: boolean,
  onStrum?: (note: number) => void,
): void {
  if (!model) {
    state.seeded = false;
    return;
  }
  if (!state.seeded) {
    state.seeded = true;
    state.px = x;
    state.py = y;
    return;
  }
  const mx = x - state.px;
  const my = y - state.py;
  const stepSq = mx * mx + my * my;
  if (stepSq < MIN_STEP_WU * MIN_STEP_WU) return; // keep the anchor; slow motion accumulates
  if (stepSq > TELEPORT_WU * TELEPORT_WU) {
    state.px = x;
    state.py = y;
    return;
  }
  const ax = state.px;
  const ay = state.py;
  state.px = x;
  state.py = y;

  let strummed = 0;
  model.nodes.forEach((node) => {
    if (strummed >= MAX_STRUMS_PER_STEP) return;
    if (!node.parentId) return;
    const parent = model.nodes.get(node.parentId);
    if (!parent) return;
    const key = `${parent.id}>${node.id}`;
    const last = strums.get(key);
    if (last != null && nowMs - last < STRUM_COOLDOWN_MS) return;
    // The strand is the quadratic through its live control point; two chords
    // (parent→control, control→child) approximate it closely enough for a
    // fingertip. Missing control point (first frames) = straight midpoint.
    const s = physics.strands.get(key);
    const cx = s ? s.mx : (parent.dx + node.dx) / 2;
    const cy = s ? s.my : (parent.dy + node.dy) / 2;
    if (
      !segsCross(ax, ay, x, y, parent.dx, parent.dy, cx, cy) &&
      !segsCross(ax, ay, x, y, cx, cy, node.dx, node.dy)
    ) {
      return;
    }
    strummed += 1;
    // The stamp is BOTH the fx start time and the cooldown anchor. Under
    // reduced motion the painter never receives this map, so the stamp is
    // cooldown-only there.
    strums.set(key, nowMs);
    const ddx = node.dx - parent.dx;
    const ddy = node.dy - parent.dy;
    const len = Math.hypot(ddx, ddy) || 1;
    if (!reducedMotion && s) {
      // Kick the filament perpendicular to itself, in the direction of the
      // sweep — the existing strand spring turns it into a natural twang.
      const nx = -ddy / len;
      const ny = ddx / len;
      const side = mx * nx + my * ny >= 0 ? 1 : -1;
      s.vx += nx * STRUM_KICK * side;
      s.vy += ny * STRUM_KICK * side;
    }
    onStrum?.(noteForLength(len));
  });
}
