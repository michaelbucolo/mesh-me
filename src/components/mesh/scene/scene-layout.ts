// Ring layout for the constellation — ground-up rebuild.
//
// You sit at the origin. Your SOURCES — people and platforms — form the inner
// ring around you, every one strung directly to you. CONTENT fans outward
// from whatever made it: your native posts spread from you across the top,
// a platform's posts cluster beyond that platform, a friend's shared posts
// cluster beyond that friend. Two readable rings, no abstract hubs, and every
// strand is a real relationship. A final relaxation pass guarantees nothing
// overlaps regardless of how much lives on the mesh.

import type { SceneModel, SceneNode, SceneNodeKind } from "./scene-model";

const TOP_ANGLE = -Math.PI / 2;
// Inner ring: people sit slightly closer than platforms so the two source
// kinds read as one ring with texture, not two competing circles.
const PERSON_RADIUS = 330;
const MUTUAL_RADIUS = 300;
const PLATFORM_RADIUS = 385;
// Content ring: post cards are wide, so they live well beyond the sources.
const CONTENT_RADIUS = 680;
const CONTENT_RING_GAP = 240;
// Native posts fan across the top arc reserved for "made by you".
const NATIVE_ARC_HALF = (72 * Math.PI) / 180;
const NATIVE_PER_RING = 5;
// Content clustered beyond a source spreads inside this half-angle.
const CLUSTER_HALF = (26 * Math.PI) / 180;

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
  const nativePosts = all.filter((n) => n.kind === "post" && n.parentId === selfId);

  // ── Inner ring: sources. People fill most of the circle; platforms take
  // the lower arc so connected accounts read as "the wider internet below
  // you" while your people surround you. The top arc stays clear for your
  // own content.
  const sourceCount = people.length + platforms.length;
  if (sourceCount > 0) {
    // People: spread across the two sides, leaving the top arc for native
    // posts and the bottom arc for platforms.
    const peopleStart = TOP_ANGLE + NATIVE_ARC_HALF + 0.18;
    const peopleSweep = Math.PI * 2 - NATIVE_ARC_HALF * 2 - 0.36 - (platforms.length > 0 ? 0.9 : 0);
    people.forEach((p, i) => {
      const frac = people.length <= 1 ? 0.5 : i / (people.length - 1);
      const angle = normalizeAngle(peopleStart + frac * peopleSweep + jitter(p.id) * 0.05);
      const radius = (p.color === "#a78bfa" ? MUTUAL_RADIUS : PERSON_RADIUS) + jitter(p.id + "r") * 16;
      p.angle = angle;
      p.depth = 1;
      p.x = Math.cos(angle) * radius;
      p.y = Math.sin(angle) * radius;
    });

    // Platforms: centered on the bottom.
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

  // ── Your content: fans across the top, closest to you of all content.
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

  // ── Source content: each source's posts cluster just beyond it, in its own
  // radial direction — the strand from source to content stays short and the
  // provenance stays visually obvious.
  const sources = [...people, ...platforms];
  sources.forEach((source) => {
    const children = source.childIds.map((id) => nodes.get(id)!).filter(Boolean);
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
