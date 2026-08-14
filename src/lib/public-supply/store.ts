import { classifyContentSafety, nsfwHiddenWhere, type AdultVerificationSnapshot } from "@/lib/content-safety";
import { prisma } from "@/lib/prisma";
import type { LaneRunResult, PublicItem, PublicSupplyLane } from "./types";

/**
 * WHERE PUBLIC SUPPLY IS KEPT, AND WHEN IT STOPS BEING KEPT.
 *
 * ── RETENTION IS THE POINT ──────────────────────────────────────────────────
 *
 * `expiresAt` is written on every row from the lane's declared
 * `retentionHours`, every read filters `expiresAt > now`, and `sweepExpired`
 * deletes what is past. That triple is deliberate: a filter alone would leave
 * expired rows sitting in the database forever, and a sweep alone would leave a
 * window where expired content is still served. Both, and the promise holds
 * even if the sweep is late.
 *
 * This exists because several platforms cap how long a third party may retain
 * API results. Encoding that per-lane means the answer to "how long do you keep
 * their data?" is a number in the registry, not a paragraph in a policy nobody
 * can verify.
 *
 * ── SAFETY IS FOLDED, NOT TRUSTED ───────────────────────────────────────────
 *
 * A source's own maturity flag is taken as a floor, never a ceiling: if the
 * platform says mature we believe it, and if it says clean we still run the
 * same classifier every other content path uses. A platform's definition of
 * safe is not automatically ours, and public supply is the one lane where
 * nobody on mesh.me chose to follow the author.
 */

/** Nothing may be retained longer than this regardless of what a lane asks. */
const MAX_RETENTION_HOURS = 24 * 30;

function resolveExpiry(lane: Pick<PublicSupplyLane, "retentionHours">, now = new Date()): Date {
  const hours = Math.min(Math.max(1, lane.retentionHours), MAX_RETENTION_HOURS);
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Write a lane's items. Upserts on (platform, platformPostId), so a refetch
 * refreshes counts and pushes `expiresAt` out rather than duplicating the Flow.
 */
export async function storeItems(lane: PublicSupplyLane, items: PublicItem[]): Promise<number> {
  if (items.length === 0) return 0;
  const expiresAt = resolveExpiry(lane);
  let stored = 0;

  for (const item of items) {
    // Skip anything that cannot be attributed or linked back. An item with no
    // URL cannot credit its author, and this layer is a reader, not a
    // re-publisher.
    if (!item.platformPostId || !item.url) continue;

    const classified = classifyContentSafety(item.title, item.content, item.authorName);
    const isNsfw = Boolean(item.sourceMarkedMature) || classified.isNsfw;

    const data = {
      platform: lane.platform,
      platformPostId: item.platformPostId,
      lane: lane.id,
      title: item.title ?? null,
      content: item.content ?? null,
      url: item.url,
      postType: item.postType,
      thumbnailUrl: item.thumbnailUrl ?? null,
      mediaUrl: item.mediaUrl ?? null,
      durationSeconds: item.durationSeconds ?? null,
      lang: item.lang ?? null,
      authorName: item.authorName ?? null,
      authorUsername: item.authorUsername ?? null,
      authorAvatarUrl: item.authorAvatarUrl ?? null,
      authorUrl: item.authorUrl ?? null,
      viewCount: item.viewCount ?? 0,
      likeCount: item.likeCount ?? 0,
      commentCount: item.commentCount ?? 0,
      isNsfw,
      contentRating: isNsfw ? "adult" : "general",
      publishedAt: item.publishedAt ?? null,
      fetchedAt: new Date(),
      expiresAt,
    };

    try {
      await prisma.publicPost.upsert({
        where: { platform_platformPostId: { platform: lane.platform, platformPostId: item.platformPostId } },
        create: data,
        update: data,
      });
      stored += 1;
    } catch {
      // One malformed item must not lose the batch. It simply does not appear.
    }
  }
  return stored;
}

/** Record what a run actually did, so an empty Flow can explain itself. */
export async function recordRun(result: LaneRunResult): Promise<void> {
  try {
    await prisma.publicSupplyRun.create({
      data: {
        platform: result.platform,
        lane: result.laneId,
        status: result.status,
        itemsFetched: result.itemsFetched,
        itemsStored: result.itemsStored,
        detail: result.detail ?? null,
        durationMs: result.durationMs,
      },
    });
  } catch {
    // Observability must never break the thing it observes.
  }
}

/**
 * Delete what the source's terms no longer let us keep. Safe to run often and
 * safe to miss — reads filter on `expiresAt` too, so a late sweep leaks
 * storage, never content.
 */
export async function sweepExpired(now = new Date()): Promise<number> {
  try {
    const { count } = await prisma.publicPost.deleteMany({ where: { expiresAt: { lte: now } } });
    return count;
  } catch {
    return 0;
  }
}

/** Run rows are operational history, not content; a short window is plenty. */
export async function sweepOldRuns(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  try {
    const { count } = await prisma.publicSupplyRun.deleteMany({ where: { startedAt: { lte: cutoff } } });
    return count;
  } catch {
    return 0;
  }
}

export type PublicSupplyRow = Awaited<ReturnType<typeof readPublicSupply>>[number];

/**
 * Unexpired public supply for a viewer.
 *
 * `nsfwHiddenWhere` is the same clause every other content read uses, so this
 * lane cannot become the one that forgets. Muting is applied downstream in
 * flow-ranking's dropMutedSources, which keys on author id and platform row id.
 */
export async function readPublicSupply(opts: {
  viewer: AdultVerificationSnapshot | null | undefined;
  limit: number;
  platforms?: string[];
  now?: Date;
}) {
  const now = opts.now ?? new Date();
  try {
    // The expiry filter is a COMPLIANCE clause, not a freshness preference:
    // retentionHours comes from each platform's terms (types.ts), so an
    // expired row may not be served even when the alternative is an empty
    // Flow. Emptiness is handled by refreshing (always allowed) — see
    // ensureSupplyFresh in runner.ts — never by stretching retention.
    return await prisma.publicPost.findMany({
      where: {
        ...nsfwHiddenWhere(opts.viewer),
        expiresAt: { gt: now },
        ...(opts.platforms?.length ? { platform: { in: opts.platforms } } : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
      take: Math.min(Math.max(1, opts.limit), 500),
    });
  } catch {
    // A missing table or a database hiccup degrades the supply to empty. The
    // Flow still renders everything else; it does not 500 because a public
    // video could not be read.
    return [];
  }
}

