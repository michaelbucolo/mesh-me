/**
 * Instagram-style ranking for the Flow.
 *
 * Instead of a chronological dump, every candidate reel is scored against the
 * viewer's taste profile — who they interact with, what formats they watch,
 * which tags they touch — blended with how fast the post itself is earning
 * engagement and how fresh it is. Content the viewer has already seen is
 * pushed far down, and a diversity pass stops any one author or platform from
 * monopolizing consecutive slots.
 */

import { prisma } from "./prisma";
import { getCombinedFeedPosts, type FeedCardPost, type FeedCurrentUser } from "./feed-data";

export type TasteProfile = {
  // authorKey (user id or external author handle) -> interaction weight
  authorAffinity: Map<string, number>;
  // "video" | "image" | "text" -> share of the viewer's positive interactions
  formatPreference: Map<string, number>;
  // lowercased tag -> interaction weight
  tagAffinity: Map<string, number>;
  followingIds: Set<string>;
};

const HOUR_MS = 3_600_000;

/**
 * The For You candidate pool: everything in-network (follows, communities,
 * connected platforms) plus public out-of-network content — the exploration
 * supply Instagram blends in so new creators can reach you.
 */
export async function getFlowCandidates(user: FeedCurrentUser): Promise<FeedCardPost[]> {
  const [inNetwork, outOfNetwork] = await Promise.all([
    getCombinedFeedPosts({ user, source: "all", contentFilter: "all", limit: 120 }),
    getCombinedFeedPosts({ user, source: "discover", contentFilter: "all", limit: 60 }),
  ]);
  const byId = new Map<string, FeedCardPost>();
  for (const post of [...inNetwork, ...outOfNetwork]) byId.set(post.id, post);
  return [...byId.values()];
}

function dominantFormat(post: FeedCardPost): "video" | "image" | "text" {
  for (const item of post.media) {
    const type = item.type.toLowerCase();
    if (type === "video" || type === "reel" || type === "short") return "video";
  }
  for (const item of post.media) {
    const type = item.type.toLowerCase();
    if (type === "image" || type === "photo") return "image";
  }
  return "text";
}

function authorKey(post: FeedCardPost): string {
  if (post.externalAuthor) {
    return `ext:${(post.externalAuthor.username || post.externalAuthor.name).toLowerCase()}`;
  }
  return post.author.id;
}

/**
 * Build the viewer's taste profile from their actual behavior: recent likes
 * (weight 1), comments (weight 2 — commenting is a stronger signal), and
 * follows (weight 3). Mirrors how Instagram leans on interaction history.
 */
export async function getViewerTasteProfile(userId: string): Promise<TasteProfile> {
  const [reactions, comments, follows] = await Promise.all([
    prisma.reaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        post: {
          select: {
            authorId: true,
            media: { select: { type: true } },
            tags: { select: { tag: true } },
          },
        },
      },
    }),
    prisma.comment.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      take: 120,
      select: {
        post: {
          select: {
            authorId: true,
            media: { select: { type: true } },
            tags: { select: { tag: true } },
          },
        },
      },
    }),
    prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    }),
  ]);

  const authorAffinity = new Map<string, number>();
  const formatCounts = new Map<string, number>();
  const tagAffinity = new Map<string, number>();

  const ingest = (
    post: { authorId: string; media: { type: string }[]; tags: { tag: string }[] },
    weight: number,
  ) => {
    authorAffinity.set(post.authorId, (authorAffinity.get(post.authorId) ?? 0) + weight);

    let format = "text";
    for (const item of post.media) {
      const type = item.type.toLowerCase();
      if (type === "video" || type === "reel" || type === "short") { format = "video"; break; }
      if (type === "image" || type === "photo") format = "image";
    }
    formatCounts.set(format, (formatCounts.get(format) ?? 0) + weight);

    for (const { tag } of post.tags) {
      const key = tag.toLowerCase();
      tagAffinity.set(key, (tagAffinity.get(key) ?? 0) + weight);
    }
  };

  for (const { post } of reactions) ingest(post, 1);
  for (const { post } of comments) ingest(post, 2);

  const followingIds = new Set<string>();
  for (const { followingId } of follows) {
    followingIds.add(followingId);
    authorAffinity.set(followingId, (authorAffinity.get(followingId) ?? 0) + 3);
  }

  // Normalize format counts into shares so they read as a preference mix.
  const formatTotal = [...formatCounts.values()].reduce((sum, count) => sum + count, 0);
  const formatPreference = new Map<string, number>();
  if (formatTotal > 0) {
    for (const [format, count] of formatCounts) {
      formatPreference.set(format, count / formatTotal);
    }
  }

  return { authorAffinity, formatPreference, tagAffinity, followingIds };
}

/**
 * Algorithm Studio ranking modes — user-steerable presets over the same
 * signal set. Weights change; nothing here is ever pay-to-win.
 */
