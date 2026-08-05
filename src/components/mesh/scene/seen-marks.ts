// Viewer-side "seen" state for New marks — the manage half of catch-up.
//
// The base watermark is `meshLastVisit` (localStorage, advanced on arrival):
// anything created after it is `isNew`. This module layers two purely
// VIEWER-SIDE refinements on top, so "seen" can be managed without ever
// mutating anything another user can observe:
//
// - BRANCH WATERMARKS: the wedge "Mark seen" pill stamps a per-branch
//   timestamp (persisted in localStorage); content in that branch created at
//   or before the stamp stops being New — on this device, for this viewer.
// - SESSION-SEEN IDS: opening a node in the lens clears its New mark for the
//   rest of the session, so counts fall as you actually read (the cross-Flow
//   seen bridge is separate and stays native-id-only — see ui/seen-bridge.ts).
//
// All pure functions over the SceneModel, applied after every model rebuild
// (initial load, quiet live-weave refresh) so marks survive the 25s poll.

import type { BranchKey, SceneModel, SceneNode } from "./scene-model";

const BRANCH_SEEN_KEY = "meshBranchSeen";

/** Per-branch mark-seen watermarks (ms epoch), viewer-local. */
export type BranchSeenMarks = Partial<Record<BranchKey, number>>;

export function loadBranchSeenMarks(): BranchSeenMarks {
  try {
    const raw = localStorage.getItem(BRANCH_SEEN_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: BranchSeenMarks = {};
    for (const [branch, at] of Object.entries(parsed)) {
      if (typeof at === "number" && Number.isFinite(at)) out[branch as BranchKey] = at;
    }
    return out;
  } catch {
    // Storage may be unavailable — marks just won't persist.
    return {};
  }
}

export function saveBranchSeenMarks(marks: BranchSeenMarks): void {
  try {
    localStorage.setItem(BRANCH_SEEN_KEY, JSON.stringify(marks));
  } catch {
    // Storage may be unavailable.
  }
}

/**
 * Clear `isNew` on nodes the viewer has already dealt with: anything at or
 * under its branch watermark, and anything opened this session. Mutates the
 * model in place (New marks are presentation state, not layout input — node
 * positions never depend on them).
 */
export function applySeenState(
  model: SceneModel,
  marks: BranchSeenMarks,
  seenIds: ReadonlySet<string>,
): void {
  model.nodes.forEach((node) => {
    if (!node.isNew) return;
    if (seenIds.has(node.id)) {
      node.isNew = false;
      return;
    }
    if (!node.branch) return;
    const mark = marks[node.branch];
    if (mark != null && (node.createdAtMs ?? 0) <= mark) node.isNew = false;
  });
}

export interface UnseenBranchCount {
  branch: BranchKey;
  count: number;
}

/** Unseen (isNew) CONTENT per branch, in the wedge order the world reads:
 * your posts on top, people at the sides, platforms at the bottom. */
export function unseenByBranch(model: SceneModel): UnseenBranchCount[] {
  const counts = new Map<BranchKey, number>();
  model.nodes.forEach((node) => {
    if (!node.isNew || !node.branch) return;
    if (node.kind !== "post" && node.kind !== "activity") return;
    counts.set(node.branch, (counts.get(node.branch) ?? 0) + 1);
  });
  const order: BranchKey[] = ["posts", "people", "platforms", "communities", "activity", "identities"];
  return order
    .filter((branch) => (counts.get(branch) ?? 0) > 0)
    .map((branch) => ({ branch, count: counts.get(branch)! }));
}

export function totalUnseen(model: SceneModel): number {
  let total = 0;
  model.nodes.forEach((node) => {
    if (node.isNew) total += 1;
  });
  return total;
}

/**
 * The catch-up tour: every UNSEEN piece of content, oldest first — "inbox
 * zero for your mesh", replayed in the order life actually happened. Pure, so
 * the contract test can pin the ordering.
 */
export function catchUpTourIds(model: SceneModel): string[] {
  const fresh: SceneNode[] = [];
  model.nodes.forEach((node) => {
    if (node.isNew && (node.kind === "post" || node.kind === "activity")) fresh.push(node);
  });
  fresh.sort(
    (a, b) => (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0) || a.id.localeCompare(b.id),
  );
  return fresh.map((node) => node.id);
}
