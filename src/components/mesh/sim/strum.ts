// The strand STRUM — sweep across a filament and it twangs, in every browser
// in the room.
//
// Your presence point (the cursor's world target on fine pointers; the
// camera-centre the touch Meshi rides during a pan/fling) traces a segment
// through the world each frame. When that segment crosses a strand, the
// strand is strummed: its physics control point takes a perpendicular kick
// (a REAL twang through the existing filament spring — no new animation
// system) and a traveling shimmer is queued for the fx layer. Silently: see
// "THE MESH DOES NOT SING" below.
//
// ── WHY THIS FILE NO LONGER SAYS "A LOCAL INSTRUMENT" ──────────────────────
//
// This header used to end:
//
//     "Nothing is broadcast: a strum is a local instrument, not a social verb."
//
// That was true, and it was the gap. The product's whole thesis is that the
// mesh is a WEB and that other people watch you move through it — and yet you
// could play your web like an instrument while somebody standing in the room
// with you heard and saw nothing. A strand is not private furniture: it is the
// edge between two nodes both of you can see, keyed by two server ids, so it
// is a genuine shared vocabulary. A strum is therefore a SOCIAL verb now (the
// seventh on the action bus), and this module grew by exactly one function to
// support it:
//
//   `applyStrum` — the by-key apply. The local sweep and an incoming broadcast
//   both go through it, so a remote strum is provably the SAME act as a local
//   one instead of a second implementation that drifts a character at a time.
//
// What did NOT change is the instrument. The caps below (per-strand cooldown,
// max chords per step, teleport/micro-motion guards) are untouched, and the
// local sweep still fires as fast as your hand can play it. Only the WIRE is
// throttled, and that throttle lives outside this file, in
// live/strum-broadcast — the mechanic must never be slowed to protect a
// budget.
//
// COSMETIC-ONLY, by construction: a strum touches strand control points and
// an fx map — never a node's laid-out x/y, never ordering — so the golden
// layout-determinism gate is untouched. That is now doubly load-bearing: a
// strum arrives over the network, and a networked event that could move a
// laid-out node would let one client reorder another's world.
//
// THE MESH DOES NOT SING, AND THIS DID NOT CHANGE THAT.
//
// The header above this one used to promise "a pentatonic tone is offered to
// the caller". That was stale by months: #363 removed the tone under the
// heading "Two things the owner didn't like, gone", and audio/sound-kit.ts has
// said "The mesh does not play music" ever since. Making the strum social was
// briefed off that stale line and briefly brought a shared tone back with it —
// which would have re-shipped, to a whole room at once, the exact thing the
// owner had asked to remove.
//
// So a strum is motion, and only motion. That is also what #363 actually
// asked for, in the same breath as removing the sound: "Sweeping across a
// strand still kicks the spring and sends a shimmer travelling down it — that
// motion stays, AND THERE SHOULD BE MORE OF IT." A strand that rings for
// everyone in the room is more of it.
//
// `noteForLength` went with the tone rather than staying on as a number
// nobody plays. It had been rewritten to read the gated laid-out x/y instead
// of the spring-animated dx/dy, so that two clients strumming one strand would
// agree on the pitch — good engineering for a feature that no longer exists,
// and a contract assertion pinning it would have been a gate guarding dead
// code. If the mesh is ever given a voice again, that reasoning is in this
// file's history and worth reading first.
//
// Budget: the whole pass early-outs while you're still (one distance check).
// While moving it is O(E) scalar segment tests against each strand's two
// chords — no allocation beyond the physics-identical edge-key strings.
// Rate caps, in two separate places doing two separate jobs: the per-strand
// cooldown and max-chords-per-step here bound the INSTRUMENT, and the cadence
// floor in live/strum-broadcast bounds the WIRE alone. Neither was tightened
// to pay for the other — the hand plays as fast as it likes.
//
// Reduced motion: no kick and no shimmer is ever recorded for the painter
// (the caller passes the strum map to paint only when motion is allowed) —
// but the map still takes the cooldown stamp, because that stamp is the
// re-strum lockout and not merely a shimmer's start time. Because a remote
// strum lands in the SAME map and reads
// the SAME `reducedMotion` flag, the receiver's preference governs a stranger's
// strum exactly as it governs their own. The sender's preference never travels.

