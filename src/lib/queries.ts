"use server";

import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { getCurrentUser } from "./auth";
import { parseMeChatMetadata } from "./mechat-metadata";
import { getGlobalMeshSelfPreviewCore, type GlobalMeshSelfPreview } from "./global-mesh";
import { canViewNsfw, nsfwHiddenWhere } from "./content-safety";
import { ABOUT_FIELDS, type AboutField, canSeeAboutField, parseFieldPrivacy } from "./profile-info";
import {
  areMutualFollowers,
  canSeeMeshBranch,
  canSeeMeshStats,
  canUserInteractWithPost,
  canViewProfile,
  getBlockedUserIdSet,
  normalizeMeshVisibility,
  parseBranchOverrides,
  type BranchVisibility,
} from "./privacy-policy";

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


async function canCurrentUserViewNativePost(
  post: { authorId: string; visibility: string; community: { id: string; isPublic: boolean } | null },
  currentUser: CurrentUser | null,
) {
  if (post.community && !post.community.isPublic) {
    if (!currentUser || post.authorId !== currentUser.id) {
      if (!currentUser) return false;
      const membership = await prisma.communityMember.findUnique({
        where: { userId_communityId: { userId: currentUser.id, communityId: post.community.id } },
        select: { userId: true },
      });
      if (!membership) return false;
    }
  }
  if (post.visibility === "public") return true;
  if (!currentUser) return false;
  if (post.authorId === currentUser.id) return true;
  if (post.visibility !== "friends") return false;
  return areMutualFollowers(currentUser.id, post.authorId);
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


export async function getExplorePosts(page = 1, limit = 20) {
  const user = await getCurrentUser();
  const visibilityFilter = user
    ? {
        ...nsfwHiddenWhere(user),
        visibility: "public",
        OR: [
          { authorId: user.id },
          // Public posts circulate when their author opted into discovery.
          {
            author: { isSuspended: false, showInDiscovery: true },
            OR: [{ communityId: null }, { community: { isPublic: true } }],
          },
        ],
      }
    : {
        isNsfw: false,
        visibility: "public",
        author: { isSuspended: false, showInDiscovery: true },
        OR: [{ communityId: null }, { community: { isPublic: true } }],
      };

  // Ordering the whole table by reaction count forces SQLite to run a
  // correlated count for every public post before it can return a single row
  // (measured at 1–2.5s in production). Explore is "what's hot lately", so
  // rank a recent window in memory instead: one indexed createdAt scan, then
  // sort those posts by engagement.
  const offset = (page - 1) * limit;
  const windowSize = Math.min(Math.max((offset + limit) * 3, 60), 240);
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
        select: { id: true, name: true, slug: true, isPublic: true },
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
    take: windowSize,
  });

  posts.sort(
    (a, b) =>
      b._count.reactions * 3 + b._count.comments * 2 + b._count.reposts -
        (a._count.reactions * 3 + a._count.comments * 2 + a._count.reposts) ||
      +new Date(b.createdAt) - +new Date(a.createdAt),
  );

  return posts.slice(offset, offset + limit);
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
          isSuspended: true,
          bio: true,
        },
      },
      community: {
        select: { id: true, name: true, slug: true, isPublic: true },
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
  // A suspended author's post is locked to admins — matching getFeedPostById and
  // the feed audience clause, so a direct /feed/[postId] link can't surface it.
  // (A suspended user can't be the viewer, since getCurrentUser rejects them.)
  if (post.author.isSuspended && !user?.isAdmin) return null;
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
      lastSeenAt: true,
      hideActivityStatus: true,
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
  // Split by direction: the viewer needs to know they are the blocker (so the
  // page can offer Unblock), but is never told that the *other* side blocked
  // them — that reads as an ordinary private profile.
  let viewerHasBlocked = false;
  let blockedEitherWay = false;
  let mutualFollowers: Array<{ follower: { id: string; username: string; displayName: string; avatarUrl: string | null } }> = [];

  if (currentUser) {
    // One parallel round: mutuals are "people I follow who follow them",
    // expressed relationally so it doesn't need my following list first.
    const [followToUser, followFromUser, mutuals, blocks] = await Promise.all([
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
        where: {
          followingId: user.id,
          follower: { followers: { some: { followerId: currentUser.id } } },
        },
        include: {
          follower: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
        take: 5,
      }),
      prisma.block.findMany({
        where: {
          OR: [
            { blockerId: currentUser.id, blockedId: user.id },
            { blockerId: user.id, blockedId: currentUser.id },
          ],
        },
        select: { blockerId: true },
      }),
    ]);

    isFollowing = Boolean(followToUser);
    isFriend = Boolean(followToUser && followFromUser);
    viewerHasBlocked = blocks.some((block) => block.blockerId === currentUser.id);
    blockedEitherWay = blocks.length > 0;
    mutualFollowers = mutuals;
  }

  const userIsPublic = user.isPublic;
  const meshVisibility = normalizeMeshVisibility(
    user.meshPrivacy?.meshVisibility,
    userIsPublic ? "public" : "private"
  );
  const branchOverrides = parseBranchOverrides(user.meshPrivacy?.branchOverrides);
  // A block closes the profile from BOTH sides and outranks every visibility
  // setting, admin included — the whole point is that the two accounts stop
  // seeing each other. The header still renders (name, avatar, action row) so
  // the blocker keeps a place to press Unblock; everything gated on
  // profileVisible — bio, links, posts, about, counts, last-seen — goes dark.
  const profileVisible = !blockedEitherWay && canViewProfile(currentUser, user, meshVisibility, isFriend);
  const profileUserId = user.id;
  const showConnections = user.meshPrivacy?.showConnections;

  function canSeeBranch(branchKey: string) {
    if (!profileVisible) return false;
    const fallback: BranchVisibility = meshVisibility === "partial"
      ? (userIsPublic ? "public" : "private")
      : meshVisibility;
    return canSeeMeshBranch({
      viewer: currentUser,
      targetUserId: profileUserId,
      branchKey,
      branchOverrides,
      isFriend,
      showConnections,
      defaultVisibility: fallback,
    });
  }

  const sectionVisibility = {
    profile: profileVisible,
    stats: profileVisible && canSeeMeshStats(currentUser, user.id, user.meshPrivacy),
    people: canSeeBranch("people"),
    communities: canSeeBranch("communities"),
    interests: canSeeBranch("interests"),
    platforms: canSeeBranch("platforms"),
    content: canSeeBranch("content"),
  };

  const hiddenCounts = { followers: 0, following: 0, posts: 0 };

  // Facebook-style "About" — gated by the overall profile visibility AND then,
  // field by field, by the owner's per-field privacy. Fails closed: a field
  // with no explicit level is shown to its owner only. The raw privacy map and
  // the full (including empty) field set are returned ONLY to the owner, for
  // the editor; every other viewer gets just the fields they may see.
  const profileInfo = await prisma.profileInfo.findUnique({
    where: { userId: user.id },
    select: {
      aboutMe: true, workplace: true, jobTitle: true, school: true, hometown: true,
      currentCity: true, relationshipStatus: true, birthday: true, gender: true,
      pronouns: true, publicEmail: true, publicPhone: true, fieldPrivacy: true,
    },
  });
  const aboutPrivacy = parseFieldPrivacy(profileInfo?.fieldPrivacy);
  let about: Partial<Record<AboutField, string>> | null = null;
  if (profileInfo && profileVisible) {
    const visible: Partial<Record<AboutField, string>> = {};
    for (const field of ABOUT_FIELDS) {
      const value = profileInfo[field];
      if (typeof value !== "string" || !value.trim()) continue;
      if (canSeeAboutField(aboutPrivacy[field], { isOwner: isOwnProfile, isFriend })) {
        visible[field] = value;
      }
    }
    about = Object.keys(visible).length ? visible : null;
  }
  const aboutEditable = isOwnProfile
    ? {
        fields: Object.fromEntries(
          ABOUT_FIELDS.map((field) => [field, (profileInfo?.[field] ?? "") as string]),
        ) as Record<AboutField, string>,
        privacy: aboutPrivacy,
      }
    : null;

  return {
    ...user,
    about,
    aboutEditable,
    // Last-online is privacy-gated on BOTH conditions: never expose the timestamp
    // (or the raw hide flag) when the user hides their activity OR their profile
    // isn't visible to the viewer. `profileVisible` is already true for your own
    // profile, so you always see your own last-seen.
    lastSeenAt: user.hideActivityStatus || !profileVisible ? null : user.lastSeenAt,
    hideActivityStatus: undefined,
    bio: profileVisible ? user.bio : null,
    location: profileVisible ? user.location : null,
    website: profileVisible ? user.website : null,
    links: profileVisible ? user.links : [],
    interests: sectionVisibility.interests ? user.interests : [],
    connectedAccounts: sectionVisibility.platforms ? user.connectedAccounts : [],
    _count: sectionVisibility.stats ? user._count : hiddenCounts,
    meshPrivacy: undefined,
    isFollowing,
    isOwnProfile,
    isFriend,
    viewerHasBlocked,
    privacyLevel: profileVisible ? meshVisibility : "private",
    sectionVisibility,
    mutualFollowers: sectionVisibility.people ? mutualFollowers.map((f) => f.follower) : [],
  };
}

