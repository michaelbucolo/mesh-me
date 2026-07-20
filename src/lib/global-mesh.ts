/**
 * The Global Mesh supply.
 *
 * THE SAFETY INVARIANT: being an active Global member grants ZERO new
 * visibility. Everything the Global view renders is content a signed-out
 * stranger can ALREADY reach today — public native posts (the exact predicate
 * the public-mesh stranger branch uses in src/app/api/mesh/route.ts) and public
 * platform posts synced by members who opted into discovery (the exact predicate
 * getDiscoverPlatformPosts uses in src/lib/feed-data.ts). The supply RE-DERIVES
 * publicness from the live rows and never trusts a member's stored claims, so a
 * bug in the join flow can at worst add or drop a member row — it can never
 * expose anything private. `sharedBranches` can only SUBTRACT (share less than
 * all-public), never add.
 */

import { prisma } from "./prisma";
import { nsfwHiddenWhere } from "./content-safety";
import type { FeedCurrentUser } from "./feed-data";
import type { MeshApiResponse } from "@/components/mesh/mesh-data";

const MAX_MEMBERS = 120;
const MAX_POSTS_PER_MEMBER = 8;

// Branch-level opt-in choices a member can make. Global can only ever show
// LESS than all-public, so this list is the allowlist for reading a member's
// stored choices. (The join action that WRITES it lands in a follow-up PR.)
const GLOBAL_MESH_BRANCHES = ["posts", "platforms", "people", "interests", "communities"] as const;
type GlobalMeshBranch = (typeof GLOBAL_MESH_BRANCHES)[number];

// Read a member's stored `sharedBranches` JSON into a validated Set.
function parseSharedBranches(raw: string | null | undefined): Set<GlobalMeshBranch> {
  try {
    const arr = JSON.parse(raw || "[]");
    if (!Array.isArray(arr)) return new Set();
    return new Set(
      arr.map(String).filter((v): v is GlobalMeshBranch => (GLOBAL_MESH_BRANCHES as readonly string[]).includes(v)),
    );
  } catch {
    return new Set();
  }
}

type Viewer = FeedCurrentUser;

/**
 * The MEMBER GATE: who is a visible Global member for this viewer. Triple-AND
 * (opted-in AND public AND not suspended) plus block filtering in BOTH
 * directions. A guest's id matches no Block rows, so the block clauses are
 * no-ops for signed-out viewers.
 */
function memberWhere(viewer: Viewer) {
  return {
    isActive: true,
    user: {
      isPublic: true,
      isSuspended: false,
      blockedBy: { none: { blockerId: viewer.id } }, // the viewer blocked them
      blocks: { none: { blockedId: viewer.id } }, // they blocked the viewer
    },
  };
}

type MeshPost = {
  id: string;
  content: string;
  createdAt: Date;
  media: { url: string; thumbnailUrl?: string | null; type: string }[];
  likeCount: number;
  commentCount: number;
  href?: string;
};

/**
 * Build the Global Mesh as a MeshApiResponse-shaped payload so the existing
 * mesh client parser + scene builder consume it unchanged: a synthetic world
 * hub at the center, opted-in members as the people around it, and each
 * member's public content hanging off them via friendMeshes.
 */
