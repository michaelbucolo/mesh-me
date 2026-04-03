import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncPlatform, syncComments, getSyncJobs } from "@/lib/platform-sync";

// GET /api/sync — get sync status and jobs
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");

  const jobs = await getSyncJobs(accountId || undefined);
  
  const accounts = await prisma.connectedAccount.findMany({
    where: { userId: user.id, isActive: true },
    select: {
      id: true,
      platform: true,
      platformUsername: true,
      syncStatus: true,
      syncError: true,
      lastSyncAt: true,
      scopes: true,
      _count: {
        select: {
          platformPosts: true,
          platformComments: true,
          platformFollowers: true,
          platformMedia: true,
        },
      },
    },
  });

  return NextResponse.json({ accounts, jobs });
}

// POST /api/sync — trigger a sync
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { connectedAccountId, syncType, platformPostId } = body;

  if (!connectedAccountId) {
    return NextResponse.json({ error: "connectedAccountId is required" }, { status: 400 });
  }

  // If syncing comments for a specific post
  if (syncType === "comments" && platformPostId) {
    const result = await syncComments(connectedAccountId, platformPostId);
    return NextResponse.json(result);
  }
  if (syncType === "comments") {
    return NextResponse.json({ error: "platformPostId is required for comment sync" }, { status: 400 });
  }

  const result = await syncPlatform(connectedAccountId, syncType || "full");
  return NextResponse.json(result);
}
