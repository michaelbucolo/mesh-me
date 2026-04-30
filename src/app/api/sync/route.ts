import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncPlatform } from "@/lib/platform-sync";
import { isSameOriginRequest } from "@/lib/request-guard";
import { isSyncType, readJsonObject } from "@/lib/api-validation";

// GET — load accounts with sync status + recent sync jobs
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const [accounts, jobs] = await Promise.all([
      prisma.connectedAccount.findMany({
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
        orderBy: { createdAt: "desc" },
      }),
      prisma.syncJob.findMany({
        where: {
          connectedAccount: { userId: user.id },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          connectedAccount: { select: { platform: true } },
        },
      }),
    ]);

    return NextResponse.json({ accounts, jobs });
  } catch {
    return NextResponse.json({ error: "Failed to load sync data" }, { status: 500 });
  }
}

// POST — trigger sync for a specific account
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await readJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const connectedAccountId = typeof body.connectedAccountId === "string" ? body.connectedAccountId.trim() : "";
    const syncType = body.syncType === undefined ? "full" : body.syncType;

    if (!connectedAccountId) {
      return NextResponse.json({ error: "connectedAccountId is required" }, { status: 400 });
    }

    if (!isSyncType(syncType)) {
      return NextResponse.json({ error: "Invalid syncType" }, { status: 400 });
    }

    const result = await syncPlatform(connectedAccountId, syncType);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
