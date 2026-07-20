import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { searchAll } from "@/lib/queries";
import { rateLimit } from "@/lib/security";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Each search fans out into several DB queries plus an external lookup, so
    // cap per-user (the proxy already caps per-IP) to bound the amplification.
    const rl = rateLimit(`search:${user.id}`, 40, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Searching too fast. Please slow down.", users: [], posts: [], communities: [], platformPosts: [], platformPeople: [], messages: [], wikipedia: [] },
        { status: 429 },
      );
    }

    const query = request.nextUrl.searchParams.get("q")?.trim() || "";

    if (query.length < 2) {
      return NextResponse.json({ users: [], posts: [], communities: [], platformPosts: [], platformPeople: [], messages: [], wikipedia: [] });
    }

    const results = await searchAll(query);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: "Search failed", users: [], posts: [], communities: [] },
      { status: 500 }
    );
  }
}
