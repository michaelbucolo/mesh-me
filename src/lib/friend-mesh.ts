import { cache } from "react";
import { prisma } from "./prisma";
import { nsfwHiddenWhere } from "./content-safety";

export type FriendMeshCurrentUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  nsfwEnabled?: boolean | null;
  adultVerificationStatus?: string | null;
  adultVerificationExpiresAt?: Date | string | null;
};

export type FriendPlatformFeedPost = {
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
  community: null;
  media: { id: string; url: string; type: string }[];
  tags: { id: string; tag: string }[];
  _count: { comments: number; reactions: number; reposts: number };
  reactions: { id: string }[];
  savedBy: { id: string }[];
  isPinned: boolean;
  platform: string;
  sourceId: string;
  externalUrl: string | null;
  platformPostId: string;
  crossPostedTo: string[];
  meshFriend: {
    userId: string;
    username: string;
    displayName: string;
  };
};

export function parseMeshBranchOverrides(value: string | null | undefined): Record<string, string> {
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

export function canShareFriendMeshBranch(
  meshVisibility: string | null | undefined,
  branchOverrides: Record<string, string>,
  branchKey: "posts" | "platforms" | "people" | "communities" | "interests"
) {
  const branchVisibility = branchOverrides[branchKey];
  if (branchVisibility === "private") return false;
  if (branchVisibility === "public" || branchVisibility === "friends") return true;

  // This function is only used after mutual follow is confirmed. Treat "private"
  // as hidden from the public internet, while mutual friends can still combine meshes.
  return meshVisibility !== "partial";
}

// Request-cached: the feed can ask for friend platform posts more than once
// per render (e.g. multi-pass flow ranking) with the same viewer and limit.
const getMutualFriendIds = cache(async (userId: string, limit = 80) => {
  // Don't cap each side before intersecting: a `take` on the following and
  // followers lists independently drops any mutual that falls outside the first
  // `limit` (unordered) rows of either side, so real friends vanish
  // non-deterministically. Intersect the full sets, then cap the result.
  const [following, followers] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    }),
    prisma.follow.findMany({
      where: { followingId: userId },
      select: { followerId: true },
    }),
  ]);

  const followerIds = new Set(followers.map((follow) => follow.followerId));
  return following
    .map((follow) => follow.followingId)
    .filter((id) => followerIds.has(id))
    .slice(0, limit);
});

export async function getFriendPlatformFeedPosts(user: FriendMeshCurrentUser, limit = 20): Promise<FriendPlatformFeedPost[]> {
  try {
    const mutualIds = await getMutualFriendIds(user.id, 120);
    if (mutualIds.length === 0) return [];

    const platformPosts = await prisma.platformPost.findMany({
      where: {
        ...nsfwHiddenWhere(user),
        visibility: { in: ["public", "friends"] },
        connectedAccount: {
          userId: { in: mutualIds },
          isActive: true,
          user: { isSuspended: false },
        },
      },
      include: {
        connectedAccount: {
          select: {
            platform: true,
            platformUsername: true,
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
        media: true,
      },
      orderBy: [
        { publishedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
    });

    return platformPosts.map((post) => {
    const fallbackType = ["video", "reel", "short", "story"].includes(post.postType) ? "video" : "image";
    const media = post.media.length > 0
      ? post.media.map((item) => {
          // PlatformMedia.mediaType is a free provider string — normalize to
          // the types the renderers actually understand so a raw value can
          // never reach an <img> tag it doesn't belong in. Audio keeps its
          // playable URL (a thumbnail can't be listened to).
          const raw = (item.mediaType || "").toLowerCase().trim();
          const type = ["image", "video", "audio", "gif", "document", "link"].includes(raw) ? raw : fallbackType;
          return {
            id: item.id,
            url: type === "audio" ? item.url : item.thumbnailUrl || item.url,
            type,
          };
        })
      : post.thumbnailUrl
        ? [{
            id: `${post.id}-thumbnail`,
            url: post.thumbnailUrl,
            type: fallbackType,
          }]
        : [];

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
      postType: post.postType ?? null,
      durationSeconds: post.durationSeconds ?? null,
      platformPostId: post.platformPostId,
      crossPostedTo: post.isFromMesh ? [post.connectedAccount.platform] : [],
      meshFriend: {
        userId: friend.id,
        username: friend.username,
        displayName: friend.displayName,
      },
    };
    });
  } catch (error) {
    console.error("[friend-mesh] Connected friend platform posts unavailable", error);
    return [];
  }
}
