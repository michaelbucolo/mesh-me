import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";
import {
  isPlatformContentAction,
  isVisibilityValue,
  parsePaginationParams,
  readJsonObject,
  readOptionalString,
  readOptionalStringArray,
  readRequiredString,
  VALID_PLATFORM_CONTENT_ACTIONS,
} from "@/lib/api-validation";
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
import { getPlatformCapabilitiesSnapshot } from "@/lib/platform-capabilities";
import { clearMeshCache } from "@/lib/mesh-cache";

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
        actions: VALID_PLATFORM_CONTENT_ACTIONS.map((id) => ({ id })),
        platformCapabilities: getPlatformCapabilitiesSnapshot(),
        visibilityValues: ["public", "private", "unlisted", "friends"],
        note: "Actions sync to source platforms only when the connected provider API, granted scopes, and account permissions allow it.",
      });
    }

    if (view === "followers") {
      const platform = searchParams.get("platform") || undefined;
      const { page, limit } = parsePaginationParams(searchParams);

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
    const { page, limit } = parsePaginationParams(searchParams);

    const result = await getPlatformContent(platform, postType, page, limit);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to fetch content" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    }

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await readJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const action = body.action;
    if (!isPlatformContentAction(action)) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    type ActionResult = { error?: string } & Record<string, unknown>;
    let result: ActionResult;

    if (action === "cross-post") {
      const content = readRequiredString(body, "content", { maxLength: 5000 });
      const platforms = readOptionalStringArray(body, "platforms");
      const mediaUrls = readOptionalStringArray(body, "mediaUrls", 10);
      const accountIds = readOptionalStringArray(body, "accountIds", 20);

      if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });
      if (platforms === null) return NextResponse.json({ error: "platforms must be a string array" }, { status: 400 });
      if (mediaUrls === null) return NextResponse.json({ error: "mediaUrls must be a string array" }, { status: 400 });
      if (accountIds === null) return NextResponse.json({ error: "accountIds must be a string array" }, { status: 400 });
      if ((!platforms || platforms.length === 0) && (!accountIds || accountIds.length === 0)) {
        return NextResponse.json({ error: "Choose at least one platform or connected account" }, { status: 400 });
      }

      result = await crossPostContent(content, platforms || [], mediaUrls, accountIds);
    } else if (action === "follow" || action === "unfollow") {
      const connectedAccountId = readRequiredString(body, "connectedAccountId");
      const platformUserId = readRequiredString(body, "platformUserId");
      if (!connectedAccountId) return NextResponse.json({ error: "connectedAccountId is required" }, { status: 400 });
      if (!platformUserId) return NextResponse.json({ error: "platformUserId is required" }, { status: 400 });

      result = action === "follow"
        ? await followPlatformUser(connectedAccountId, platformUserId)
        : await unfollowPlatformUser(connectedAccountId, platformUserId);
    } else if (action === "delete-comment") {
      const commentId = readRequiredString(body, "commentId");
      if (!commentId) return NextResponse.json({ error: "commentId is required" }, { status: 400 });
      result = await deletePlatformComment(commentId);
    } else {
      const postId = readRequiredString(body, "postId");
      if (!postId) return NextResponse.json({ error: "postId is required" }, { status: 400 });

      switch (action) {
        case "delete":
          result = await deletePlatformPost(postId);
          break;
        case "edit": {
          const content = readRequiredString(body, "content", { maxLength: 5000 });
          if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });
          result = await editPlatformPost(postId, content);
          break;
        }
        case "like":
          result = await likePlatformPost(postId);
          break;
        case "unlike":
          result = await unlikePlatformPost(postId);
          break;
        case "share": {
          const comment = readOptionalString(body, "comment", 500);
          if (comment === null) return NextResponse.json({ error: "comment must be a string" }, { status: 400 });
          result = await sharePlatformPost(postId, comment);
          break;
        }
        case "pin":
          result = await pinPlatformPost(postId);
          break;
        case "unpin":
          result = await unpinPlatformPost(postId);
          break;
        case "visibility": {
          const visibility = readRequiredString(body, "visibility", { maxLength: 20 });
          if (!isVisibilityValue(visibility)) {
            return NextResponse.json({ error: "visibility must be public, private, unlisted, or friends" }, { status: 400 });
          }
          result = await updatePlatformPostVisibility(postId, visibility);
          break;
        }
        case "reply": {
          const content = readRequiredString(body, "content", { maxLength: 1000 });
          if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });
          result = await replyToPlatformComment(postId, content);
          break;
        }
      }
    }

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    clearMeshCache(user.id);
    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
