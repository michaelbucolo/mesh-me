// sim/toys — playful physics. PR5 ships the first toy: the PLUCK.
//
// Press-and-hold a content node and it stretches toward your finger on a
// spring; release and it snaps home with a wobble. Toys are COSMETIC OFFSETS
// on top of the deterministic layout: they only ever inject velocity into a
// node's animated display state (dx/dy/vx/vy — the same state the arrival
// springs use), never touch its laid-out x/y, and never reorder anything.
// The golden layout-determinism gate is untouched by construction.
//
// Zero hot-path cost when idle: stepToys returns immediately unless a pluck
// is live. Reduced motion means no stretch and no snap impulse — the pluck
// still *works* (the ring opens), it just doesn't perform.

import type { SceneModel } from "../scene/scene-model";

/** How hard the held node is pulled toward the pointer (accel per world unit). */
const PLUCK_PULL = 34;
/** The pull saturates at this pointer distance — a far drag can't sling the
 * node across the mesh; the stretch reads as elastic, not free movement. */
const MAX_STRETCH = 64;
/** Snap-back kick on release, proportional to how far the node was stretched
 * from its resting place — the visible "boing". */
const RELEASE_KICK = 4.5;

interface PluckState {
  nodeId: string;
  /** Pointer position in WORLD coordinates — what the node stretches toward. */
  aimX: number;
  aimY: number;
}

export interface ToysState {
  pluck: PluckState | null;
}

export function createToysState(): ToysState {
  return { pluck: null };
}

export function startPluck(toys: ToysState, nodeId: string, aimX: number, aimY: number): void {
  toys.pluck = { nodeId, aimX, aimY };
}

/** Track the pointer while held — the spring re-aims every move. */
export function aimPluck(toys: ToysState, aimX: number, aimY: number): void {
  if (!toys.pluck) return;
  toys.pluck.aimX = aimX;
  toys.pluck.aimY = aimY;
}

/**
 * Let go: the stretch force stops and the node's own spring carries it home.
 * A small kick proportional to the stretch makes the snap-back wobble read.
 */
export function releasePluck(toys: ToysState, model: SceneModel | null, reducedMotion: boolean): void {
  const pluck = toys.pluck;
  toys.pluck = null;
  if (!pluck || reducedMotion || !model) return;
  const node = model.nodes.get(pluck.nodeId);
  if (!node) return;
  node.vx += (node.x - node.dx) * RELEASE_KICK;
  node.vy += (node.y - node.dy) * RELEASE_KICK;
}

/**
 * Per-frame step, run in the sim phase right after the scene physics: while
 * a pluck is held, accelerate the node toward the pointer (clamped), letting
 * the layout spring fight back — the equilibrium is the stretch. Purely a
 * velocity injection; integration stays entirely inside sim/physics.
 */
export function stepToys(
  model: SceneModel | null,
  toys: ToysState,
  dtMs: number,
  reducedMotion: boolean,
): void {
  const pluck = toys.pluck;
  if (!pluck || !model) return;
  if (reducedMotion) return;
  const node = model.nodes.get(pluck.nodeId);
  if (!node) {
    // The node left the model mid-hold (rewind, live refresh) — drop the toy.
    toys.pluck = null;
    return;
  }
  const dt = Math.min(dtMs, 50) / 1000;
  const dx = pluck.aimX - node.dx;
  const dy = pluck.aimY - node.dy;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) return;
  const clamped = Math.min(dist, MAX_STRETCH) / dist;
  node.vx += dx * clamped * PLUCK_PULL * dt;
  node.vy += dy * clamped * PLUCK_PULL * dt;
}
