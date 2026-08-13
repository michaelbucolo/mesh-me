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
import { ANONYMOUS_VIEWER, canonicalFeedKey, getCombinedFeedPosts, type FeedCardPost, type FeedCurrentUser } from "./feed-data";
import { guessLanguage } from "./language";
import { parseMutedSources } from "./muted-sources";
import { hasMeshPro } from "@/lib/mesh-pro";

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
 * Per-post implicit watch behavior — the signal Instagram weighs above all
 * else for Reels. Read only from the VIEWER's own impressions.
 */
export type WatchStats = { watchMs: number; completion: number; liked: boolean };

// Watch-time value model thresholds: a near-complete watch (or long dwell) is
// a quiet "more like this"; flicking past in under two seconds is the
// clearest "less". An explicit like always overrides the skip read.
const WATCH_FULL_MS = 24_000;
const WATCH_PARTIAL_MS = 10_000;
const FAST_SKIP_MS = 2_000;

function isFastSkip(ws: WatchStats): boolean {
  return !ws.liked && ws.watchMs > 0 && ws.watchMs < FAST_SKIP_MS && ws.completion < 0.2;
}

/**
 * Fold the viewer's implicit watch behavior into their taste profile.
 * Completing a video (or dwelling a long while) accrues author affinity at
 * roughly half a like; a fast skip subtracts — so authors the viewer keeps
 * flicking past sink across the whole feed, not just the one seen post.
 * Mutates the profile in place; only ever shapes the viewer's own feed.
 */
export function applyWatchSignal(
  profile: TasteProfile,
  posts: FeedCardPost[],
  watch: Map<string, WatchStats>,
): void {
  if (watch.size === 0) return;
  const byId = new Map(posts.map((post) => [post.id, post]));
  for (const [postId, ws] of watch) {
    const post = byId.get(postId);
    if (!post) continue;
    let delta = 0;
    if (ws.completion >= 0.85 || ws.watchMs >= WATCH_FULL_MS) delta = 0.5;
    else if (ws.completion >= 0.5 || ws.watchMs >= WATCH_PARTIAL_MS) delta = 0.25;
    else if (isFastSkip(ws)) delta = -0.35;
    if (delta === 0) continue;
    const key = authorKey(post);
    profile.authorAffinity.set(key, (profile.authorAffinity.get(key) ?? 0) + delta);
  }
}

// How hard to nudge same-language content up. Strong enough to cater the Flow
// to the viewer's language, but below author affinity (2.6) so people you
// actually engage with are never buried by language alone.
const LANGUAGE_BOOST = 1.6;

// The Flow is a quick, vertical, swipe-through surface — it should showcase
// short-form (Shorts, Reels, TikToks, clips) over full-length video. Short-form
// gets a real lift; long-form is nudged DOWN (never filtered, so a strong-match
// long video still surfaces). Anything we can't classify is neutral.

// URL shapes that are unambiguously short-form containers…
const SHORT_FORM_URL =
  /\/shorts\/|tiktok\.com\/@[\w.-]+\/video\/|\/reels?\/|clips\.twitch\.tv\/|twitch\.tv\/[\w.-]+\/clip\/|\/clip\//i;
// …and ones that are unambiguously long-form containers. Deliberately narrow
// (e.g. youtu.be is left neutral — it fronts both Shorts and long videos) so
// we never penalize a short by mistake.
const LONG_FORM_URL = /youtube\.com\/watch|twitch\.tv\/videos\//i;

