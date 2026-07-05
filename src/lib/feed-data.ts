import { nsfwHiddenWhere } from "./content-safety";
import { getFriendPlatformFeedPosts, type FriendPlatformFeedPost } from "./friend-mesh";
import { prisma } from "./prisma";

export type FeedSource = "all" | "following" | "discover";
export type FeedContentFilter = "all" | "mesh" | "platforms" | "media" | "links" | "text" | "photos" | "videos";

export type FeedCurrentUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  nsfwEnabled?: boolean | null;
  adultVerificationStatus?: string | null;
  adultVerificationExpiresAt?: Date | string | null;
};

export type FeedCardPost = {
  id: string;
  content: string;
  createdAt: Date | string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isVerified: boolean;
  };
  community?: { id: string; name: string; slug: string } | null;
  media: { id: string; url: string; type: string }[];
  tags: { id: string; tag: string }[];
  _count: { comments: number; reactions: number; reposts: number };
  reactions?: { id: string }[];
  savedBy?: { id: string }[];
  isPinned?: boolean;
  platform?: string;
  sourceId?: string;
  externalUrl?: string | null;
  platformPostId?: string;
  crossPostedTo?: string[];
  meshFriend?: { userId: string; username: string; displayName: string };
  // Set when the post was authored by someone outside mesh.me (an item from
  // a connected platform's for-you feed). The card links to their platform
  // profile instead of a mesh profile.
  externalAuthor?: { name: string; username?: string | null; avatarUrl?: string | null; profileUrl?: string | null };
  isNsfw?: boolean;
  contentRating?: string;
  visibility?: string;
};

type NativeFeedPost = Awaited<ReturnType<typeof getNativeFeedPostsForSource>>[number];

const FEED_SOURCES: FeedSource[] = ["all", "following", "discover"];
const CONTENT_FILTERS: FeedContentFilter[] = ["all", "mesh", "platforms", "media", "links", "text", "photos", "videos"];

export function normalizeFeedSource(value: string | null | undefined): FeedSource {
  return FEED_SOURCES.includes(value as FeedSource) ? (value as FeedSource) : "all";
}

export function normalizeFeedContentFilter(value: string | null | undefined): FeedContentFilter {
  return CONTENT_FILTERS.includes(value as FeedContentFilter) ? (value as FeedContentFilter) : "all";
}