export type ProfileConnection = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  bio: string | null;
  followerCount: number;
  isFollowingByViewer: boolean;
  isViewer: boolean;
};

/**
 * The followers / following list behind a profile's stat counts. Authorization
 * is enforced HERE, not only in the page: this file is a "use server" module, so
 * this export is a dispatchable Server Action — it must re-derive the viewer from
 * the session and re-check the target's "people" branch itself, or it could be
 * invoked directly to enumerate an arbitrary (even private) user's social graph.
 * Suspended accounts and anyone in a block relationship with the viewer (either
 * direction) are additionally filtered out.
 */
export async function getProfileConnections(
  targetId: string,
  tab: "followers" | "following",
): Promise<ProfileConnection[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];
  const viewerId = currentUser.id;

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    include: { meshPrivacy: true },
  });
  if (!target || target.isSuspended) return [];

  // Same in-function gate as getUserCommunities: a non-self, non-admin viewer
  // may only enumerate connections when the target's "people" branch is visible
  // to them under the target's own mesh-privacy settings.
  const isSelf = currentUser.id === target.id;
  if (!isSelf && !currentUser.isAdmin) {
    const meshVisibility = normalizeMeshVisibility(
      target.meshPrivacy?.meshVisibility,
      target.isPublic ? "public" : "private",
    );
    const isFriend = await areMutualFollowers(currentUser.id, target.id);
    if (!canViewProfile(currentUser, target, meshVisibility, isFriend)) return [];
    const fallback: BranchVisibility = meshVisibility === "partial"
      ? (target.isPublic ? "public" : "private")
      : (meshVisibility as BranchVisibility);
    const canSee = canSeeMeshBranch({
      viewer: currentUser,
      targetUserId: target.id,
      branchKey: "people",
      branchOverrides: parseBranchOverrides(target.meshPrivacy?.branchOverrides),
      isFriend,
      showConnections: target.meshPrivacy?.showConnections,
      defaultVisibility: fallback,
    });
    if (!canSee) return [];
  }

  const userSelect = {
    id: true,
    username: true,
    displayName: true,
    avatarUrl: true,
    isVerified: true,
    bio: true,
    _count: { select: { followers: true } },
    // A single row iff the viewer already follows this person.
    followers: { where: { followerId: viewerId }, select: { id: true }, take: 1 },
  } as const;
  const safe = {
    isSuspended: false,
    blocks: { none: { blockedId: viewerId } }, // they haven't blocked the viewer
    blockedBy: { none: { blockerId: viewerId } }, // the viewer hasn't blocked them
  };

  let people: Array<{
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    isVerified: boolean;
    bio: string | null;
    _count: { followers: number };
    followers: { id: string }[];
  }>;
  if (tab === "followers") {
    const rows = await prisma.follow.findMany({
      where: { followingId: targetId, follower: safe },
      select: { follower: { select: userSelect } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    people = rows.map((r) => r.follower);
  } else {
    const rows = await prisma.follow.findMany({
      where: { followerId: targetId, following: safe },
      select: { following: { select: userSelect } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    people = rows.map((r) => r.following);
  }

  return people.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName ?? u.username,
    avatarUrl: u.avatarUrl,
    isVerified: u.isVerified,
    bio: u.bio,
    followerCount: u._count.followers,
    isFollowingByViewer: u.followers.length > 0,
    isViewer: u.id === viewerId,
  }));
}

export async function getUserPosts(username: string, page = 1, limit = 20) {
  const currentUser = await getCurrentUser();

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      isPublic: true,
      isSuspended: true,
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
    const [followToUser, followFromUser, blocked] = await Promise.all([
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
      prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: currentUser.id, blockedId: user.id },
            { blockerId: user.id, blockedId: currentUser.id },
          ],
        },
        select: { id: true },
      }),
    ]);
    isFriend = Boolean(followToUser && followFromUser);
    // The profile grid is fetched independently of getUserProfile, so the block
    // gate has to be repeated here — mirroring the mesh-visibility guard below,
    // which is duplicated for the same reason.
    if (blocked) return [];
  }

  const meshVisibility = normalizeMeshVisibility(
    user.meshPrivacy?.meshVisibility,
    user.isPublic ? "public" : "private"
  );
  // Gate on overall profile visibility FIRST — mirrors getUserProfile's
  // `if (!profileVisible) return false` guard. Without this, a stale per-branch
  // content:"public" override could serve a private profile's posts to strangers
  // (the content override would otherwise outrank an overall-private mesh).
  if (!canViewProfile(currentUser, user, meshVisibility, isFriend)) return [];

  const branchOverrides = parseBranchOverrides(user.meshPrivacy?.branchOverrides);
  const fallback: BranchVisibility = meshVisibility === "partial"
    ? (user.isPublic ? "public" : "private")
    : meshVisibility;
  if (!canSeeMeshBranch({
    viewer: currentUser,
    targetUserId: user.id,
    branchKey: "content",
    branchOverrides,
    isFriend,
    defaultVisibility: fallback,
  })) return [];

  const postVisibilityWhere = isOwnProfile
    ? {}
    : {
        OR: [
          {
            visibility: "public",
            OR: [{ communityId: null }, { community: { isPublic: true } }],
          },
          ...(isFriend
            ? [{
                visibility: "friends",
                OR: [{ communityId: null }, { community: { isPublic: true } }],
              }]
            : []),
        ],
      };

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
    lastMessage: thread.messages[0]
      ? {
          ...thread.messages[0],
          // An unsent message keeps its row but drops its content — the inbox
          // preview should say what happened instead of rendering blank.
          content: parseMeChatMetadata(thread.messages[0].metadata).unsent
            ? "Unsent a message"
            : thread.messages[0].content,
        }
      : null,
    unreadCount: unreadCountByThread.get(thread.id) || 0,
  }));
}

