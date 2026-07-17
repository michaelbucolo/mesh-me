import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getFlowCandidates, getViewerTasteProfile, rankFlowPosts } from "@/lib/flow-ranking";

/**
 * Ranked Flow feed. The client sends the ids it already has (`exclude`) plus
 * ids the viewer has recently watched (`seen`); the server returns the next
 * best-ranked batch the viewer hasn't been handed yet.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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

  const [candidates, profile] = await Promise.all([
    getFlowCandidates(user),
    getViewerTasteProfile(user.id),
  ]);

  const fresh = candidates.filter((post) => !exclude.has(post.id));
  const ranked = rankFlowPosts(fresh, profile, { seen, limit });

  return NextResponse.json({
    posts: ranked,
    hasMore: fresh.length > ranked.length,
  });
}
