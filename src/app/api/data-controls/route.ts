import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { readJsonObject } from "@/lib/api-validation";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";
import { clearMeshCache } from "@/lib/mesh-cache";

const VISIBILITY_VALUES = ["public", "friends", "private", "unlisted", "hidden"] as const;
const POLICY_ENTITY_TYPES = [
  "profile",
  "mesh",
  "native_posts",
  "connected_account",
  "platform_post",
  "messages",
  "analytics",
  "meshi_memory",
  "global_mesh",
  "notifications",
] as const;

function isVisibility(value: unknown): value is (typeof VISIBILITY_VALUES)[number] {
  return typeof value === "string" && VISIBILITY_VALUES.includes(value as (typeof VISIBILITY_VALUES)[number]);
}

const LEGACY_ENTITY_ALIASES: Record<string, (typeof POLICY_ENTITY_TYPES)[number]> = {
  meshi_ai: "meshi_memory",
};

function isPolicyEntityType(value: unknown): value is (typeof POLICY_ENTITY_TYPES)[number] {
  if (typeof value !== "string") return false;
  return POLICY_ENTITY_TYPES.includes(value as (typeof POLICY_ENTITY_TYPES)[number]) || value in LEGACY_ENTITY_ALIASES;
}

function normalizePolicyEntityType(value: string): (typeof POLICY_ENTITY_TYPES)[number] {
  return LEGACY_ENTITY_ALIASES[value] || (value as (typeof POLICY_ENTITY_TYPES)[number]);
}

function readOptionalBoolean(payload: Record<string, unknown>, key: string, fallback = false) {
  const value = payload[key];
  if (typeof value === "boolean") return value;
  return fallback;
}

function isShortString(value: unknown, maxLength = 256): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

async function getOwnedConnectedAccountIds(userId: string, connectedAccountId: unknown) {
  if (connectedAccountId !== undefined && connectedAccountId !== null) {
    if (!isShortString(connectedAccountId, 128)) {
      return { error: "Invalid connected account" } as const;
    }

    const account = await prisma.connectedAccount.findFirst({
      where: { id: connectedAccountId.trim(), userId },
      select: { id: true },
    });

    if (!account) return { error: "Connected account not found" } as const;
    return { ids: [account.id] };
  }

  const accounts = await prisma.connectedAccount.findMany({
    where: { userId },
    select: { id: true },
  });

  return { ids: accounts.map((account) => account.id) };
}