/**
 * The Flow shows shorts and reels. Nothing else.
 *
 * ── WHY THIS IS AN EXCLUSION AND NOT A NUDGE ────────────────────────────────
 *
 * It used to be a bias: +1.5 for short, -0.9 for long, with a comment saying
 * "never filtered". A penalty does not keep long-form out, it just puts it
 * further down — and a surface you scroll forever reaches "further down" in
 * about a minute.
 *
 * ── WHY DURATION IS FIRST ───────────────────────────────────────────────────
 *
 * Every previous signal was a guess about a container. Three of them were
 * outright broken:
 *
 *   - `item.type === "short" || "reel"` was DEAD CODE. Media types are built
 *     by buildExternalMedia, which emits only "video" | "image", so that branch
 *     could never fire on any item from any platform.
 *   - Every YouTube item was classified LONG, including actual Shorts, because
 *     the adapter hardcoded `youtube.com/watch?v=` (platform-sync.ts) and that
 *     matches LONG_FORM_URL. The one platform where "short vs long" is the
 *     whole question got it exactly backwards.
 *   - `youtu.be` was left neutral on purpose because it fronts both.
 *
 * `durationSeconds` is a number, and it is the thing the user actually means.
 * The adapter now populates it. URL shape and platform stay as fallbacks for
 * items whose source cannot tell us, not as the primary rule.
 *
 * ── WHAT HAPPENS TO "UNKNOWN" ───────────────────────────────────────────────
 *
 * It is excluded. That is the strict direction, and it is deliberate: the
 * request was "no long form content", and a permissive fallback is precisely
 * how long-form gets in. An unknown-duration video from a source with no
 * short-form marker could be forty seconds or four hours, and admitting it
 * means admitting the four-hour one.
 *
 * The cost is real and it is not hidden: items we cannot classify do not
 * appear, so a mesh whose platforms report no duration will have a thin Flow
 * until sync fills it in. `flowFormStats` exists so a caller can SAY that
 * rather than silently show an empty screen.
 */
const SHORT_FORM_MAX_SECONDS = 180;

function flowFormClass(post: FeedCardPost): "short" | "long" | "unknown" {
  // 1. A real number beats every guess.
  const seconds = post.durationSeconds;
  if (typeof seconds === "number" && seconds > 0) {
    return seconds <= SHORT_FORM_MAX_SECONDS ? "short" : "long";
  }

  // 2. The source labelled it. postType now reaches the ranker (it used to be
  //    read by buildExternalMedia and discarded), so "short"/"reel"/"clip"
  //    from the platform is usable at last.
  const postType = (post.postType || "").toLowerCase();
  if (postType === "short" || postType === "shorts" || postType === "reel" || postType === "clip") return "short";

  // 3. Container shapes that only ever hold short-form.
  const url = post.externalUrl || "";
  if (SHORT_FORM_URL.test(url)) return "short";
  if ((post.platform || "").toLowerCase() === "tiktok") return "short";
  if (LONG_FORM_URL.test(url)) return "long";

  return "unknown";
}

/** True when an item belongs on a shorts-and-reels surface. Module-private:
 *  callers get the rule by going through rankFlowPosts / rankRelatedPosts, so
 *  there is no way to build a Flow list that skipped it. */
function isFlowEligible(post: FeedCardPost): boolean {
  return flowFormClass(post) === "short";
}

/**
 * What the shorts-only rule removed, so a caller can explain an empty Flow
 * instead of just rendering one. Silent truncation reads as "there is nothing
 * to show" when the truth is "we could not tell what these were".
 */
export function flowFormStats(posts: FeedCardPost[]): { kept: number; long: number; unknown: number } {
  let kept = 0, long = 0, unknown = 0;
  for (const post of posts) {
    const cls = flowFormClass(post);
    if (cls === "short") kept += 1;
    else if (cls === "long") long += 1;
    else unknown += 1;
  }
  return { kept, long, unknown };
}

/**
 * The For You candidate pool: everything in-network (follows, communities,
 * connected platforms) plus public out-of-network content — the exploration
 * supply Instagram blends in so new creators can reach you.
 */
export async function getFlowCandidates(user: FeedCurrentUser): Promise<FeedCardPost[]> {
  const [inNetwork, outOfNetwork] = await Promise.all([
    getCombinedFeedPosts({ user, source: "all", contentFilter: "all", limit: 240 }),
    getCombinedFeedPosts({ user, source: "discover", contentFilter: "all", limit: 240 }),
  ]);
  // Dedup by canonical identity, not raw id: the same external item can arrive
  // as a friend's shared reel AND the anonymous discover copy under different
  // ids, and keying on post.id would let both into the pool. First wins, so the
  // in-network (friend-attributed) copy beats the discover one.
  const byId = new Map<string, FeedCardPost>();
  for (const post of [...inNetwork, ...outOfNetwork]) {
    const key = canonicalFeedKey(post);
    if (!byId.has(key)) byId.set(key, post);
  }
  return dropMutedSources(user, [...byId.values()]);
}

/**
 * Muted mesh sources (a viewer-side preference — see lib/muted-sources.ts)
 * drop out of THIS viewer's Flow candidate pool: native + platform posts by a
 * muted author, and platform posts from a muted connected account. Filtering
 * only ever subtracts from the viewer's own feed; nothing changes for anyone
 * else. Guests have no preference row by construction.
 */
