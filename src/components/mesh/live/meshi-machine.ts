// The Meshi behaviour state machine — ONE sprite record per Meshi in the
// room, replacing the old 12-map / 3-coordinate-space handoff machinery
// (targets/pos/mode/perchPos/world/worldPos/perchWorldPos/avoidOffset/
// lastScreenPos/perchNode/look/joinStamp). That machinery existed to hand
// positions between viewport-fraction, screen, and world space on every mode
// change; the teleport bugs were artifacts of it. The machine has one rule
// instead:
//
//   A MESHI'S POSITION LIVES IN WORLD COORDINATES, PERIOD. The eased
//   `world` position simply persists across every mode/perch transition, so
//   the sprite TRAVELS to wherever the next mode wants it — a teleport is
//   impossible by construction. Screen projection happens once per frame at
//   the edge (live/use-meshi-dom-sync via core/camera), and the only
//   screen-space state is cosmetic: the node-dodge offset and gaze vector.
//
// Pure data + step functions: no DOM, no React, no timers. Exercised by
// scripts/mesh-live-contract.ts.

/** "roam" = drifting the room as a live cursor; "perch" = standing at the
 * node they're reading. */
type MeshiMode = "roam" | "perch";

export interface MeshiSprite {
  mode: MeshiMode;
  /** The node a perched Meshi stands at ("" while roaming). */
  perchNodeId: string;
  /** Eased current position (world units). Null until the first dom-sync
   * frame seeds it AT its target — a new arrival appears where it is, and
   * every later change glides from here. */
  world: { x: number; y: number } | null;
  /** The broadcast roam target (world units). Perch mode ignores it — the
   * perch target derives from the node's live position each frame. */
  target: { x: number; y: number };
  /** Screen-space cosmetic node-dodge offset (eased at the edge). */
  avoid: { x: number; y: number };
  /** Eased gaze unit vector (−1..1 each axis). */
  look: { x: number; y: number };
  /** When this Meshi joined the room (drives the arrive burst). */
  joinedAt: number;
}

export function createSprite(now: number, target: { x: number; y: number }): MeshiSprite {
  return {
    mode: "roam",
    perchNodeId: "",
    world: null,
    target: { x: target.x, y: target.y },
    avoid: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    joinedAt: now,
  };
}

/** Apply a roster sighting: mode + perch + roam target. `world` is left
 * untouched on every transition — that is the whole no-teleport guarantee. */
export function applySighting(
  sprite: MeshiSprite,
  sighting: { world: { x: number; y: number } | null; perchNodeId: string | null },
): void {
  if (sighting.perchNodeId) {
    sprite.mode = "perch";
    sprite.perchNodeId = sighting.perchNodeId;
  } else {
    sprite.mode = "roam";
    sprite.perchNodeId = "";
  }
  if (sighting.world) {
    sprite.target.x = sighting.world.x;
    sprite.target.y = sighting.world.y;
  }
}

/** Glide time constant — tuned for the movement broadcasts: tight enough to
 * track live motion, soft enough to stay smooth between payloads. */
const GLIDE_TAU_MS = 300;
/** Hard screen-space speed cap (px/s) so a Meshi floats, never darts. */
export const MAX_MESHI_SPEED_PX_S = 680;

/** One glide step toward (tx, ty): exponential ease + hard speed cap.
 * Mutates `pos`. `maxStep` is the per-frame distance cap in pos's units. */
export function glideStep(
  pos: { x: number; y: number },
  tx: number,
  ty: number,
  dt: number,
  maxStep: number,
): void {
  const k = 1 - Math.exp(-dt / GLIDE_TAU_MS);
  let stepX = (tx - pos.x) * k;
  let stepY = (ty - pos.y) * k;
  const dist = Math.hypot(stepX, stepY);
  if (dist > maxStep && dist > 0) {
    stepX = (stepX / dist) * maxStep;
    stepY = (stepY / dist) * maxStep;
  }
  pos.x += stepX;
  pos.y += stepY;
}

/** Step a sprite's world position toward a world target. First placement
 * seeds AT the target (a new arrival appears where it is); afterwards it
 * glides with the speed cap. Returns the sprite's world position. */
export function stepSpriteToward(
  sprite: MeshiSprite,
  tx: number,
  ty: number,
  dt: number,
  maxWorldStep: number,
): { x: number; y: number } {
  if (!sprite.world) {
    sprite.world = { x: tx, y: ty };
    return sprite.world;
  }
  glideStep(sprite.world, tx, ty, dt, maxWorldStep);
  return sprite.world;
}

/** Gaze easing time constant. */
const LOOK_TAU_MS = 130;

/** Unit direction from a Meshi at (x,y) toward a target — where its eyes
 * point. Zero vector when there's no target or it's on top of us. */
export function lookUnit(
  x: number,
  y: number,
  target: { x: number; y: number } | null,
): { x: number; y: number } {
  if (!target) return { x: 0, y: 0 };
  const dx = target.x - x;
  const dy = target.y - y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return { x: 0, y: 0 };
  return { x: dx / d, y: dy / d };
}

/** Ease a gaze vector toward a wanted unit vector. Mutates `look`; returns
 * false when both are effectively centred (caller may skip the style write). */
export function stepLook(
  look: { x: number; y: number },
  wantX: number,
  wantY: number,
  dt: number,
): boolean {
  if (wantX === 0 && wantY === 0 && Math.abs(look.x) < 0.004 && Math.abs(look.y) < 0.004) {
    return false;
  }
  const k = 1 - Math.exp(-dt / LOOK_TAU_MS);
  look.x += (wantX - look.x) * k;
  look.y += (wantY - look.y) * k;
  return true;
}

/** Body language: the bank (deg) into the direction of travel. */
const LEAN_MAX_DEG = 16;
const LEAN_TAU_MS = 110;

/** Ease a body-bank rotation toward the lean implied by screen velocity. */
export function stepLean(rot: number, screenVelPxPerMs: number, dt: number): number {
  const lean = Math.max(-LEAN_MAX_DEG, Math.min(LEAN_MAX_DEG, screenVelPxPerMs * 24));
  return rot + (lean - rot) * (1 - Math.exp(-dt / LEAN_TAU_MS));
}

// ---------------------------------------------------------------------------
// The owner Meshi's behaviour states (the heart Meshi at the centre).
// ---------------------------------------------------------------------------

/** - "cursor":   your own mesh, fine pointer — the Meshi IS your cursor.
 *  - "centered": your own mesh, coarse pointer — centred as the world moves.
 *  - "tracking": visiting, and the owner is HERE browsing their own mesh —
 *                their Meshi tracks their broadcast world position.
 *  - "resting":  visiting, owner away — eases home below their node and
 *                sleeps (the Zzz state; the layer renders the doze). */
export type OwnerMode = "cursor" | "centered" | "tracking" | "resting";

export function deriveOwnerMode(input: {
  isOwnMesh: boolean;
  coarse: boolean;
  cursorSeen: boolean;
  /** Pointer on canvas or input within the recency window. */
  pointerLive: boolean;
  ownerHere: boolean;
}): OwnerMode {
  if (input.isOwnMesh) {
    if (input.coarse) return "centered";
    if (input.cursorSeen && input.pointerLive) return "cursor";
    // Own mesh, pointer gone quiet: amble home — same easing as resting.
    return "resting";
  }
  return input.ownerHere ? "tracking" : "resting";
}
