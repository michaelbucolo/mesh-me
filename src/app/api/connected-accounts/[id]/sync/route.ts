import { NextRequest, NextResponse } from "next/server";
import { syncPlatform } from "@/lib/platform-sync";
import { getCurrentUser } from "@/lib/auth";
import { clearMeshCache } from "@/lib/mesh-cache";
import { isSameOriginRequest } from "@/lib/request-guard";
import { isSyncType, readJsonObject } from "@/lib/api-validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    }

    const { id } = await params;
    const body = await readJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const syncType = body.syncType === undefined ? "full" : body.syncType;
    if (!isSyncType(syncType)) {
      return NextResponse.json({ error: "Invalid syncType" }, { status: 400 });
    }

    const result = await syncPlatform(id, syncType);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Newly synced posts/feed items feed the mesh, which is served from a
    // 45s-TTL per-user cache — invalidate it so the content isn't invisible
    // until the entry expires (matches /api/sync).
    const user = await getCurrentUser();
    if (user) clearMeshCache(user.id);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
