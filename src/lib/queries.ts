"use server";

import { prisma } from "./prisma";
import { getCurrentUser } from "./auth";
import { canViewNsfw, nsfwHiddenWhere } from "./content-safety";

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

const SOCIAL_SEARCH_SOURCES = [
  {
    id: "twitter",
    name: "X",
    description: "Public posts, creators, and conversations from synced X accounts.",
    connectHref: "/connected-accounts?platform=twitter",
  },
  {
    id: "instagram",
    name: "Instagram",
    description: "Profiles, photos, reels, and creator references from connected Instagram accounts.",
    connectHref: "/connected-accounts?platform=instagram",
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Videos, channels, titles, and synced creator performance from connected YouTube accounts.",
    connectHref: "/connected-accounts?platform=youtube",
  },
  {
    id: "snapchat",
    name: "Snapchat",
    description: "Connected Snapchat identity and share references where provider permissions allow.",
    connectHref: "/connected-accounts?platform=snapchat",
  },
] as const;

const SOCIAL_SEARCH_PLATFORM_IDS = SOCIAL_SEARCH_SOURCES.map((source) => source.id);

function sourceSearchUrl(platform: string, query: string) {
  const encoded = encodeURIComponent(query);
  const tag = query.toLowerCase().replace(/^#/, "").replace(/[^a-z0-9_]+/g, "");

  switch (platform) {
    case "twitter":
      return `https://x.com/search?q=${encoded}&src=typed_query`;
    case "instagram":
      return tag ? `https://www.instagram.com/explore/tags/${tag}/` : "https://www.instagram.com/explore/";
    case "youtube":
      return `https://www.youtube.com/results?search_query=${encoded}`;
    case "snapchat":
      return `https://www.snapchat.com/search?q=${encoded}`;
    default:
      return "";
  }
}

function parseStoredRecord(value: string | null | undefined): Record<string, string> {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
      )
    );
  } catch {
    return {};
  }
}

const VALID_PROFILE_VISIBILITIES = new Set(["private", "friends", "public", "partial"]);

function normalizeProfileVisibility(value: string | null | undefined, fallback: string) {
  return value && VALID_PROFILE_VISIBILITIES.has(value) ? value : fallback;
}

function canSeeVisibility(visibility: string, isOwnProfile: boolean, isFriend: boolean) {
  if (isOwnProfile) return true;
  if (visibility === "public") return true;
  if (visibility === "friends") return isFriend;
  return false;
}

async function getMutualFriendIds(userId: string) {
  const [following, followers] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
    prisma.follow.findMany({ where: { followingId: userId }, select: { followerId: true } }),
  ]);
  const followerIds = new Set(followers.map((item) => item.followerId));
  return following.map((item) => item.followingId).filter((id) => followerIds.has(id));
}

async function canCurrentUserViewNativePost(post: { authorId: string; visibility: string }, currentUser: CurrentUser | null) {
  if (post.visibility === "public") return true;
  if (!currentUser) return false;
  if (post.authorId === currentUser.id) return true;
  if (post.visibility !== "friends") return false;
  const [followToAuthor, followFromAuthor] = await Promise.all([
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: currentUser.id, followingId: post.authorId } },
      select: { id: true },
    }),
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: post.authorId, followingId: currentUser.id } },
      select: { id: true },
    }),
  ]);
  return Boolean(followToAuthor && followFromAuthor);
}

