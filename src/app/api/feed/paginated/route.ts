import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getCombinedFeedPosts,
  normalizeFeedContentFilter,
  normalizeFeedSource,
} from "@/lib/feed-data";
import { getFlowCandidates, getViewerTasteProfile, rankFlowPosts, resolveStudioWeights } from "@/lib/flow-ranking";
import { returnBriefCursor } from "@/lib/return-brief";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const source = normalizeFeedSource(searchParams.get("source"));
  const contentFilter = normalizeFeedContentFilter(searchParams.get("content"));

  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;
  const windowSize = Math.min(safePage * safeLimit + 1, 180);

  // The default feed uses the same For You ranking as the Flow — one
  // algorithm across the platform. Scores are deterministic per request
  // shape, so page windows slice consistently. Filtered/following views stay
  // chronological, which is what those tabs promise.
  let mergedPosts;
  if (source === "all" && contentFilter === "all") {
    const [candidates, profile] = await Promise.all([
      getFlowCandidates(user),
      getViewerTasteProfile(user.id),
    ]);
    // Same mix as the first paint above, or a later page would re-rank without
    // the member's weights and the list would jump when it loaded.
    mergedPosts = rankFlowPosts(candidates, profile, {
      limit: windowSize,
      studio: resolveStudioWeights(user),
    });
    // A ranked feed that ranks NOTHING is not an empty account — it is a cold
    // taste profile. feed/page.tsx has carried this exact fallback since the
    // seeded-account bug; this route never got it, so clicking back to the
    // "All" chip (or loading page 2) wiped a feed the SSR paint had just
    // shown. Two surfaces must not disagree about the same feed.
    if (mergedPosts.length === 0) {
      mergedPosts = await getCombinedFeedPosts({
        user,
        source,
        contentFilter,
        limit: windowSize,
      });
    }
  } else {
    mergedPosts = await getCombinedFeedPosts({
      user,
      source,
      contentFilter,
      limit: windowSize,
      // Same newness stamp as the page's first paint, so a loaded page can't
      // move the "You're caught up" line.
      newSince: source === "following" ? returnBriefCursor(user.caughtUpAt) : undefined,
    });
  }

  const offset = (safePage - 1) * safeLimit;
  const resultPosts = mergedPosts.slice(offset, offset + safeLimit);
  const hasMore = mergedPosts.length > offset + safeLimit;

  return NextResponse.json({
    posts: resultPosts,
    hasMore,
    page: safePage,
    nextPage: hasMore ? safePage + 1 : null,
  });
}
