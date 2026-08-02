// Muted mesh sources — the shared vocabulary for the viewer-side "mute
// source" preference (pluck ring → Mute, person/platform detail → Unmute).
//
// A "source" is where mesh content comes from: a mesh.me author
// ("author:{userId}") or a connected platform account
// ("account:{connectedAccountId}"). The keys live as a JSON array on the
// viewer's own FeedPreference row, so muting is PRIVATE by construction:
// it subtracts that source's content from the viewer's own mesh payload and
// Flow candidates, and never mutates anything another user can observe.
//
// Pure helpers only (no prisma / no DOM) so the mesh client, the server
// actions, and the API routes all speak the same key format.

const MAX_MUTED_SOURCES = 200;

const KEY_PATTERN = /^(author|account):[A-Za-z0-9_-]{1,64}$/;

export function isValidMutedSourceKey(key: unknown): key is string {
  return typeof key === "string" && KEY_PATTERN.test(key);
}

export function authorMuteKey(userId: string): string {
  return `author:${userId}`;
}

export function accountMuteKey(connectedAccountId: string): string {
  return `account:${connectedAccountId}`;
}

/** Parse the persisted JSON list defensively — bad rows read as "no mutes". */
export function parseMutedSources(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidMutedSourceKey).slice(0, MAX_MUTED_SOURCES);
  } catch {
    return [];
  }
}

/**
 * The mute key behind a scene-node id, or null when that node has no mutable
 * source (your own native posts, activities, the self node…).
 *
 * - `platform-post:{acctId}:{ppId}` / `platform:{acctId}` → the platform account
 * - `friend-post:{userId}:{postId}` / `person:{userId}` → the author
 */
export function meshNodeMuteKey(nodeId: string): string | null {
  if (nodeId.startsWith("platform-post:")) {
    const acctId = nodeId.slice("platform-post:".length).split(":")[0];
    return acctId ? accountMuteKey(acctId) : null;
  }
  if (nodeId.startsWith("platform:")) {
    const acctId = nodeId.slice("platform:".length);
    return acctId ? accountMuteKey(acctId) : null;
  }
  if (nodeId.startsWith("friend-post:")) {
    const userId = nodeId.slice("friend-post:".length).split(":")[0];
    return userId ? authorMuteKey(userId) : null;
  }
  if (nodeId.startsWith("person:")) {
    const userId = nodeId.slice("person:".length);
    return userId ? authorMuteKey(userId) : null;
  }
  return null;
}
