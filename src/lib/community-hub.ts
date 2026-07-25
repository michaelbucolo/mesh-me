"use server";

import { getCurrentUser } from "@/lib/auth";
import { COMMUNITY_SPACE_TYPES, communityThreadTitle } from "@/lib/community-constants";
import { canViewNsfw, nsfwHiddenWhere } from "@/lib/content-safety";
import { prisma } from "@/lib/prisma";
import { getBlockedUserIdSet } from "@/lib/privacy-policy";

function communityVisibilityWhere(userId: string) {
  return {
    OR: [
      { isPublic: true },
      { members: { some: { userId } } },
    ],
  };
}

function canModerateRole(role?: string | null) {
  return role === "admin" || role === "moderator";
}

function roleRank(role: string) {
  if (role === "admin") return 0;
  if (role === "moderator") return 1;
  return 2;
}

export async function getCommunitiesHubData() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [communities, myMemberships, totalPosts, totalMembers] = await Promise.all([
    prisma.community.findMany({
      where: communityVisibilityWhere(user.id),
      include: {
        _count: { select: { members: true, posts: true } },
        members: {
          where: { userId: user.id },
          select: { id: true, role: true },
        },
      },
      orderBy: [
        { updatedAt: "desc" },
        { members: { _count: "desc" } },
      ],
      take: 80,
    }),
    prisma.communityMember.findMany({
      where: { userId: user.id },
      include: {
        community: {
          include: {
            _count: { select: { members: true, posts: true } },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    }),
    prisma.post.count({
      where: {
        community: communityVisibilityWhere(user.id),
        ...nsfwHiddenWhere(user),
      },
    }),
    prisma.communityMember.count({
      where: {
        community: communityVisibilityWhere(user.id),
      },
    }),
  ]);

  const myCommunityIds = new Set(myMemberships.map((membership) => membership.communityId));
  const publicCommunities = communities.filter((community) => community.isPublic);
  const privateSpaces = myMemberships
    .map((membership) => membership.community)
    .filter((community) => !community.isPublic);
  const categoryCounts = new Map<string, number>();

  communities.forEach((community) => {
    const key = community.category || "general";
    categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
  });

  return {
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
    },
    stats: {
      spaces: communities.length,
      posts: totalPosts,
      members: totalMembers,
      privateSpaces: privateSpaces.length,
    },
    communities,
    myCommunities: communities.filter((community) => myCommunityIds.has(community.id)),
    publicCommunities,
    privateSpaces,
    categories: [...categoryCounts.entries()].map(([name, count]) => ({ name, count })),
    templates: COMMUNITY_SPACE_TYPES,
  };
}

export async function getCommunitySpaceData(slug: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const community = await prisma.community.findUnique({
    where: { slug },
    include: {
      _count: { select: { members: true, posts: true, reports: true } },
    },
  });

  if (!community) {
    return { status: "missing" as const };
  }

  const membership = await prisma.communityMember.findUnique({
    where: { userId_communityId: { userId: user.id, communityId: community.id } },
  });

  const canView = community.isPublic || Boolean(membership);
  const canPost = Boolean(membership);
  const canModerate = canModerateRole(membership?.role);
  const canAdmin = membership?.role === "admin";

  if (!canView) {
    return {
      status: "locked" as const,
      community: {
        id: community.id,
        name: community.name,
        slug: community.slug,
        isPublic: community.isPublic,
      },
    };
  }

  // A shared community is the one place a block could stay a live two-way
  // channel: co-membership is its own audience clause, so without this the
  // blocked party keeps authoring into C and the blocker keeps reading it,
  // complete with byline, avatar and a member-list row. The feed already holds
  // the line ("a block outranks every audience clause — including shared
  // community membership"); these are the same posts on their other page.
  const blockedIds = Array.from(await getBlockedUserIdSet(user.id));
  const notBlockedAuthor = blockedIds.length ? { authorId: { notIn: blockedIds } } : {};

  const [members, posts, reports, thread] = await Promise.all([
    prisma.communityMember.findMany({
      where: {
        communityId: community.id,
        ...(blockedIds.length ? { userId: { notIn: blockedIds } } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
      take: 80,
    }),
    prisma.post.findMany({
      where: {
        communityId: community.id,
        ...nsfwHiddenWhere(user),
        // Posts written inside a private community are stamped visibility
        // "private". If the community is later flipped to public, those posts
        // must not retroactively leak to non-members — so a non-member only
        // ever sees posts explicitly published as public. Members see all.
        ...(membership ? {} : { visibility: "public" }),
        ...notBlockedAuthor,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
          },
        },
        media: true,
        tags: true,
        _count: { select: { comments: true, reactions: true, reposts: true } },
        reactions: { where: { userId: user.id }, select: { id: true } },
        savedBy: { where: { userId: user.id }, select: { id: true } },
      },
      orderBy: [
        { isPinned: "desc" },
        { createdAt: "desc" },
      ],
      take: 40,
    }),
    canModerate
      ? prisma.report.findMany({
          where: { reportedCommunityId: community.id },
          include: {
            reporter: { select: { username: true, displayName: true, avatarUrl: true } },
            reportedPost: { select: { id: true, content: true } },
            reportedComment: { select: { id: true, content: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        })
      : Promise.resolve([]),
    membership
      ? prisma.messageThread.findFirst({
          where: {
            title: communityThreadTitle(community.id),
            threadType: "community",
            members: { some: { userId: user.id } },
          },
          include: {
            messages: {
              // The community chat is the live half of that same two-way
              // channel, so it takes the same block filter as the post list.
              where: blockedIds.length ? { senderId: { notIn: blockedIds } } : {},
              include: {
                sender: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                  },
                },
              },
              orderBy: { createdAt: "desc" },
              take: 30,
            },
          },
        })
      : Promise.resolve(null),
  ]);

  return {
    status: "ready" as const,
    user: {
      id: user.id,
      username: user.username,
      canViewNsfw: canViewNsfw(user),
    },
    community,
    membership,
    role: membership?.role || null,
    canView,
    canPost,
    canModerate,
    canAdmin,
    members: members.sort((a, b) => roleRank(a.role) - roleRank(b.role)),
    posts,
    reports,
    chatMessages: thread?.messages.reverse() || [],
  };
}
