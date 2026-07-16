import { getCurrentUser } from "@/lib/auth";
import { getConnectedAccountsDashboard } from "@/lib/connected-accounts";
import { prisma } from "@/lib/prisma";

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function countTotal(values: Record<string, number>) {
  return Object.values(values).reduce((total, value) => total + value, 0);
}

export type PrivacyControlCenterData = Awaited<ReturnType<typeof getPrivacyControlCenter>>;

export async function getPrivacyControlCenter() {
  const user = await getCurrentUser();
  if (!user) return null;

  const connectedDashboard = await getConnectedAccountsDashboard(user.id);
  const accountIds = connectedDashboard.accounts.map((account) => account.id);
  const connectedAccountWhere = accountIds.length > 0 ? { in: accountIds } : { in: ["__none__"] };

  const [
    meshPrivacy,
    globalMesh,
    visibilityPolicies,
    recentImportedContent,
    postCount,
    commentCount,
    reactionCount,
    messageCount,
    savedPostCount,
    notificationCount,
    interestCount,
    blockCount,
    sessionCount,
    platformPostCount,
    platformCommentCount,
    platformFollowerCount,
    platformMediaCount,
    platformAnalyticsCount,
    syncJobCount,
  ] = await Promise.all([
    prisma.meshPrivacy.findUnique({
      where: { userId: user.id },
      select: {
        meshVisibility: true,
        branchOverrides: true,
        showConnections: true,
        showStats: true,
      },
    }),
    prisma.globalMeshMember.findUnique({
      where: { userId: user.id },
      select: {
        isActive: true,
        sharedBranches: true,
      },
    }),
    prisma.dataVisibilityPolicy.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: {
        id: true,
        entityType: true,
        entityId: true,
        visibility: true,
        allowDiscovery: true,
        allowAnalytics: true,
        allowMeshiUse: true,
        metadata: true,
        updatedAt: true,
      },
    }),
    prisma.platformPost.findMany({
      where: { connectedAccountId: connectedAccountWhere },
      orderBy: [{ updatedAt: "desc" }, { publishedAt: "desc" }],
      take: 12,
      select: {
        id: true,
        title: true,
        content: true,
        url: true,
        postType: true,
        visibility: true,
        isNsfw: true,
        contentRating: true,
        thumbnailUrl: true,
        likeCount: true,
        commentCount: true,
        shareCount: true,
        viewCount: true,
        publishedAt: true,
        updatedAt: true,
        connectedAccount: {
          select: {
            id: true,
            platform: true,
            platformUsername: true,
            accountLabel: true,
          },
        },
      },
    }),
    prisma.post.count({ where: { authorId: user.id } }),
    prisma.comment.count({ where: { authorId: user.id } }),
    prisma.reaction.count({ where: { userId: user.id } }),
    prisma.message.count({ where: { senderId: user.id } }),
    prisma.savedPost.count({ where: { userId: user.id } }),
    prisma.notification.count({ where: { recipientId: user.id } }),
    prisma.userInterest.count({ where: { userId: user.id } }),
    prisma.block.count({ where: { blockerId: user.id } }),
    prisma.session.count({ where: { userId: user.id } }),
    prisma.platformPost.count({ where: { connectedAccountId: connectedAccountWhere } }),
    prisma.platformComment.count({ where: { connectedAccountId: connectedAccountWhere } }),
    prisma.platformFollower.count({ where: { connectedAccountId: connectedAccountWhere } }),
    prisma.platformMedia.count({ where: { connectedAccountId: connectedAccountWhere } }),
    prisma.platformAnalytics.count({ where: { connectedAccountId: connectedAccountWhere } }),
    prisma.syncJob.count({ where: { connectedAccountId: connectedAccountWhere } }),
  ]);

  const nativeStored = {
    posts: postCount,
    comments: commentCount,
    reactions: reactionCount,
    messages: messageCount,
    savedPosts: savedPostCount,
    notifications: notificationCount,
    interests: interestCount,
    blocks: blockCount,
    sessions: sessionCount,
    visibilityRules: visibilityPolicies.length,
  };

  const importedStored = {
    platformPosts: platformPostCount,
    platformComments: platformCommentCount,
    platformFollowers: platformFollowerCount,
    platformMedia: platformMediaCount,
    platformAnalytics: platformAnalyticsCount,
    syncJobs: syncJobCount,
  };

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      isPublic: user.isPublic,
      showInDiscovery: user.showInDiscovery,
      hideActivityStatus: user.hideActivityStatus,
      readReceipts: user.readReceipts,
      nsfwEnabled: user.nsfwEnabled,
      adultVerificationStatus: user.adultVerificationStatus,
      isMeshPro: user.isMeshPro,
      createdAt: user.createdAt.toISOString(),
    },
    connected: connectedDashboard,
    meshPrivacy: meshPrivacy ?? {
      meshVisibility: "private",
      branchOverrides: "{}",
      showConnections: false,
      showStats: false,
    },
    globalMesh: globalMesh ?? {
      isActive: false,
      sharedBranches: "[]",
    },
    storedData: {
      native: nativeStored,
      imported: importedStored,
      totals: {
        native: countTotal(nativeStored),
        imported: countTotal(importedStored),
        all: countTotal(nativeStored) + countTotal(importedStored),
      },
    },
    visibilityPolicies: visibilityPolicies.map((policy) => ({
      ...policy,
      updatedAt: policy.updatedAt.toISOString(),
    })),
    recentImportedContent: recentImportedContent.map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      url: post.url,
      postType: post.postType,
      visibility: post.visibility,
      isNsfw: post.isNsfw,
      contentRating: post.contentRating,
      thumbnailUrl: post.thumbnailUrl,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      shareCount: post.shareCount,
      viewCount: post.viewCount,
      publishedAt: toIso(post.publishedAt),
      updatedAt: post.updatedAt.toISOString(),
      account: {
        id: post.connectedAccount.id,
        platform: post.connectedAccount.platform,
        platformUsername: post.connectedAccount.platformUsername,
        accountLabel: post.connectedAccount.accountLabel,
      },
    })),
  };
}
