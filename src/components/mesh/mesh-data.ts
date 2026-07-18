// Builds MeshNode[] and MeshEdge[] from the /api/mesh response.
// Deterministic layout: positions based on type rings + index angle, no Math.random().

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MeshApiResponse {
  // Set when the viewer isn't allowed into this mesh: only `user` identity
  // fields are present and the client renders a locked state.
  privateMesh?: boolean;
  user: { id: string; username: string; displayName: string | null; avatarUrl: string | null; bio: string | null; isVerified: boolean; isMeshPro?: boolean };
  following: any[];
  followers: any[];
  communities: any[];
  interests: string[];
  posts: any[];
  connectedAccounts: any[];
  activities?: Array<{
    id: string;
    type: string;
    label: string;
    summary?: string | null;
    href?: string;
    sourcePostId?: string | null;
    connectedAccountId?: string | null;
    createdAt?: string | Date | null;
    isUnread?: boolean;
    actor?: {
      id: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
    } | null;
  }>;
  friendMeshes?: Array<{
    user: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
    posts: any[];
    connectedAccounts: any[];
  }>;
  alterEgos: any[];
  meshiPreference: {
    colorTheme: string;
    hatStyle: string;
    faceStyle: string;
    hairStyle: string;
    accessoryStyle: string;
    eyeStyle: string;
    badgeStyle: string;
    outfitStyle: string;
  };
  meshCosmetics?: Array<{ type: string; value: string; isActive?: boolean }>;
  stats: {
    followingCount: number;
    followerCount: number;
    mutualCount: number;
    communityCount: number;
    postCount: number;
    interestCount: number;
    connectedPlatformCount: number;
    alterEgoCount: number;
    activityCount?: number;
  };
}

/**
 * Lay out items in a ring around (cx, cy) at the given radius.
 * Returns deterministic angles based on index.
 */

/** Compute an engagement score from node metrics */







// Caps used by the Simplified view to keep the Mesh digestible.

/**
 * Simplified view: keep the user at center, their identities, connected
 * platforms, the most relevant people, and their most important posts.
 * Low-signal clutter (loose activity items and interest tags) is set aside
 * for the Advanced view. Returns the subset of nodes to show; edges are
 * filtered downstream by node visibility.
 */


/**
 * Build mesh data for viewing another user's mesh (from /api/users/[username]/mesh).
 */

/**
 * Preload avatar images for nodes.
 * Populates the cache map with HTMLImageElements keyed by node ID.
 */
