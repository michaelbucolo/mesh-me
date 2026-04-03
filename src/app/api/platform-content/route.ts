import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPlatformContent, getPlatformAnalyticsSummary, deletePlatformPost, crossPostContent } from "@/lib/platform-sync";
import { prisma } from "@/lib/prisma";

// GET /api/platform-content — get synced content across platforms
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") || undefined;
  const postType = searchParams.get("postType") || undefined;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const view = searchParams.get("view"); // "analytics" | "followers" | "posts"

  if (view === "analytics") {
    const summary = await getPlatformAnalyticsSummary();
    return NextResponse.json({ analytics: summary });
  }

  if (view === "followers") {
    const accounts = await prisma.connectedAccount.findMany({
      where: { userId: user.id, isActive: true, ...(platform ? { platform } : {}) },
      select: { id: true },
    });
    const followers = await prisma.platformFollower.findMany({
      where: { connectedAccountId: { in: accounts.map((a) => a.id) } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { connectedAccount: { select: { platform: true } } },
    });
    const total = await prisma.platformFollower.count({
      where: { connectedAccountId: { in: accounts.map((a) => a.id) } },
    });
    return NextResponse.json({ followers, total });
  }

  const result = await getPlatformContent(platform, postType, page, limit);
  return NextResponse.json(result);
}

// POST /api/platform-content — cross-post or manage content
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  if (action === "cross-post") {
    const { content, platforms, mediaUrls } = body;
    if (!content || !platforms?.length) {
      return NextResponse.json({ error: "Content and platforms are required" }, { status: 400 });
    }
    const result = await crossPostContent(content, platforms, mediaUrls);
    return NextResponse.json(result);
  }

  if (action === "delete") {
    const { postId } = body;
    if (!postId) return NextResponse.json({ error: "postId is required" }, { status: 400 });
    const result = await deletePlatformPost(postId);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