async function searchWikipedia(query: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 800);

  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: query,
      gsrlimit: "5",
      prop: "pageimages|extracts",
      exintro: "1",
      explaintext: "1",
      exsentences: "2",
      piprop: "thumbnail",
      pithumbsize: "160",
      origin: "*",
    });
    const response = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`, {
      signal: controller.signal,
      next: { revalidate: 3600 },
    });
    if (!response.ok) return [];
    const payload = await response.json().catch(() => null) as {
      query?: {
        pages?: Record<string, {
          pageid: number;
          title: string;
          extract?: string;
          thumbnail?: { source?: string };
        }>;
      };
    } | null;

    return Object.values(payload?.query?.pages || {}).map((page) => ({
      id: String(page.pageid),
      title: page.title,
      extract: page.extract || "",
      url: `https://en.wikipedia.org/?curid=${page.pageid}`,
      thumbnailUrl: page.thumbnail?.source || null,
      source: "Wikipedia",
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function getFeedPosts(page = 1, limit = 20, currentUser?: CurrentUser | null) {
  const user = currentUser ?? await getCurrentUser();
  if (!user) return [];

  const [following, communityMemberships, friendIds] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    }),
    prisma.communityMember.findMany({
      where: { userId: user.id },
      select: { communityId: true },
    }),
    getMutualFriendIds(user.id),
  ]);

  const followingIds = following.map((f) => f.followingId);
  const communityIds = communityMemberships.map((m) => m.communityId);

  const posts = await prisma.post.findMany({
    where: {
      ...nsfwHiddenWhere(user),
      AND: [
        {
          OR: [
            { authorId: { in: [...followingIds, user.id] } },
            { communityId: { in: communityIds } },
          ],
        },
        {
          OR: [
            { authorId: user.id },
            { communityId: { in: communityIds } },
            { visibility: "public" },
            { visibility: "friends", authorId: { in: friendIds } },
          ],
        },
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

export async function getExplorePosts(page = 1, limit = 20, currentUser?: CurrentUser | null) {
  const user = currentUser ?? await getCurrentUser();
  const visibilityFilter = user
    ? {
        ...nsfwHiddenWhere(user),
        visibility: "public",
        OR: [
          { authorId: user.id },
          { author: { isSuspended: false, isPublic: true, showInDiscovery: true } },
        ],
      }
    : { isNsfw: false, visibility: "public", author: { isSuspended: false, isPublic: true, showInDiscovery: true } };

  const posts = await prisma.post.findMany({
    where: visibilityFilter,
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

  if (!post) return null;
  if (post.isNsfw && !canViewNsfw(user)) return null;
  if (!(await canCurrentUserViewNativePost(post, user))) return null;

  return post;
}

export async function getUserProfile(username: string) {
  const currentUser = await getCurrentUser();

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      location: true,
      website: true,
      avatarUrl: true,
      bannerUrl: true,
      accentColor: true,
      isPublic: true,
      isVerified: true,
      isMeshPro: true,
      isSuspended: true,
      createdAt: true,
      interests: {
        select: { id: true, tag: true },
        orderBy: { tag: "asc" },
      },
      links: {
        select: { id: true, label: true, url: true },
      },
      connectedAccounts: {
        where: { isActive: true },
        select: {
          id: true,
          platform: true,
          platformUsername: true,
          accountLabel: true,
          lastSyncAt: true,
          syncStatus: true,
        },
        orderBy: { platform: "asc" },
      },
      meshiPreference: {
        select: {
          colorTheme: true,
          hatStyle: true,
          faceStyle: true,
          hairStyle: true,
          accessoryStyle: true,
          eyeStyle: true,
          badgeStyle: true,
          outfitStyle: true,
        },
      },
      meshPrivacy: {
        select: {
          meshVisibility: true,
          branchOverrides: true,
          showConnections: true,
          showStats: true,
        },
      },
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

  const isOwnProfile = currentUser?.id === user.id;
  let isFollowing = false;
  let isFriend = false;
  let mutualFollowers: Array<{ follower: { id: string; username: string; displayName: string; avatarUrl: string | null } }> = [];

  if (currentUser) {
    const [followToUser, followFromUser, currentFollowing] = await Promise.all([
      prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUser.id,
            followingId: user.id,
          },
        },
      }),
      prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: user.id,
            followingId: currentUser.id,
          },
        },
      }),
      prisma.follow.findMany({
        where: { followerId: currentUser.id },
        select: { followingId: true },
      }),
    ]);

    isFollowing = Boolean(followToUser);
    isFriend = Boolean(followToUser && followFromUser);

    mutualFollowers = await prisma.follow.findMany({
        where: {
          followingId: user.id,
          followerId: {
          in: currentFollowing.map((f) => f.followingId),
          },
        },
        include: {
          follower: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
        take: 5,
    });
  }

  const userIsPublic = user.isPublic;
  const meshShowStats = user.meshPrivacy?.showStats ?? false;
  const meshVisibility = normalizeProfileVisibility(
    user.meshPrivacy?.meshVisibility,
    userIsPublic ? "public" : "private"
  );
  const branchOverrides = parseStoredRecord(user.meshPrivacy?.branchOverrides);
  const canViewProfile = isOwnProfile || userIsPublic || canSeeVisibility(meshVisibility, isOwnProfile, isFriend);

  function canSeeBranch(branchKey: string) {
    if (!canViewProfile) return false;
    const fallback = meshVisibility === "partial" ? (userIsPublic ? "public" : "private") : meshVisibility;
    return canSeeVisibility(normalizeProfileVisibility(branchOverrides[branchKey], fallback), isOwnProfile, isFriend);
  }

  const sectionVisibility = {
    profile: canViewProfile,
    stats: isOwnProfile || (canViewProfile && (meshShowStats || userIsPublic)),
    people: canSeeBranch("people"),
    interests: canSeeBranch("interests"),
    platforms: canSeeBranch("platforms"),
    content: canSeeBranch("content"),
  };

  const hiddenCounts = { followers: 0, following: 0, posts: 0 };

  return {
    ...user,
    bio: canViewProfile ? user.bio : null,
    location: canViewProfile ? user.location : null,
    website: canViewProfile ? user.website : null,
    links: canViewProfile ? user.links : [],
    interests: sectionVisibility.interests ? user.interests : [],
    connectedAccounts: sectionVisibility.platforms ? user.connectedAccounts : [],
    _count: sectionVisibility.stats ? user._count : hiddenCounts,
    meshPrivacy: undefined,
    isFollowing,
    isOwnProfile,
    isFriend,
    privacyLevel: canViewProfile ? meshVisibility : "private",
    sectionVisibility,
    mutualFollowers: sectionVisibility.people ? mutualFollowers.map((f) => f.follower) : [],
  };
}

