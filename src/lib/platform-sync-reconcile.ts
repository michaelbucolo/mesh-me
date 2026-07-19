// Pure decision logic for reconciling cached posts against the window a source
// actually returned during a sync. Extracted from platform-sync so it can be
// unit-tested without a database — this is the single source of truth for which
// cached posts count as source-side deletions.

interface ReconcilableCachedPost {
  platformPostId: string;
  publishedAt: Date | null;
}

// Given the posts a sync actually returned (`seenPostIds`) and the oldest publish
// time among them (`oldestSeenPublishedAt`, the lower bound of the observed
// window), return the platformPostIds of cached posts that should be pruned as
// source-side deletions: those at or after the window's lower bound that were
// NOT returned this sync.
//
// Safety properties:
// - Returns [] when there is no reliable signal (no posts seen, or none dated),
//   so a transient empty/undated response prunes nothing.
// - Never prunes a cached post older than the observed window — most adapters
//   return only a capped page of recent posts, and older cached history is
//   outside what the fetch can observe.
// - Never prunes a post that was returned this sync.
export function selectPrunablePostIds(
  cachedPosts: readonly ReconcilableCachedPost[],
  seenPostIds: ReadonlySet<string>,
  oldestSeenPublishedAt: Date | null,
): string[] {
  if (seenPostIds.size === 0 || !oldestSeenPublishedAt) return [];
  const boundary = oldestSeenPublishedAt.getTime();
  return cachedPosts
    .filter(
      (post) =>
        post.publishedAt !== null &&
        post.publishedAt.getTime() >= boundary &&
        !seenPostIds.has(post.platformPostId),
    )
    .map((post) => post.platformPostId);
}
