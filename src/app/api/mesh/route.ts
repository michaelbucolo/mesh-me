import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [followingData, followersData, communitiesData, interestsData, postsData, connectedAccountsData, alterEgosData, meshiPrefData] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: user.id },
      include: {
        following: {
          select: {
            id: true, username: true, displayName: true, avatarUrl: true,
            status: true, lastSeenAt: true,
            _count: { select: { followers: true, posts: true } },
            interests: { select: { tag: true }, take: 5 },
          },
        },
      },
      take: 80,
    }),
    prisma.follow.findMany({
      where: { followingId: user.id },
      include: {
        follower: {
          select: {
            id: true, username: true, displayName: true, avatarUrl: true,
            status: true, lastSeenAt: true,
            _count: { select: { followers: true, posts: true } },
            interests: { select: { tag: true }, take: 5 },
          },
        },
      },
      take: 80,
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
      take: 50,
    }),
    prisma.connectedAccount.findMany({
      where: { userId: user.id, isActive: true },
      select: { id: true, platform: true, platformUsername: true },
    }),
    // Fetch alter egos for this user
    prisma.alterEgo.findMany({
      where: { userId: user.id, isActive: true },
      select: { id: true, username: true, displayName: true, bio: true, avatarUrl: true },
      orderBy: { createdAt: "asc" },
    }),
    // Fetch user's Meshi customization preferences
    prisma.meshiPreference.findUnique({
      where: { userId: user.id },
      select: { colorTheme: true, hatStyle: true, faceStyle: true },
    }),
  ]);

  // Find mutual follows (people the user follows who also follow them back)
  const followingIds = new Set(followingData.map((f) => f.following.id));
  const followerIds = new Set(followersData.map((f) => f.follower.id));
  const mutualIds = [...followingIds].filter((id) => followerIds.has(id));

  // Find which users share communities with the current user
  const communityIds = communitiesData.map((cm) => cm.community.id);
  const allUserIds = [...new Set([...followingIds, ...followerIds])];
  const sharedCommunityMembers = communityIds.length > 0
    ? await prisma.communityMember.findMany({
        where: {
          communityId: { in: communityIds },
          userId: { in: allUserIds },
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

  // Find shared interests between user and all connected users
  const userTags = new Set(interestsData.map((i) => i.tag));
  const userSharedInterests: Record<string, string[]> = {};
  for (const f of followingData) {
    const shared = f.following.interests?.filter((i) => userTags.has(i.tag)).map((i) => i.tag) || [];
    if (shared.length > 0) userSharedInterests[f.following.id] = shared;
  }
  for (const f of followersData) {
    if (!userSharedInterests[f.follower.id]) {
      const shared = f.follower.interests?.filter((i) => userTags.has(i.tag)).map((i) => i.tag) || [];
      if (shared.length > 0) userSharedInterests[f.follower.id] = shared;
    }
  }

  // Calculate interaction counts per user (comments, likes, messages exchanged)
  // This powers interaction-based proximity — more interactions = closer in the mesh
  const interactionCounts: Record<string, number> = {};

  if (allUserIds.length > 0) {
    // Count comments on each other's posts
    const commentInteractions = await prisma.comment.findMany({
      where: {
        OR: [
          { authorId: user.id, post: { authorId: { in: [...allUserIds] } } },
          { authorId: { in: [...allUserIds] }, post: { authorId: user.id } },
        ],
      },
      select: {
        authorId: true,
        post: { select: { authorId: true } },
      },
    });

    for (const c of commentInteractions) {
      const otherId = c.authorId === user.id ? c.post.authorId : c.authorId;
      interactionCounts[otherId] = (interactionCounts[otherId] || 0) + 1;
    }

    // Count reactions on each other's posts
    const reactionInteractions = await prisma.reaction.findMany({
      where: {
        OR: [
          { userId: user.id, post: { authorId: { in: [...allUserIds] } } },
          { userId: { in: [...allUserIds] }, post: { authorId: user.id } },
        ],
      },
      select: {
        userId: true,
        post: { select: { authorId: true } },
      },
    });

    for (const r of reactionInteractions) {
      const otherId = r.userId === user.id ? r.post.authorId : r.userId;
      interactionCounts[otherId] = (interactionCounts[otherId] || 0) + 1;
    }

    // Mutual follows count as extra interaction weight
    for (const id of mutualIds) {
      interactionCounts[id] = (interactionCounts[id] || 0) + 3;
    }
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
      sharedInterests: userSharedInterests[f.following.id] || [],
      lastSeenAt: f.following.lastSeenAt,
      followerCount: f.following._count.followers,
      postCount: f.following._count.posts,
      interactionCount: interactionCounts[f.following.id] || 0,
      status: f.following.status || "offline",
    })),
    followers: followersData.map((f) => ({
      ...f.follower,
      isMutual: mutualIds.includes(f.follower.id),
      sharedCommunities: userCommunityLinks[f.follower.id] || [],
      sharedInterests: userSharedInterests[f.follower.id] || [],
      followerCount: f.follower._count.followers,
      postCount: f.follower._count.posts,
      interactionCount: interactionCounts[f.follower.id] || 0,
      status: f.follower.status || "offline",
      lastSeenAt: f.follower.lastSeenAt,
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
      content: p.content.slice(0, 200),
      createdAt: p.createdAt,
      communityId: p.communityId,
      tags: p.tags.map((t) => t.tag),
      likeCount: p._count.reactions,
      commentCount: p._count.comments,
      repostCount: p._count.reposts,
    })),
    connectedAccounts: connectedAccountsData,
    alterEgos: alterEgosData,
    meshiPreference: meshiPrefData || { colorTheme: "blue", hatStyle: "none", faceStyle: "happy" },
    stats: {
      followingCount: followingData.length,
      followerCount: followersData.length,
      mutualCount: mutualIds.length,
      communityCount: communitiesData.length,
      postCount: postsData.length,
      interestCount: interestsData.length,
      connectedPlatformCount: connectedAccountsData.length,
      alterEgoCount: alterEgosData.length,
    },
  });
  } catch (error) {
    console.error("Mesh API error:", error);
    return NextResponse.json(
      { error: "Failed to load mesh data" },
      { status: 500 }
    );
  }
}
