// Layout for the constellation — organized by logic and human nature.
//
// You sit at the origin, and the geometry tells the truth about your life:
//
//   CLOSENESS IS DISTANCE. People are placed at a radius set by the real
//   strength of the tie — mutuals you talk to daily sit right beside you,
//   acquaintances drift toward the rim. One glance shows who your people are.
//
//   TIME FLOWS OUTWARD. Everything anyone made fans out from its maker with
//   the newest work nearest — your latest post sits closest to you, a
//   platform's latest video sits closest to that platform. Walking outward is
//   walking back in time.
//
//   PROVENANCE IS GEOMETRY. Every strand is a real relationship: you→person,
//   you→platform, maker→work. No abstract hubs, nothing arbitrary.
//
// Angles are deterministic per node id, so everyone keeps their place between
// visits and spatial memory works. A final relaxation pass guarantees nothing
// overlaps regardless of how much lives on the mesh.

import type { SceneModel, SceneNode, SceneNodeKind } from "./scene-model";

const TOP_ANGLE = -Math.PI / 2;
// People: closeness maps onto this radial band. closeness 1 → right beside
// you; closeness 0 → the rim of your social world.
const PERSON_NEAR = 240;
const PERSON_SPREAD = 290;
// Platforms: your bridge to the wider internet, grounded at the bottom.
const PLATFORM_RADIUS = 400;
// Content ring: post cards are wide, so they live well beyond the sources.
const CONTENT_RADIUS = 680;
const CONTENT_RING_GAP = 240;
// Native posts fan across the top arc reserved for "made by you".
const NATIVE_ARC_HALF = (72 * Math.PI) / 180;
const NATIVE_PER_RING = 5;
// Content clustered beyond a source spreads inside this half-angle.
const CLUSTER_HALF = (26 * Math.PI) / 180;

// Faint labeled rings the renderer draws so the closeness geometry is
// self-explaining: radii in world units, matched to the person band above.
export const GUIDE_RINGS: { radius: number; label: string }[] = [
  { radius: PERSON_NEAR + PERSON_SPREAD * 0.22, label: "Closest to you" },
  { radius: PERSON_NEAR + PERSON_SPREAD * 0.92, label: "Your wider circle" },
];

function normalizeAngle(angle: number): number {
  const full = Math.PI * 2;
  return ((angle % full) + full) % full;
}

