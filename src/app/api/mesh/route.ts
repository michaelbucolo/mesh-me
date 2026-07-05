import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canShareFriendMeshBranch, parseMeshBranchOverrides } from "@/lib/friend-mesh";
import { nsfwHiddenWhere } from "@/lib/content-safety";

const meshPayloadCache = new Map<string, { expiresAt: number; payload: unknown }>();
const MESH_CACHE_MAX_ENTRIES = 500;

export async function GET(req: Request) {
  try {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const viewUserId = searchParams.get("user");

  if (viewUserId && viewUserId !== user.id) {
    return getPublicMesh(viewUserId, user.id);
  }

  const now = Date.now();
  const cachedPayload = meshPayloadCache.get(user.id);
  if (cachedPayload && cachedPayload.expiresAt > now) {
    return NextResponse.json(cachedPayload.payload);
  }
  for (const [key, entry] of meshPayloadCache) {
    if (entry.expiresAt <= now) meshPayloadCache.delete(key);
  }

  const safetyWhere = nsfwHiddenWhere(user);

  const [followingData, followersData, communitiesData, interestsData, postsData, connectedAccountsData, alterEgosData, meshiPrefData, meshCosmeticsData] = await Promise.all([
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
      where: { ...safetyWhere, authorId: user.id },
      select: {
        id: true, content: true, createdAt: true,
        communityId: true,
        media: { select: { url: true, type: true, width: true, height: true }, take: 1 },
        tags: { select: { tag: true } },
        _count: { select: { reactions: true, comments: true, reposts: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.connectedAccount.findMany({
      where: { userId: user.id, isActive: true },
      select: {
        id: true, platform: true, platformUsername: true,
        lastSyncAt: true, syncStatus: true,
        _count: { select: { platformPosts: true, platformFollowers: true, platformMedia: true, platformComments: true } },
        platformPosts: {
          where: safetyWhere,
          select: {
            id: true, platformPostId: true, title: true, content: true, url: true, postType: true,
            likeCount: true, commentCount: true, shareCount: true, viewCount: true,
            thumbnailUrl: true, publishedAt: true, visibility: true, isPinned: true,
            media: {
              select: {
                url: true,
                thumbnailUrl: true,
                mediaType: true,
                width: true,
                height: true,
              },
              take: 1,
            },
          },
          orderBy: { likeCount: "desc" },
          take: 8,
        },
        platformFollowers: {
          select: {
            id: true, platformUserId: true, username: true, displayName: true, avatarUrl: true,
            followerCount: true, isMutual: true, relationshipType: true, profileUrl: true,
          },
          orderBy: { followerCount: "desc" },
          take: 10,
        },
        platformAnalytics: {
          select: {
            followerCount: true, followingCount: true, postCount: true,
            totalLikes: true, totalComments: true, totalViews: true, totalShares: true,
            date: true,
          },
          orderBy: { date: "desc" },
          take: 1,
        },
      },
    }),
    prisma.alterEgo.findMany({
      where: { userId: user.id, isActive: true },
      select: { id: true, username: true, displayName: true, bio: true, avatarUrl: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.meshiPreference.findUnique({
      where: { userId: user.id },
      select: { colorTheme: true, hatStyle: true, faceStyle: true, hairStyle: true, accessoryStyle: true, eyeStyle: true, badgeStyle: true, outfitStyle: true },
    }),
    prisma.meshCosmetic.findMany({
      where: { userId: user.id, isActive: true },
      select: { type: true, value: true, isActive: true },
    }),
  ]);

  const [notificationsData, commentActivityData, reactionActivityData, messageActivityData] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: user.id },
      select: {
        id: true,
        type: true,
        message: true,
        read: true,
        createdAt: true,
        postId: true,
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
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.comment.findMany({
      where: { authorId: user.id, post: safetyWhere },
      select: {
        id: true,
        content: true,
        createdAt: true,
        post: {
          select: {
            id: true,
            content: true,
            author: {
              select: {
                username: true,
                displayName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.reaction.findMany({
      where: { userId: user.id, post: safetyWhere },
      select: {
        id: true,
        type: true,
        createdAt: true,
        post: {
          select: {
            id: true,
            content: true,
            author: {
              select: {
                username: true,
                displayName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.message.findMany({
      where: { senderId: user.id },
      select: {
        id: true,
        content: true,
        createdAt: true,
        threadId: true,
        sourcePlatform: true,
        messageType: true,
        sourcePostId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const activityData = [
    ...notificationsData.map((notification) => ({
      id: `notification-${notification.id}`,
      type: "notification",
      label: notification.type.replace(/_/g, " "),
      summary: notification.message || notification.post?.content || "New Mesh notification",
      href: notification.postId ? `/feed/${notification.postId}` : "/notifications",
      sourcePostId: notification.postId,
      createdAt: notification.createdAt,
      isUnread: !notification.read,
      actor: notification.actor
        ? {
            id: notification.actor.id,
            username: notification.actor.username,
            displayName: notification.actor.displayName,
            avatarUrl: notification.actor.avatarUrl,
          }
        : null,
    })),
    ...commentActivityData.map((comment) => ({
      id: `comment-${comment.id}`,
      type: "comment",
      label: "Commented",
      summary: comment.content || `Replied to ${comment.post.author.displayName || comment.post.author.username}`,
      href: `/feed/${comment.post.id}`,
      sourcePostId: comment.post.id,
      createdAt: comment.createdAt,
      isUnread: false,
      actor: null,
    })),
    ...reactionActivityData.map((reaction) => ({
      id: `reaction-${reaction.id}`,
      type: reaction.type || "reaction",
      label: reaction.type === "like" ? "Liked a post" : `${reaction.type} reaction`,
      summary: reaction.post.content || `Reacted to ${reaction.post.author.displayName || reaction.post.author.username}`,
      href: `/feed/${reaction.post.id}`,
      sourcePostId: reaction.post.id,
      createdAt: reaction.createdAt,
      isUnread: false,
      actor: null,
    })),
    ...messageActivityData.map((message) => ({
      id: `message-${message.id}`,
      type: "message",
      label: message.sourcePlatform === "mesh" ? "MeChat message" : `${message.sourcePlatform} message`,
      summary: message.content,
      href: `/messages/${message.threadId}`,
      sourcePostId: message.sourcePostId || null,
      createdAt: message.createdAt,
      isUnread: false,
      actor: null,
    })),
    ...connectedAccountsData
      .filter((account) => Boolean(account.lastSyncAt))
      .map((account) => ({
        id: `sync-${account.id}`,
        type: "sync",
        label: `${account.platform} synced`,
        summary: account.platformUsername
          ? `@${account.platformUsername} is connected and ready.`
          : `${account.platform} is connected and ready.`,
        href: "/connected-accounts",
        sourcePostId: null,
        connectedAccountId: account.id,
        createdAt: account.lastSyncAt,
        isUnread: false,
        actor: null,
      })),
    {
      id: `profile-created-${user.id}`,
      type: "profile",
      label: "Mesh created",
      summary: "Your private Mesh account is active.",
      href: "/settings",
      sourcePostId: null,
      connectedAccountId: null,
      createdAt: user.createdAt,
      isUnread: false,
      actor: null,
    },
  ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 18);

  // Find mutual follows (people the user follows who also follow them back)
  const followingIds = new Set(followingData.map((f) => f.following.id));
  const followerIds = new Set(followersData.map((f) => f.follower.id));
  const mutualSet = new Set<string>();
  for (const id of followingIds) {
    if (followerIds.has(id)) mutualSet.add(id);
  }

  const mutualIds = Array.from(mutualSet).slice(0, 12);
  const friendMeshData = mutualIds.length > 0
    ? await prisma.user.findMany({
        where: {
          id: { in: mutualIds },
          isSuspended: false,
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          meshPrivacy: {
            select: {
              meshVisibility: true,
              branchOverrides: true,
            },
          },
          posts: {
            where: safetyWhere,
            select: {
              id: true,
              content: true,
              createdAt: true,
              communityId: true,
              media: { select: { url: true, type: true, width: true, height: true }, take: 1 },
              tags: { select: { tag: true } },
              _count: { select: { reactions: true, comments: true, reposts: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 6,
          },
          connectedAccounts: {
            where: { isActive: true },
            select: {
              id: true,
              platform: true,
              platformUsername: true,
              syncStatus: true,
              platformPosts: {
                where: { ...safetyWhere, visibility: { in: ["public", "friends"] } },
                select: {
                  id: true,
                  platformPostId: true,
                  title: true,
                  content: true,
                  url: true,
                  postType: true,
                  likeCount: true,
                  commentCount: true,
                  shareCount: true,
                  viewCount: true,
                  thumbnailUrl: true,
                  publishedAt: true,
                  visibility: true,
                  isPinned: true,
                  media: {
                    select: {
                      url: true,
                      thumbnailUrl: true,
                      mediaType: true,
                      width: true,
                      height: true,
                    },
                    take: 1,
                  },
                },
                orderBy: [
                  { publishedAt: "desc" },
                  { createdAt: "desc" },
                ],
                take: 4,
              },
            },
            take: 4,
          },
        },
      })
    : [];

  // Find which users share communities with the current user
  const communityIds = communitiesData.map((cm) => cm.community.id);
  const allUserIds = Array.from(new Set([...followingIds, ...followerIds]));
  const sharedCommunityMembers = communityIds.length > 0 && allUserIds.length > 0
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
          { authorId: user.id, post: { ...safetyWhere, authorId: { in: allUserIds } } },
          { authorId: { in: allUserIds }, post: { ...safetyWhere, authorId: user.id } },
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
          { userId: user.id, post: { ...safetyWhere, authorId: { in: allUserIds } } },
          { userId: { in: allUserIds }, post: { ...safetyWhere, authorId: user.id } },
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
    for (const id of mutualSet) {
      interactionCounts[id] = (interactionCounts[id] || 0) + 3;
    }
  }

  const payload = {
    user: {
      id: user.id, username: user.username, displayName: user.displayName,
      avatarUrl: user.avatarUrl, bio: user.bio,
    },
    following: followingData.map((f) => ({
      ...f.following,
      isMutual: mutualSet.has(f.following.id),
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
      isMutual: mutualSet.has(f.follower.id),
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
      media: p.media.map((media) => ({
        url: media.url,
        type: media.type,
        width: media.width,
        height: media.height,
      })),
      tags: p.tags.map((t) => t.tag),
      likeCount: p._count.reactions,
      commentCount: p._count.comments,
      repostCount: p._count.reposts,
    })),
    connectedAccounts: connectedAccountsData.map((acct) => ({
      id: acct.id,
      platform: acct.platform,
      platformUsername: acct.platformUsername,
      lastSyncAt: acct.lastSyncAt,
      syncStatus: acct.syncStatus,
      counts: acct._count,
      analytics: acct.platformAnalytics[0] || null,
      topPosts: acct.platformPosts
        .filter((p) => p.visibility === "public")
        .map((p) => ({
        id: p.id,
        platformPostId: p.platformPostId,
        connectedAccountId: acct.id,
        title: p.title,
        content: (p.content || "").slice(0, 150),
        url: p.url,
        postType: p.postType,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        shareCount: p.shareCount,
        viewCount: p.viewCount,
        thumbnailUrl: p.thumbnailUrl,
        media: p.media.map((media) => ({
          url: media.url,
          thumbnailUrl: media.thumbnailUrl,
          mediaType: media.mediaType,
          width: media.width,
          height: media.height,
        })),
        publishedAt: p.publishedAt,
        visibility: p.visibility,
        isPinned: p.isPinned,
      })),
      topFollowers: acct.platformFollowers.map((f) => ({
        id: f.id,
        platformUserId: f.platformUserId,
        connectedAccountId: acct.id,
        username: f.username,
        displayName: f.displayName,
        avatarUrl: f.avatarUrl,
        followerCount: f.followerCount,
        isMutual: f.isMutual,
        relationshipType: f.relationshipType,
        profileUrl: f.profileUrl,
      })),
    })),
    friendMeshes: friendMeshData.map((friend) => {
      const branchOverrides = parseMeshBranchOverrides(friend.meshPrivacy?.branchOverrides);
      const meshVisibility = friend.meshPrivacy?.meshVisibility ?? "private";
      const canSharePosts = canShareFriendMeshBranch(meshVisibility, branchOverrides, "posts");
      const canSharePlatforms = canShareFriendMeshBranch(meshVisibility, branchOverrides, "platforms");

      return {
        user: {
          id: friend.id,
          username: friend.username,
          displayName: friend.displayName,
          avatarUrl: friend.avatarUrl,
        },
        posts: canSharePosts
          ? friend.posts.map((p) => ({
              id: p.id,
              content: p.content.slice(0, 200),
              createdAt: p.createdAt,
              communityId: p.communityId,
              media: p.media.map((media) => ({
                url: media.url,
                type: media.type,
                width: media.width,
                height: media.height,
              })),
              tags: p.tags.map((t) => t.tag),
              likeCount: p._count.reactions,
              commentCount: p._count.comments,
              repostCount: p._count.reposts,
            }))
          : [],
        connectedAccounts: canSharePlatforms
          ? friend.connectedAccounts.map((acct) => ({
              id: acct.id,
              platform: acct.platform,
              platformUsername: acct.platformUsername,
              syncStatus: acct.syncStatus,
              topPosts: acct.platformPosts.map((p) => ({
                id: p.id,
                platformPostId: p.platformPostId,
                connectedAccountId: acct.id,
                title: p.title,
                content: (p.content || "").slice(0, 150),
                url: p.url,
                postType: p.postType,
                likeCount: p.likeCount,
                commentCount: p.commentCount,
                shareCount: p.shareCount,
                viewCount: p.viewCount,
                thumbnailUrl: p.thumbnailUrl,
                media: p.media.map((media) => ({
                  url: media.url,
                  thumbnailUrl: media.thumbnailUrl,
                  mediaType: media.mediaType,
                  width: media.width,
                  height: media.height,
                })),
                publishedAt: p.publishedAt,
                visibility: p.visibility,
                isPinned: p.isPinned,
              })),
            }))
          : [],
      };
    }),
    alterEgos: alterEgosData,
    activities: activityData,
    meshiPreference: meshiPrefData || {
      colorTheme: "blue",
      hatStyle: "none",
      faceStyle: "happy",
      hairStyle: "none",
      accessoryStyle: "none",
      eyeStyle: "regular",
      badgeStyle: "none",
      outfitStyle: "none",
    },
    meshCosmetics: meshCosmeticsData,
    stats: {
      followingCount: followingData.length,
      followerCount: followersData.length,
      mutualCount: mutualSet.size,
      communityCount: communitiesData.length,
      postCount: postsData.length,
      interestCount: interestsData.length,
      connectedPlatformCount: connectedAccountsData.length,
      alterEgoCount: alterEgosData.length,
      activityCount: activityData.length,
    },
  };

  meshPayloadCache.delete(user.id);
  if (meshPayloadCache.size >= MESH_CACHE_MAX_ENTRIES) {
    const oldest = meshPayloadCache.keys().next().value;
    if (oldest !== undefined) meshPayloadCache.delete(oldest);
  }
  meshPayloadCache.set(user.id, { expiresAt: Date.now() + 45_000, payload });
  return NextResponse.json(payload);
  } catch (error) {
    console.error("Mesh API error:", error);
    return NextResponse.json(
      { error: "Failed to load mesh data" },
      { status: 500 }
    );
  }
}

async function getPublicMesh(targetUserId: string, viewerId: string) {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      isPublic: true,
    },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isFollowing = await prisma.follow.findFirst({
    where: { followerId: viewerId, followingId: targetUserId },
  });

  if (!targetUser.isPublic && !isFollowing) {
    return NextResponse.json({ error: "This mesh is private" }, { status: 403 });
  }

  const [followingData, followersData, postsData, interestsData, connectedAccountsData, meshiPrefData, followingCount, followerCount, postCount, visibilityPolicies] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: targetUserId },
      select: {
        following: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
      take: 50,
    }),
    prisma.follow.findMany({
      where: { followingId: targetUserId },
      select: {
        follower: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
      take: 50,
    }),
    prisma.post.findMany({
      where: { authorId: targetUserId, visibility: "public" },
      select: {
        id: true,
        content: true,
        createdAt: true,
        media: { select: { url: true, type: true, width: true, height: true } },
        _count: { select: { comments: true, reactions: true, reposts: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.userInterest.findMany({
      where: { userId: targetUserId },
      select: { id: true, tag: true },
    }),
    prisma.connectedAccount.findMany({
      where: { userId: targetUserId },
      select: { id: true, platform: true, platformUsername: true, isActive: true },
    }),
    prisma.meshiPreference.findUnique({
      where: { userId: targetUserId },
      select: { colorTheme: true, hatStyle: true, faceStyle: true, hairStyle: true, accessoryStyle: true, eyeStyle: true, badgeStyle: true, outfitStyle: true },
    }),
    prisma.follow.count({ where: { followerId: targetUserId } }),
    prisma.follow.count({ where: { followingId: targetUserId } }),
    prisma.post.count({ where: { authorId: targetUserId, visibility: "public" } }),
    prisma.dataVisibilityPolicy.findMany({
      where: { userId: targetUserId, entityType: "connected_account" },
      select: { entityId: true, visibility: true },
    }),
  ]);

  const following = followingData.map((f) => f.following);
  const followers = followersData.map((f) => f.follower);
  const interests = interestsData.map((i) => i.tag);

  return NextResponse.json({
    user: {
      id: targetUser.id,
      username: targetUser.username,
      displayName: targetUser.displayName,
      avatarUrl: targetUser.avatarUrl,
      bio: targetUser.bio,
    },
    following,
    followers,
    communities: [],
    interests,
    posts: postsData.map((p) => ({
      id: p.id,
      content: p.content.slice(0, 200),
      createdAt: p.createdAt,
      media: p.media,
      likeCount: p._count.reactions,
      commentCount: p._count.comments,
      repostCount: p._count.reposts,
    })),
    connectedAccounts: connectedAccountsData.filter((ca) => {
      const policy = visibilityPolicies.find((p) => p.entityId === ca.id);
      return !policy || (policy.visibility !== "private" && policy.visibility !== "hidden");
    }),
    alterEgos: [],
    meshiPreference: meshiPrefData || { colorTheme: "blue", hatStyle: "none", faceStyle: "happy", hairStyle: "none", accessoryStyle: "none", eyeStyle: "regular", badgeStyle: "none", outfitStyle: "none" },
    stats: {
      followingCount,
      followerCount,
      mutualCount: 0,
      communityCount: 0,
      postCount,
      interestCount: interestsData.length,
      connectedPlatformCount: connectedAccountsData.filter((ca) => {
        const policy = visibilityPolicies.find((p) => p.entityId === ca.id);
        return !policy || (policy.visibility !== "private" && policy.visibility !== "hidden");
      }).length,
      alterEgoCount: 0,
      activityCount: 0,
    },
    isViewingOtherUser: true,
  });
}
