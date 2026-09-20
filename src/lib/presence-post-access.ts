import { getFeedPostById, type FeedCurrentUser } from "@/lib/feed-data";

/** Presence uses the same audience, community, block and content gates as
 * the real post. A claimed or guessed ID is never proof of access. */
export async function canViewPresencePost(user: FeedCurrentUser, postId: string | null): Promise<boolean> {
  if (!postId || postId.length > 160) return false;
  try {
    return Boolean(await getFeedPostById(user, postId));
  } catch {
    return false;
  }
}