// Deterministic pseudo-random in [-1, 1] from a string id.
function jitter(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

export function layoutScene(model: SceneModel): void {
  const { nodes, selfId } = model;

  const self = nodes.get(selfId);
  if (self) {
    self.x = 0;
    self.y = 0;
    self.angle = 0;
    self.depth = 0;
  }

  const all = Array.from(nodes.values());
  const people = all.filter((n) => n.kind === "person");
  const platforms = all.filter((n) => n.kind === "platform");
  const nativePosts = all
    .filter((n) => n.kind === "post" && n.parentId === selfId)
    .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));

  // ── People: spread across the two sides in a stable, id-deterministic
  // order (so everyone keeps their place between visits), at a radius set by
  // closeness. The top arc stays clear for your own content, the bottom arc
  // for platforms.
  const peopleOrdered = [...people].sort((a, b) => jitter(a.id) - jitter(b.id));
  const peopleStart = TOP_ANGLE + NATIVE_ARC_HALF + 0.18;
  const peopleSweep = Math.PI * 2 - NATIVE_ARC_HALF * 2 - 0.36 - (platforms.length > 0 ? 0.9 : 0);
  peopleOrdered.forEach((p, i) => {
    const frac = peopleOrdered.length <= 1 ? 0.5 : i / (peopleOrdered.length - 1);
    const angle = normalizeAngle(peopleStart + frac * peopleSweep + jitter(p.id) * 0.05);
    const closeness = p.closeness ?? 0.35;
    const radius = PERSON_NEAR + (1 - closeness) * PERSON_SPREAD + jitter(p.id + "r") * 14;
    p.angle = angle;
    p.depth = 1;
    p.x = Math.cos(angle) * radius;
    p.y = Math.sin(angle) * radius;
  });

  // ── Platforms: centered on the bottom.
  if (platforms.length) {
    const platformSweep = Math.min(1.5, 0.5 * Math.max(platforms.length - 1, 0) + 0.001);
    platforms.forEach((p, i) => {
      const frac = platforms.length <= 1 ? 0.5 : i / (platforms.length - 1);
      const angle = normalizeAngle(Math.PI / 2 + (frac - 0.5) * platformSweep + jitter(p.id) * 0.04);
      p.angle = angle;
      p.depth = 1;
      p.x = Math.cos(angle) * PLATFORM_RADIUS;
      p.y = Math.sin(angle) * PLATFORM_RADIUS;
    });
  }

  // ── Your content: fans across the top, newest nearest to you, each older
  // ring a step further back in time.
  nativePosts.forEach((post, i) => {
    const ring = Math.floor(i / NATIVE_PER_RING);
    const onRing = Math.min(NATIVE_PER_RING, nativePosts.length - ring * NATIVE_PER_RING);
    const pos = i % NATIVE_PER_RING;
    const frac = onRing <= 1 ? 0.5 : pos / (onRing - 1);
    const angle = TOP_ANGLE + (frac - 0.5) * 2 * NATIVE_ARC_HALF + jitter(post.id) * 0.04;
    const radius = CONTENT_RADIUS - 80 + ring * CONTENT_RING_GAP;
    post.angle = normalizeAngle(angle);
    post.depth = 2;
    post.x = Math.cos(angle) * radius;
    post.y = Math.sin(angle) * radius;
  });

  // ── Source content: each maker's work clusters just beyond them in their
  // own radial direction, newest closest to its maker — short strands, obvious
  // provenance, and time flowing outward everywhere on the mesh.
  const sources = [...people, ...platforms];
  sources.forEach((source) => {
    const children = source.childIds
      .map((id) => nodes.get(id)!)
      .filter(Boolean)
      .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
    children.forEach((child, i) => {
      const ring = Math.floor(i / 3);
      const onRing = Math.min(3, children.length - ring * 3);
      const pos = i % 3;
      const frac = onRing <= 1 ? 0.5 : pos / (onRing - 1);
      const angle = source.angle + (frac - 0.5) * 2 * CLUSTER_HALF + jitter(child.id) * 0.03;
      const radius = CONTENT_RADIUS + ring * CONTENT_RING_GAP + jitter(child.id + "r") * 30;
      child.angle = normalizeAngle(angle);
      child.depth = 2;
      child.x = Math.cos(angle) * radius;
      child.y = Math.sin(angle) * radius;
    });
  });

  // Final pass: guarantee nothing overlaps. Radial placement spaces nodes by
  // angle, which ignores real footprints — a post card is ~172px across, an
  // avatar ~40px. Relax colliding pairs apart; self stays pinned.
  resolveOverlaps(model);
}

// Half-footprint (world units) each kind claims for collision purposes.
const FOOTPRINT: Record<SceneNodeKind, number> = {
  self: 84,
  branch: 48,
  post: 132,
  persona: 42,
  platform: 46,
  person: 48,
  community: 40,
  interest: 34,
  activity: 34,
};
const FOOTPRINT_MARGIN = 18;

function resolveOverlaps(model: SceneModel): void {
  const list = Array.from(model.nodes.values());
  const radiusOf = (n: SceneNode) => FOOTPRINT[n.kind] ?? 34;

  for (let iter = 0; iter < 120; iter += 1) {
    let moved = false;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const minDist = radiusOf(a) + radiusOf(b) + FOOTPRINT_MARGIN;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= minDist) continue;
        if (dist < 0.001) {
          // Perfectly coincident — nudge along a deterministic direction.
          const theta = i * 2.399963;
          dx = Math.cos(theta);
          dy = Math.sin(theta);
          dist = 1;
        }
        const ux = dx / dist;
        const uy = dy / dist;
        const overlap = minDist - dist;
        const aFixed = a.id === model.selfId;
        const bFixed = b.id === model.selfId;
        if (aFixed && bFixed) continue;
        if (aFixed) {
          b.x += ux * overlap;
          b.y += uy * overlap;
        } else if (bFixed) {
          a.x -= ux * overlap;
          a.y -= uy * overlap;
        } else {
          const half = overlap / 2;
          a.x -= ux * half;
          a.y -= uy * half;
          b.x += ux * half;
          b.y += uy * half;
        }
        moved = true;
      }
    }
    if (!moved) break;
  }

  // Keep self exactly centred and refresh each node's angle from its final
  // position so labels and strands still radiate correctly.
  list.forEach((n) => {
    if (n.id === model.selfId) {
      n.x = 0;
      n.y = 0;
      n.angle = 0;
      return;
    }
    n.angle = Math.atan2(n.y, n.x);
  });
}

export function sceneBounds(model: SceneModel): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  model.nodes.forEach((n: SceneNode) => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x);
    maxY = Math.max(maxY, n.y);
  });
  return { minX, minY, maxX, maxY };
}
