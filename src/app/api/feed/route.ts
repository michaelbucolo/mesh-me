import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getCombinedFeedPosts,
  normalizeFeedContentFilter,
  normalizeFeedSource,
} from "@/lib/feed-data";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const source = normalizeFeedSource(searchParams.get("source"));
  const contentFilter = normalizeFeedContentFilter(searchParams.get("content"));

  const posts = await getCombinedFeedPosts({
    user,
    source,
    contentFilter,
    limit: 50,
  });

  return NextResponse.json({ posts });
}
