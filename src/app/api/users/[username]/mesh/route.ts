import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getFriendMeshData } from "@/lib/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    if (!(await getCurrentUser())) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

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
