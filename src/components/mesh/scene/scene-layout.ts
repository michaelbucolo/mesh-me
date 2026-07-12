// Static sectored radial-tree layout for the constellation.
//
// You sit at the origin. Each category branch owns an angular sector so the
// branches never overlap. A branch's items fan out on one or more arcs inside
// that sector; an item's own footprint (posts, accounts) clusters just beyond
// it like a small constellation. A little deterministic jitter keeps it
// organic rather than mechanical, while staying inside the sector bounds.

import type { SceneModel, SceneNode, SceneNodeKind } from "./scene-model";

const BRANCH_RADIUS = 310;
const ITEM_RING_START = 540;
const ITEM_RING_GAP = 120;
const ITEMS_PER_RING = 6;
const SUB_RADIUS_STEP = 64;
const TOP_ANGLE = -Math.PI / 2;
const BOTTOM_CORRIDOR_HALF = (55 * Math.PI) / 180;
const BRANCH_SWEEP = Math.PI * 2 - BOTTOM_CORRIDOR_HALF * 2;

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
  const { nodes, selfId, branchOrder } = model;

  const self = nodes.get(selfId);
  if (self) {
    self.x = 0;
    self.y = 0;
    self.angle = 0;
    self.depth = 0;
  }

  const branchCount = Math.max(branchOrder.length, 1);
  const isSingleBranch = branchCount === 1;
  const sectorWidth = branchCount > 1 ? BRANCH_SWEEP / (branchCount - 1) : 0;
  const sectorHalf = isSingleBranch
    ? Math.min((BRANCH_SWEEP / 2) * 0.82, (14 * Math.PI) / 180)
    : Math.min((sectorWidth / 2) * 0.82, (14 * Math.PI) / 180);

  branchOrder.forEach((branchHubId, branchIndex) => {
    const branch = nodes.get(branchHubId);
    if (!branch) return;
    const baseAngle = normalizeAngle(
      isSingleBranch ? TOP_ANGLE : TOP_ANGLE - BRANCH_SWEEP / 2 + branchIndex * sectorWidth,
    );
    branch.angle = baseAngle;
    branch.depth = 1;
    branch.x = Math.cos(baseAngle) * BRANCH_RADIUS;
    branch.y = Math.sin(baseAngle) * BRANCH_RADIUS;

    const items = branch.childIds.map((id) => nodes.get(id)!).filter(Boolean);
    // Post cards are much wider than stars, so they get fewer per ring and
    // more breathing room between rings.
    const isPostBranch = items.length > 0 && items.every((i) => i.kind === "post");
    const perRing = isPostBranch ? 3 : ITEMS_PER_RING;
    const ringStart = isPostBranch ? ITEM_RING_START + 60 : ITEM_RING_START;
    const ringGap = isPostBranch ? 200 : ITEM_RING_GAP;
    const ringCount = Math.max(1, Math.ceil(items.length / perRing));

    items.forEach((item, itemIndex) => {
      const ring = Math.floor(itemIndex / perRing);
      const ringRadius = ringStart + ring * ringGap;

      // How many items live on this ring (last ring may be partial).
      const onThisRing =
        ring === ringCount - 1 && items.length % perRing !== 0
          ? items.length % perRing
          : Math.min(perRing, items.length - ring * perRing);
      const posInRing = itemIndex % perRing;

      const frac = onThisRing <= 1 ? 0.5 : posInRing / (onThisRing - 1);
      // Alternate ring offset so stacked rings interleave instead of aligning.
      const ringSkew = (ring % 2) * (sectorHalf / Math.max(onThisRing, 1)) * 0.5;
      const spread = (frac - 0.5) * 2 * sectorHalf;
      const angle = baseAngle + spread + ringSkew + jitter(item.id) * 0.05;

      item.angle = angle;
      item.depth = 2;
      item.x = Math.cos(angle) * ringRadius;
      item.y = Math.sin(angle) * ringRadius;

      // Sub-items (item's own footprint) cluster just beyond the item, fanning
      // outward along the same radial direction.
      const subs = item.childIds.map((id) => nodes.get(id)!).filter(Boolean);
      subs.forEach((sub, subIndex) => {
        const isCard = sub.kind === "post";
        const subFrac = subs.length <= 1 ? 0 : subIndex / (subs.length - 1) - 0.5;
        const subAngle = angle + subFrac * (isCard ? 0.8 : 0.42) + jitter(sub.id) * 0.04;
        const subRadius =
          ringRadius + SUB_RADIUS_STEP + (subIndex % 2) * (isCard ? 120 : 26) + (isCard ? 90 : 30);
        sub.angle = subAngle;
        sub.depth = 3;
        sub.x = Math.cos(subAngle) * subRadius;
        sub.y = Math.sin(subAngle) * subRadius;
      });
    });
  });

  // Final pass: guarantee nothing overlaps. The radial placement above spaces
  // nodes by *angle*, which ignores how much room each node actually occupies —
  // a post card is ~172px across, a star ~30px. Relax any pair whose footprints
  // collide by pushing them apart along the line between their centres. Self
  // stays pinned at the origin; everything else settles into a clean, legible
  // constellation while keeping its radial branch structure.
  resolveOverlaps(model);
}

// Half-footprint (world units) each kind claims for collision purposes.
const FOOTPRINT: Record<SceneNodeKind, number> = {
  self: 74,
  branch: 48,
  post: 132,
  persona: 42,
  platform: 38,
  person: 40,
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
