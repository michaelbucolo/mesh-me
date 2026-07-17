import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getCombinedFeedPosts,
  normalizeFeedContentFilter,
  normalizeFeedSource,
} from "@/lib/feed-data";
import { getFlowCandidates, getViewerTasteProfile, rankFlowPosts } from "@/lib/flow-ranking";

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
    mergedPosts = rankFlowPosts(candidates, profile, { limit: windowSize });
  } else {
    mergedPosts = await getCombinedFeedPosts({
      user,
      source,
      contentFilter,
      limit: windowSize,
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
