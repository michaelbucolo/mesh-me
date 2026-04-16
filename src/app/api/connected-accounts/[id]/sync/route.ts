import { NextRequest, NextResponse } from "next/server";
import { syncPlatform } from "@/lib/platform-sync";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const syncType = body.syncType || "full";

    const result = await syncPlatform(id, syncType);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
