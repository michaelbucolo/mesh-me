// Spring dynamics for the constellation. Each node carries an animated
// display position (dx/dy) that chases a target derived from the static
// layout: collapsed branches hold their items in a tight cluster near the
// hub, the active branch breathes out to the full layout, and every star
// drifts on its own slow orbit so the sky never sits still.

import type { BranchKey, SceneModel, SceneNode } from "./scene-model";

const STIFFNESS = 42;
const DAMPING = 11;
const COLLAPSED_SCALE = 0.55;
const DRIFT_AMP = 7;

// Deterministic phase in [0, 2π) from a string id.
function phase(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 6283) / 1000;
}

export interface PhysicsState {
  /** Per-branch expansion progress, 0 (collapsed) → 1 (open). */
  expansion: Map<BranchKey, number>;
  seeded: boolean;
}

export function createPhysicsState(): PhysicsState {
  return { expansion: new Map(), seeded: false };
}

function targetFor(node: SceneNode, model: SceneModel, state: PhysicsState, time: number): { x: number; y: number } {
  let tx = node.x;
  let ty = node.y;

  if (node.depth >= 2 && node.branch) {
    const open = state.expansion.get(node.branch) ?? 0;
    const scale = COLLAPSED_SCALE + (1 - COLLAPSED_SCALE) * open;
    const hub = node.parentId ? model.nodes.get(node.parentId) : null;
    if (node.depth === 2) {
      tx = node.x * scale;
      ty = node.y * scale;
    } else if (hub) {
      // Sub-items follow their (already scaled) parent, keeping their offset.
      tx = hub.dx + (node.x - hub.x);
      ty = hub.dy + (node.y - hub.y);
    }
  }

  if (node.depth >= 1) {
    const p = phase(node.id);
    const amp = DRIFT_AMP * (node.depth >= 2 ? 1 : 0.6);
    tx += Math.sin(time * 0.00045 + p) * amp;
    ty += Math.cos(time * 0.00038 + p * 1.7) * amp;
  }

  return { x: tx, y: ty };
}

export function stepScenePhysics(model: SceneModel, state: PhysicsState, time: number, dtMs: number): void {
  const dt = Math.min(dtMs, 50) / 1000;

  // Seed display positions on first frame: everything starts gathered at the
  // center and springs outward, so the constellation forms in.
  if (!state.seeded) {
    model.nodes.forEach((n) => {
      n.dx = n.x * 0.1;
      n.dy = n.y * 0.1;
      n.vx = 0;
      n.vy = 0;
    });
    state.seeded = true;
  }

  model.nodes.forEach((node) => {
    const t = targetFor(node, model, state, time);
    node.vx += (t.x - node.dx) * STIFFNESS * dt - node.vx * DAMPING * dt;
    node.vy += (t.y - node.dy) * STIFFNESS * dt - node.vy * DAMPING * dt;
    node.dx += node.vx * dt;
    node.dy += node.vy * dt;
  });
}

/** Ease each branch's expansion toward 1 for the active branch, 0 otherwise. */
export function stepExpansion(state: PhysicsState, branches: BranchKey[], active: BranchKey | null, dtMs: number): void {
  const dt = Math.min(dtMs, 50) / 1000;
  const rate = 6;
  for (const key of branches) {
    const current = state.expansion.get(key) ?? 0;
    const goal = active === null ? 0.5 : key === active ? 1 : 0;
    const next = current + (goal - current) * Math.min(1, rate * dt);
    state.expansion.set(key, next);
  }
}