export type FlowRankMode = "following" | "balanced" | "discovery" | "chronological" | "calm";

export function normalizeFlowRankMode(value: string | null | undefined): FlowRankMode {
  return value === "following" || value === "discovery" || value === "chronological" || value === "calm"
    ? value
    : "balanced";
}

type RankWeights = {
  velocity: number;
  recency: number;
  affinity: number;
  formatMatch: number;
  tagMatch: number;
  // Every Nth slot reserved for a no-history creator (0 disables).
  explorationEvery: number;
  // Max consecutive posts from one author.
  maxRun: number;
};

const MODE_WEIGHTS: Record<Exclude<FlowRankMode, "chronological">, RankWeights> = {
  // Relationships, interests, discovery, and recency.
  balanced: { velocity: 1.2, recency: 1.0, affinity: 2.6, formatMatch: 1.2, tagMatch: 0.9, explorationEvery: 6, maxRun: 2 },
  // Primarily people the viewer explicitly follows (candidates pre-filtered).
  following: { velocity: 0.8, recency: 1.6, affinity: 3.2, formatMatch: 0.8, tagMatch: 0.6, explorationEvery: 0, maxRun: 3 },
  // Broader: new creators and topics get real room.
  discovery: { velocity: 1.6, recency: 1.2, affinity: 0.9, formatMatch: 1.0, tagMatch: 1.1, explorationEvery: 3, maxRun: 2 },
  // Lower novelty, gentler pace: viral spikes damped, variety enforced.
  calm: { velocity: 0.4, recency: 1.1, affinity: 2.2, formatMatch: 1.0, tagMatch: 1.0, explorationEvery: 8, maxRun: 1 },
};

function scoreFlowPost(
  post: FeedCardPost,
  profile: TasteProfile,
  opts: { now?: number; seen?: Set<string>; weights?: RankWeights } = {},
): number {
  const now = opts.now ?? Date.now();
  const ageHours = Math.max((now - new Date(post.createdAt).getTime()) / HOUR_MS, 0.5);

  // Engagement velocity: how fast the post earns interactions, log-dampened so
  // a viral outlier doesn't drown everything, decayed by age like IG's
  // freshness-weighted popularity signal.
  const rawEngagement =
    post._count.reactions + 2 * post._count.comments + 1.5 * post._count.reposts;
  const velocity = Math.log1p(rawEngagement) / Math.pow(ageHours + 2, 0.35);

  // Recency: half-life of ~36h keeps the feed current without making it
  // purely chronological.
  const recency = Math.exp(-ageHours / 52);

  // Author affinity: the strongest IG signal — content from people the viewer
  // actually interacts with.
  const affinityRaw = profile.authorAffinity.get(authorKey(post)) ?? 0;
  const affinity = Math.min(Math.log1p(affinityRaw) / Math.log(20), 1.5);

  // Format match: viewers who mostly watch video get more video, etc.
  const format = dominantFormat(post);
  const formatMatch = profile.formatPreference.get(format) ?? 0;

  // Tag interest overlap.
  let tagMatch = 0;
  for (const { tag } of post.tags) {
    tagMatch += profile.tagAffinity.get(tag.toLowerCase()) ?? 0;
  }
  tagMatch = Math.min(Math.log1p(tagMatch), 1);

  // Media-rich posts play better full-screen; give bare text a gentle nudge
  // down rather than filtering it out.
  const richness = post.media.length > 0 ? (format === "video" ? 0.5 : 0.25) : 0;

  const w = opts.weights ?? MODE_WEIGHTS.balanced;
  let score =
    velocity * w.velocity +
    recency * w.recency +
    affinity * w.affinity +
    formatMatch * w.formatMatch +
    tagMatch * w.tagMatch +
    richness;

  // Seen fatigue: already-watched reels sink hard but stay retrievable once
  // fresh material runs out.
  if (opts.seen?.has(post.id)) score *= 0.06;

  return score;
}

/**
 * Rank candidates and apply a diversity pass: never more than two consecutive
 * slots from the same author, and roughly every sixth slot is reserved for
 * "exploration" — the best-scoring post from an author the viewer has no
 * history with, which is how new accounts break into the feed.
 */
