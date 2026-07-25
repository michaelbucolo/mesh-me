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
import { nativePostDiscoveryConsentWhere, policyGrants, profileDiscoveryConsentWhere } from "./consent";
import { nsfwHiddenWhere } from "./content-safety";
import { ANONYMOUS_VIEWER, type FeedCurrentUser } from "./feed-data";
import type { MeshApiResponse } from "@/components/mesh/core/domain";

const MAX_MEMBERS = 120;
const MAX_POSTS_PER_MEMBER = 8;

// Branch-level opt-in choices a member can make. Global can only ever show
// LESS than all-public, so this list is the allowlist for reading a member's
// stored choices. (The join action that WRITES it lands in a follow-up PR.)
export const GLOBAL_MESH_BRANCHES = ["posts", "platforms", "people", "interests", "communities"] as const;
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
 * The MEMBER GATE: who is a visible Global member for this viewer. To honor the
 * zero-new-visibility invariant against a SIGNED-OUT guest, the gate matches the
 * strictest guest-reachable baseline — a member must be opted-in AND public AND
 * not suspended AND discoverable (showInDiscovery, which EVERY guest discovery
 * surface requires and which defaults false) AND have an explicitly public mesh
 * (meshVisibility === "public"; it defaults "private" and otherwise locks the
 * public-mesh view even for signed-in strangers). Plus block filtering in BOTH
 * directions — a guest's id matches no Block rows, so those clauses no-op.
 */
function memberWhere(viewer: Viewer) {
  return {
    isActive: true,
    user: {
      isPublic: true,
      isSuspended: false,
      showInDiscovery: true,
      ...profileDiscoveryConsentWhere(),
      meshPrivacy: { meshVisibility: "public" },
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
          // Counts are shown only when the member enabled showStats — the same
          // gate the profile view and public mesh enforce (it defaults false).
          meshPrivacy: { select: { showStats: true } },
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
            // The member gate above clears the PROFILE for discovery; native
            // posts carry their own category rule, so re-check it here.
            author: nativePostDiscoveryConsentWhere(),
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
    // Counts only when the member opted into showing stats (defaults off) —
    // never leak follower / public-post counts a stranger couldn't already see.
    followerCount: m.user.meshPrivacy?.showStats ? m.user._count.followers : 0,
    postCount: m.user.meshPrivacy?.showStats ? (publicPostCountByAuthor.get(m.user.id) ?? 0) : 0,
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

export type GlobalMeshSelfPreview = {
  /** Whether you'd actually appear in the Global Mesh right now. */
  qualifies: boolean;
  /** Plain-language reasons you would NOT appear (empty when qualifies). */
  reasons: string[];
  posts: { id: string; content: string; media: { url: string; type: string }[] }[];
  platforms: { id: string; platform: string; title: string; thumbnailUrl: string | null }[];
};

/**
 * The content-review step: shows a member EXACTLY what the world would see of
 * THEM before they opt in — their own already-public content, re-derived from
 * live rows with the identical supply predicates, using the strict stranger
 * NSFW baseline so it never over-promises. Scoped entirely to `viewer.id`, so
 * it can only ever reveal the caller's own public content (the dispatch wrapper
 * in queries.ts derives the viewer from getCurrentUser and takes no id).
 */
export async function getGlobalMeshSelfPreviewCore(
  viewer: Viewer,
  sharedBranches?: string[],
): Promise<GlobalMeshSelfPreview> {
  const selected = new Set(
    (Array.isArray(sharedBranches) ? sharedBranches : (GLOBAL_MESH_BRANCHES as readonly string[]))
      .map(String)
      .filter((b): b is GlobalMeshBranch => (GLOBAL_MESH_BRANCHES as readonly string[]).includes(b)),
  );

  // Eligibility from LIVE rows — the exact memberWhere user-gate.
  const me = await prisma.user.findUnique({
    where: { id: viewer.id },
    select: {
      isPublic: true,
      showInDiscovery: true,
      isSuspended: true,
      meshPrivacy: { select: { meshVisibility: true } },
      // The member gate now also honors the privacy centre's Profile rule, so
      // the preview has to name it — otherwise a user who switched it off is
      // told they qualify while the Global supply quietly drops them.
      dataVisibilityPolicies: {
        where: { entityType: "profile", entityId: null },
        select: { allowDiscovery: true },
        take: 1,
      },
    },
  });
  const reasons: string[] = [];
  if (!me?.isPublic) reasons.push("Your profile is private");
  if (!me?.showInDiscovery) reasons.push("You're hidden from discovery");
  if (!policyGrants(me?.dataVisibilityPolicies?.[0], "allowDiscovery")) {
    reasons.push("Your privacy rules turn off profile discovery");
  }
  if (me?.isSuspended) reasons.push("Your account is suspended");
  if (me?.meshPrivacy?.meshVisibility !== "public") reasons.push("Your mesh isn't set to public");
  const qualifies = reasons.length === 0;

  // "What the world sees" = the guest-reachable set: the exact public supply
  // predicates scoped to YOU, with the strict stranger NSFW baseline (a
  // signed-out guest with NSFW off) so the preview can never over-promise.
  const guestNsfw = nsfwHiddenWhere(ANONYMOUS_VIEWER);

  const [nativePosts, platformPosts] = await Promise.all([
    selected.has("posts")
      ? prisma.post.findMany({
          where: { ...guestNsfw, authorId: viewer.id, visibility: "public", OR: [{ communityId: null }, { community: { isPublic: true } }], author: nativePostDiscoveryConsentWhere() },
          select: { id: true, content: true, media: { select: { url: true, type: true } } },
          orderBy: { createdAt: "desc" },
          take: 12,
        })
      : Promise.resolve([]),
    selected.has("platforms")
      ? prisma.platformPost.findMany({
          where: { ...guestNsfw, visibility: "public", connectedAccount: { isActive: true, userId: viewer.id, user: { isSuspended: false, showInDiscovery: true } } },
          select: { id: true, title: true, thumbnailUrl: true, connectedAccount: { select: { platform: true } } },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          take: 12,
        })
      : Promise.resolve([]),
  ]);

  return {
    qualifies,
    reasons,
    posts: nativePosts.map((p) => ({
      id: p.id,
      content: (p.content || "").slice(0, 160),
      media: p.media.map((m) => ({ url: m.url, type: m.type })),
    })),
    platforms: platformPosts.map((pp) => ({
      id: `platform-${pp.id}`,
      platform: pp.connectedAccount.platform,
      title: (pp.title || `${pp.connectedAccount.platform} post`).slice(0, 120),
      thumbnailUrl: pp.thumbnailUrl,
    })),
  };
}