export async function getUserPosts(username: string, page = 1, limit = 20) {
  const currentUser = await getCurrentUser();

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      isPublic: true,
      meshPrivacy: {
        select: {
          meshVisibility: true,
          branchOverrides: true,
        },
      },
    },
  });
  if (!user) return [];

  const isOwnProfile = currentUser?.id === user.id;
  let isFriend = false;
  if (currentUser && !isOwnProfile) {
    const [followToUser, followFromUser] = await Promise.all([
      prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUser.id,
            followingId: user.id,
          },
        },
      }),
      prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: user.id,
            followingId: currentUser.id,
          },
        },
      }),
    ]);
    isFriend = Boolean(followToUser && followFromUser);
  }

  const meshVisibility = normalizeProfileVisibility(
    user.meshPrivacy?.meshVisibility,
    user.isPublic ? "public" : "private"
  );
  const branchOverrides = parseStoredRecord(user.meshPrivacy?.branchOverrides);
  const fallback = meshVisibility === "partial" ? (user.isPublic ? "public" : "private") : meshVisibility;
  const contentVisibility = normalizeProfileVisibility(branchOverrides.content, fallback);
  if (!canSeeVisibility(contentVisibility, isOwnProfile, isFriend)) return [];

  const postVisibilityWhere = isOwnProfile
    ? {}
    : { OR: [{ visibility: "public" }, ...(isFriend ? [{ visibility: "friends" }] : [])] };

  const posts = await prisma.post.findMany({
    where: {
      ...nsfwHiddenWhere(currentUser),
      authorId: user.id,
      ...postVisibilityWhere,
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
    where: user
      ? {
          OR: [
            { isPublic: true },
            { members: { some: { userId: user.id } } },
          ],
        }
      : { isPublic: true },
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

  if (!community.isPublic && !membership) return null;

  return {
    ...community,
    isMember: !!membership,
    userRole: membership?.role || null,
  };
}

export async function getCommunityPosts(communityId: string, page = 1, limit = 20) {
  const user = await getCurrentUser();
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { isPublic: true },
  });

  if (!community) return [];
  if (!community.isPublic) {
    if (!user) return [];
    const membership = await prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: user.id, communityId } },
      select: { id: true },
    });
    if (!membership) return [];
  }

  return prisma.post.findMany({
    where: { ...nsfwHiddenWhere(user), communityId },
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
      savedBy: user ? {
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

  const [threads, unreadCounts] = await Promise.all([
    prisma.messageThread.findMany({
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
                isVerified: true,
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
    }),
    prisma.$queryRaw<Array<{ threadId: string; unreadCount: bigint | number }>>`
      SELECT
        tm.threadId AS threadId,
        COUNT(m.id) AS unreadCount
      FROM ThreadMember tm
      LEFT JOIN Message m
        ON m.threadId = tm.threadId
       AND m.senderId != ${user.id}
       AND m.createdAt > tm.lastRead
      WHERE tm.userId = ${user.id}
      GROUP BY tm.threadId
    `,
  ]);

  const unreadCountByThread = new Map(unreadCounts.map((row) => [row.threadId, Number(row.unreadCount)]));

  return threads.map((thread) => ({
    ...thread,
    otherUsers: thread.members.filter((m) => m.userId !== user.id).map((m) => m.user),
    otherUser: thread.members.find((m) => m.userId !== user.id)?.user,
    memberCount: thread.members.length,
    displayTitle:
      thread.title ||
      (thread.members.filter((m) => m.userId !== user.id).length > 1
        ? thread.members
            .filter((m) => m.userId !== user.id)
            .map((m) => m.user.displayName)
            .join(", ")
        : thread.members.find((m) => m.userId !== user.id)?.user.displayName || "Conversation"),
    lastMessage: thread.messages[0] || null,
    unreadCount: unreadCountByThread.get(thread.id) || 0,
  }));
}

export async function getThreadMessages(threadId: string) {
  const user = await getCurrentUser();
  if (!user) return [];

  // Verify the user is a member of this thread
  const membership = await prisma.threadMember.findFirst({
    where: { threadId, userId: user.id },
  });
  if (!membership) return [];

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
        post: {
          select: {
            id: true,
            content: true,
            community: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
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
  const user = await getCurrentUser();
  if (!user) return { users: [], posts: [], communities: [], platformPosts: [], platformPeople: [], messages: [], wikipedia: [], sourceIndex: [] };

  if (!query?.trim()) return { users: [], posts: [], communities: [], platformPosts: [], platformPeople: [], messages: [], wikipedia: [], sourceIndex: [] };

  const q = query.trim();
  const wikipediaPromise = searchWikipedia(q);

  const [users, posts, communities, platformPosts, platformPeople, connectedSocialSources, messages] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q } },
          { displayName: { contains: q } },
        ],
        id: { not: user.id },
        isSuspended: false,
        isPublic: true,
        showInDiscovery: true,
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
      where: {
        ...nsfwHiddenWhere(user),
        content: { contains: q },
        OR: [
          { authorId: user.id },
          { author: { isSuspended: false, isPublic: true, showInDiscovery: true } },
        ],
      },
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
        AND: [
          {
            OR: [
              { isPublic: true },
              { members: { some: { userId: user.id } } },
            ],
          },
        ],
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
    prisma.platformPost.findMany({
      where: {
        ...nsfwHiddenWhere(user),
        visibility: { not: "private" },
        connectedAccount: {
          isActive: true,
          platform: { in: SOCIAL_SEARCH_PLATFORM_IDS },
          OR: [
            { userId: user.id },
            { user: { isSuspended: false, isPublic: true, showInDiscovery: true } },
          ],
        },
        OR: [
          { title: { contains: q } },
          { content: { contains: q } },
          { url: { contains: q } },
          { platformPostId: { contains: q } },
        ],
      },
      include: {
        connectedAccount: {
          select: {
            id: true,
            platform: true,
            platformUsername: true,
            user: {
              select: {
                username: true,
                displayName: true,
              },
            },
          },
        },
        media: {
          select: {
            id: true,
            url: true,
            thumbnailUrl: true,
            mediaType: true,
          },
          take: 1,
        },
      },
      orderBy: [
        { publishedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: 12,
    }),
    prisma.platformFollower.findMany({
      where: {
        connectedAccount: {
          userId: user.id,
          isActive: true,
          platform: { in: SOCIAL_SEARCH_PLATFORM_IDS },
        },
        OR: [
          { username: { contains: q } },
          { displayName: { contains: q } },
          { profileUrl: { contains: q } },
        ],
      },
      include: {
        connectedAccount: {
          select: {
            platform: true,
            platformUsername: true,
          },
        },
      },
      orderBy: { followerCount: "desc" },
      take: 12,
    }),
    prisma.connectedAccount.findMany({
      where: {
        userId: user.id,
        isActive: true,
        platform: { in: SOCIAL_SEARCH_PLATFORM_IDS },
      },
      select: {
        id: true,
        platform: true,
        platformUsername: true,
        syncStatus: true,
        lastSyncAt: true,
        _count: {
          select: {
            platformPosts: true,
            platformFollowers: true,
          },
        },
      },
    }),
    prisma.message.findMany({
      where: {
        content: { contains: q },
        thread: { members: { some: { userId: user.id } } },
      },
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
      take: 8,
    }),
  ]);

  const wikipedia = await Promise.race([
    wikipediaPromise.catch(() => []),
    new Promise<Array<{ id: string; title: string; extract: string; url: string; thumbnailUrl: string | null; source: string }>>((resolve) => {
      setTimeout(() => resolve([]), 850);
    }),
  ]);

  const sourceIndex = SOCIAL_SEARCH_SOURCES.map((source) => {
    const account = connectedSocialSources.find((item) => item.platform === source.id);

    return {
      id: source.id,
      name: source.name,
      description: source.description,
      connected: Boolean(account),
      accountLabel: account?.platformUsername || null,
      syncStatus: account?.syncStatus || "not_connected",
      lastSyncAt: account?.lastSyncAt || null,
      syncedPosts: account?._count.platformPosts || 0,
      syncedPeople: account?._count.platformFollowers || 0,
      searchUrl: sourceSearchUrl(source.id, q),
      connectHref: source.connectHref,
    };
  });

  return { users, posts, communities, platformPosts, platformPeople, messages, wikipedia, sourceIndex };
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

  const exclude = [...followingIds, user.id];
  const include = {
    interests: true,
    _count: { select: { followers: true, posts: true } },
  } as const;
  // Discoverable != public. A private account can still opt in to being
  // *found* (and then approve followers), so discovery only requires
  // showInDiscovery — content visibility stays governed by isPublic elsewhere.
  const baseWhere = {
    isSuspended: false,
    showInDiscovery: true,
  };

  // Interest-matched suggestions first, so discovery feels personal.
  const interestMatched = tags.length > 0
    ? await prisma.user.findMany({
        where: {
          ...baseWhere,
          id: { notIn: exclude },
          interests: { some: { tag: { in: tags } } },
        },
        include,
        orderBy: { followers: { _count: "desc" } },
        take: 20,
      })
    : [];

  // Always backfill with popular people to follow, so the discovery rail is
  // never empty just because interests don't overlap. Deduped against the
  // people already shown and anyone you follow.
  const suggested = [...interestMatched];
  if (suggested.length < 12) {
    const already = new Set([...exclude, ...suggested.map((u) => u.id)]);
    const popular = await prisma.user.findMany({
      where: {
        ...baseWhere,
        id: { notIn: Array.from(already) },
      },
      include,
      orderBy: { followers: { _count: "desc" } },
      take: 20 - suggested.length,
    });
    suggested.push(...popular);
  }

  return suggested;
}

export async function getTrendingCommunities() {
  return prisma.community.findMany({
    where: { isPublic: true },
    include: {
      _count: { select: { members: true, posts: true } },
    },
    orderBy: { members: { _count: "desc" } },
    take: 10,
  });
}

// ─── Admin Queries ───────────────────────────────────────────

export async function getAdminStats() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { userCount: 0, postCount: 0, communityCount: 0, reportCount: 0, recentUsers: [], recentReports: [], adminLogs: [], recentSignups: 0, recentPostCount: 0 };

  const [userCount, postCount, communityCount, reportCount, recentUsers, recentReports, adminLogs] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.community.count(),
    prisma.report.count({ where: { status: "pending" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        isAdmin: true,
        isSuspended: true,
        isVerified: true,
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
        reportedComment: { select: { id: true, content: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.adminLog.findMany({
      where: { action: { not: "feedback" } },
      include: { admin: { select: { username: true, displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  // Get signup stats for last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentSignups = await prisma.user.count({
    where: { createdAt: { gte: sevenDaysAgo } },
  });

  const recentPostCount = await prisma.post.count({
    where: { createdAt: { gte: sevenDaysAgo } },
  });

  return { userCount, postCount, communityCount, reportCount, recentUsers, recentReports, adminLogs, recentSignups, recentPostCount };
}

// ─── Additional Queries ─────────────────────────────────────

export async function getUserCommunities(username: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return [];

  return prisma.communityMember.findMany({
    where: { userId: user.id },
    include: {
      community: {
        include: {
          _count: { select: { members: true, posts: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });
}

export async function getSavedPosts(page = 1, limit = 20) {
  const user = await getCurrentUser();
  if (!user) return [];

  const saved = await prisma.savedPost.findMany({
    where: { userId: user.id, post: nsfwHiddenWhere(user) },
    include: {
      post: {
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
          community: { select: { id: true, name: true, slug: true } },
          media: true,
          tags: true,
          _count: { select: { comments: true, reactions: true, reposts: true } },
          reactions: { where: { userId: user.id }, select: { id: true } },
          savedBy: { where: { userId: user.id }, select: { id: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  return saved.map((s) => s.post);
}

export async function getSavedPostCount() {
  const user = await getCurrentUser();
  if (!user) return 0;
  return prisma.savedPost.count({ where: { userId: user.id, post: nsfwHiddenWhere(user) } });
}

export async function getAdvancedSocialDashboard() {
  const user = await getCurrentUser();
  if (!user) return null;

  const safetyWhere = nsfwHiddenWhere(user);

  const [
    communityMemberships,
    sessions,
    savedPosts,
    recentPosts,
    platformPosts,
    connectedAccounts,
    following,
    followers,
    communityThreads,
  ] = await Promise.all([
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
      take: 24,
    }),
    prisma.meChatSession.findMany({
      where: {
        OR: [
          { hostId: user.id },
          { participants: { some: { userId: user.id } } },
        ],
      },
      include: {
        participants: {
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
        },
        items: {
          include: { votes: true },
          orderBy: { position: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.savedPost.findMany({
      where: { userId: user.id, post: safetyWhere },
      include: {
        post: {
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
            community: { select: { id: true, name: true, slug: true } },
            media: true,
            tags: true,
            _count: { select: { comments: true, reactions: true, reposts: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.post.findMany({
      where: {
        ...safetyWhere,
        OR: [
          { authorId: user.id },
          {
            visibility: "public",
            author: {
              isSuspended: false,
              isPublic: true,
              showInDiscovery: true,
            },
          },
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
        community: { select: { id: true, name: true, slug: true } },
        media: true,
        tags: true,
        _count: { select: { comments: true, reactions: true, reposts: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 18,
    }),
    prisma.platformPost.findMany({
      where: {
        ...safetyWhere,
        connectedAccount: {
          userId: user.id,
          isActive: true,
        },
      },
      include: {
        connectedAccount: {
          select: {
            id: true,
            platform: true,
            platformUsername: true,
          },
        },
        media: {
          select: {
            id: true,
            url: true,
            thumbnailUrl: true,
            mediaType: true,
          },
          take: 1,
        },
      },
      orderBy: [
        { publishedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: 18,
    }),
    prisma.connectedAccount.findMany({
      where: { userId: user.id, isActive: true },
      include: {
        _count: {
          select: {
            platformPosts: true,
            platformComments: true,
            platformFollowers: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 24,
    }),
    prisma.follow.findMany({
      where: { followerId: user.id },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isPublic: true,
            showInDiscovery: true,
          },
        },
      },
      take: 80,
    }),
    prisma.follow.findMany({
      where: { followingId: user.id },
      select: { followerId: true },
      take: 250,
    }),
    prisma.messageThread.findMany({
      where: {
        threadType: "community",
        members: { some: { userId: user.id } },
      },
      include: {
        members: {
          select: {
            userId: true,
            role: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
  ]);

  const followerIds = new Set(followers.map((follower) => follower.followerId));
  const friends = following
    .filter((follow) => followerIds.has(follow.followingId))
    .map((follow) => follow.following)
    .filter((friend) => friend.isPublic && friend.showInDiscovery)
    .slice(0, 24);

  return {
    currentUser: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isMeshPro: user.isMeshPro,
    },
    spaces: communityMemberships.map((membership) => ({
      id: membership.community.id,
      name: membership.community.name,
      slug: membership.community.slug,
      description: membership.community.description,
      category: membership.community.category,
      isPublic: membership.community.isPublic,
      role: membership.role,
      joinedAt: membership.joinedAt,
      memberCount: membership.community._count.members,
      postCount: membership.community._count.posts,
    })),
    sessions,
    savedPosts,
    recentPosts,
    platformPosts,
    connectedAccounts,
    friends,
    communityThreads: communityThreads.map((thread) => ({
      id: thread.id,
      title: thread.title,
      memberCount: thread.members.length,
      lastMessage: thread.messages[0] || null,
      updatedAt: thread.updatedAt,
    })),
  };
}

export async function getBlockedUsers() {
  const user = await getCurrentUser();
  if (!user) return [];

  return prisma.block.findMany({
    where: { blockerId: user.id },
    include: {
      blocked: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMutedUsers() {
  const user = await getCurrentUser();
  if (!user) return [];

  return prisma.mute.findMany({
    where: { muterId: user.id },
    include: {
      muted: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTrendingTags() {
  const tags = await prisma.postTag.groupBy({
    by: ["tag"],
    where: { post: { isNsfw: false } },
    _count: { tag: true },
    orderBy: { _count: { tag: "desc" } },
    take: 20,
  });

  return tags.map((t) => ({ tag: t.tag, count: t._count.tag }));
}

export async function getPopularPosts(limit = 10) {
  const user = await getCurrentUser();
  const safetyWhere = nsfwHiddenWhere(user);
  const visibilityFilter = user
    ? {
        ...safetyWhere,
        OR: [
          { authorId: user.id },
          { author: { isSuspended: false, isPublic: true, showInDiscovery: true } },
        ],
      }
    : { ...safetyWhere, author: { isSuspended: false, isPublic: true, showInDiscovery: true } };

  return prisma.post.findMany({
    where: visibilityFilter,
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
      community: { select: { id: true, name: true, slug: true } },
      media: true,
      tags: true,
      _count: { select: { comments: true, reactions: true, reposts: true } },
      reactions: user ? { where: { userId: user.id }, select: { id: true } } : false,
      savedBy: user ? { where: { userId: user.id }, select: { id: true } } : false,
    },
    orderBy: [{ reactions: { _count: "desc" } }, { comments: { _count: "desc" } }, { createdAt: "desc" }],
    take: limit,
  });
}

export async function getUserSettings() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [userWithProfile, achievements] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        email: true,
        activeTitle: true,
        interests: true,
        links: true,
        connectedAccounts: {
          where: { isActive: true },
          select: {
            id: true,
            platform: true,
            platformUsername: true,
            accountLabel: true,
            isActive: true,
            lastSyncAt: true,
            syncStatus: true,
          },
          orderBy: { platform: "asc" },
        },
        notificationPreference: {
          select: {
            pushEnabled: true,
            emailDigest: true,
            messages: true,
            mentions: true,
            comments: true,
            follows: true,
            platformAlerts: true,
            securityAlerts: true,
            productUpdates: true,
          },
        },
      },
    }),
    prisma.userAchievement.findMany({
      where: { userId: user.id },
      include: { achievement: { select: { slug: true } } },
    }),
  ]);

  return {
    id: user.id,
    email: userWithProfile?.email,
    emailVerified: user.emailVerified,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    location: user.location,
    website: user.website,
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
    accentColor: user.accentColor,
    isPublic: user.isPublic,
    showInDiscovery: user.showInDiscovery,
    hideActivityStatus: user.hideActivityStatus,
    readReceipts: user.readReceipts,
    nsfwEnabled: user.nsfwEnabled,
    adultVerificationStatus: user.adultVerificationStatus,
    adultVerifiedAt: user.adultVerifiedAt,
    adultVerificationExpiresAt: user.adultVerificationExpiresAt,
    adultVerificationProvider: user.adultVerificationProvider,
    adultVerificationRegion: user.adultVerificationRegion,
    interests: userWithProfile?.interests ?? [],
    links: userWithProfile?.links ?? [],
    connectedAccounts: userWithProfile?.connectedAccounts ?? [],
    notificationPreference: userWithProfile?.notificationPreference ?? {
      pushEnabled: true,
      emailDigest: "weekly",
      messages: true,
      mentions: true,
      comments: true,
      follows: true,
      platformAlerts: true,
      securityAlerts: true,
      productUpdates: false,
    },
    activeTitle: userWithProfile?.activeTitle ?? null,
    achievements: achievements.map((a) => ({ slug: a.achievement.slug })),
    isMeshPro: user.isMeshPro,
  };
}

export async function getCommunityMembers(communityId: string) {
  return prisma.communityMember.findMany({
    where: { communityId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          isVerified: true,
          bio: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });
}

export async function getUnreadNotificationCount() {
  const user = await getCurrentUser();
  if (!user) return 0;

  return prisma.notification.count({
    where: { recipientId: user.id, read: false },
  });
}

// ─── Mesh Graph Data (for Meshi awareness) ─────────────────

export interface MeshGraphEntity {
  id: string;
  type: "user" | "community" | "tag" | "platform";
  label: string;
  sublabel?: string;
  isMutual?: boolean;
  followerCount?: number;
  memberCount?: number;
  sharedInterests?: string[];
}

export async function getMeshGraphData(): Promise<{
  entities: MeshGraphEntity[];
  stats: { followers: number; following: number; posts: number; communities: number; platforms: number };
}> {
  const user = await getCurrentUser();
  if (!user) return { entities: [], stats: { followers: 0, following: 0, posts: 0, communities: 0, platforms: 0 } };
  const safetyWhere = nsfwHiddenWhere(user);

  const [following, followers, communities, interests, connectedAccounts, postCount] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: user.id },
      include: {
        following: {
          select: { id: true, username: true, displayName: true, _count: { select: { followers: true } } },
        },
      },
    }),
    prisma.follow.findMany({
      where: { followingId: user.id },
      select: { followerId: true },
    }),
    prisma.communityMember.findMany({
      where: { userId: user.id },
      include: {
        community: {
          select: { id: true, name: true, slug: true, _count: { select: { members: true } } },
        },
      },
    }),
    prisma.userInterest.findMany({ where: { userId: user.id } }),
    prisma.connectedAccount.findMany({ where: { userId: user.id, isActive: true } }),
    prisma.post.count({ where: { ...safetyWhere, authorId: user.id } }),
  ]);

  const followerIds = new Set(followers.map((f) => f.followerId));

  const entities: MeshGraphEntity[] = [];

  // Add people (following)
  for (const f of following) {
    entities.push({
      id: f.following.id,
      type: "user",
      label: f.following.displayName,
      sublabel: `@${f.following.username}`,
      isMutual: followerIds.has(f.following.id),
      followerCount: f.following._count.followers,
    });
  }

  // Add communities
  for (const cm of communities) {
    entities.push({
      id: cm.community.id,
      type: "community",
      label: cm.community.name,
      sublabel: cm.community.slug,
      memberCount: cm.community._count.members,
    });
  }

  // Add interests
  for (const interest of interests) {
    entities.push({
      id: `interest-${interest.tag}`,
      type: "tag",
      label: interest.tag,
    });
  }

  // Add platforms
  for (const account of connectedAccounts) {
    entities.push({
      id: account.id,
      type: "platform",
      label: account.platform,
      sublabel: account.platformUsername || undefined,
    });
  }

  return {
    entities,
    stats: {
      followers: followers.length,
      following: following.length,
      posts: postCount,
      communities: communities.length,
      platforms: connectedAccounts.length,
    },
  };
}

// ─── Mesh Privacy Queries ───────────────────────────────────

export async function getMeshPrivacy() {
  const user = await getCurrentUser();
  if (!user) return null;

  const privacy = await prisma.meshPrivacy.findUnique({
    where: { userId: user.id },
  });

  return privacy || {
    meshVisibility: "private",
    branchOverrides: "{}",
    showConnections: false,
    showStats: false,
  };
}

export async function getGlobalMeshStatus() {
  const user = await getCurrentUser();
  if (!user) return null;

  const member = await prisma.globalMeshMember.findUnique({
    where: { userId: user.id },
  });

  return member || { isActive: false, sharedBranches: "[]" };
}

type FriendMeshPublicPost = {
  id: string;
  title: string | null;
  content: string;
  url: string | null;
  postType: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  thumbnailUrl: string | null;
  publishedAt: Date | null;
};

type FriendMeshPlatform = {
  id: string;
  platform: string;
  platformUsername: string | null;
  publicPosts: FriendMeshPublicPost[];
};

// ─── Friend Mesh Viewing ────────────────────────────────────

export async function getFriendMeshData(username: string): Promise<{
  user: { id: string; username: string; displayName: string; avatarUrl: string | null };
  following: Array<{
    id: string; username: string; displayName: string; avatarUrl: string | null;
    isMutual: boolean; followerCount: number; postCount: number;
  }>;
  communities: Array<{ id: string; name: string; slug: string; memberCount: number }>;
  interests: string[];
  platforms: FriendMeshPlatform[];
  meshiPreference: {
    colorTheme: string;
    hatStyle: string;
    faceStyle: string;
    hairStyle: string;
    accessoryStyle: string;
    eyeStyle: string;
    badgeStyle: string;
    outfitStyle: string;
  } | null;
  stats: { followers: number; following: number; posts: number; communities: number; platforms: number };
  privacyLevel: string;
} | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;
  const safetyWhere = nsfwHiddenWhere(currentUser);

  const targetUser = await prisma.user.findFirst({
    where: { username: { equals: username } },
  });
  if (!targetUser) return null;

  // Check privacy settings
  const privacy = await prisma.meshPrivacy.findUnique({
    where: { userId: targetUser.id },
  });

  const visibility = privacy?.meshVisibility || "private";

  // Check if we're friends (mutual follow)
  const [followToTarget, followFromTarget] = await Promise.all([
    prisma.follow.findFirst({
      where: { followerId: currentUser.id, followingId: targetUser.id },
    }),
    prisma.follow.findFirst({
      where: { followerId: targetUser.id, followingId: currentUser.id },
    }),
  ]);
  const isFriend = !!followToTarget && !!followFromTarget;

  const emptyResult = {
    user: { id: targetUser.id, username: targetUser.username, displayName: targetUser.displayName, avatarUrl: targetUser.avatarUrl },
    following: [] as Array<{ id: string; username: string; displayName: string; avatarUrl: string | null; isMutual: boolean; followerCount: number; postCount: number }>,
    communities: [] as Array<{ id: string; name: string; slug: string; memberCount: number }>,
    interests: [] as string[],
    platforms: [] as FriendMeshPlatform[],
    meshiPreference: null,
    stats: { followers: 0, following: 0, posts: 0, communities: 0, platforms: 0 },
  };

  // Check access
  if (visibility === "private" && targetUser.id !== currentUser.id) {
    return { ...emptyResult, privacyLevel: "private" };
  }
  if (visibility === "friends" && !isFriend && targetUser.id !== currentUser.id) {
    return { ...emptyResult, privacyLevel: "friends-only" };
  }

  const branchOverrides = parseStoredRecord(privacy?.branchOverrides);

  const [following, followers, communities, interests, connectedAccounts, postCount, meshiPref] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: targetUser.id },
      include: {
        following: {
          select: {
            id: true, username: true, displayName: true, avatarUrl: true,
            _count: { select: { followers: true, posts: true } },
          },
        },
      },
    }),
    prisma.follow.count({ where: { followingId: targetUser.id } }),
    prisma.communityMember.findMany({
      where: { userId: targetUser.id },
      include: {
        community: {
          select: { id: true, name: true, slug: true, _count: { select: { members: true } } },
        },
      },
    }),
    prisma.userInterest.findMany({ where: { userId: targetUser.id } }),
    prisma.connectedAccount.findMany({
      where: { userId: targetUser.id, isActive: true },
      select: {
        id: true, platform: true, platformUsername: true,
        platformPosts: {
          where: { ...safetyWhere, visibility: "public" },
          select: {
            id: true, title: true, content: true, url: true, postType: true,
            likeCount: true, commentCount: true, viewCount: true,
            thumbnailUrl: true, publishedAt: true, visibility: true,
          },
          orderBy: { likeCount: "desc" },
          take: 5,
        },
      },
    }),
    prisma.post.count({ where: { ...safetyWhere, authorId: targetUser.id } }),
    prisma.meshiPreference.findUnique({ where: { userId: targetUser.id } }),
  ]);

  // Filter by branch visibility
  function canSeeBranch(branchKey: string): boolean {
    const vis = branchOverrides[branchKey];
    if (!vis || vis === "public") return true;
    if (vis === "friends") return isFriend;
    if (vis === "private") return false;
    return true;
  }

  // Check which user IDs follow the target user (to determine mutuals)
  const targetFollowerIds = new Set<string>();
  if (canSeeBranch("people")) {
    const targetFollowers = await prisma.follow.findMany({
      where: { followingId: targetUser.id },
      select: { followerId: true },
    });
    for (const tf of targetFollowers) {
      targetFollowerIds.add(tf.followerId);
    }
  }

  const followingData = canSeeBranch("people")
    ? following.map((f) => ({
        id: f.following.id,
        username: f.following.username,
        displayName: f.following.displayName,
        avatarUrl: f.following.avatarUrl,
        isMutual: targetFollowerIds.has(f.following.id),
        followerCount: f.following._count.followers,
        postCount: f.following._count.posts,
      }))
    : [];

  const communityData = canSeeBranch("communities")
    ? communities.map((cm) => ({
        id: cm.community.id,
        name: cm.community.name,
        slug: cm.community.slug,
        memberCount: cm.community._count.members,
      }))
    : [];

  const interestData = canSeeBranch("interests")
    ? interests.map((i) => i.tag)
    : [];

  const platformData = canSeeBranch("platforms")
    ? connectedAccounts.map((a) => ({
        id: a.id,
        platform: a.platform,
        platformUsername: a.platformUsername,
        publicPosts: a.platformPosts.map((p) => ({
          id: p.id,
          title: p.title,
          content: (p.content || "").slice(0, 150),
          url: p.url,
          postType: p.postType,
          likeCount: p.likeCount,
          commentCount: p.commentCount,
          viewCount: p.viewCount,
          thumbnailUrl: p.thumbnailUrl,
          publishedAt: p.publishedAt,
        })),
      }))
    : [];

  return {
    user: {
      id: targetUser.id,
      username: targetUser.username,
      displayName: targetUser.displayName,
      avatarUrl: targetUser.avatarUrl,
    },
    following: followingData,
    communities: communityData,
    interests: interestData,
    platforms: platformData,
    meshiPreference: meshiPref
      ? {
          colorTheme: meshiPref.colorTheme,
          hatStyle: meshiPref.hatStyle,
          faceStyle: meshiPref.faceStyle,
          hairStyle: meshiPref.hairStyle,
          accessoryStyle: meshiPref.accessoryStyle,
          eyeStyle: meshiPref.eyeStyle,
          badgeStyle: meshiPref.badgeStyle,
          outfitStyle: meshiPref.outfitStyle,
        }
      : null,
    stats: {
      followers,
      following: following.length,
      posts: postCount,
      communities: communities.length,
      platforms: connectedAccounts.length,
    },
    privacyLevel: visibility,
  };
}

// ─── Privacy Transparency Dashboard ──────────────────────────

export async function getPrivacyTransparencyData() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [
    postCount,
    commentCount,
    reactionCount,
    messageCount,
    followerCount,
    followingCount,
    communityCount,
    connectedAccounts,
    savedPostCount,
    notificationCount,
    interestCount,
    blockCount,
    platformPostCount,
    sessionCount,
  ] = await Promise.all([
    prisma.post.count({ where: { authorId: user.id } }),
    prisma.comment.count({ where: { authorId: user.id } }),
    prisma.reaction.count({ where: { userId: user.id } }),
    prisma.message.count({ where: { senderId: user.id } }),
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.communityMember.count({ where: { userId: user.id } }),
    prisma.connectedAccount.findMany({
      where: { userId: user.id },
      select: { platform: true, isActive: true, lastSyncAt: true, scopes: true },
    }),
    prisma.savedPost.count({ where: { userId: user.id } }),
    prisma.notification.count({ where: { recipientId: user.id } }),
    prisma.userInterest.count({ where: { userId: user.id } }),
    prisma.block.count({ where: { blockerId: user.id } }),
    prisma.platformPost.count({ where: { connectedAccount: { userId: user.id } } }),
    prisma.session.count({ where: { userId: user.id } }),
  ]);

  return {
    dataStored: {
      posts: postCount,
      comments: commentCount,
      reactions: reactionCount,
      messages: messageCount,
      savedPosts: savedPostCount,
      notifications: notificationCount,
      interests: interestCount,
      blocks: blockCount,
      platformPosts: platformPostCount,
    },
    connections: {
      followers: followerCount,
      following: followingCount,
      communities: communityCount,
    },
    platforms: connectedAccounts.map(a => ({
      name: a.platform,
      active: a.isActive,
      lastSync: a.lastSyncAt,
      scopes: a.scopes,
    })),
    sessions: sessionCount,
    accountCreated: user.createdAt,
    isMeshPro: user.isMeshPro,
  };
}
