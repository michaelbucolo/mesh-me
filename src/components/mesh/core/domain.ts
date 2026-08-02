// The typed boundary for the mesh payload — the ONE place the /api/mesh,
// /api/mesh?user= and /api/mesh/global responses are given a shape the rest
// of the client can trust. Replaces the old `mesh-data.ts` husk.
//
// Hand-rolled validators (this repo deliberately carries no schema library):
// `parseMeshApiResponse` checks the structural invariants the scene builder
// relies on and throws a `MeshPayloadError` naming the offending path, so a
// malformed payload fails loudly at the boundary instead of as NaN positions
// three modules deep. Item-level fields stay permissive on purpose — the
// server owns their exact shape and the model builder reads them defensively.

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
  /** Own-mesh payload only: the VIEWER's private muted-source keys
   * ("author:{userId}" / "account:{connectedAccountId}") so the client can
   * mark muted hubs and offer Unmute. Never present on visited/Global. */
  viewerMutedSources?: string[];
  meshiPreference: {
    colorTheme: string;
    hatStyle: string;
    faceStyle: string;
    hairStyle: string;
    accessoryStyle: string;
    eyeStyle: string;
    badgeStyle: string;
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
