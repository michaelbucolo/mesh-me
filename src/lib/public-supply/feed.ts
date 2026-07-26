import type { FeedCardPost } from "@/lib/feed-data";
import { toFeedCardPosts } from "./normalize";
import { readPublicSupply } from "./store";

/**
 * THE PUBLIC SUPPLY, AS FEED CARDS.
 *
 * The one entry point feed-data uses. Kept separate from store.ts so the
 * storage layer never has to know what a FeedCardPost is, and separate from
 * normalize.ts so the read policy (who may see what) lives with the read.
 *
 * ── WHY THIS IS ALWAYS LAST IN THE MERGE ────────────────────────────────────
 *
 * getCombinedFeedPosts dedups by canonical identity, first-wins. The same
 * YouTube video can arrive three ways: a friend shared it, someone's connected
 * account synced it, or this lane fetched it anonymously. The first two carry
 * attribution a person cares about — "Maya posted this" — and the third is
 * just the video. So public supply goes last and loses those ties on purpose.
 * It is the floor under the feed, not the front of it.
 *
 * ── WHAT IT DOES NOT DO ─────────────────────────────────────────────────────
 *
 * It does not fetch. Reading is a database query against rows a scheduled run
 * already stored, so opening /flow never waits on YouTube. If the supply is
 * stale or empty, the page still renders — with less in it, and the status
 * surface can say why.
 */

export async function getPublicSupplyFeedPosts(
  viewer: Parameters<typeof readPublicSupply>[0]["viewer"],
  limit: number,
): Promise<FeedCardPost[]> {
  const rows = await readPublicSupply({ viewer, limit });
  return toFeedCardPosts(rows);
}
