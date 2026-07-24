// Spring dynamics for the constellation. Each node carries an animated
// display position (dx/dy) that springs toward its laid-out place and drifts
// on its own slow orbit so the sky never sits still. The layout is the truth
// — closeness and time decided every position, so physics never pulls a node
// away from where it belongs; it only makes the world feel alive on the way
// there.
//
// (Ported from scene/scene-physics.ts; the model types still live in
// scene/scene-model.ts until the domain build moves into core.)

import type { SceneModel, SceneNode } from "../scene/scene-model";
import { SpatialGrid } from "./spatial-grid";

const STIFFNESS = 42;
const DAMPING = 11;
const DRIFT_AMP = 7;

// Deterministic phase in [0, 2π) from a string id.
function phase(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 6283) / 1000;
}

interface StrandPoint {
  mx: number;
  my: number;
  vx: number;
  vy: number;
}

export interface PhysicsState {
  seeded: boolean;
  /** Live control-point of each parent→child strand, keyed "parent>child". */
  strands: Map<string, StrandPoint>;
  /** Spatial hash over node positions for strand routing — rebuilt per step,
   * so each strand consults only nearby nodes: O(E×k), not O(E×N). */
  grid: SpatialGrid<SceneNode>;
}

export function createPhysicsState(): PhysicsState {
  return { seeded: false, strands: new Map(), grid: new SpatialGrid(NODE_CLEARANCE) };
}

// Strand physics — each connection is an elastic filament. Its control point
// hangs below the straight line between the two nodes (gravity sag) and springs
// toward that rest with inertia, so a strand droops, and sways/whips when the
// nodes it links drift or get flung. Loose spring + light damping = natural.
const STRAND_K = 52;
const STRAND_DAMP = 6.5;
// Radius (world units) each node clears around itself for strand routing.
const NODE_CLEARANCE = 56;
const STRAND_PUSH = 90;
// Meshis moving through the web brush the strands aside: anything inside
// this radius of a control point shoves it, so filaments visibly part and
// sway around every person passing through the room.
const DISTURB_RADIUS = 120;
const DISTURB_PUSH = 340;

/** A Meshi (yours or a visitor's) currently at a world position. */
export interface StrandDisturbance {
  x: number;
  y: number;
}

function stepStrands(
  model: SceneModel,
  state: PhysicsState,
  dt: number,
  disturbances: StrandDisturbance[],
): void {
  const seen = new Set<string>();
  // One O(N) grid rebuild per step buys O(k)-neighbour routing per strand
  // below (the old pass scanned every node for every strand — O(E×N), the
  // hottest per-frame loop in the scene at scale).
  state.grid.rebuild(model.nodes.values());
  model.nodes.forEach((node) => {
    if (!node.parentId) return;
    const parent = model.nodes.get(node.parentId);
    if (!parent) return;
    const key = `${parent.id}>${node.id}`;
    seen.add(key);

    const midX = (parent.dx + node.dx) / 2;
    const midY = (parent.dy + node.dy) / 2;
    const len = Math.hypot(node.dx - parent.dx, node.dy - parent.dy);
    const sag = Math.min(len * 0.16, 72);
    const restX = midX;
    const restY = midY + sag; // world +y is down → cable hangs down

    let s = state.strands.get(key);
    if (!s) {
      s = { mx: restX, my: restY, vx: 0, vy: 0 };
      state.strands.set(key, s);
    }
    s.vx += (restX - s.mx) * STRAND_K * dt - s.vx * STRAND_DAMP * dt;
    s.vy += (restY - s.my) * STRAND_K * dt - s.vy * STRAND_DAMP * dt;

    // Route around obstacles: any node other than this strand's own endpoints
    // pushes the control point away, so the strand bows around it instead of
    // cutting through — strands never overlap a node, and long strands split
    // their path around whatever's in the way. The spatial grid hands back
    // just the nodes within clearance range (a superset; the distance check
    // below stays the authority), so this is O(k) per strand.
    const near = state.grid.near(s.mx, s.my);
    for (let k = 0; k < near.length; k += 1) {
      const other = near[k];
      if (other.id === node.id || other.id === parent.id) continue;
      const dx = s.mx - other.dx;
      const dy = s.my - other.dy;
      const d = Math.hypot(dx, dy);
      if (d >= NODE_CLEARANCE || d < 0.001) continue;
      const push = ((NODE_CLEARANCE - d) / NODE_CLEARANCE) * STRAND_PUSH;
      s.vx += (dx / d) * push * dt;
      s.vy += (dy / d) * push * dt;
    }

    // People passing by brush the filament aside — the closer they are, the
    // harder the shove. Inertia + light damping turn it into a natural sway.
    for (let k = 0; k < disturbances.length; k += 1) {
      const d0 = disturbances[k];
      const dx = s.mx - d0.x;
      const dy = s.my - d0.y;
      const d = Math.hypot(dx, dy);
      if (d >= DISTURB_RADIUS || d < 0.001) continue;
      const push = ((DISTURB_RADIUS - d) / DISTURB_RADIUS) * DISTURB_PUSH;
      s.vx += (dx / d) * push * dt;
      s.vy += (dy / d) * push * dt;
    }

    s.mx += s.vx * dt;
    s.my += s.vy * dt;
  });
  // Drop control points whose edge no longer exists.
  if (state.strands.size > seen.size) {
    for (const key of state.strands.keys()) {
      if (!seen.has(key)) state.strands.delete(key);
    }
  }
}