export async function getGlobalMeshSupply(viewer: Viewer): Promise<MeshApiResponse> {
  const members = await prisma.globalMeshMember.findMany({
    where: memberWhere(viewer),
    select: {
      sharedBranches: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          isVerified: true,
          isMeshPro: true,
          // followers is public; a PUBLIC-only post count is computed separately
          // below so the node never leaks how many PRIVATE posts a member has.
          _count: { select: { followers: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: MAX_MEMBERS,
  });

  const sharesById = new Map(members.map((m) => [m.user.id, parseSharedBranches(m.sharedBranches)]));
  const postAuthorIds = members.filter((m) => sharesById.get(m.user.id)?.has("posts")).map((m) => m.user.id);
  const platformOwnerIds = members.filter((m) => sharesById.get(m.user.id)?.has("platforms")).map((m) => m.user.id);

  // Public-only post count per member (matches the public-mesh stranger view —
  // never the total, which would leak the count of private posts).
  const memberIds = members.map((m) => m.user.id);
  const publicPostCounts = memberIds.length
    ? await prisma.post.groupBy({
        by: ["authorId"],
        where: {
          ...nsfwHiddenWhere(viewer),
          authorId: { in: memberIds },
          visibility: "public",
          OR: [{ communityId: null }, { community: { isPublic: true } }],
        },
        _count: { _all: true },
      })
    : [];
  const publicPostCountByAuthor = new Map(publicPostCounts.map((row) => [row.authorId, row._count._all]));

  // Two batched supply queries (not one-per-member). Both reuse the same public
  // predicates the public mesh / discover feed already ship, scoped to the
  // member set and the viewer's NSFW gate.
  const [nativePosts, platformPosts] = await Promise.all([
    postAuthorIds.length
      ? prisma.post.findMany({
          where: {
            ...nsfwHiddenWhere(viewer),
            authorId: { in: postAuthorIds },
            visibility: "public",
            OR: [{ communityId: null }, { community: { isPublic: true } }],
          },
          select: {
            id: true,
            content: true,
            createdAt: true,
            authorId: true,
            media: { select: { url: true, type: true } },
            _count: { select: { comments: true, reactions: true } },
          },
          orderBy: { createdAt: "desc" },
          take: MAX_MEMBERS * MAX_POSTS_PER_MEMBER,
        })
      : Promise.resolve([] as never[]),
    platformOwnerIds.length
      ? prisma.platformPost.findMany({
          where: {
            ...nsfwHiddenWhere(viewer),
            visibility: "public",
            connectedAccount: {
              isActive: true,
              userId: { in: platformOwnerIds },
              user: { isSuspended: false, showInDiscovery: true },
            },
          },
          select: {
            id: true,
            title: true,
            content: true,
            publishedAt: true,
            createdAt: true,
            thumbnailUrl: true,
            connectedAccount: { select: { userId: true, platform: true } },
            media: { select: { url: true, thumbnailUrl: true, mediaType: true } },
          },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          take: MAX_MEMBERS * MAX_POSTS_PER_MEMBER,
        })
      : Promise.resolve([] as never[]),
  ]);

  const postsByOwner = new Map<string, MeshPost[]>();
  const push = (ownerId: string, post: MeshPost) => {
    const list = postsByOwner.get(ownerId) ?? [];
    if (list.length < MAX_POSTS_PER_MEMBER) {
      list.push(post);
      postsByOwner.set(ownerId, list);
    }
  };
  for (const p of nativePosts) {
    push(p.authorId, {
      id: p.id,
      content: (p.content || "").slice(0, 200),
      createdAt: p.createdAt,
      media: p.media.map((m) => ({ url: m.url, type: m.type })),
      likeCount: p._count.reactions,
      commentCount: p._count.comments,
      href: `/feed/${p.id}`,
    });
  }
  for (const pp of platformPosts) {
    const first = pp.media[0];
    push(pp.connectedAccount.userId, {
      id: `platform-${pp.id}`,
      content: [pp.title, pp.content].filter(Boolean).join(" ").slice(0, 200) || `${pp.connectedAccount.platform} post`,
      createdAt: pp.publishedAt ?? pp.createdAt,
      media: [{ url: first?.url ?? pp.thumbnailUrl ?? "", thumbnailUrl: first?.thumbnailUrl ?? pp.thumbnailUrl, type: first?.mediaType ?? "image" }],
      likeCount: 0,
      commentCount: 0,
    });
  }

  const following = members.map((m) => ({
    id: m.user.id,
    username: m.user.username,
    displayName: m.user.displayName,
    avatarUrl: m.user.avatarUrl,
    isVerified: m.user.isVerified,
    joinedAt: m.joinedAt,
    followerCount: m.user._count.followers,
    postCount: publicPostCountByAuthor.get(m.user.id) ?? 0,
    status: "offline" as const,
  }));

  const friendMeshes = members.map((m) => ({
    user: {
      id: m.user.id,
      username: m.user.username,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
    },
    posts: postsByOwner.get(m.user.id) ?? [],
    connectedAccounts: [] as never[],
  }));

  return {
    user: {
      id: "global",
      username: "global",
      displayName: "Global Mesh",
      avatarUrl: null,
      bio: "Everyone who's opted in, woven into one world.",
      isVerified: false,
      isMeshPro: false,
    },
    following,
    followers: [],
    communities: [],
    interests: [],
    posts: [],
    connectedAccounts: [],
    friendMeshes,
    alterEgos: [],
    meshiPreference: {
      colorTheme: "blue",
      hatStyle: "none",
      faceStyle: "happy",
      hairStyle: "none",
      accessoryStyle: "none",
      eyeStyle: "regular",
      badgeStyle: "none",
      outfitStyle: "none",
    },
    stats: {
      followingCount: following.length,
      followerCount: 0,
      mutualCount: 0,
      communityCount: 0,
      postCount: nativePosts.length + platformPosts.length,
      interestCount: 0,
      connectedPlatformCount: 0,
      alterEgoCount: 0,
      activityCount: 0,
    },
  } as MeshApiResponse;
}
