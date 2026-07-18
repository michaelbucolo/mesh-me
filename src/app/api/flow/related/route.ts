import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ANONYMOUS_VIEWER, getFeedPostById } from "@/lib/feed-data";
import { getFlowCandidates, rankRelatedPosts } from "@/lib/flow-ranking";

/**
 * The sideways lane: content similar/related to the reel the viewer just
 * watched. Anchored on a post id; returns the closest matches by author,
 * tags, platform, and format. Open to guests (public supply only).
 */
export async function GET(request: Request) {
  const user = (await getCurrentUser()) ?? ANONYMOUS_VIEWER;

  const { searchParams } = new URL(request.url);
  const anchorId = searchParams.get("anchor");
  if (!anchorId) {
    return NextResponse.json({ error: "anchor is required" }, { status: 400 });
  }
  const exclude = new Set(
    (searchParams.get("exclude") || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 600),
  );

  const [anchor, candidates] = await Promise.all([
    getFeedPostById(user, anchorId),
    getFlowCandidates(user),
  ]);

  if (!anchor) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const related = rankRelatedPosts(anchor, candidates, { exclude, limit: 8 });

  return NextResponse.json({ posts: related });
}