// `driftTime` MUST be a shared wall clock (Date.now()), never a per-client
// timer like performance.now(). The drift is a deterministic function of the
// node id (phase) and this clock, so anchoring it to wall time makes every
// client compute the SAME orbit offset at the same instant — two people looking
// at one mesh see each node in the same spot (to within clock skew), instead of
// each node wobbling out of phase per screen.
function targetFor(node: SceneNode, driftTime: number, driftScale: number): { x: number; y: number } {
  let tx = node.x;
  let ty = node.y;

  if (node.depth >= 1 && driftScale > 0) {
    const p = phase(node.id);
    const amp = DRIFT_AMP * driftScale * (node.depth >= 2 ? 1 : 0.6);
    tx += Math.sin(driftTime * 0.00045 + p) * amp;
    ty += Math.cos(driftTime * 0.00038 + p * 1.7) * amp;
  }

  return { x: tx, y: ty };
}

/** Mesh Pro motion styles map onto a single drift multiplier. */
export function driftScaleFor(motionStyle?: string | null): number {
  if (motionStyle === "lively") return 1.9;
  if (motionStyle === "minimal") return 0.22;
  return 1;
}

export function stepScenePhysics(
  model: SceneModel,
  state: PhysicsState,
  driftTime: number,
  dtMs: number,
  driftScale = 1,
  disturbances: StrandDisturbance[] = [],
): void {
  const dt = Math.min(dtMs, 50) / 1000;

  // Seed display positions on first frame: every node starts AT ITS MAKER
  // (people/platforms at you, content at its source) and springs outward to
  // its place — the world visibly grows out of its real relationships.
  if (!state.seeded) {
    model.nodes.forEach((n) => {
      const parent = n.parentId ? model.nodes.get(n.parentId) : null;
      n.dx = parent ? parent.x * 0.85 : 0;
      n.dy = parent ? parent.y * 0.85 : 0;
      n.vx = 0;
      n.vy = 0;
    });
    state.seeded = true;
  }

  model.nodes.forEach((node) => {
    const t = targetFor(node, driftTime, driftScale);
    node.vx += (t.x - node.dx) * STIFFNESS * dt - node.vx * DAMPING * dt;
    node.vy += (t.y - node.dy) * STIFFNESS * dt - node.vy * DAMPING * dt;
    node.dx += node.vx * dt;
    node.dy += node.vy * dt;
  });

  // Now that nodes have moved, settle the strands hanging between them.
  stepStrands(model, state, dt, disturbances);
}
