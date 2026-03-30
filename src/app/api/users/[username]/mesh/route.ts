import { NextRequest, NextResponse } from "next/server";
import { getFriendMeshData } from "@/lib/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await params;

    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }

    const data = await getFriendMeshData(username);

    if (!data) {
      return NextResponse.json({ error: "User not found or not authenticated" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
