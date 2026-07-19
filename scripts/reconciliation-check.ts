// Unit checks for the source-side post-deletion reconciliation logic.
// Run: npm run reconciliation:check
//
// This guards the delete path in platform-sync: pruning cached posts that were
// deleted at the source, WITHOUT deleting valid posts that simply fall outside
// the capped window most adapters return.

import assert from "node:assert/strict";
import { selectPrunablePostIds } from "../src/lib/platform-sync-reconcile";

const d = (iso: string) => new Date(iso);
const ids = (set: string[]) => new Set(set);

// Capped feed (e.g. X returns latest 3): p1,p2,p3 returned; p0 is older history
// still on the platform; pX was in-window but deleted at source.
{
  const cached = [
    { platformPostId: "p0", publishedAt: d("2026-01-01T00:00:00Z") }, // older than window
    { platformPostId: "p1", publishedAt: d("2026-06-01T00:00:00Z") },
    { platformPostId: "p2", publishedAt: d("2026-06-02T00:00:00Z") },
    { platformPostId: "p3", publishedAt: d("2026-06-03T00:00:00Z") },
    { platformPostId: "pX", publishedAt: d("2026-06-02T12:00:00Z") }, // in-window, not returned
  ];
  const seen = ids(["p1", "p2", "p3"]);
  const oldestSeen = d("2026-06-01T00:00:00Z");
  const prune = selectPrunablePostIds(cached, seen, oldestSeen);
  assert.deepEqual(prune, ["pX"], "only the in-window, unreturned post is pruned");
  assert.ok(!prune.includes("p0"), "older-than-window history is preserved");
}

// Empty seen set (transient empty response) prunes nothing.
{
  const cached = [{ platformPostId: "a", publishedAt: d("2026-06-01T00:00:00Z") }];
  assert.deepEqual(selectPrunablePostIds(cached, ids([]), d("2026-06-01T00:00:00Z")), []);
}

// No dated posts seen (null boundary) prunes nothing.
{
  const cached = [{ platformPostId: "a", publishedAt: d("2026-06-01T00:00:00Z") }];
  assert.deepEqual(selectPrunablePostIds(cached, ids(["a"]), null), []);
}

// A cached post with no publish date is never pruned.
{
  const cached = [
    { platformPostId: "n", publishedAt: null },
    { platformPostId: "d", publishedAt: d("2026-06-05T00:00:00Z") },
  ];
  const prune = selectPrunablePostIds(cached, ids(["keep"]), d("2026-06-01T00:00:00Z"));
  assert.ok(!prune.includes("n"), "undated posts are never pruned");
  assert.ok(prune.includes("d"), "dated in-window unreturned post is pruned");
}

// A returned post is never pruned even at the exact boundary.
{
  const cached = [{ platformPostId: "b", publishedAt: d("2026-06-01T00:00:00Z") }];
  assert.deepEqual(selectPrunablePostIds(cached, ids(["b"]), d("2026-06-01T00:00:00Z")), []);
}

// Full-paginate case (boundary is the global oldest): every unreturned in-window
// post is pruned.
{
  const cached = [
    { platformPostId: "a", publishedAt: d("2026-01-01T00:00:00Z") },
    { platformPostId: "b", publishedAt: d("2026-02-01T00:00:00Z") },
    { platformPostId: "gone", publishedAt: d("2026-03-01T00:00:00Z") },
  ];
  const prune = selectPrunablePostIds(cached, ids(["a", "b"]), d("2026-01-01T00:00:00Z"));
  assert.deepEqual(prune, ["gone"]);
}

console.log("Reconciliation checks passed");
