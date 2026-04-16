import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getPlatformContent,
  getPlatformAnalyticsSummary,
  deletePlatformPost,
  crossPostContent,
  editPlatformPost,
  likePlatformPost,
  unlikePlatformPost,
  followPlatformUser,
  unfollowPlatformUser,
  sharePlatformPost,
  pinPlatformPost,
  unpinPlatformPost,
  updatePlatformPostVisibility,
  replyToPlatformComment,
  getPlatformPostDetails,
  getConnectedAccountDetails,
} from "@/lib/platform-sync";

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
            connectedAccount: { select: { platform: true, platformUsername: true, id: true } },
          },
        }),
        prisma.platformFollower.count({ where }),
      ]);

      return NextResponse.json({ followers, total });
    }

    // Post details view
    if (view === "post-details") {
      const postId = searchParams.get("postId");
      if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });
      const result = await getPlatformPostDetails(postId);
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json(result);
    }

    // Account details view
    if (view === "account-details") {
      const accountId = searchParams.get("accountId");
      if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });
      const result = await getConnectedAccountDetails(accountId);
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json(result);
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
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === "cross-post") {
      const result = await crossPostContent(body.content, body.platforms, body.mediaUrls);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json(result);
    }

    if (action === "edit") {
      const result = await editPlatformPost(body.postId, body.content);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === "like") {
      const result = await likePlatformPost(body.postId);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === "unlike") {
      const result = await unlikePlatformPost(body.postId);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === "follow") {
      const result = await followPlatformUser(body.connectedAccountId, body.platformUserId);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === "unfollow") {
      const result = await unfollowPlatformUser(body.connectedAccountId, body.platformUserId);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === "share") {
      const result = await sharePlatformPost(body.postId, body.comment);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === "pin") {
      const result = await pinPlatformPost(body.postId);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === "unpin") {
      const result = await unpinPlatformPost(body.postId);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === "visibility") {
      const result = await updatePlatformPostVisibility(body.postId, body.visibility);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (action === "reply") {
      const result = await replyToPlatformComment(body.postId, body.content);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, comment: "comment" in result ? result.comment : undefined });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