import type { SceneModel } from "../scene/scene-model";
import type { PhysicsState } from "./physics";

/** How long a strummed strand's shimmer runs (paint reads the same window). */
export const STRUM_WAVE_MS = 620;
/** A strand can't be re-strummed while it's still ringing. Shared by local
 * and remote strums on purpose — it is ONE physical strand, so an incoming
 * strum and yours contend for the same 550ms, and neither can machine-gun it. */
const STRUM_COOLDOWN_MS = 550;
/** Crossing a whole fan of strands in one step strums at most this many —
 * a chord, not a cluster bomb. Also bounds the incoming queue, so a burst of
 * payloads can't chord-bomb a receiver either. */
export const MAX_STRUMS_PER_STEP = 3;
/** How long a staged remote strum stays worth ringing. Cleared by the frame
 * loop on the WALL clock, so a tab that had rAF paused in the background does
 * not replay a whole crowd's sweeps at once on refocus. Sized to clear the
 * SLOWEST legitimate delivery, not the fastest: a receiver on the 2s fallback
 * poll is already two seconds behind through no fault of its own, so anything
 * tighter would silence them and only them. */
export const STRUM_STALE_MS = 3000;
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

/** Which way the filament was pushed, along its own normal. Carried on the
 * wire (one character) so the room bows the strand the way the player's hand
 * actually swept it, rather than every screen guessing. */
export type StrumSide = 1 | -1;

/** One strand rang. Handed to the caller, which owns the broadcast for a
 * LOCAL strum. `local` is what separates "I played this" from
 * "somebody in the room played this" — a remote strum must never re-broadcast,
 * or one pluck would ring around the room forever. */
export interface StrumEvent {
  /** The strand's CHILD node id — the wire's whole payload for a strum. */
  childId: string;
  side: StrumSide;
  local: boolean;
}

export function createStrumState(): StrumState {
  return { seeded: false, px: 0, py: 0 };
}

/** THE strand identity: two server node ids joined by ">". Built identically
 * in sim/physics (which owns the control points) and paint/edges (which draws
 * them); this is the copy the strum owns, and both of the strum's callers —
 * the local sweep and the network — go through it, so sender and receiver
 * cannot drift by a character. */
