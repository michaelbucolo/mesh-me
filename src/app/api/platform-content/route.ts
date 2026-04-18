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
  deletePlatformComment,
  getPlatformPostDetails,
  getConnectedAccountDetails,
} from "@/lib/platform-sync";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view");

    if (view === "analytics") {
      const analytics = await getPlatformAnalyticsSummary();
      return NextResponse.json({ analytics: analytics || [] });
    }

    if (view === "capabilities") {
      return NextResponse.json({
        actions: [
          { id: "cross-post", required: ["content"], optional: ["mediaUrls", "platforms", "accountIds"] },
          { id: "delete", required: ["postId"] },
          { id: "edit", required: ["postId", "content"] },
          { id: "like", required: ["postId"] },
          { id: "unlike", required: ["postId"] },
          { id: "share", required: ["postId"], optional: ["comment"] },
          { id: "pin", required: ["postId"] },
          { id: "unpin", required: ["postId"] },
          { id: "visibility", required: ["postId", "visibility"] },
          { id: "reply", required: ["postId", "content"] },
          { id: "delete-comment", required: ["commentId"] },
          { id: "follow", required: ["connectedAccountId", "platformUserId"] },
          { id: "unfollow", required: ["connectedAccountId", "platformUserId"] },
        ],
      });
    }

    if (view === "followers") {
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
    if (!(await getCurrentUser())) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    type ActionResult = { error?: string } & Record<string, unknown>;
    const handlers: Record<string, () => Promise<ActionResult>> = {
      delete: async () => deletePlatformPost(body.postId),
      "cross-post": async () => crossPostContent(body.content, body.platforms, body.mediaUrls, body.accountIds),
      edit: async () => editPlatformPost(body.postId, body.content),
      like: async () => likePlatformPost(body.postId),
      unlike: async () => unlikePlatformPost(body.postId),
      follow: async () => followPlatformUser(body.connectedAccountId, body.platformUserId),
      unfollow: async () => unfollowPlatformUser(body.connectedAccountId, body.platformUserId),
      share: async () => sharePlatformPost(body.postId, body.comment),
      pin: async () => pinPlatformPost(body.postId),
      unpin: async () => unpinPlatformPost(body.postId),
      visibility: async () => updatePlatformPostVisibility(body.postId, body.visibility),
      reply: async () => replyToPlatformComment(body.postId, body.content),
      "delete-comment": async () => deletePlatformComment(body.commentId),
    };

    const handler = handlers[action];
    if (!handler) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const result = await handler();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
