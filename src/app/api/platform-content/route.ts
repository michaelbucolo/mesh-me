import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlatformContent, getPlatformAnalyticsSummary, deletePlatformPost, crossPostContent } from "@/lib/platform-sync";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view");

    if (view === "analytics") {
      const analytics = await getPlatformAnalyticsSummary();
      return NextResponse.json({ analytics: analytics || [] });
    }

    if (view === "followers") {
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

      const platform = searchParams.get("platform") || undefined;
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "20");

      const accounts = await prisma.connectedAccount.findMany({
        where: { userId: user.id, isActive: true, ...(platform ? { platform } : {}) },
        select: { id: true },
      });

      const accountIds = accounts.map((a) => a.id);
      if (accountIds.length === 0) return NextResponse.json({ followers: [], total: 0 });

      const where = { connectedAccountId: { in: accountIds } };
      const [followers, total] = await Promise.all([
        prisma.platformFollower.findMany({
          where,
          orderBy: { followerCount: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            connectedAccount: { select: { platform: true, platformUsername: true } },
          },
        }),
        prisma.platformFollower.count({ where }),
      ]);

      return NextResponse.json({ followers, total });
    }

    const platform = searchParams.get("platform") || undefined;
    const postType = searchParams.get("postType") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const result = await getPlatformContent(platform, postType, page, limit);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to fetch content" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "delete") {
      const result = await deletePlatformPost(body.postId);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "cross-post") {
      const result = await crossPostContent(body.content, body.platforms, body.mediaUrls);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