export function sortFeedPosts(posts: FeedCardPost[]) {
  return [...posts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function filterFeedPostsByContent(posts: FeedCardPost[], filter: FeedContentFilter) {
  if (filter === "all") return posts;

  return posts.filter((post) => {
    const platform = post.platform?.toLowerCase() || "meshme";
    const hasText = post.content.trim().length > 0;
    const hasPhotoMedia = post.media.some((item) => {
      const type = item.type.toLowerCase();
      return type === "image" || type === "photo";
    });
    const hasVideoMedia = post.media.some((item) => {
      const type = item.type.toLowerCase();
      return type === "video" || type === "reel" || type === "short";
    });
    const hasVisualMedia = post.media.some((item) => {
      const type = item.type.toLowerCase();
      return type === "image" || type === "photo" || type === "video" || type === "reel" || type === "short";
    });
    const hasLinkMedia = post.media.some((item) => {
      const type = item.type.toLowerCase();
      return type !== "image" && type !== "photo" && type !== "video" && type !== "reel" && type !== "short";
    }) || Boolean(post.externalUrl);

    if (filter === "mesh") return platform === "meshme";
    if (filter === "platforms") return platform !== "meshme";
    if (filter === "media") return hasVisualMedia;
    if (filter === "links") return hasLinkMedia;
    if (filter === "text") return hasText && !hasVisualMedia && !hasLinkMedia;
    if (filter === "photos") return hasPhotoMedia;
    if (filter === "videos") return hasVideoMedia;
    return true;
  });
}

export function toFeedCardPost(post: NativeFeedPost): FeedCardPost {
  return {
    ...post,
    media: post.media.map((item) => ({ id: item.id, url: item.url, type: item.type })),
    platform: "meshme",
  };
}

export async function getNativeFeedPostsForSource(user: FeedCurrentUser, source: FeedSource, take: number) {
  const [following, communityMemberships, followers] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    }),
    prisma.communityMember.findMany({
      where: { userId: user.id },
      select: { communityId: true },
    }),
    prisma.follow.findMany({
      where: { followingId: user.id },
      select: { followerId: true },
    }),
  ]);

  const followingIds = following.map((follow) => follow.followingId);
  const communityIds = communityMemberships.map((membership) => membership.communityId);
  const followerIds = new Set(followers.map((follow) => follow.followerId));
  const friendIds = followingIds.filter((id) => followerIds.has(id));
  const safetyWhere = nsfwHiddenWhere(user);
  const audienceWhere = {
    OR: [
      { authorId: user.id },
      { communityId: { in: communityIds } },
      { visibility: "public" },
      { visibility: "friends", authorId: { in: friendIds } },
    ],
  };

  const baseInclude = {
    author: {
      select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true },
    },
    community: { select: { id: true, name: true, slug: true } },
    media: true,
    tags: true,
    _count: { select: { comments: true, reactions: true, reposts: true } },
    reactions: { where: { userId: user.id }, select: { id: true } },
    savedBy: { where: { userId: user.id }, select: { id: true } },
  };

  if (source === "following") {
    return prisma.post.findMany({
      where: {
        ...safetyWhere,
        authorId: { in: [...followingIds, user.id] },
        AND: [audienceWhere],
      },
      include: baseInclude,
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  if (source === "discover") {
    return prisma.post.findMany({
      where: {
        ...safetyWhere,
        visibility: "public",
        authorId: { notIn: [...followingIds, user.id] },
        author: { isSuspended: false, isPublic: true, showInDiscovery: true },
      },
      include: baseInclude,
      orderBy: [
        { reactions: { _count: "desc" } },
        { createdAt: "desc" },
      ],
      take,
    });
  }

  return prisma.post.findMany({
    where: {
      ...safetyWhere,
      AND: [
        {
          OR: [
            { authorId: { in: [...followingIds, user.id] } },
            { communityId: { in: communityIds } },
          ],
        },
        audienceWhere,
      ],
    },
    include: baseInclude,
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function getConnectedPlatformFeedPosts(user: FeedCurrentUser, limit = 20): Promise<FeedCardPost[]> {
  const platformPosts = await prisma.platformPost.findMany({
    where: {
      ...nsfwHiddenWhere(user),
      connectedAccount: {
        userId: user.id,
        isActive: true,
      },
      visibility: { not: "private" },
    },
    include: {
      connectedAccount: {
        select: {
          platform: true,
          platformUsername: true,
        },
      },
      media: true,
    },
    orderBy: [
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    take: limit,
  });

  return platformPosts.map((post) => {
    const media = post.media.length > 0
      ? post.media.map((item) => ({
          id: item.id,
          url: item.thumbnailUrl || item.url,
          type: item.mediaType,
        }))
      : post.thumbnailUrl
        ? [{
            id: `${post.id}-thumbnail`,
            url: post.thumbnailUrl,
            type: ["video", "reel", "short", "story"].includes(post.postType) ? "video" : "image",
          }]
        : [];

    const content = [post.title, post.content].filter(Boolean).join(post.title && post.content ? "\n\n" : "");

    return {
      id: `platform-${post.id}`,
      content: content || `${post.connectedAccount.platform} post`,
      createdAt: post.publishedAt ?? post.createdAt,
      author: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
      },
      community: null,
      media,
      tags: [],
      _count: {
        comments: post.commentCount,
        reactions: post.likeCount,
        reposts: post.shareCount,
      },
      reactions: [],
      savedBy: [],
      isPinned: post.isPinned,
      platform: post.connectedAccount.platform,
      sourceId: post.id,
      externalUrl: post.url,
      platformPostId: post.platformPostId,
      crossPostedTo: post.isFromMesh ? [post.connectedAccount.platform] : [],
      isNsfw: post.isNsfw,
      contentRating: post.contentRating,
    };
  });
}

export async function getMergedForYouFeedPosts(user: FeedCurrentUser, limit = 40): Promise<FeedCardPost[]> {
  const items = await prisma.platformFeedItem.findMany({
    where: {
      ...nsfwHiddenWhere(user),
      connectedAccount: { userId: user.id, isActive: true },
    },
    include: {
      connectedAccount: { select: { platform: true, platformUsername: true } },
    },
    orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
    take: limit,
  });

  return items.map((item) => {
    const content = [item.title, item.content].filter(Boolean).join(item.title && item.content ? "\n\n" : "");
    const authorName = item.authorName || item.authorUsername || item.connectedAccount.platform;
    const media = item.mediaUrl || item.thumbnailUrl
      ? [{
          id: `${item.id}-media`,
          url: item.mediaUrl || item.thumbnailUrl || "",
          type: ["video", "reel", "short", "stream"].includes(item.postType) ? "video" : "image",
        }]
      : [];

    return {
      id: `feeditem-${item.id}`,
      content: content || `${item.connectedAccount.platform} post`,
      createdAt: item.publishedAt ?? item.fetchedAt,
      author: {
        id: `external-${item.id}`,
        username: item.authorUsername || authorName,
        displayName: authorName,
        avatarUrl: item.authorAvatarUrl,
        isVerified: false,
      },
      externalAuthor: {
        name: authorName,
        username: item.authorUsername,
        avatarUrl: item.authorAvatarUrl,
        profileUrl: item.authorUrl,
      },
      community: null,
      media,
      tags: [],
      _count: { comments: item.commentCount, reactions: item.likeCount, reposts: 0 },
      reactions: [],
      savedBy: [],
      platform: item.connectedAccount.platform,
      sourceId: item.id,
      externalUrl: item.url,
      platformPostId: item.platformItemId,
      isNsfw: item.isNsfw,
      contentRating: item.contentRating,
    };
  });
}

export async function getFeedPostById(user: FeedCurrentUser, id: string): Promise<FeedCardPost | null> {
  if (id.startsWith("feeditem-")) {
    const item = await prisma.platformFeedItem.findFirst({
      where: {
        id: id.slice("feeditem-".length),
        ...nsfwHiddenWhere(user),
        connectedAccount: { userId: user.id, isActive: true },
      },
      include: {
        connectedAccount: { select: { platform: true, platformUsername: true } },
      },
    });
    if (!item) return null;
    const content = [item.title, item.content].filter(Boolean).join(item.title && item.content ? "\n\n" : "");
    const authorName = item.authorName || item.authorUsername || item.connectedAccount.platform;
    const media = item.mediaUrl || item.thumbnailUrl
      ? [{
          id: `${item.id}-media`,
          url: item.mediaUrl || item.thumbnailUrl || "",
          type: ["video", "reel", "short", "stream"].includes(item.postType) ? "video" : "image",
        }]
      : [];
    return {
      id: `feeditem-${item.id}`,
      content: content || `${item.connectedAccount.platform} post`,
      createdAt: item.publishedAt ?? item.fetchedAt,
      author: {
        id: `external-${item.id}`,
        username: item.authorUsername || authorName,
        displayName: authorName,
        avatarUrl: item.authorAvatarUrl,
        isVerified: false,
      },
      externalAuthor: {
        name: authorName,
        username: item.authorUsername,
        avatarUrl: item.authorAvatarUrl,
        profileUrl: item.authorUrl,
      },
      community: null,
      media,
      tags: [],
      _count: { comments: item.commentCount, reactions: item.likeCount, reposts: 0 },
      reactions: [],
      savedBy: [],
      platform: item.connectedAccount.platform,
      sourceId: item.id,
      externalUrl: item.url,
      platformPostId: item.platformItemId,
      isNsfw: item.isNsfw,
      contentRating: item.contentRating,
    };
  }

  if (id.startsWith("platform-")) {
    const post = await prisma.platformPost.findFirst({
      where: {
        id: id.slice("platform-".length),
        ...nsfwHiddenWhere(user),
        connectedAccount: { userId: user.id, isActive: true },
        visibility: { not: "private" },
      },
      include: {
        connectedAccount: { select: { platform: true, platformUsername: true } },
        media: true,
      },
    });
    if (!post) return null;
    const media = post.media.length > 0
      ? post.media.map((item) => ({ id: item.id, url: item.thumbnailUrl || item.url, type: item.mediaType }))
      : post.thumbnailUrl
        ? [{
            id: `${post.id}-thumbnail`,
            url: post.thumbnailUrl,
            type: ["video", "reel", "short", "story"].includes(post.postType) ? "video" : "image",
          }]
        : [];
    const content = [post.title, post.content].filter(Boolean).join(post.title && post.content ? "\n\n" : "");
    return {
      id: `platform-${post.id}`,
      content: content || `${post.connectedAccount.platform} post`,
      createdAt: post.publishedAt ?? post.createdAt,
      author: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
      },
      community: null,
      media,
      tags: [],
      _count: { comments: post.commentCount, reactions: post.likeCount, reposts: post.shareCount },
      reactions: [],
      savedBy: [],
      isPinned: post.isPinned,
      platform: post.connectedAccount.platform,
      sourceId: post.id,
      externalUrl: post.url,
      platformPostId: post.platformPostId,
      crossPostedTo: post.isFromMesh ? [post.connectedAccount.platform] : [],
      isNsfw: post.isNsfw,
      contentRating: post.contentRating,
    };
  }

  const [following, communityMemberships, followers] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: user.id }, select: { followingId: true } }),
    prisma.communityMember.findMany({ where: { userId: user.id }, select: { communityId: true } }),
    prisma.follow.findMany({ where: { followingId: user.id }, select: { followerId: true } }),
  ]);
  const followingIds = following.map((follow) => follow.followingId);
  const followerIds = new Set(followers.map((follow) => follow.followerId));
  const friendIds = followingIds.filter((followingId) => followerIds.has(followingId));
  const communityIds = communityMemberships.map((membership) => membership.communityId);

  const post = await prisma.post.findFirst({
    where: {
      id,
      ...nsfwHiddenWhere(user),
      OR: [
        { authorId: user.id },
        { communityId: { in: communityIds } },
        { visibility: "public" },
        { visibility: "friends", authorId: { in: friendIds } },
      ],
    },
    include: {
      author: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true },
      },
      community: { select: { id: true, name: true, slug: true } },
      media: true,
      tags: true,
      _count: { select: { comments: true, reactions: true, reposts: true } },
      reactions: { where: { userId: user.id }, select: { id: true } },
      savedBy: { where: { userId: user.id }, select: { id: true } },
    },
  });
  if (!post) return null;
  return {
    ...post,
    media: post.media.map((item) => ({ id: item.id, url: item.url, type: item.type })),
    platform: "meshme",
  };
}

export async function getCombinedFeedPosts({
  user,
  source,
  contentFilter,
  limit,
}: {
  user: FeedCurrentUser;
  source: FeedSource;
  contentFilter: FeedContentFilter;
  limit: number;
}) {
  const providerLimit = Math.min(Math.max(limit * 2, 48), 240);
  const [nativePosts, ownPlatformPosts, friendPlatformPosts, mergedForYouPosts] = await Promise.all([
    getNativeFeedPostsForSource(user, source, providerLimit),
    source === "discover" ? Promise.resolve([]) : getConnectedPlatformFeedPosts(user, providerLimit),
    source === "discover" ? Promise.resolve([]) : getFriendPlatformFeedPosts(user, providerLimit),
    source === "following" ? Promise.resolve([]) : getMergedForYouFeedPosts(user, providerLimit),
  ]);

  return filterFeedPostsByContent(
    sortFeedPosts([
      ...nativePosts.map(toFeedCardPost),
      ...ownPlatformPosts,
      ...(friendPlatformPosts as FriendPlatformFeedPost[]),
      ...mergedForYouPosts,
    ]),
    contentFilter,
  ).slice(0, limit);
}
