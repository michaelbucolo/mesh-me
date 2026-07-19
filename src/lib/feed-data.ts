import { cache } from "react";
import { nsfwHiddenWhere } from "./content-safety";
import { buildExternalMedia } from "./external-media";
import { getFriendPlatformFeedPosts, type FriendPlatformFeedPost } from "./friend-mesh";
import { prisma } from "./prisma";

// The viewer's follow/community graph is stable within a request, but the feed
// builds several candidate passes (all + discover + per-platform) that each
// need it. Request-level cache() collapses those into one 3-query batch.
const getViewerSocialGraph = cache(async (userId: string) => {
  const [following, communityMemberships, followers] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    }),
    prisma.communityMember.findMany({
      where: { userId },
      select: { communityId: true },
    }),
    prisma.follow.findMany({
      where: { followingId: userId },
      select: { followerId: true },
    }),
  ]);

  const followingIds = following.map((follow) => follow.followingId);
  const communityIds = communityMemberships.map((membership) => membership.communityId);
  const followerIds = new Set(followers.map((follow) => follow.followerId));
  const friendIds = followingIds.filter((id) => followerIds.has(id));

  return { followingIds, communityIds, followerIds, friendIds };
});

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

/**
 * The signed-out viewer. Its id matches no rows, so every personal query
 * (follows, reactions, blocks) naturally resolves empty and the public
 * "discover" supply is all that remains — guests browse the open internet's
 * content, and interacting is what asks for an account.
 */
