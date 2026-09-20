import "server-only";

import { prisma } from "./prisma";
import { hasMeshiConsent, meshiConsentWhere } from "./consent";
import { nsfwHiddenWhere, type AdultVerificationSnapshot } from "./content-safety";
import { blockedUserWhere, canSeeMeshStats, canViewProfile, normalizeMeshVisibility } from "./privacy-policy";

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

type MeshContextViewer = AdultVerificationSnapshot & { id: string };

export interface MeshiMeshContext {
  access: "allowed" | "disabled" | "signed-out";
  entities: MeshGraphEntity[];
  stats: { followers: number; following: number; posts: number; communities: number; platforms: number };
}

/** Called only with the authenticated viewer resolved by the server action. */
export async function readMeshiMeshContext(user: MeshContextViewer | null): Promise<MeshiMeshContext> {
  const empty = {
    entities: [],
    stats: { followers: 0, following: 0, posts: 0, communities: 0, platforms: 0 },
  };
  if (!user) return { ...empty, access: "signed-out" };
  // Review and optional chat share the same rule. A denied read must stop
  // before loading relationships, posts, memberships, or connected accounts.
  if (!(await hasMeshiConsent(user.id))) return { ...empty, access: "disabled" };

  const [following, followers, followingCount, communities, interests, connectedAccounts, postCount] = await Promise.all([
    prisma.follow.findMany({
      where: {
        followerId: user.id,
        following: { isSuspended: false, ...meshiConsentWhere(), ...blockedUserWhere(user.id) },
      },
      select: {
        following: {
          select: {
            id: true, username: true, displayName: true, isPublic: true,
            meshPrivacy: true,
            _count: { select: { followers: true } },
          },
        },
      },
      orderBy: { followingId: "asc" },
    }),
    prisma.follow.findMany({ where: { followingId: user.id }, select: { followerId: true } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.communityMember.findMany({
      where: { userId: user.id },
      select: { community: { select: { id: true, name: true, slug: true, _count: { select: { members: true } } } } },
      orderBy: { communityId: "asc" },
    }),
    prisma.userInterest.findMany({ where: { userId: user.id }, select: { tag: true }, orderBy: { tag: "asc" } }),
    prisma.connectedAccount.findMany({
      where: { userId: user.id, isActive: true },
      // Tokens and other connection internals never belong in Meshi context.
      select: { id: true, platform: true, platformUsername: true },
      orderBy: { id: "asc" },
    }),
    prisma.post.count({ where: { ...nsfwHiddenWhere(user), authorId: user.id } }),
  ]);

  const followerIds = new Set(followers.map((follow) => follow.followerId));
  const entities: MeshGraphEntity[] = [];
  // Meshi receives ordinary member visibility, never an admin's moderation
  // override: a privileged account is not permission to send private profiles
  // to an optional assistant.
  const viewer = { id: user.id };
  for (const { following: person } of following) {
    const isMutual = followerIds.has(person.id);
    if (!canViewProfile(viewer, person, normalizeMeshVisibility(person.meshPrivacy?.meshVisibility), isMutual)) continue;
    entities.push({
      id: person.id, type: "user", label: person.displayName, sublabel: `@${person.username}`, isMutual,
      ...(canSeeMeshStats(viewer, person.id, person.meshPrivacy) ? { followerCount: person._count.followers } : {}),
    });
  }
  for (const { community } of communities) {
    entities.push({ id: community.id, type: "community", label: community.name, sublabel: community.slug, memberCount: community._count.members });
  }
  for (const interest of interests) {
    entities.push({ id: `interest-${interest.tag}`, type: "tag", label: interest.tag });
  }
  for (const account of connectedAccounts) {
    entities.push({ id: account.id, type: "platform", label: account.platform, sublabel: account.platformUsername || undefined });
  }
  return {
    access: "allowed",
    entities,
    // These are the caller's own aggregate counts, not counts of the filtered
    // sample of people available to the assistant.
    stats: { followers: followers.length, following: followingCount, posts: postCount, communities: communities.length, platforms: connectedAccounts.length },
  };
}
