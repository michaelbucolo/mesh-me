"use server";

import { prisma } from "./prisma";
import { getCurrentUser } from "./auth";

export async function getFeedPosts(page = 1, limit = 20) {
  const user = await getCurrentUser();
  if (!user) return [];

  const following = await prisma.follow.findMany({
    where: { followerId: user.id },
    select: { followingId: true },
  });

  const followingIds = following.map((f) => f.followingId);

  const communityMemberships = await prisma.communityMember.findMany({
    where: { userId: user.id },
    select: { communityId: true },
  });

  const communityIds = communityMemberships.map((m) => m.communityId);

  const posts = await prisma.post.findMany({
    where: {
      OR: [
        { authorId: { in: [...followingIds, user.id] } },
        { communityId: { in: communityIds } },
      ],
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
      community: {
        select: { id: true, name: true, slug: true },
      },
      media: true,
      tags: true,
      _count: {
        select: { comments: true, reactions: true, reposts: true },
      },
      reactions: {
        where: { userId: user.id },
        select: { id: true },
      },
      savedBy: {
        where: { userId: user.id },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  return posts;
}

export async function getExplorePosts(page = 1, limit = 20) {
  const user = await getCurrentUser();

  const posts = await prisma.post.findMany({
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
      community: {
        select: { id: true, name: true, slug: true },
      },
      media: true,
      tags: true,
      _count: {
        select: { comments: true, reactions: true, reposts: true },
      },
      reactions: user ? {
        where: { userId: user.id },
        select: { id: true },
      } : false,
      savedBy: user ? {
        where: { userId: user.id },
        select: { id: true },
      } : false,
    },
    orderBy: [
      { reactions: { _count: "desc" } },
      { createdAt: "desc" },
    ],
    skip: (page - 1) * limit,
    take: limit,
  });

  return posts;
}

export async function getPostById(postId: string) {
  const user = await getCurrentUser();

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          isVerified: true,
          bio: true,
        },
      },
      community: {
        select: { id: true, name: true, slug: true },
      },
      media: true,
      tags: true,
      comments: {
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          replies: {
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        where: { parentId: null },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: { comments: true, reactions: true, reposts: true },
      },
      reactions: user ? {
        where: { userId: user.id },
        select: { id: true },
      } : false,
      savedBy: user ? {
        where: { userId: user.id },
        select: { id: true },
      } : false,
    },
  });

  return post;
}

export async function getUserProfile(username: string) {
  const currentUser = await getCurrentUser();

  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      interests: true,
      links: true,
      _count: {
        select: {
          followers: true,
          following: true,
          posts: true,
        },
      },
    },
  });

  if (!user) return null;

  const isFollowing = currentUser
    ? !!(await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUser.id,
            followingId: user.id,
          },
        },
      }))
    : false;

  const mutualFollowers = currentUser
    ? await prisma.follow.findMany({
        where: {
          followingId: user.id,
          followerId: {
            in: (
              await prisma.follow.findMany({
                where: { followingId: currentUser.id },
                select: { followerId: true },
              })
            ).map((f) => f.followerId),
          },
        },
        include: {
          follower: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
        take: 5,
      })
    : [];

  return {
    ...user,
    isFollowing,
    isOwnProfile: currentUser?.id === user.id,
    mutualFollowers: mutualFollowers.map((f) => f.follower),
  };
}

