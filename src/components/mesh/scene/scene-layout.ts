// Static sectored radial-tree layout for the constellation.
//
// You sit at the origin. Each category branch owns an angular sector so the
// branches never overlap. A branch's items fan out on one or more arcs inside
// that sector; an item's own footprint (posts, accounts) clusters just beyond
// it like a small constellation. A little deterministic jitter keeps it
// organic rather than mechanical, while staying inside the sector bounds.

import type { SceneModel, SceneNode } from "./scene-model";

const BRANCH_RADIUS = 250;
const ITEM_RING_START = 470;
const ITEM_RING_GAP = 120;
const ITEMS_PER_RING = 6;
const SUB_RADIUS_STEP = 64;

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
  const sectorWidth = (Math.PI * 2) / branchCount;
  const sectorHalf = (sectorWidth / 2) * 0.82;

  branchOrder.forEach((branchHubId, branchIndex) => {
    const branch = nodes.get(branchHubId);
    if (!branch) return;
    const baseAngle = -Math.PI / 2 + branchIndex * sectorWidth;
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