export async function getThreadMessages(threadId: string) {
  const user = await getCurrentUser();
  if (!user) return [];

  // Verify the user is a member of this thread. Authorization is always
  // re-derived from the session here and never trusted from the caller.
  const membership = await prisma.threadMember.findFirst({
    where: { threadId, userId: user.id },
  });
  if (!membership) return [];

  // Latest window only — an unbounded fetch over a long thread multiplies
  // into enormous payloads and render work. The API route uses the same cap.
  const messages = await prisma.message.findMany({
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
    orderBy: { createdAt: "desc" },
    take: 150,
  });
  return messages.reverse();
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
  // People search must never cross a block in either direction.
  const blocked = await getBlockedUserIdSet(user.id);

  const [users, posts, communities, platformPosts, platformPeople, connectedSocialSources, messages] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q } },
          { displayName: { contains: q } },
        ],
        id: { notIn: [user.id, ...blocked] },
        isSuspended: false,
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
          // Strangers only ever match posts published as public.
          {
            visibility: "public",
            author: { isSuspended: false, showInDiscovery: true },
            OR: [{ communityId: null }, { community: { isPublic: true } }],
          },
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
        // Source visibility is a whitelist for anyone but the owner: only
        // "public" is searchable. Unlisted, friends, private, and drafts stay
        // exactly as private as the source made them.
        AND: [
          {
            OR: [
              { connectedAccount: { isActive: true, platform: { in: SOCIAL_SEARCH_PLATFORM_IDS }, userId: user.id } },
              {
                visibility: "public",
                connectedAccount: {
                  isActive: true,
                  platform: { in: SOCIAL_SEARCH_PLATFORM_IDS },
                  user: { isSuspended: false, showInDiscovery: true },
                },
              },
            ],
          },
        ],
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

