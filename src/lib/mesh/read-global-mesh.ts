import { ANONYMOUS_VIEWER, type FeedCurrentUser } from "@/lib/feed-data";
import { getGlobalMeshSupply } from "@/lib/global-mesh";
import type { FieldItem } from "@/components/meshfield/model/rings";

/**
 * The Global mesh — everyone who has opted in — as field items.
 *
 * ── THE CONSENT RULE IS NOT COPIED ─────────────────────────────────────────
 *
 * Who may appear in Global is decided by `getGlobalMeshSupply`, which folds in
 * the opt-in membership, the discovery-consent predicates and the viewer's NSFW
 * policy. That rule is deliberately NOT re-derived here: this reads the supply
 * it returns and reshapes it. Re-querying members directly would have meant a
 * second copy of a consent rule, which is the one kind of duplication that
 * turns into a leak rather than a bug.
 *
 * The supply comes back shaped for the old canvas (a node graph), so all this
 * does is translate that into the flat item list the field takes.
 */

/** A post as the global supply hands it over. Structural rather than imported,
 * because `MeshApiResponse` types these as `any[]` at the boundary. */
type SuppliedPost = {
  id?: unknown;
  content?: unknown;
  createdAt?: unknown;
  media?: Array<{ url?: unknown }>;
  href?: unknown;
};

/** Guests see Global too — it is the guest-viewable world supply. */
export async function readGlobalMesh(
  viewer: FeedCurrentUser | null,
): Promise<{ items: FieldItem[]; nowMs: number }> {
  const nowMs = Date.now();
  const supply = await getGlobalMeshSupply(viewer ?? ANONYMOUS_VIEWER);

  const items: FieldItem[] = [];

  for (const member of supply.friendMeshes ?? []) {
    const posts = (member.posts ?? []) as SuppliedPost[];

    // Recency for the PERSON is their newest post. Someone who posted an hour
    // ago sits nearer than someone who joined and went quiet, which is what
    // makes Global feel inhabited rather than like a directory.
    let newestAt = 0;
    for (const p of posts) {
      const at = toMs(p.createdAt);
      if (at > newestAt) newestAt = at;
    }

    items.push({
      id: `person-${member.user.id}`,
      kind: "person",
      title: member.user.displayName || member.user.username,
      platform: "mesh",
      imageUrl: member.user.avatarUrl,
      atMs: newestAt || nowMs,
      href: `/profile/${member.user.username}`,
    });

    for (const p of posts) {
      const id = typeof p.id === "string" ? p.id : null;
      if (!id) continue;
      const text = typeof p.content === "string" ? p.content.trim() : "";
      items.push({
        id,
        kind: "post",
        title: text.split("\n")[0] || member.user.displayName || member.user.username,
        platform: "mesh",
        imageUrl: typeof p.media?.[0]?.url === "string" ? (p.media[0].url as string) : null,
        body: text,
        atMs: toMs(p.createdAt) || nowMs,
        // The supply already builds the permalink; use it rather than
        // reconstructing a second opinion about where a post lives.
        href: typeof p.href === "string" ? p.href : `/feed/${encodeURIComponent(id)}`,
      });
    }
  }

  return { items, nowMs };
}

/** Dates cross this boundary as Date or ISO string depending on the branch. */
function toMs(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? 0 : ms;
  }
  return 0;
}
