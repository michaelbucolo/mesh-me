import { NextRequest, NextResponse } from "next/server";
import { searchAll } from "@/lib/queries";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() || "";

    if (query.length < 2) {
      return NextResponse.json({ users: [], posts: [], communities: [] });
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
