// Layout for the constellation — organized by logic and human nature.
//
// You sit at the origin, and the geometry tells the truth about your life:
//
//   CLOSENESS IS DISTANCE. People are placed at a radius set by the real
//   strength of the tie — mutuals you talk to daily sit right beside you,
//   acquaintances drift toward the rim.
//
//   EVERY SOURCE OWNS A SECTOR. The circle is divided into exclusive wedges:
//   your own posts fan the top, each platform owns a wedge at the bottom,
//   each person owns a wedge on the sides — and everything a source made
//   lives strictly inside its wedge. Nothing from two sources ever mixes,
//   so provenance is readable from position alone.
//
//   TIME FLOWS OUTWARD. Within a wedge the newest work sits nearest its
//   maker; older rings are older work.
//
// Angles are deterministic per node id, so everyone keeps their place between
// visits and spatial memory works. A final relaxation pass guarantees nothing
// overlaps regardless of how much lives on the mesh.

import type { SceneModel, SceneNode, SceneNodeKind } from "./scene-model";

const TOP = -Math.PI / 2;
const BOTTOM = Math.PI / 2;
// People: closeness maps onto this radial band.
const PERSON_NEAR = 240;
const PERSON_SPREAD = 290;
const PLATFORM_RADIUS = 380;
// Content rings: post cards are wide, so they live well beyond the sources.
const CONTENT_RADIUS = 620;
const RING_GAP = 210;
// World-units of arc one content card needs before cards start crowding.
const CARD_SPACING = 300;
// Breathing room between zones so wedges never visually touch.
const ZONE_MARGIN = 0.12;

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

const byNewest = (a: SceneNode, b: SceneNode) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0);

// Fan `items` inside the wedge [center-half, center+half], newest first,
// nearest ring first. Cards per ring grows with the ring's circumference so
// outer rings hold more without crowding.
function placeCluster(items: SceneNode[], center: number, half: number, startRadius: number): void {
  let index = 0;
  let ring = 0;
  while (index < items.length) {
    const radius = startRadius + ring * RING_GAP;
    const perRing = Math.max(1, Math.floor((2 * half * radius) / CARD_SPACING));
    const rowCount = Math.min(perRing, items.length - index);
    for (let pos = 0; pos < rowCount; pos += 1) {
      const item = items[index + pos];
      const frac = rowCount <= 1 ? 0.5 : pos / (rowCount - 1);
      const angle = center + (frac - 0.5) * 2 * half * 0.86 + jitter(item.id) * 0.02;
      item.angle = normalizeAngle(angle);
      item.depth = 2;
      item.x = Math.cos(angle) * radius;
      item.y = Math.sin(angle) * radius;
    }
    index += rowCount;
    ring += 1;
  }
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
    .sort(byNewest);
  const childrenOf = (source: SceneNode) =>
    source.childIds
      .map((id) => nodes.get(id))
      .filter((n): n is SceneNode => Boolean(n))
      .sort(byNewest);

  // ── Zone widths (half-angles). The top belongs to what YOU made; the
  // bottom to your platforms; the sides to your people.
  const nativeHalf = nativePosts.length ? Math.min(1.02, 0.52 + nativePosts.length * 0.05) : 0.2;
  const platformHalf = platforms.length ? Math.min(1.02, 0.3 + 0.28 * platforms.length) : 0;

  // ── Your content: fans across the top wedge, newest nearest.
  placeCluster(nativePosts, TOP, nativeHalf, CONTENT_RADIUS - 60);

  // ── Platforms: each owns a sub-wedge of the bottom zone, sized by how
  // much it holds; its content lives strictly inside that sub-wedge.
  if (platforms.length) {
    const ordered = [...platforms].sort((a, b) => jitter(a.id) - jitter(b.id));
    const weights = ordered.map((p) => 1 + childrenOf(p).length);
    const totalW = weights.reduce((s, w) => s + w, 0);
    let cursor = BOTTOM - platformHalf;
    ordered.forEach((platform, i) => {
      const w = (2 * platformHalf * weights[i]) / totalW;
      const center = cursor + w / 2;
      platform.angle = normalizeAngle(center);
      platform.depth = 1;
      platform.x = Math.cos(center) * PLATFORM_RADIUS;
      platform.y = Math.sin(center) * PLATFORM_RADIUS;
      placeCluster(childrenOf(platform), center, Math.min(w / 2, 0.55), CONTENT_RADIUS);
      cursor += w;
    });
  }

  // ── People: the two side arcs, each person owning a wedge sized by how
  // much they share. Stable hash order keeps everyone's spot between visits;
  // closeness still sets their distance from you.
  if (people.length) {
    const rightArc: [number, number] = [TOP + nativeHalf + ZONE_MARGIN, BOTTOM - platformHalf - ZONE_MARGIN];
    const leftArc: [number, number] = [BOTTOM + platformHalf + ZONE_MARGIN, TOP + Math.PI * 2 - nativeHalf - ZONE_MARGIN];
    const arcs = [rightArc, leftArc].filter(([a, b]) => b - a > 0.2);
    const arcLengths = arcs.map(([a, b]) => b - a);
    const totalArc = arcLengths.reduce((s, l) => s + l, 0);

    const ordered = [...people].sort((a, b) => jitter(a.id) - jitter(b.id));
    const weights = ordered.map((p) => Math.max(1, 1 + childrenOf(p).length * 1.4));
    const totalW = weights.reduce((s, w) => s + w, 0);

    let arcIndex = 0;
    let cursor = arcs.length ? arcs[0][0] : 0;
    ordered.forEach((person, i) => {
      const w = (totalArc * weights[i]) / totalW;
      // If this wedge would spill past the current arc, continue on the next.
      if (arcIndex < arcs.length - 1 && cursor + w > arcs[arcIndex][1] + 0.01) {
        arcIndex += 1;
        cursor = arcs[arcIndex][0];
      }
      const center = cursor + w / 2;
      const closeness = person.closeness ?? 0.35;
      const radius = PERSON_NEAR + (1 - closeness) * PERSON_SPREAD + jitter(person.id + "r") * 10;
      person.angle = normalizeAngle(center);
      person.depth = 1;
      person.x = Math.cos(center) * radius;
      person.y = Math.sin(center) * radius;
      placeCluster(childrenOf(person), center, Math.min(w / 2, 0.5), CONTENT_RADIUS);
      cursor += w;
    });
  }

  // Final pass: guarantee nothing overlaps. The sector system prevents
  // cross-source mixing; this only settles rare in-sector collisions.
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

  for (let iter = 0; iter < 90; iter += 1) {
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
