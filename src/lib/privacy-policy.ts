import { prisma } from "./prisma";

type Viewer = {
  id: string;
  isAdmin?: boolean;
} | null;

type ProfileSubject = {
  id: string;
  isPublic?: boolean;
  isSuspended?: boolean;
};

export type MeshVisibility = "private" | "friends" | "public" | "partial";
export type BranchVisibility = "private" | "friends" | "public";

export type MeshPrivacyRecord = {
  meshVisibility: string;
  branchOverrides: string;
  showConnections: boolean;
  showStats: boolean;
} | null;

function isSelf(viewer: Viewer, subjectId: string): boolean {
  return !!viewer && viewer.id === subjectId;
}

export async function areMutualFollowers(viewerId: string, targetUserId: string): Promise<boolean> {
  if (viewerId === targetUserId) return true;

  const [viewerFollowsTarget, targetFollowsViewer] = await Promise.all([
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: targetUserId } },
      select: { id: true },
    }),
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: targetUserId, followingId: viewerId } },
      select: { id: true },
    }),
  ]);

  return !!viewerFollowsTarget && !!targetFollowsViewer;
}

// Every user id the viewer has blocked, unioned with everyone who has blocked
// the viewer. Presence, discovery, and social reads must never cross a block in
// either direction, so callers subtract this set (or add `id: { notIn }`) before
// surfacing other users.
export async function getBlockedUserIdSet(viewerId: string): Promise<Set<string>> {
  const rows = await prisma.block.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.blockerId !== viewerId) ids.add(row.blockerId);
    if (row.blockedId !== viewerId) ids.add(row.blockedId);
  }
  return ids;
}

/**
 * The same rule as `getBlockedUserIdSet`, expressed as a Prisma filter fragment
 * on User instead of a set to subtract — for reads that are already a single
 * query and should stay one.
 *
 * Two mechanisms, deliberately, because the surfaces genuinely differ: a list
 * read fetches the set once and reuses it across several queries, while a single
 * `findFirst` should not pay a second round trip to learn something the database
 * can answer inline. What is NOT deliberate is a third, fourth and fifth
 * hand-rolled spelling of "in either direction" — that is how the rule ends up
 * enforced in some places and not others, which is exactly what happened here:
 * searchAll subtracted blocks, /api/search/users did not, and Meshi's resolver
 * grew its own copy. Both mechanisms now live in this file, next to each other,
 * and scripts/second-writer-check.ts requires every people search to use one.
 *
 * Spread into a `where`. Composes with AND:/OR: like any fragment — but note it
 * contributes a top-level `NOT`, so spreading it beside another fragment that
 * also has one silently drops the first.
 */
export function blockedUserWhere(viewerId: string) {
  return {
    NOT: {
      OR: [
        // They blocked the viewer.
        { blocks: { some: { blockedId: viewerId } } },
        // The viewer blocked them.
        { blockedBy: { some: { blockerId: viewerId } } },
      ],
    },
  };
}

/**
 * Is there a block between these two users, in EITHER direction? Block stores
 * one directional row (blockerId = whoever pressed the button), but its effect
 * is symmetric, so every point check must match both orientations. Use this
 * whenever the surface is a single known pair; use getBlockedUserIdSet when the
 * surface is a list that needs an id filter.
 */
export async function isBlockedBetween(userId: string, otherUserId: string): Promise<boolean> {
  if (userId === otherUserId) return false;
  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: otherUserId },
        { blockerId: otherUserId, blockedId: userId },
      ],
    },
    select: { id: true },
  });
  return Boolean(blocked);
}

/**
 * Can this user see — and therefore interact with (react/comment) — the given
 * post? Mirrors the feed's read-side audience clause so a user who only knows
 * a post's id cannot react to or comment on a private/friends-only post they
 * were never allowed to see. Community posts require membership.
 */
export async function canUserInteractWithPost(
  userId: string,
  post: { authorId: string; visibility: string; communityId?: string | null },
): Promise<boolean> {
  if (post.authorId === userId) return true;

  // A block outranks every clause below, in either direction: the person you
  // blocked must not be able to react to, comment on, save, repost or share
  // your public posts, and you get the same protection from them. This is the
  // write-side twin of the feed's block filter — without it, knowing a post id
  // is enough to keep interacting straight through a block.
  if (await isBlockedBetween(userId, post.authorId)) return false;

  if (post.communityId) {
    const membership = await prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId: post.communityId } },
      select: { userId: true },
    });
    if (membership) return true;
    // Not a member: fall through to the post's own visibility (a public post
    // in a public community is still publicly readable).
  }

  if (post.visibility === "public") return true;
  if (post.visibility === "friends") return areMutualFollowers(userId, post.authorId);
  return false;
}

export function canViewProfile(
  viewer: Viewer,
  subject: ProfileSubject,
  visibility: MeshVisibility,
  isFriend: boolean,
): boolean {
  if (subject.isSuspended && !isSelf(viewer, subject.id) && !viewer?.isAdmin) return false;
  if (isSelf(viewer, subject.id) || viewer?.isAdmin) return true;
  if (subject.isPublic !== false || visibility === "public") return true;
  return visibility === "friends" && isFriend;
}

export function parseBranchOverrides(raw: string | null | undefined): Record<string, BranchVisibility> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const safe: Record<string, BranchVisibility> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value === "private" || value === "friends" || value === "public") {
        safe[key] = value;
      }
    }
    return safe;
  } catch {
    return {};
  }
}

export function normalizeMeshVisibility(
  value: string | null | undefined,
  fallback: MeshVisibility = "friends",
): MeshVisibility {
  if (value === "private" || value === "friends" || value === "public" || value === "partial") {
    return value;
  }
  return fallback;
}

export function canViewMesh(
  viewer: Viewer,
  targetUserId: string,
  visibility: MeshVisibility,
  isFriend: boolean,
): boolean {
  if (isSelf(viewer, targetUserId) || viewer?.isAdmin) return true;
  if (visibility === "private") return false;
  if (visibility === "friends") return isFriend;
  return true;
}

export function canSeeMeshBranch(options: {
  viewer: Viewer;
  targetUserId: string;
  branchKey: string;
  branchOverrides: Record<string, BranchVisibility>;
  isFriend: boolean;
  showConnections?: boolean;
  defaultVisibility?: BranchVisibility;
}): boolean {
  if (isSelf(options.viewer, options.targetUserId) || options.viewer?.isAdmin) return true;

  const connectionBranches = new Set(["people", "communities", "platforms"]);
  if (options.showConnections === false && connectionBranches.has(options.branchKey)) {
    return false;
  }

  const visibility = options.branchOverrides[options.branchKey] ?? options.defaultVisibility ?? "private";
  if (visibility === "private") return false;
  if (visibility === "friends") return options.isFriend;
  return true;
}

export function canSeeMeshStats(viewer: Viewer, targetUserId: string, privacy: MeshPrivacyRecord): boolean {
  if (isSelf(viewer, targetUserId) || viewer?.isAdmin) return true;
  return privacy?.showStats === true;
}
