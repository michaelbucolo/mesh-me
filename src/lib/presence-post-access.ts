import { getFeedPostById, type FeedCurrentUser } from "@/lib/feed-data";
import { getPostPresenceKey } from "@/lib/presence-keys";
import { prisma } from "@/lib/prisma";

async function canViewPlatformPresencePost(user: FeedCurrentUser, sourceId: string, expectedSource?: "post" | "feeditem"): Promise<boolean> {
  if (!sourceId || sourceId.includes(":")) return false;
  // Both imported posts and personalized feed items use platform:<sourceId>.
  // Resolve the actual row kind first; never reinterpret a denied post as
  // a different source with a coincidentally identical identifier.
  const post = await prisma.platformPost.findUnique({ where: { id: sourceId }, select: { id: true, connectedAccount: { select: { userId: true } } } });
  if (post) {
    if (expectedSource === "feeditem") return false;
    const ownerId = post.connectedAccount.userId;
    const blocked = await prisma.block.findFirst({ where: { OR: [
      { blockerId: user.id, blockedId: ownerId }, { blockerId: ownerId, blockedId: user.id },
    ] }, select: { id: true } });
    if (blocked) return false;
    const visible = await getFeedPostById(user, `platform-${sourceId}`)
      ?? await getFeedPostById(user, `friend-platform-${sourceId}`);
    return Boolean(visible && getPostPresenceKey(visible) === `platform:${sourceId}`);
  }
  if (expectedSource === "post") return false;
  const visible = await getFeedPostById(user, `feeditem-${sourceId}`);
  return Boolean(visible && getPostPresenceKey(visible) === `platform:${sourceId}`);
}

/** Presence keys are shared identities, not feed permalink IDs. Keep them
 * canonical on the wire, translating only for the real post's access check. */
export async function canViewPresencePost(user: FeedCurrentUser, postId: string | null): Promise<boolean> {
  if (!postId || postId.length > 160) return false;
  try {
    if (postId.startsWith("platform:")) {
      return await canViewPlatformPresencePost(user, postId.slice("platform:".length));
    }
    if (postId.startsWith("mesh:")) {
      const feedId = postId.slice("mesh:".length);
      if (!feedId || feedId.includes(":")) return false;
      // Public-supply cards have no sourceId, so the existing producer emits
      // mesh:public-<id>; the feed resolver applies their expiry/safety gates.
      const visible = await getFeedPostById(user, feedId);
      return Boolean(visible && getPostPresenceKey(visible) === postId);
    }
    // Legacy aliases must pass the same block fence and retain source kind.
    for (const prefix of ["friend-platform-", "platform-", "feeditem-"]) {
      if (postId.startsWith(prefix)) {
        return await canViewPlatformPresencePost(user, postId.slice(prefix.length), prefix === "feeditem-" ? "feeditem" : "post");
      }
    }
    // Retain legacy raw native/public IDs, rejecting unknown namespaces/URLs.
    if (postId.includes(":")) return false;
    return Boolean(await getFeedPostById(user, postId));
  } catch {
    return false;
  }
}