export async function getDiscoverUsers(currentUser?: CurrentUser | null) {
  const user = currentUser ?? await getCurrentUser();
  if (!user) return [];

  // The production database is remote, so latency is round trips, not query
  // cost. Everything here runs as ONE parallel round: candidates exclude
  // already-followed people relationally (no follow-list prefetch), and the
  // caller's interest tags load alongside.
  const include = {
    interests: true,
    _count: { select: { followers: true, posts: true } },
  } as const;
  // Discoverable != public. A private account can still opt in to being
  // *found* (and then approve followers), so discovery only requires
  // showInDiscovery — content visibility stays governed by isPublic elsewhere.
  // Ordering the whole user table by follower count would make SQLite run a
  // correlated COUNT per user, so pull one bounded fresh window instead and
  // rank it in memory: exact for small networks, an approximation at scale.
  const [candidateRows, userInterests, blocked] = await Promise.all([
    prisma.user.findMany({
      where: {
        isSuspended: false,
        showInDiscovery: true,
        id: { not: user.id },
        followers: { none: { followerId: user.id } },
      },
      include,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.userInterest.findMany({
      where: { userId: user.id },
      select: { tag: true },
    }),
    getBlockedUserIdSet(user.id),
  ]);
  // Discovery must never cross a block in either direction.
  const candidates = candidateRows.filter((u) => !blocked.has(u.id));
  const tags = userInterests.map((i) => i.tag);

  const byFollowers = (a: (typeof candidates)[number], b: (typeof candidates)[number]) =>
    b._count.followers - a._count.followers;

  // Interest-matched suggestions first, so discovery feels personal; backfill
  // with the most-followed of the rest so the rail is never empty.
  const tagSet = new Set(tags);
  const interestMatched = tags.length
    ? candidates.filter((u) => u.interests.some((i) => tagSet.has(i.tag))).sort(byFollowers).slice(0, 20)
    : [];
  const suggested = [...interestMatched];
  if (suggested.length < 12) {
    const already = new Set(suggested.map((u) => u.id));
    suggested.push(
      ...candidates
        .filter((u) => !already.has(u.id))
        .sort(byFollowers)
        .slice(0, 20 - suggested.length),
    );
  }

  return suggested;
}

// Not user-specific, and ordering the whole community table by member count is
// one of the heavier queries on /explore — a short shared cache keeps trending
// fresh enough while serving repeat views instantly.
export const getTrendingCommunities = unstable_cache(
  async () =>
    prisma.community.findMany({
      where: { isPublic: true },
      include: {
        _count: { select: { members: true, posts: true } },
      },
      orderBy: { members: { _count: "desc" } },
      take: 10,
    }),
  ["trending-communities"],
  { revalidate: 60 },
);

// ─── Admin Queries ───────────────────────────────────────────


// ─── Additional Queries ─────────────────────────────────────

/**
 * Preview EXACTLY what the world would see of YOU before opting in. Scoped to
 * the session user (no target id), so it can only ever reveal your own already
 * public content. `sharedBranches` is a selection filter only.
 */
export async function getGlobalMeshSelfPreview(sharedBranches?: string[]): Promise<GlobalMeshSelfPreview | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return getGlobalMeshSelfPreviewCore(user, sharedBranches);
}

export async function getUserCommunities(username: string) {
  const currentUser = await getCurrentUser();
  const user = await prisma.user.findUnique({
    where: { username },
    include: { meshPrivacy: true },
  });
  if (!user) return [];

  // Authorization is enforced here (not only in the page) so this "use server"
  // export cannot be invoked directly to enumerate an arbitrary user's
  // community memberships past their connections privacy control.
  const isSelf = !!currentUser && currentUser.id === user.id;
  if (!isSelf && !currentUser?.isAdmin) {
    const meshVisibility = normalizeMeshVisibility(
      user.meshPrivacy?.meshVisibility,
      user.isPublic ? "public" : "private",
    );
    const isFriend = currentUser ? await areMutualFollowers(currentUser.id, user.id) : false;
    if (!canViewProfile(currentUser, user, meshVisibility, isFriend)) return [];
    const fallback: BranchVisibility = meshVisibility === "partial"
      ? (user.isPublic ? "public" : "private")
      : (meshVisibility as BranchVisibility);
    const canSee = canSeeMeshBranch({
      viewer: currentUser,
      targetUserId: user.id,
      branchKey: "communities",
      branchOverrides: parseBranchOverrides(user.meshPrivacy?.branchOverrides),
      isFriend,
      showConnections: user.meshPrivacy?.showConnections,
      defaultVisibility: fallback,
    });
    if (!canSee) return [];
  }

  // A private (invite-only) community must not leak its existence, name, size,
  // or this user's membership to outsiders. The owner and admins see all of
  // their memberships; everyone else sees only public communities plus any
  // private community they themselves belong to (which they already know of).
  const isPrivileged = currentUser?.id === user.id || Boolean(currentUser?.isAdmin);
  const communityScope = isPrivileged
    ? {}
    : {
        community: {
          OR: [
            { isPublic: true },
            ...(currentUser ? [{ members: { some: { userId: currentUser.id } } }] : []),
          ],
        },
      };

  return prisma.communityMember.findMany({
    where: { userId: user.id, ...communityScope },
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
    // Exclude suspended authors' content — canUserInteractWithPost (used below)
    // has no suspension check, so the saved collection is otherwise the one
    // surface that still surfaces a moderated author's posts.
    where: { userId: user.id, post: { ...nsfwHiddenWhere(user), author: { isSuspended: false } } },
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

  // Defense in depth: a saved link that predates the audience gate (or was
  // forced) must never surface content the viewer is no longer allowed to see.
  const visible = await Promise.all(
    saved.map(async (s) =>
      (await canUserInteractWithPost(user.id, {
        authorId: s.post.authorId,
        visibility: s.post.visibility,
        communityId: s.post.communityId,
      }))
        ? s.post
        : null,
    ),
  );
  return visible.filter((p): p is NonNullable<typeof p> => p !== null);
}

export async function getSavedPostCount() {
  const user = await getCurrentUser();
  if (!user) return 0;
  // Same audience gate as getSavedPosts (canUserInteractWithPost), expressed
  // as a single COUNT so the collections badge matches the rendered list
  // without loading the whole collection.
  return prisma.savedPost.count({
    where: {
      userId: user.id,
      post: {
        AND: [
          nsfwHiddenWhere(user),
          { author: { isSuspended: false } },
          {
            OR: [
              { authorId: user.id },
              { visibility: "public" },
              { community: { members: { some: { userId: user.id } } } },
              {
                visibility: "friends",
                author: {
                  followers: { some: { followerId: user.id } },
                  following: { some: { followingId: user.id } },
                },
              },
            ],
          },
        ],
      },
    },
  });
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


// Global aggregation over every post tag — same story as trending communities:
// cache the shared answer briefly instead of re-grouping per request.
export const getTrendingTags = unstable_cache(
  async () => {
    const tags = await prisma.postTag.groupBy({
      by: ["tag"],
      where: { post: { isNsfw: false } },
      _count: { tag: true },
      orderBy: { _count: { tag: "desc" } },
      take: 20,
    });

    return tags.map((t) => ({ tag: t.tag, count: t._count.tag }));
  },
  ["trending-tags"],
  { revalidate: 60 },
);


export async function getUserSettings() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [userWithProfile, achievements] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        email: true,
        // bannerUrl is omitted from the session user (auth hot path); the
        // settings/profile view is the one place that needs it, so load it here.
        bannerUrl: true,
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
    bannerUrl: userWithProfile?.bannerUrl ?? null,
    accentColor: user.accentColor,
    isPublic: user.isPublic,
    showInDiscovery: user.showInDiscovery,
    hideActivityStatus: user.hideActivityStatus,
    readReceipts: user.readReceipts,
    ghostMode: user.ghostMode,
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