async function dropMutedSources(user: FeedCurrentUser, candidates: FeedCardPost[]): Promise<FeedCardPost[]> {
  if (user.id === ANONYMOUS_VIEWER.id || candidates.length === 0) return candidates;
  const pref = await prisma.feedPreference.findUnique({
    where: { userId: user.id },
    select: { mutedSources: true },
  });
  const keys = parseMutedSources(pref?.mutedSources);
  if (keys.length === 0) return candidates;

  const mutedAuthors = new Set(
    keys.filter((k) => k.startsWith("author:")).map((k) => k.slice("author:".length)),
  );
  const mutedAccounts = keys
    .filter((k) => k.startsWith("account:"))
    .map((k) => k.slice("account:".length));

  // Account-level mutes resolve precisely through the candidates' PlatformPost
  // row ids (`sourceId`), so muting one account never hides a second account
  // on the same platform. One bounded query, only when account mutes exist.
  let mutedPlatformRows = new Set<string>();
  if (mutedAccounts.length > 0) {
    const sourceIds = candidates
      .filter((post) => post.sourceId && post.platform)
      .map((post) => post.sourceId as string);
    if (sourceIds.length > 0) {
      const rows = await prisma.platformPost.findMany({
        where: { id: { in: sourceIds }, connectedAccountId: { in: mutedAccounts } },
        select: { id: true },
      });
      mutedPlatformRows = new Set(rows.map((row) => row.id));
    }
  }

  return candidates.filter((post) => {
    if (mutedAuthors.has(post.author.id)) return false;
    if (post.meshFriend && mutedAuthors.has(post.meshFriend.userId)) return false;
    if (post.sourceId && mutedPlatformRows.has(post.sourceId)) return false;
    return true;
  });
}

