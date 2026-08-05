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
    // No `outfitStyle`: outfits were retired from Meshi customization, so no
    // /api/mesh, /api/mesh?user= or /api/mesh/global response carries the field
    // any more. It stayed declared (and REQUIRED) here after the removal, which
    // is why every server-built payload had to be forced through a cast to
    // satisfy this type — the column survives in the database purely so old
    // rows stay valid, and the boundary should not claim otherwise.
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

/** A mesh payload failed boundary validation; `path` names the bad field. */
export class MeshPayloadError extends Error {
  readonly path: string;
  constructor(path: string, expected: string) {
    super(`Invalid mesh payload at "${path}": expected ${expected}`);
    this.name = "MeshPayloadError";
    this.path = path;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string") throw new MeshPayloadError(path, "a string");
  return value;
}

// Identity strings may legitimately be null (e.g. a member with no display
// name); anything else non-string is a malformed payload, not a default.
function nullableString(value: unknown, path: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new MeshPayloadError(path, "a string or null");
  return value;
}

// Arrays default to [] when absent — every branch of the payload can be
// withheld by privacy enforcement, and "hidden" must read as "empty", never
// as a crash. A present-but-non-array value is still a hard error.
function arrayOrEmpty(value: unknown, path: string): any[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new MeshPayloadError(path, "an array");
  return value;
}

/**
 * Validate + normalize a raw /api/mesh(-shaped) response at the boundary.
 *
 * Guarantees on the returned object:
 * - `user` carries a real string id/username (the scene keys the self node,
 *   presence room, and own-mesh detection on it);
 * - every branch collection is an array (missing → empty, wrong type → throw);
 * - a `privateMesh` payload passes with identity fields alone, exactly as the
 *   locked-state UI consumes it.
 */
export function parseMeshApiResponse(input: unknown): MeshApiResponse {
  if (!isRecord(input)) throw new MeshPayloadError("$", "an object");
  const user = input.user;
  if (!isRecord(user)) throw new MeshPayloadError("user", "an object");
  requireString(user.id, "user.id");
  requireString(user.username, "user.username");
  nullableString(user.displayName, "user.displayName");
  nullableString(user.avatarUrl, "user.avatarUrl");

  // Locked mesh: identity only — nothing else may be required of it.
  const privateMesh = Boolean(input.privateMesh);

  const out = {
    ...input,
    privateMesh: privateMesh || undefined,
    following: arrayOrEmpty(input.following, "following"),
    followers: arrayOrEmpty(input.followers, "followers"),
    communities: arrayOrEmpty(input.communities, "communities"),
    interests: arrayOrEmpty(input.interests, "interests"),
    posts: arrayOrEmpty(input.posts, "posts"),
    connectedAccounts: arrayOrEmpty(input.connectedAccounts, "connectedAccounts"),
    alterEgos: arrayOrEmpty(input.alterEgos, "alterEgos"),
  } as MeshApiResponse;
  if (input.activities != null) {
    out.activities = arrayOrEmpty(input.activities, "activities");
  }
  if (input.friendMeshes != null) {
    const friendMeshes = arrayOrEmpty(input.friendMeshes, "friendMeshes");
    friendMeshes.forEach((fm, i) => {
      if (!isRecord(fm) || !isRecord(fm.user)) throw new MeshPayloadError(`friendMeshes[${i}].user`, "an object");
      requireString(fm.user.id, `friendMeshes[${i}].user.id`);
      fm.posts = arrayOrEmpty(fm.posts, `friendMeshes[${i}].posts`);
      fm.connectedAccounts = arrayOrEmpty(fm.connectedAccounts, `friendMeshes[${i}].connectedAccounts`);
    });
    out.friendMeshes = friendMeshes;
  }
  if (input.meshCosmetics != null) {
    out.meshCosmetics = arrayOrEmpty(input.meshCosmetics, "meshCosmetics");
  }
  if (input.viewerMutedSources != null) {
    out.viewerMutedSources = arrayOrEmpty(input.viewerMutedSources, "viewerMutedSources").filter(
      (key): key is string => typeof key === "string",
    );
  }
  return out;
}