export const ANONYMOUS_VIEWER: FeedCurrentUser = {
  id: "anonymous-guest",
  username: "guest",
  displayName: "Guest",
  avatarUrl: null,
  isVerified: false,
  nsfwEnabled: false,
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
  media: { id: string; url: string; type: string; posterUrl?: string }[];
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

/**
 * A stable identity for the same underlying item across the different feed-card
 * ids it can arrive under. The exact same external post surfaces both as a
 * friend's shared reel (`friend-platform-<id>`) and as the anonymous discover
 * copy (`platform-<id>`); both share one `platformPostId`, so we collapse them.
 * Native mesh posts fall through to their own id.
 */
export function canonicalFeedKey(post: FeedCardPost): string {
  if (post.platform && post.platform.toLowerCase() !== "meshme" && post.platformPostId) {
    return `ext:${post.platform.toLowerCase()}:${post.platformPostId}`;
  }
  return post.id;
}

function filterFeedPostsByContent(posts: FeedCardPost[], filter: FeedContentFilter) {
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

async function getNativeFeedPostsForSource(user: FeedCurrentUser, source: FeedSource, take: number) {
  const { followingIds, communityIds, friendIds } = await getViewerSocialGraph(user.id);
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
        // Public posts circulate when their author opted into discovery;
        // isPublic only gates the profile page itself.
        author: { isSuspended: false, showInDiscovery: true },
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

async function getConnectedPlatformFeedPosts(user: FeedCurrentUser, limit = 20): Promise<FeedCardPost[]> {
  try {
    const platformPosts = await prisma.platformPost.findMany({
      where: {
        ...nsfwHiddenWhere(user),
        // This is the owner's own feed: they see everything they imported —
        // private, unlisted, drafts included — labeled with its real status.
        // Non-owner surfaces apply their own whitelists.
        connectedAccount: {
          userId: user.id,
          isActive: true,
        },
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
      ? post.media.flatMap((item) =>
          buildExternalMedia({
            id: item.id,
            mediaUrl: item.url,
            thumbnailUrl: item.thumbnailUrl,
            mediaType: item.mediaType,
            postType: post.postType,
          }),
        )
      : buildExternalMedia({
          id: `${post.id}-thumbnail`,
          thumbnailUrl: post.thumbnailUrl,
          postType: post.postType,
        });

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
      visibility: post.visibility,
    };
    });
  } catch (error) {
    console.error("[feed-data] Connected platform posts unavailable", error);
    return [];
  }
}

/**
 * The open supply: PUBLIC posts synced from ANY member's connected platforms
 * (owner opted into discovery, post visibility public). This is what makes
 * the Flow feel like the whole internet instead of just your own graph —
 * every item real, human, platform-labeled content.
 */
async function getDiscoverPlatformPosts(user: FeedCurrentUser, limit = 60): Promise<FeedCardPost[]> {
  try {
    const platformPosts = await prisma.platformPost.findMany({
      where: {
        ...nsfwHiddenWhere(user),
        visibility: "public",
        connectedAccount: {
          isActive: true,
          userId: { not: user.id },
          user: { isSuspended: false, showInDiscovery: true },
        },
      },
      include: {
        connectedAccount: {
          select: {
            platform: true,
            platformUsername: true,
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
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
        ? post.media.flatMap((item) =>
            buildExternalMedia({
              id: item.id,
              mediaUrl: item.url,
              thumbnailUrl: item.thumbnailUrl,
              mediaType: item.mediaType,
              postType: post.postType,
            }),
          )
        : buildExternalMedia({
            id: `${post.id}-thumbnail`,
            thumbnailUrl: post.thumbnailUrl,
            postType: post.postType,
          });
      const owner = post.connectedAccount.user;
      const content = [post.title, post.content].filter(Boolean).join(post.title && post.content ? "\n\n" : "");

      return {
        id: `platform-${post.id}`,
        content: content || `${post.connectedAccount.platform} post`,
        createdAt: post.publishedAt ?? post.createdAt,
        author: {
          id: owner.id,
          username: owner.username,
          displayName: owner.displayName,
          avatarUrl: owner.avatarUrl,
          isVerified: owner.isVerified,
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
        isPinned: false,
        platform: post.connectedAccount.platform,
        sourceId: post.id,
        externalUrl: post.url,
        platformPostId: post.platformPostId,
        crossPostedTo: [],
        isNsfw: post.isNsfw,
        contentRating: post.contentRating,
        visibility: post.visibility,
      };
    });
  } catch (error) {
    console.error("[feed-data] Discover platform posts unavailable", error);
    return [];
  }
}

export async function getMergedForYouFeedPosts(user: FeedCurrentUser, limit = 40): Promise<FeedCardPost[]> {
  try {
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
    const media = buildExternalMedia({
      id: item.id,
      mediaUrl: item.mediaUrl,
      thumbnailUrl: item.thumbnailUrl,
      postType: item.postType,
    });

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
  } catch (error) {
    console.error("[feed-data] Merged platform feed unavailable", error);
    return [];
  }
}

export async function getFeedPostById(user: FeedCurrentUser, id: string): Promise<FeedCardPost | null> {
  if (id.startsWith("feeditem-")) {
    try {
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
      const media = buildExternalMedia({
        id: item.id,
        mediaUrl: item.mediaUrl,
        thumbnailUrl: item.thumbnailUrl,
        postType: item.postType,
      });
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
    } catch (error) {
      console.error("[feed-data] Connected feed item unavailable", error);
      return null;
    }
  }

  // A mutual friend's shared platform reel. These are in the Flow candidate pool
  // (getFriendPlatformFeedPosts), so they must be resolvable here too — else a
  // like on one 404s and its author affinity is silently lost.
  if (id.startsWith("friend-platform-")) {
    try {
      const { friendIds } = await getViewerSocialGraph(user.id);
      if (friendIds.length === 0) return null;
      const post = await prisma.platformPost.findFirst({
        where: {
          id: id.slice("friend-platform-".length),
          ...nsfwHiddenWhere(user),
          visibility: { in: ["public", "friends"] },
          connectedAccount: {
            userId: { in: friendIds },
            isActive: true,
            user: { isSuspended: false },
          },
        },
        include: {
          connectedAccount: {
            select: {
              platform: true,
              platformUsername: true,
              user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
            },
          },
          media: true,
        },
      });
      if (!post) return null;
      const media = post.media.length > 0
        ? post.media.flatMap((item) =>
            buildExternalMedia({
              id: item.id,
              mediaUrl: item.url,
              thumbnailUrl: item.thumbnailUrl,
              mediaType: item.mediaType,
              postType: post.postType,
            }),
          )
        : buildExternalMedia({ id: `${post.id}-thumbnail`, thumbnailUrl: post.thumbnailUrl, postType: post.postType });
      const friend = post.connectedAccount.user;
      const content = [post.title, post.content].filter(Boolean).join(post.title && post.content ? "\n\n" : "");
      return {
        id: `friend-platform-${post.id}`,
        content: content || `${post.connectedAccount.platform} post from ${friend.displayName}`,
        createdAt: post.publishedAt ?? post.createdAt,
        author: {
          id: friend.id,
          username: friend.username,
          displayName: friend.displayName,
          avatarUrl: friend.avatarUrl,
          isVerified: friend.isVerified,
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
        meshFriend: { userId: friend.id, username: friend.username, displayName: friend.displayName },
        isNsfw: post.isNsfw,
        contentRating: post.contentRating,
        visibility: post.visibility,
      };
    } catch (error) {
      console.error("[feed-data] Friend platform post unavailable", error);
      return null;
    }
  }

  if (id.startsWith("platform-")) {
    try {
      const rawId = id.slice("platform-".length);
      const platformInclude = {
        connectedAccount: {
          select: {
            platform: true,
            platformUsername: true,
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
          },
        },
        media: true,
      } as const;
      // Owner-scoped first: the owner can open all of their own imported
      // content regardless of its source visibility.
      let post = await prisma.platformPost.findFirst({
        where: {
          id: rawId,
          ...nsfwHiddenWhere(user),
          connectedAccount: { userId: user.id, isActive: true },
        },
        include: platformInclude,
      });
      // Discover fallback: a PUBLIC post from any discoverable member — the same
      // gate getDiscoverPlatformPosts applies, so this exposes nothing new, and
      // it lets a like on a discover reel (or the related lane) resolve.
      if (!post) {
        post = await prisma.platformPost.findFirst({
          where: {
            id: rawId,
            ...nsfwHiddenWhere(user),
            visibility: "public",
            connectedAccount: {
              isActive: true,
              user: { isSuspended: false, showInDiscovery: true },
            },
          },
          include: platformInclude,
        });
      }
      if (!post) return null;
      const media = post.media.length > 0
        ? post.media.flatMap((item) =>
            buildExternalMedia({
              id: item.id,
              mediaUrl: item.url,
              thumbnailUrl: item.thumbnailUrl,
              mediaType: item.mediaType,
              postType: post!.postType,
            }),
          )
        : buildExternalMedia({
            id: `${post.id}-thumbnail`,
            thumbnailUrl: post.thumbnailUrl,
            postType: post.postType,
          });
      const owner = post.connectedAccount.user;
      const content = [post.title, post.content].filter(Boolean).join(post.title && post.content ? "\n\n" : "");
      return {
        id: `platform-${post.id}`,
        content: content || `${post.connectedAccount.platform} post`,
        createdAt: post.publishedAt ?? post.createdAt,
        author: {
          id: owner.id,
          username: owner.username,
          displayName: owner.displayName,
          avatarUrl: owner.avatarUrl,
          isVerified: owner.isVerified,
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
        visibility: post.visibility,
      };
    } catch (error) {
      console.error("[feed-data] Connected platform post unavailable", error);
      return null;
    }
  }

  const { communityIds, friendIds } = await getViewerSocialGraph(user.id);

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
  const [nativePosts, ownPlatformPosts, friendPlatformPosts, mergedForYouPosts, discoverPlatformPosts] = await Promise.all([
    getNativeFeedPostsForSource(user, source, providerLimit),
    source === "discover" ? Promise.resolve([]) : getConnectedPlatformFeedPosts(user, providerLimit),
    source === "discover" ? Promise.resolve([]) : getFriendPlatformFeedPosts(user, providerLimit),
    source === "following" ? Promise.resolve([]) : getMergedForYouFeedPosts(user, providerLimit),
    // Everyone's public platform content circulates — the open internet's
    // supply, not just the viewer's own graph.
    source === "following" ? Promise.resolve([]) : getDiscoverPlatformPosts(user, providerLimit),
  ]);

  // A friend's shared post and the open-discovery copy are the same underlying
  // item — collapse them by canonical identity (shared platformPostId), keeping
  // the first, so friend/own attribution wins over the anonymous discover copy.
  const byId = new Map<string, FeedCardPost>();
  for (const post of [
    ...nativePosts.map(toFeedCardPost),
    ...ownPlatformPosts,
    ...(friendPlatformPosts as FriendPlatformFeedPost[]),
    ...mergedForYouPosts,
    ...discoverPlatformPosts,
  ]) {
    const key = canonicalFeedKey(post);
    if (!byId.has(key)) byId.set(key, post);
  }

  return filterFeedPostsByContent(sortFeedPosts([...byId.values()]), contentFilter).slice(0, limit);
}
