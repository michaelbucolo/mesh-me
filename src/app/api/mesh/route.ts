import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [followingData, followersData, communitiesData, interestsData, postsData, connectedAccountsData] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: user.id },
      include: {
        following: {
          select: {
            id: true, username: true, displayName: true, avatarUrl: true,
            _count: { select: { followers: true, posts: true } },
            interests: { select: { tag: true }, take: 5 },
          },
        },
      },
      take: 50,
    }),
    prisma.follow.findMany({
      where: { followingId: user.id },
      include: {
        follower: {
          select: {
            id: true, username: true, displayName: true, avatarUrl: true,
            _count: { select: { followers: true, posts: true } },
          },
        },
      },
      take: 50,
    }),
    prisma.communityMember.findMany({
      where: { userId: user.id },
      include: {
        community: {
          select: {
            id: true, name: true, slug: true, description: true, category: true,
            _count: { select: { members: true, posts: true } },
          },
        },
      },
    }),
    prisma.userInterest.findMany({ where: { userId: user.id }, select: { tag: true } }),
    prisma.post.findMany({
      where: { authorId: user.id },
      select: {
        id: true, content: true, createdAt: true,
        communityId: true,
        tags: { select: { tag: true } },
        _count: { select: { reactions: true, comments: true, reposts: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.connectedAccount.findMany({
      where: { userId: user.id, isActive: true },
      select: { id: true, platform: true, platformUsername: true },
    }),
  ]);

  // Find mutual follows (people the user follows who also follow them back)
  const followingIds = new Set(followingData.map((f) => f.following.id));
  const followerIds = new Set(followersData.map((f) => f.follower.id));
  const mutualIds = [...followingIds].filter((id) => followerIds.has(id));

  // Find which users share communities with the current user
  const communityIds = communitiesData.map((cm) => cm.community.id);
  const sharedCommunityMembers = communityIds.length > 0
    ? await prisma.communityMember.findMany({
        where: {
          communityId: { in: communityIds },
          userId: { in: [...followingIds] },
        },
        select: { userId: true, communityId: true },
      })
    : [];

  // Build user-to-community connections
  const userCommunityLinks: Record<string, string[]> = {};
  for (const m of sharedCommunityMembers) {
    if (!userCommunityLinks[m.userId]) userCommunityLinks[m.userId] = [];
    userCommunityLinks[m.userId].push(m.communityId);
  }

  // Find shared interests between user and followed users
  const userTags = new Set(interestsData.map((i) => i.tag));
  const followingWithSharedInterests: Record<string, string[]> = {};
  for (const f of followingData) {
    const shared = f.following.interests?.filter((i) => userTags.has(i.tag)).map((i) => i.tag) || [];
    if (shared.length > 0) followingWithSharedInterests[f.following.id] = shared;
  }

  return NextResponse.json({
    user: {
      id: user.id, username: user.username, displayName: user.displayName,
      avatarUrl: user.avatarUrl, bio: user.bio,
    },
    following: followingData.map((f) => ({
      ...f.following,
      isMutual: mutualIds.includes(f.following.id),
      sharedCommunities: userCommunityLinks[f.following.id] || [],
      sharedInterests: followingWithSharedInterests[f.following.id] || [],
      followerCount: f.following._count.followers,
      postCount: f.following._count.posts,
    })),
    followers: followersData.map((f) => ({
      ...f.follower,
      isMutual: mutualIds.includes(f.follower.id),
      followerCount: f.follower._count.followers,
      postCount: f.follower._count.posts,
    })),
    communities: communitiesData.map((cm) => ({
      id: cm.community.id,
      name: cm.community.name,
      slug: cm.community.slug,
      description: cm.community.description,
      category: cm.community.category,
      memberCount: cm.community._count.members,
      postCount: cm.community._count.posts,
    })),
    interests: interestsData.map((i) => i.tag),
    posts: postsData.map((p) => ({
      id: p.id,
      content: p.content.slice(0, 120),
      createdAt: p.createdAt,
      communityId: p.communityId,
      tags: p.tags.map((t) => t.tag),
      likeCount: p._count.reactions,
      commentCount: p._count.comments,
      repostCount: p._count.reposts,
    })),
    connectedAccounts: connectedAccountsData,
    stats: {
      followingCount: followingData.length,
      followerCount: followersData.length,
      mutualCount: mutualIds.length,
      communityCount: communitiesData.length,
      postCount: postsData.length,
      interestCount: interestsData.length,
      connectedPlatformCount: connectedAccountsData.length,
    },
  });
}
