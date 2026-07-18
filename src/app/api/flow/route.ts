import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ANONYMOUS_VIEWER } from "@/lib/feed-data";
import { explainFlowPost, getFlowCandidates, getViewerTasteProfile, normalizeFlowRankMode, normalizeStudioWeights, rankFlowPosts } from "@/lib/flow-ranking";

/**
 * Ranked Flow feed. The client sends the ids it already has (`exclude`) plus
 * ids the viewer has recently watched (`seen`); the server returns the next
 * best-ranked batch the viewer hasn't been handed yet. Guests get the public
 * discover supply — watching is free, interacting needs an account.
 */
export async function GET(request: Request) {
  const user = (await getCurrentUser()) ?? ANONYMOUS_VIEWER;

  const { searchParams } = new URL(request.url);
  const limitRaw = parseInt(searchParams.get("limit") || "12", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 30) : 12;
  const parseIds = (key: string) =>
    (searchParams.get(key) || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 600);
  const exclude = new Set(parseIds("exclude"));
  const seen = new Set(parseIds("seen"));
  const mode = normalizeFlowRankMode(searchParams.get("mode"));
  // Custom Studio weights are a Mesh Pro control — validated server-side so
  // the flag can't be spoofed by the client.
  const isPro = (user as { isMeshPro?: boolean }).isMeshPro === true;
  const studio = isPro ? normalizeStudioWeights(searchParams.get("studio")) : null;

  const [candidates, profile] = await Promise.all([
    getFlowCandidates(user),
    getViewerTasteProfile(user.id),
  ]);

  const fresh = candidates.filter((post) => !exclude.has(post.id));
  const ranked = rankFlowPosts(fresh, profile, { seen, limit, mode, studio }).map((post) => ({
    ...post,
    whyThis: explainFlowPost(post, profile, mode, studio),
  }));

  return NextResponse.json({
    posts: ranked,
    hasMore: fresh.length > ranked.length,
  });
}