export function rankFlowPosts(
  posts: FeedCardPost[],
  profile: TasteProfile,
  opts: { seen?: Set<string>; limit?: number; mode?: FlowRankMode } = {},
): FeedCardPost[] {
  const mode = opts.mode ?? "balanced";
  const limit = opts.limit ?? posts.length;

  // Following mode narrows the candidate pool to people the viewer explicitly
  // follows (native posts and friends' platform content) before ranking.
  let candidates = posts;
  if (mode === "following") {
    candidates = posts.filter(
      (post) =>
        (!post.externalAuthor && profile.followingIds.has(post.author.id)) ||
        Boolean(post.meshFriend),
    );
  }

  // Chronological is exactly what it says: newest eligible items first, no
  // scoring, no exploration, no seen-fatigue reshuffling.
  if (mode === "chronological") {
    return [...candidates]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  const weights = MODE_WEIGHTS[mode];
  const now = Date.now();
  const scored = candidates
    .map((post) => ({ post, score: scoreFlowPost(post, profile, { now, seen: opts.seen, weights }) }))
    .sort((a, b) => b.score - a.score);

  const result: FeedCardPost[] = [];
  const pool = [...scored];

  while (result.length < limit && pool.length > 0) {
    const slot = result.length;
    const lastAuthor = result[slot - 1] ? authorKey(result[slot - 1]) : null;
    const runStart = Math.max(0, slot - weights.maxRun);
    const runAuthors = result.slice(runStart, slot).map((p) => authorKey(p));
    const runIsFull = (key: string) =>
      runAuthors.length >= weights.maxRun && runAuthors.every((a) => a === key);
    const explorationSlot =
      weights.explorationEvery > 0 && slot > 0 && slot % weights.explorationEvery === 0;

    let pickIndex = -1;

    if (explorationSlot) {
      pickIndex = pool.findIndex(
        ({ post }) =>
          !(profile.authorAffinity.get(authorKey(post)) ?? 0) &&
          authorKey(post) !== lastAuthor,
      );
    }
    if (pickIndex === -1) {
      pickIndex = pool.findIndex(({ post }) => !runIsFull(authorKey(post)));
    }
    if (pickIndex === -1) pickIndex = 0;

    result.push(pool.splice(pickIndex, 1)[0].post);
  }

  return result;
}

/**
 * Plain-language "Why this?" for a recommended item — the honest reason the
 * ranker surfaced it, never another user's private activity, never a paid
 * placement (those don't exist here).
 */
export function explainFlowPost(
  post: FeedCardPost,
  profile: TasteProfile,
  mode: FlowRankMode = "balanced",
): string {
  const handle = `@${post.author.username}`;
  if (mode === "chronological") return "Newest first — you're in Chronological mode";
  if (mode === "following") return `You follow ${handle} — Following mode shows only your people`;
  if (!post.externalAuthor && profile.followingIds.has(post.author.id)) {
    return `You follow ${handle}`;
  }
  if ((profile.authorAffinity.get(authorKey(post)) ?? 0) > 0) {
    return `You interact with ${handle}`;
  }
  for (const { tag } of post.tags) {
    if ((profile.tagAffinity.get(tag.toLowerCase()) ?? 0) > 0) {
      return `Matches your interest in #${tag}`;
    }
  }
  const ageHours = Math.max((Date.now() - new Date(post.createdAt).getTime()) / HOUR_MS, 0.5);
  const engagement = post._count.reactions + 2 * post._count.comments + 1.5 * post._count.reposts;
  if (engagement / ageHours > 1) return "Getting a lot of attention right now";
  const format = dominantFormat(post);
  if ((profile.formatPreference.get(format) ?? 0) > 0.5) {
    return format === "video" ? "You watch a lot of video" : "Matches what you usually enjoy";
  }
  if (mode === "discovery") return "Discovery mode — a new corner of mesh.me";
  if (ageHours < 24) return "Fresh from a creator you haven't met yet";
  return "Discovery — a new corner of mesh.me";
}

/**
 * Score candidates by similarity to an anchor post — the "swipe sideways for
 * more like this" lane. Same author dominates, then shared tags, same
 * platform, same format, with engagement as a tiebreaker.
 */
export function rankRelatedPosts(
  anchor: FeedCardPost,
  candidates: FeedCardPost[],
  opts: { exclude?: Set<string>; limit?: number } = {},
): FeedCardPost[] {
  const anchorAuthor = authorKey(anchor);
  const anchorPlatform = (anchor.platform || "meshme").toLowerCase();
  const anchorFormat = dominantFormat(anchor);
  const anchorTags = new Set(anchor.tags.map(({ tag }) => tag.toLowerCase()));

  return candidates
    .filter((post) => post.id !== anchor.id && !opts.exclude?.has(post.id))
    .map((post) => {
      let score = 0;
      if (authorKey(post) === anchorAuthor) score += 3;
      if ((post.platform || "meshme").toLowerCase() === anchorPlatform) score += 1.2;
      if (dominantFormat(post) === anchorFormat) score += 1.5;
      let sharedTags = 0;
      for (const { tag } of post.tags) {
        if (anchorTags.has(tag.toLowerCase())) sharedTags += 1;
      }
      score += Math.min(sharedTags * 0.8, 2.4);
      const engagement =
        post._count.reactions + 2 * post._count.comments + 1.5 * post._count.reposts;
      score += Math.min(Math.log1p(engagement) * 0.25, 1);
      return { post, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 8)
    .map(({ post }) => post);
}
