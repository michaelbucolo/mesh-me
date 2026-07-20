import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ANONYMOUS_VIEWER } from "@/lib/feed-data";
import { getGlobalMeshSupply } from "@/lib/global-mesh";

/**
 * The Global Mesh supply. Unlike /api/mesh (owner-only, 401 for guests), this
 * is open to everyone — viewing the Global Mesh needs no account. The supply
 * only ever contains already-public content of opted-in members (see
 * src/lib/global-mesh.ts), gated by the viewer's own block + NSFW settings.
 */
export async function GET() {
  const user = await getCurrentUser();
  const viewer = user ?? ANONYMOUS_VIEWER;
  const data = await getGlobalMeshSupply(viewer);
  return NextResponse.json(data);
}
