import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { searchAll } from "@/lib/queries";

export async function GET(request: NextRequest) {
  try {
    if (!(await getCurrentUser())) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
