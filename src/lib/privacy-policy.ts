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

export function isSelf(viewer: Viewer, subjectId: string): boolean {
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

export async function canViewProfile(viewer: Viewer, subject: ProfileSubject): Promise<boolean> {
  if (subject.isSuspended && !isSelf(viewer, subject.id) && !viewer?.isAdmin) return false;
  if (isSelf(viewer, subject.id) || viewer?.isAdmin) return true;
  if (subject.isPublic !== false) return true;
  if (!viewer) return false;
  return areMutualFollowers(viewer.id, subject.id);
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

export function normalizeMeshVisibility(value: string | null | undefined): MeshVisibility {
  if (value === "private" || value === "friends" || value === "public" || value === "partial") {
    return value;
  }
  return "friends";
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
}): boolean {
  if (isSelf(options.viewer, options.targetUserId) || options.viewer?.isAdmin) return true;

  const connectionBranches = new Set(["people", "communities", "platforms"]);
  if (options.showConnections === false && connectionBranches.has(options.branchKey)) {
    return false;
  }

  const visibility = options.branchOverrides[options.branchKey] ?? "public";
  if (visibility === "private") return false;
  if (visibility === "friends") return options.isFriend;
  return true;
}

export function canSeeMeshStats(viewer: Viewer, targetUserId: string, privacy: MeshPrivacyRecord): boolean {
  if (isSelf(viewer, targetUserId) || viewer?.isAdmin) return true;
  return privacy?.showStats === true;
}