export function dominantFormat(post: FeedCardPost): "video" | "image" | "text" {
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

export function authorKey(post: FeedCardPost): string {
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
  // Guests have no interaction history by construction — skip the three
  // guaranteed-empty round trips on the guest Flow hot path.
  if (userId === ANONYMOUS_VIEWER.id) {
    return {
      authorAffinity: new Map(),
      formatPreference: new Map(),
      tagAffinity: new Map(),
      followingIds: new Set(),
    };
  }

  const [reactions, comments, follows, flowInteractions] = await Promise.all([
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
    // Privately-liked Flow items (native AND external). Keyed by the SAME
    // authorKey the ranker scores on, so external content finally matches
    // affinity — the taste triple was denormalized at like-time.
    prisma.flowImpression.findMany({
      where: { userId, liked: true },
      orderBy: { seenAt: "desc" },
      take: 300,
      select: { authorKey: true, format: true, tags: true },
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

  // Fold liked Flow items straight in via their stored taste triple (weight 1,
  // same scale as a native reaction). This is what lets an external author the
  // viewer likes accrue affinity the ranker can actually read.
  for (const it of flowInteractions) {
    if (it.authorKey) authorAffinity.set(it.authorKey, (authorAffinity.get(it.authorKey) ?? 0) + 1);
    if (it.format) formatCounts.set(it.format, (formatCounts.get(it.format) ?? 0) + 1);
    if (it.tags) {
      try {
        for (const t of JSON.parse(it.tags) as unknown[]) {
          const key = String(t).toLowerCase();
          tagAffinity.set(key, (tagAffinity.get(key) ?? 0) + 1);
        }
      } catch {
        // Malformed tag JSON — skip.
      }
    }
  }

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

/**
 * Algorithm Studio (MeshPro): five human sliders, 0–100 with 50 neutral,
 * compiled into the same RankWeights the presets use. This is the opposite
 * of an engagement dial — the OWNER tunes their own feed, and no post can
 * pay its way up.
 */
export type StudioWeights = {
  relationships: number;
  recency: number;
  discovery: number;
  interests: number;
  variety: number;
};

/**
 * THE ACCOUNT'S STUDIO MIX, resolved in one place.
 *
 * /meshpro sells Algorithm Studio as "your algorithm, literally". It failed that
 * twice: the weights only reached /flow — `feed/page.tsx` and
 * `api/feed/paginated/route.ts` called this same ranker with `{ limit }` and no
 * `studio`, so your algorithm governed one surface and was silently ignored on
 * the one people open first — and they lived in localStorage, so the paid
 * control was stored where free things live and a new phone forgot it.
 *
 * Every ranked surface asks this, so they cannot drift apart again. It returns
 * null for a free account without consulting the caller, because an entitlement
 * that each call site re-decides is an entitlement that eventually differs.
 */
export function resolveStudioWeights(
  user: { username?: string | null; isMeshPro?: boolean | null; meshProGiftUntil: Date | null; flowStudio?: string | null } | null | undefined,
  override?: string | null,
): StudioWeights | null {
  if (!user) return null;
  if (!hasMeshPro(user)) return null;
  // An explicit request parameter wins, so tuning a slider is live before the
  // write lands; otherwise the account's stored mix.
  return normalizeStudioWeights(override) ?? normalizeStudioWeights(user.flowStudio);
}

export function normalizeStudioWeights(raw: string | null | undefined): StudioWeights | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const take = (key: keyof StudioWeights) => {
      const v = Number(parsed[key]);
      if (!Number.isFinite(v)) return null;
      return Math.min(100, Math.max(0, Math.round(v)));
    };
    const relationships = take("relationships");
    const recency = take("recency");
    const discovery = take("discovery");
    const interests = take("interests");
    const variety = take("variety");
    if (relationships == null || recency == null || discovery == null || interests == null || variety == null) return null;
    return { relationships, recency, discovery, interests, variety };
  } catch {
    return null;
  }
}

function weightsFromStudio(s: StudioWeights): RankWeights {
  const f = (v: number) => v / 50; // 50 = the balanced preset's neutral point
  return {
    velocity: 0.4 + 1.0 * f(s.discovery),
    recency: 0.5 + 0.8 * f(s.recency),
    affinity: 0.6 + 1.4 * f(s.relationships),
    formatMatch: 0.5 + 0.6 * f(s.interests),
    tagMatch: 0.4 + 0.6 * f(s.interests),
    explorationEvery: s.discovery >= 66 ? 3 : s.discovery >= 25 ? 6 : 0,
    maxRun: s.variety >= 66 ? 1 : s.variety >= 25 ? 2 : 3,
  };
}

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
  opts: {
    now?: number;
    seen?: Set<string>;
    weights?: RankWeights;
    viewerLangs?: Set<string>;
    watch?: Map<string, WatchStats>;
  } = {},
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
  // actually interacts with. Positive history saturates on a log curve;
  // net-negative history (an author the viewer keeps flicking past, via
  // applyWatchSignal) becomes a real subtractive penalty.
  const affinityRaw = profile.authorAffinity.get(authorKey(post)) ?? 0;
  const affinity =
    affinityRaw >= 0
      ? Math.min(Math.log1p(affinityRaw) / Math.log(20), 1.5)
      : Math.max(affinityRaw, -3) * 0.2;

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

  // Cater to the viewer's language: content we can confidently read as one of
  // their languages gets a real nudge up. Text we can't classify (or media-only
  // posts) is left neutral — never penalized — so the Flow never empties out.
  if (opts.viewerLangs && opts.viewerLangs.size > 0) {
    const lang = guessLanguage(post.content);
    if (lang && opts.viewerLangs.has(lang)) score += LANGUAGE_BOOST;
  }

  // Favor short-form: the Flow showcases quick vertical content over
  // full-length video. Additive, like the language boost, so it shifts the
  // ranking without ever hard-filtering long-form out.
  // No form-class term here any more. Ranking cannot express "never" — only
  // "later" — and the surface is shorts-only now, so eligibility is decided by
  // isFlowEligible BEFORE anything is scored. Leaving a +1.5/-0.9 nudge in
  // place would also have been dishonest: it implies long-form is still in the
  // pool, ordered lower, when in fact it is gone.

  // Proportional jitter, applied BEFORE the fatigue crush so it scales with the
  // score and survives the ×0.06 at the same ratio — a real score gap is never
  // inverted, only genuine near-ties reshuffle, so two visits to the same pool
  // never produce the identical march of posts. (Additive dither after the
  // crush would randomize real gaps among the seen tail.)
  score *= 1 + (Math.random() - 0.5) * 0.16;

  // Seen fatigue: already-watched reels sink hard but stay retrievable once
  // fresh material runs out. A reel the viewer fast-skipped sinks hardest —
  // they already answered. Sign-safe: a negative score (possible now that
  // net-negative authors subtract) is DIVIDED by the crush so it falls
  // further — multiplying it would pull it toward zero and rank a rejected
  // reel above that author's unseen posts.
  if (opts.seen?.has(post.id)) {
    const ws = opts.watch?.get(post.id);
    const crush = ws && isFastSkip(ws) ? 0.02 : 0.06;
    score = score > 0 ? score * crush : score / crush;
  }

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
  opts: {
    seen?: Set<string>;
    limit?: number;
    mode?: FlowRankMode;
    studio?: StudioWeights | null;
    /** Posts the viewer scrolled immediately before this batch, oldest→newest.
     * Seeds the diversity window so author/platform runs can't straddle the
     * seam between one response and the next. */
    recent?: FeedCardPost[];
    /** The viewer's languages (from Accept-Language). Same-language content is
     * nudged up so the Flow caters to the language they actually read. */
    viewerLangs?: Set<string>;
    /** The viewer's own per-post watch stats — deepens the seen crush for
     * fast-skipped reels. Author-level effects come via applyWatchSignal. */
    watch?: Map<string, WatchStats>;
  } = {},
): FeedCardPost[] {
  const mode = opts.mode ?? "balanced";
  const limit = opts.limit ?? posts.length;

  // SHORTS AND REELS ONLY — before the mode branches, deliberately.
  //
  // The old short-form bias lived inside scoreFlowPost, which chronological
  // mode returns before ever reaching (see the early return below), and which
  // the related lane never calls at all. So the one rule that decides what
  // this surface IS applied in some modes and not others. It is a filter on
  // the pool now, so every mode inherits it and no mode can opt out by
  // taking a different path through the scorer.
  let candidates = posts.filter(isFlowEligible);

  // Following mode narrows the candidate pool to people the viewer explicitly
  // follows (native posts and friends' platform content) before ranking.
  if (mode === "following") {
    candidates = candidates.filter(
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

  // A Studio mix (MeshPro) overrides the preset's weights outright — the
  // caller is responsible for gating who may pass one.
  const weights = opts.studio ? weightsFromStudio(opts.studio) : MODE_WEIGHTS[mode];
  const now = Date.now();
  const scored = candidates
    .map((post) => ({ post, score: scoreFlowPost(post, profile, { now, seen: opts.seen, weights, viewerLangs: opts.viewerLangs, watch: opts.watch }) }))
    .sort((a, b) => b.score - a.score);

  const result: FeedCardPost[] = [];
  const pool = [...scored];
  // The diversity window looks at what the viewer actually just watched, not
  // just this batch — seeded with the tail of the previous response.
  const history: FeedCardPost[] = [...(opts.recent ?? [])];

  while (result.length < limit && pool.length > 0) {
    const slot = result.length;
    const h = history.length;
    const lastAuthor = history[h - 1] ? authorKey(history[h - 1]) : null;
    const runAuthors = history.slice(Math.max(0, h - weights.maxRun), h).map((p) => authorKey(p));
    const runIsFull = (key: string) =>
      runAuthors.length >= weights.maxRun && runAuthors.every((a) => a === key);
    // No single EXTERNAL platform monopolizes the screen: three consecutive
    // slots from one platform means the next pick prefers anywhere else. Native
    // mesh content is un-bucketed here (its variety is governed by maxRun), so a
    // run of native posts never force-injects external content every 3rd slot.
    const platformOf = (p: FeedCardPost): string | null => {
      const pl = (p.platform || "meshme").toLowerCase();
      return pl === "meshme" ? null : pl;
    };
    const lastPlatforms = history
      .slice(Math.max(0, h - 3), h)
      .map(platformOf)
      .filter((p): p is string => p !== null);
    const platformRunFull = (platform: string | null) =>
      platform !== null && lastPlatforms.length >= 3 && lastPlatforms.every((p) => p === platform);
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
      pickIndex = pool.findIndex(
        ({ post }) => !runIsFull(authorKey(post)) && !platformRunFull(platformOf(post)),
      );
    }
    if (pickIndex === -1) {
      pickIndex = pool.findIndex(({ post }) => !runIsFull(authorKey(post)));
    }
    if (pickIndex === -1) pickIndex = 0;

    const pick = pool.splice(pickIndex, 1)[0].post;
    result.push(pick);
    history.push(pick);
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
  studio?: StudioWeights | null,
): string {
  const handle = `@${post.author.username}`;
  if (studio) return "Ranked by your Studio mix — you tuned these weights";
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
    // The sideways "more like this" lane had no form-class term at all, so
    // long-form could enter the Flow through it even from a short anchor.
    .filter(isFlowEligible)
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