async function upsertVisibilityPolicy({
  userId,
  entityType,
  entityId,
  visibility,
  allowDiscovery,
  allowAnalytics,
  allowMeshiUse,
  metadata,
}: {
  userId: string;
  entityType: string;
  entityId: string | null;
  visibility: string;
  allowDiscovery: boolean;
  allowAnalytics: boolean;
  allowMeshiUse: boolean;
  metadata?: Record<string, unknown>;
}) {
  const existing = await prisma.dataVisibilityPolicy.findFirst({
    where: { userId, entityType, entityId },
    select: { id: true },
  });

  const data = {
    visibility,
    allowDiscovery,
    allowAnalytics,
    allowMeshiUse,
    metadata: JSON.stringify(metadata ?? {}),
  };

  if (existing) {
    return prisma.dataVisibilityPolicy.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.dataVisibilityPolicy.create({
    data: {
      userId,
      entityType,
      entityId,
      ...data,
    },
  });
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  if (searchParams.get("action") !== "export") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const connectedAccounts = await prisma.connectedAccount.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      platform: true,
      platformUsername: true,
      platformId: true,
      scopes: true,
      isActive: true,
      lastSyncAt: true,
      syncStatus: true,
      syncError: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const accountIds = connectedAccounts.map((account) => account.id);

  const [
    posts,
    comments,
    reactions,
    follows,
    followers,
    communities,
    messages,
    meChatSessions,
    notifications,
    meshPrivacy,
    globalMesh,
    platformPosts,
    platformComments,
    platformFollowers,
    platformMedia,
    platformAnalytics,
    visibilityPolicies,
  ] = await Promise.all([
    prisma.post.findMany({ where: { authorId: user.id }, include: { tags: true, media: true } }),
    prisma.comment.findMany({ where: { authorId: user.id } }),
    prisma.reaction.findMany({ where: { userId: user.id } }),
    prisma.follow.findMany({ where: { followerId: user.id } }),
    prisma.follow.findMany({ where: { followingId: user.id } }),
    prisma.communityMember.findMany({ where: { userId: user.id }, include: { community: true } }),
    prisma.message.findMany({ where: { senderId: user.id } }),
    prisma.meChatSession.findMany({
      where: {
        OR: [
          { hostId: user.id },
          { participants: { some: { userId: user.id } } },
        ],
      },
      include: {
        participants: true,
        items: { include: { votes: true } },
      },
    }),
    prisma.notification.findMany({ where: { recipientId: user.id } }),
    prisma.meshPrivacy.findUnique({ where: { userId: user.id } }),
    prisma.globalMeshMember.findUnique({ where: { userId: user.id } }),
    prisma.platformPost.findMany({ where: { connectedAccountId: { in: accountIds } }, include: { media: true } }),
    prisma.platformComment.findMany({ where: { connectedAccountId: { in: accountIds } } }),
    prisma.platformFollower.findMany({ where: { connectedAccountId: { in: accountIds } } }),
    prisma.platformMedia.findMany({ where: { connectedAccountId: { in: accountIds } } }),
    prisma.platformAnalytics.findMany({ where: { connectedAccountId: { in: accountIds } } }),
    prisma.dataVisibilityPolicy.findMany({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      location: user.location,
      website: user.website,
      isPublic: user.isPublic,
      createdAt: user.createdAt,
    },
    mesh: { meshPrivacy, globalMesh },
    nativeActivity: { posts, comments, reactions, follows, followers, communities, messages, meChatSessions, notifications },
    connectedAccounts,
    visibilityPolicies,
    syncedData: { platformPosts, platformComments, platformFollowers, platformMedia, platformAnalytics },
  });
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const payload = await readJsonObject(req);
  if (!payload) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { action } = payload;

  if (action === "delete-synced-data") {
    const result = await getOwnedConnectedAccountIds(user.id, payload.connectedAccountId);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

    const connectedAccountId = { in: result.ids.length > 0 ? result.ids : ["__none__"] };

    const deleted = await prisma.$transaction(async (tx) => {
      const platformPostIds = await tx.platformPost.findMany({
        where: { connectedAccountId },
        select: { id: true },
      });
      const policyPostIds = platformPostIds.map((post) => post.id);

      const platformMedia = await tx.platformMedia.deleteMany({ where: { connectedAccountId } });
      const platformComments = await tx.platformComment.deleteMany({ where: { connectedAccountId } });
      const platformFollowers = await tx.platformFollower.deleteMany({ where: { connectedAccountId } });
      const platformAnalytics = await tx.platformAnalytics.deleteMany({ where: { connectedAccountId } });
      const syncJobs = await tx.syncJob.deleteMany({ where: { connectedAccountId } });
      const platformPosts = await tx.platformPost.deleteMany({ where: { connectedAccountId } });
      const visibilityPolicies = await tx.dataVisibilityPolicy.deleteMany({
        where: {
          userId: user.id,
          OR: [
            { entityType: "connected_account", entityId: { in: result.ids } },
            { entityType: "platform_post", entityId: { in: policyPostIds.length > 0 ? policyPostIds : ["__none__"] } },
          ],
        },
      });

      await tx.connectedAccount.updateMany({
        where: { id: connectedAccountId, userId: user.id },
        data: { lastSyncAt: null, syncStatus: "idle", syncError: null },
      });

      const total = platformMedia.count + platformComments.count + platformFollowers.count +
        platformAnalytics.count + syncJobs.count + platformPosts.count + visibilityPolicies.count;

      return {
        platformMedia: platformMedia.count,
        platformComments: platformComments.count,
        platformFollowers: platformFollowers.count,
        platformAnalytics: platformAnalytics.count,
        syncJobs: syncJobs.count,
        platformPosts: platformPosts.count,
        visibilityPolicies: visibilityPolicies.count,
        total,
      };
    });

    revalidatePath("/privacy-controls");
    revalidatePath("/settings");
    revalidatePath("/mesh");
    revalidatePath("/feed");
    clearMeshCache(user.id);

    return NextResponse.json({ success: true, deleted });
  }

  if (action === "update-platform-post-visibility") {
    if (!isShortString(payload.postId, 128)) {
      return NextResponse.json({ error: "Invalid post" }, { status: 400 });
    }
    if (!isVisibility(payload.visibility)) {
      return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
    }

    const platformPost = await prisma.platformPost.findFirst({
      where: {
        id: payload.postId.trim(),
        connectedAccount: { userId: user.id },
      },
      select: {
        id: true,
        title: true,
        connectedAccount: {
          select: {
            id: true,
            platform: true,
            platformUsername: true,
          },
        },
      },
    });

    if (!platformPost) {
      return NextResponse.json({ error: "Imported post not found" }, { status: 404 });
    }

    const updated = await prisma.platformPost.update({
      where: { id: platformPost.id },
      data: { visibility: payload.visibility },
      select: {
        id: true,
        visibility: true,
        updatedAt: true,
      },
    });

    await upsertVisibilityPolicy({
      userId: user.id,
      entityType: "platform_post",
      entityId: platformPost.id,
      visibility: payload.visibility,
      allowDiscovery: payload.visibility === "public",
      allowAnalytics: payload.visibility !== "hidden",
      allowMeshiUse: false,
      metadata: {
        title: platformPost.title,
        platform: platformPost.connectedAccount.platform,
        connectedAccountId: platformPost.connectedAccount.id,
      },
    });

    revalidatePath("/privacy-controls");
    revalidatePath("/mesh");
    revalidatePath("/feed");
    clearMeshCache(user.id);

    return NextResponse.json({
      success: true,
      post: { ...updated, updatedAt: updated.updatedAt.toISOString() },
    });
  }

  if (action === "update-visibility-policy") {
    if (!isPolicyEntityType(payload.entityType)) {
      return NextResponse.json({ error: "Invalid policy type" }, { status: 400 });
    }
    if (!isVisibility(payload.visibility)) {
      return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
    }

    const entityId = typeof payload.entityId === "string" && payload.entityId.trim()
      ? payload.entityId.trim()
      : null;

    if (payload.entityType === "connected_account" && entityId) {
      const account = await prisma.connectedAccount.findFirst({
        where: { id: entityId, userId: user.id },
        select: { id: true },
      });
      if (!account) return NextResponse.json({ error: "Connected account not found" }, { status: 404 });
    }

    if (payload.entityType === "platform_post" && entityId) {
      const post = await prisma.platformPost.findFirst({
        where: { id: entityId, connectedAccount: { userId: user.id } },
        select: { id: true },
      });
      if (!post) return NextResponse.json({ error: "Imported post not found" }, { status: 404 });
      await prisma.platformPost.update({ where: { id: entityId }, data: { visibility: payload.visibility } });
    }

    const normalizedEntityType = normalizePolicyEntityType(payload.entityType as string);

    const policy = await upsertVisibilityPolicy({
      userId: user.id,
      entityType: normalizedEntityType,
      entityId,
      visibility: payload.visibility,
      allowDiscovery: readOptionalBoolean(payload, "allowDiscovery", payload.visibility === "public"),
      allowAnalytics: readOptionalBoolean(payload, "allowAnalytics", payload.visibility !== "hidden"),
      allowMeshiUse: readOptionalBoolean(payload, "allowMeshiUse", false),
      metadata: {
        updatedFrom: "privacy-control-center",
      },
    });

    revalidatePath("/privacy-controls");
    revalidatePath("/settings");
    revalidatePath("/mesh");
    revalidatePath("/feed");

    return NextResponse.json({
      success: true,
      policy: {
        id: policy.id,
        entityType: policy.entityType,
        entityId: policy.entityId,
        visibility: policy.visibility,
        allowDiscovery: policy.allowDiscovery,
        allowAnalytics: policy.allowAnalytics,
        allowMeshiUse: policy.allowMeshiUse,
        metadata: policy.metadata,
        updatedAt: policy.updatedAt.toISOString(),
      },
    });
  }

  if (action === "delete-visibility-policy") {
    if (!isShortString(payload.policyId, 128)) {
      return NextResponse.json({ error: "Invalid policy" }, { status: 400 });
    }

    const deleted = await prisma.dataVisibilityPolicy.deleteMany({
      where: { id: payload.policyId.trim(), userId: user.id },
    });

    revalidatePath("/privacy-controls");
    revalidatePath("/settings");
    revalidatePath("/mesh");
    revalidatePath("/feed");
    clearMeshCache(user.id);

    return NextResponse.json({ success: true, deleted: deleted.count });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