export async function getUserPosts(username: string, page = 1, limit = 20) {
  const currentUser = await getCurrentUser();

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return [];

  const posts = await prisma.post.findMany({
    where: { authorId: user.id },
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
      community: {
        select: { id: true, name: true, slug: true },
      },
      media: true,
      tags: true,
      _count: {
        select: { comments: true, reactions: true, reposts: true },
      },
      reactions: currentUser ? {
        where: { userId: currentUser.id },
        select: { id: true },
      } : false,
      savedBy: currentUser ? {
        where: { userId: currentUser.id },
        select: { id: true },
      } : false,
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  return posts;
}

export async function getCommunities() {
  const user = await getCurrentUser();

  const communities = await prisma.community.findMany({
    include: {
      _count: {
        select: { members: true, posts: true },
      },
      members: user ? {
        where: { userId: user.id },
        select: { id: true, role: true },
      } : false,
    },
    orderBy: { members: { _count: "desc" } },
  });

  return communities;
}

export async function getCommunityBySlug(slug: string) {
  const user = await getCurrentUser();

  const community = await prisma.community.findUnique({
    where: { slug },
    include: {
      _count: {
        select: { members: true, posts: true },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        take: 20,
      },
    },
  });

  if (!community) return null;

  const membership = user
    ? await prisma.communityMember.findUnique({
        where: { userId_communityId: { userId: user.id, communityId: community.id } },
      })
    : null;

  return {
    ...community,
    isMember: !!membership,
    userRole: membership?.role || null,
  };
}

export async function getCommunityPosts(communityId: string, page = 1, limit = 20) {
  const user = await getCurrentUser();

  return prisma.post.findMany({
    where: { communityId },
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
      _count: {
        select: { comments: true, reactions: true, reposts: true },
      },
      reactions: user ? {
        where: { userId: user.id },
        select: { id: true },
      } : false,
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });
}

export async function getMessageThreads() {
  const user = await getCurrentUser();
  if (!user) return [];

  const threads = await prisma.messageThread.findMany({
    where: { members: { some: { userId: user.id } } },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return threads.map((thread) => ({
    ...thread,
    otherUser: thread.members.find((m) => m.userId !== user.id)?.user,
    lastMessage: thread.messages[0] || null,
  }));
}

export async function getThreadMessages(threadId: string) {
  return prisma.message.findMany({
    where: { threadId },
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
    orderBy: { createdAt: "asc" },
  });
}

export async function getNotifications(page = 1, limit = 30) {
  const user = await getCurrentUser();
  if (!user) return { notifications: [], unreadCount: 0 };

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: user.id },
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({
      where: { recipientId: user.id, read: false },
    }),
  ]);

  return { notifications, unreadCount };
}

export async function searchAll(query: string) {
  if (!query?.trim()) return { users: [], posts: [], communities: [] };

  const q = query.trim();

  const [users, posts, communities] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q } },
          { displayName: { contains: q } },
        ],
        isSuspended: false,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        isVerified: true,
        _count: { select: { followers: true } },
      },
      take: 10,
    }),
    prisma.post.findMany({
      where: { content: { contains: q } },
      include: {
        author: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        _count: { select: { comments: true, reactions: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.community.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { description: { contains: q } },
        ],
      },
      include: {
        _count: { select: { members: true } },
      },
      take: 10,
    }),
  ]);

  return { users, posts, communities };
}

export async function getDiscoverUsers() {
  const user = await getCurrentUser();
  if (!user) return [];

  const following = await prisma.follow.findMany({
    where: { followerId: user.id },
    select: { followingId: true },
  });
  const followingIds = following.map((f) => f.followingId);

  const userInterests = await prisma.userInterest.findMany({
    where: { userId: user.id },
    select: { tag: true },
  });
  const tags = userInterests.map((i) => i.tag);

  const suggestedUsers = await prisma.user.findMany({
    where: {
      id: { notIn: [...followingIds, user.id] },
      isSuspended: false,
      ...(tags.length > 0 ? { interests: { some: { tag: { in: tags } } } } : {}),
    },
    include: {
      interests: true,
      _count: { select: { followers: true, posts: true } },
    },
    take: 20,
  });

  return suggestedUsers;
}

export async function getTrendingCommunities() {
  return prisma.community.findMany({
    include: {
      _count: { select: { members: true, posts: true } },
    },
    orderBy: { members: { _count: "desc" } },
    take: 10,
  });
}

// ─── Admin Queries ───────────────────────────────────────────

export async function getAdminStats() {
  const [userCount, postCount, communityCount, reportCount, recentUsers, recentReports] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.community.count(),
    prisma.report.count({ where: { status: "pending" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        isAdmin: true,
        isSuspended: true,
        createdAt: true,
        _count: { select: { posts: true, followers: true } },
      },
    }),
    prisma.report.findMany({
      where: { status: "pending" },
      include: {
        reporter: { select: { username: true, displayName: true } },
        reportedUser: { select: { username: true, displayName: true } },
        reportedPost: { select: { id: true, content: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return { userCount, postCount, communityCount, reportCount, recentUsers, recentReports };
}
