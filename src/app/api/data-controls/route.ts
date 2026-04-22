import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    syncedData: { platformPosts, platformComments, platformFollowers, platformMedia, platformAnalytics },
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { action } = await req.json();
  if (action !== "delete-synced-data") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const accounts = await prisma.connectedAccount.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  const connectedAccountId = { in: accounts.map((account) => account.id) };

  const deleted = await prisma.$transaction(async (tx) => {
    const platformMedia = await tx.platformMedia.deleteMany({ where: { connectedAccountId } });
    const platformComments = await tx.platformComment.deleteMany({ where: { connectedAccountId } });
    const platformFollowers = await tx.platformFollower.deleteMany({ where: { connectedAccountId } });
    const platformAnalytics = await tx.platformAnalytics.deleteMany({ where: { connectedAccountId } });
    const syncJobs = await tx.syncJob.deleteMany({ where: { connectedAccountId } });
    const platformPosts = await tx.platformPost.deleteMany({ where: { connectedAccountId } });

    await tx.connectedAccount.updateMany({
      where: { userId: user.id },
      data: { lastSyncAt: null, syncStatus: "idle", syncError: null },
    });

    const total = platformMedia.count + platformComments.count + platformFollowers.count +
      platformAnalytics.count + syncJobs.count + platformPosts.count;

    return {
      platformMedia: platformMedia.count,
      platformComments: platformComments.count,
      platformFollowers: platformFollowers.count,
      platformAnalytics: platformAnalytics.count,
      syncJobs: syncJobs.count,
      platformPosts: platformPosts.count,
      total,
    };
  });

  return NextResponse.json({ success: true, deleted });
}
