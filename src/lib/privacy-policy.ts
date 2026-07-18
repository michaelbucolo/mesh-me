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