function strandKey(parentId: string, childId: string): string {
  return `${parentId}>${childId}`;
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

/**
 * RING ONE STRAND, BY THE CHILD NODE THAT NAMES IT.
 *
 * The one place a strum actually happens. `stepStrum` calls it once per
 * crossed strand; the live room calls it for every strum that arrives off the
 * wire. Everything a strum IS lives here — the cooldown, the fx/cooldown
 * stamp, the perpendicular kick, the pitch — so the two paths cannot diverge.
 *
 * The wire carries the CHILD node id, not the edge key, and this function
 * rebuilds the key from the receiver's OWN model. Three things follow, all of
 * them safety rather than convenience: the id is half the length (the action
 * envelope truncates a targetId past 160 chars SILENTLY, and a truncated id
 * matches nothing); nothing ever has to split a key on ">" (platform-post ids
 * are external strings and are not charset-constrained); and the parent is
 * whatever THIS client's model says it is, so a forged "post:a>post:b" cannot
 * conjure a strand that does not exist here.
 *
 * AN UNKNOWN STRAND IS IGNORED — exactly as an unknown VERB is ignored by the
 * action bus, and for a stronger reason. Unknown verbs are rare (a version
 * skew); unknown strands will be COMMON and NORMAL: a visitor's /api/mesh
 * payload carries no friend-post nodes and no platform top-posts at all,
 * privacy branch gates and per-viewer mutes remove more, and a viewer in
 * Rewind has strictly fewer nodes than the person strumming. So the miss path
 * is two map lookups and a `return null` — never an error, never a toast,
 * never a synthesized strand, and above all never a write into
 * `physics.strands` (sim/physics deletes control points whose edge no longer
 * exists, so inventing one would thrash that sweep every frame).
 *
 * Returns whether the strand actually rang. False means nothing happened —
 * an unknown strand (this viewer was served a different node set), or one
 * still ringing from a moment ago. Callers must not treat a miss as an error:
 * a strand you cannot see is ignored exactly as an unknown verb is.
 */
export function applyStrum(
  model: SceneModel | null,
  physics: PhysicsState,
  strums: Map<string, number>,
  childId: string,
  nowMs: number,
  reducedMotion: boolean,
  side: StrumSide,
): boolean {
  if (!model) return false;
  const node = model.nodes.get(childId);
  if (!node || !node.parentId) return false;
  const parent = model.nodes.get(node.parentId);
  if (!parent) return false;
  const key = strandKey(parent.id, node.id);
  const last = strums.get(key);
  if (last != null && nowMs - last < STRUM_COOLDOWN_MS) return false;
  // The stamp is BOTH the fx start time and the cooldown anchor. Under
  // reduced motion the painter never receives this map, so the stamp is
  // cooldown-only there. `nowMs` is the LOCAL rAF clock in both paths — a
  // remote strum is re-stamped on arrival and never carries the sender's
  // Date.now(), which would put a wall-clock number into a map the painter
  // and the collector both measure with performance.now().
  strums.set(key, nowMs);
  if (!reducedMotion) {
    // Kick the filament perpendicular to itself, in the direction the hand
    // swept — the existing strand spring turns it into a natural twang. The
    // control point is only read here, never created: a strand with no control
    // point yet (first frames) simply rings without the kick.
    const s = physics.strands.get(key);
    if (s) {
      const ddx = node.dx - parent.dx;
      const ddy = node.dy - parent.dy;
      const len = Math.hypot(ddx, ddy) || 1;
      s.vx += (-ddy / len) * STRUM_KICK * side;
      s.vy += (ddx / len) * STRUM_KICK * side;
    }
  }
  return true;
}

/**
 * Per-frame step (sim phase, right after the toys): trace the presence point
 * and strum every strand the trace crossed. `onStrum` receives one event per
 * strand that actually rang — the caller owns sound policy and, for a local
 * strum, the broadcast.
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
  onStrum?: (event: StrumEvent) => void,
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
    const key = strandKey(parent.id, node.id);
    // The strand is the quadratic through its live control point; two chords
    // (parent→control, control→child) approximate it closely enough for a
    // fingertip. Missing control point (first frames) = straight midpoint.
    // (The cooldown is NOT pre-checked here any more — applyStrum owns it, so
    // there is exactly one copy of that rule. The cost is two scalar segment
    // tests against a strand that is still ringing, which is the same work the
    // pass already does for every strand you did not cross.)
    const s = physics.strands.get(key);
    const cx = s ? s.mx : (parent.dx + node.dx) / 2;
    const cy = s ? s.my : (parent.dy + node.dy) / 2;
    if (
      !segsCross(ax, ay, x, y, parent.dx, parent.dy, cx, cy) &&
      !segsCross(ax, ay, x, y, cx, cy, node.dx, node.dy)
    ) {
      return;
    }
    // Which side of the filament the hand came from. This is the one thing a
    // receiver cannot derive — it is the sweep, not the strand — so it is the
    // one bit that rides the wire alongside the child id.
    const ddx = node.dx - parent.dx;
    const ddy = node.dy - parent.dy;
    const len = Math.hypot(ddx, ddy) || 1;
    const side: StrumSide = mx * (-ddy / len) + my * (ddx / len) >= 0 ? 1 : -1;
    const rang = applyStrum(model, physics, strums, node.id, nowMs, reducedMotion, side);
    if (!rang) return; // still ringing from a moment ago
    strummed += 1;
    onStrum?.({ childId: node.id, side, local: true });
  });
}
