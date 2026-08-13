// WHAT MESHPRO ADDS IS ANSWERS, NOT MORE NUMBERS.
//
// The free dashboard already reports totals, per-platform comparison, follower
// growth and audience overlap, and Pro already widens the window those are
// measured over. Adding another grid of counters on top would be a longer page,
// not a better one.
//
// So this module computes the three things someone running several accounts
// actually has to decide, each derived from data already synced rather than
// modelled or guessed:
//
//   WHEN TO POST     PlatformPost.publishedAt x engagement, per platform.
//   WHAT TO POST     PlatformPost.postType x engagement, per platform.
//   WHERE IT IS GOING  PlatformAnalytics newFollowers/lostFollowers over the
//                      window, plus how concentrated the audience is.
//
// ── THE RULE THIS MODULE IS BUILT AROUND ────────────────────────────────────
//
// EVERY ANSWER CARRIES THE SAMPLE IT CAME FROM, AND STAYS SILENT BELOW IT.
//
// "Post at 7pm on Thursdays" off three posts is astrology with a chart behind
// it. It is also the easiest possible thing to ship, because the arithmetic
// works fine on three rows and nothing complains. So every result here is a
// discriminated union: either a finding WITH its sample size, or an explicit
// `insufficient` carrying how much data exists and how much is needed. The UI
// renders the second case as plainly as the first.
//
// MIN_POSTS_FOR_TIMING is 12 because the week is split into 4 day-parts x 2
// day-types (see BUCKETS) — 8 buckets, so 12 posts is the point where the
// modal bucket can hold more than one post and still mean something. It is a
// floor, not a guarantee, and `confidence` reports which side of comfortable
// the sample is on.

import { prisma } from "./prisma";
import { getCurrentUser } from "./auth";
import { hasAnalyticsConsent } from "./consent";
import { getPlatformCapability } from "./platform-capabilities";

/** Below this many posts on a platform, timing advice is noise. */
const MIN_POSTS_FOR_TIMING = 12;
/** Below this, a format comparison is one post against one post. */
const MIN_POSTS_FOR_FORMAT = 8;
/** Days of history the Pro window looks back over. */
const WINDOW_DAYS = 90;

/**
 * Engagement as a single comparable number.
 *
 * Views are weighted at 1 and the deliberate acts above it, because a view is
 * mostly a function of how far the platform pushed the post and a comment is a
 * decision. The weights are shared with the free dashboard's ranking (likes 8,
 * comments 12) so the two surfaces cannot disagree about which post did well.
 */
function engagementScore(p: { viewCount: number; likeCount: number; commentCount: number; shareCount: number }): number {
  return p.viewCount + p.likeCount * 8 + p.commentCount * 12 + p.shareCount * 10;
}

// ── WHEN ────────────────────────────────────────────────────────────────────

/**
 * Four day-parts, and weekday vs weekend. Not 168 hour-slots: nobody has
 * enough posts to fill a 168-cell grid, and a grid that is mostly empty
 * produces a "best hour" that is whichever single post did best.
 */
const BUCKETS = [
  { id: "early", label: "Early (5am–9am)", from: 5, to: 9 },
  { id: "day", label: "Daytime (9am–5pm)", from: 9, to: 17 },
  { id: "evening", label: "Evening (5pm–10pm)", from: 17, to: 22 },
  { id: "late", label: "Late (10pm–5am)", from: 22, to: 5 },
] as const;

function bucketFor(hour: number): (typeof BUCKETS)[number] {
  for (const b of BUCKETS) {
    if (b.from < b.to ? hour >= b.from && hour < b.to : hour >= b.from || hour < b.to) return b;
  }
  return BUCKETS[BUCKETS.length - 1];
}

export type TimingFinding =
  | {
      status: "ok";
      bucketId: string;
      bucketLabel: string;
      dayType: "weekday" | "weekend";
      /** Mean engagement in the winning bucket, and across all buckets. */
      bucketAverage: number;
      overallAverage: number;
      /** How much better than average, as a percentage. Can be negative. */
      lift: number;
      sampleSize: number;
      confidence: "firm" | "tentative";
    }
  | { status: "insufficient"; have: number; need: number };

export function bestTime(posts: { publishedAt: Date | null; score: number }[]): TimingFinding {
  const dated = posts.filter((p): p is { publishedAt: Date; score: number } => p.publishedAt !== null);
  if (dated.length < MIN_POSTS_FOR_TIMING) {
    return { status: "insufficient", have: dated.length, need: MIN_POSTS_FOR_TIMING };
  }

  const cells = new Map<string, { total: number; n: number; bucket: (typeof BUCKETS)[number]; dayType: "weekday" | "weekend" }>();
  for (const p of dated) {
    const day = p.publishedAt.getUTCDay();
    const dayType: "weekday" | "weekend" = day === 0 || day === 6 ? "weekend" : "weekday";
    const bucket = bucketFor(p.publishedAt.getUTCHours());
    const key = `${dayType}:${bucket.id}`;
    const cell = cells.get(key) ?? { total: 0, n: 0, bucket, dayType };
    cell.total += p.score;
    cell.n += 1;
    cells.set(key, cell);
  }

  const overallAverage = dated.reduce((sum, p) => sum + p.score, 0) / dated.length;

  // A bucket holding a single post is that post, not a pattern.
  const eligible = [...cells.values()].filter((c) => c.n >= 2);
  if (!eligible.length) return { status: "insufficient", have: dated.length, need: MIN_POSTS_FOR_TIMING };

  const winner = eligible.reduce((best, c) => (c.total / c.n > best.total / best.n ? c : best));
  const bucketAverage = winner.total / winner.n;

  return {
    status: "ok",
    bucketId: winner.bucket.id,
    bucketLabel: winner.bucket.label,
    dayType: winner.dayType,
    bucketAverage: Math.round(bucketAverage),
    overallAverage: Math.round(overallAverage),
    lift: overallAverage > 0 ? Math.round(((bucketAverage - overallAverage) / overallAverage) * 100) : 0,
    sampleSize: winner.n,
    // Four posts in the winning bucket is the point where one outlier stops
    // deciding the answer on its own.
    confidence: winner.n >= 4 ? "firm" : "tentative",
  };
}

// ── WHAT ────────────────────────────────────────────────────────────────────

export type FormatFinding =
  | { status: "ok"; rows: { postType: string; averageScore: number; count: number }[] }
  | { status: "insufficient"; have: number; need: number };

export function bestFormat(posts: { postType: string; score: number }[]): FormatFinding {
  if (posts.length < MIN_POSTS_FOR_FORMAT) {
    return { status: "insufficient", have: posts.length, need: MIN_POSTS_FOR_FORMAT };
  }
  const byType = new Map<string, { total: number; n: number }>();
  for (const p of posts) {
    const cell = byType.get(p.postType) ?? { total: 0, n: 0 };
    cell.total += p.score;
    cell.n += 1;
    byType.set(p.postType, cell);
  }
  const rows = [...byType.entries()]
    // A format with one post is an anecdote; it is dropped rather than ranked.
    .filter(([, v]) => v.n >= 2)
    .map(([postType, v]) => ({ postType, averageScore: Math.round(v.total / v.n), count: v.n }))
    .sort((a, b) => b.averageScore - a.averageScore);

  if (!rows.length) return { status: "insufficient", have: posts.length, need: MIN_POSTS_FOR_FORMAT };
  return { status: "ok", rows };
}

// ── WHERE IT IS GOING ───────────────────────────────────────────────────────

type PlatformMomentum = {
  platform: string;
  platformName: string;
  followers: number;
  /** Net follower change across the window, from the dated snapshots. */
  netFollowerChange: number;
  gained: number;
  lost: number;
  /** Share of this person's total audience that sits on this platform, 0-100. */
  audienceShare: number;
  /** Whether this platform's analytics have ever been synced. */
  hasData: boolean;
};

/**
 * How concentrated the audience is, 0-100, as the largest platform's share.
 *
 * Deliberately NOT a Herfindahl index or an entropy figure: the number is shown
 * to a person deciding where to spend an afternoon, and "62% of your audience
 * is on one platform" is a sentence they can act on. A normalized HHI is more
 * defensible statistically and communicates nothing.
 */
function concentration(rows: PlatformMomentum[]): { largestShare: number; largestPlatform: string | null } {
  const withAudience = rows.filter((r) => r.followers > 0);
  if (!withAudience.length) return { largestShare: 0, largestPlatform: null };
  const top = withAudience.reduce((a, b) => (b.followers > a.followers ? b : a));
  return { largestShare: top.audienceShare, largestPlatform: top.platform };
}

// ── THE QUERY ───────────────────────────────────────────────────────────────

export type ProAnalytics = {
  isMeshPro: boolean;
  windowDays: number;
  /** Platforms whose analytics have actually been synced; the rest are named. */
  platformsWithData: string[];
  platformsWithoutData: string[];
  timing: { platform: string; platformName: string; finding: TimingFinding }[];
  formats: { platform: string; platformName: string; finding: FormatFinding }[];
  momentum: PlatformMomentum[];
  concentration: { largestShare: number; largestPlatform: string | null };
};

export async function getProAnalytics(): Promise<ProAnalytics | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  // THE SAME CONSENT THAT GATES THE FREE DASHBOARD GATES THIS ONE.
  //
  // getAnalyticsDashboardData returns null when someone has switched the
  // Analytics rule off, and the honest answer to a withdrawn consent is not to
  // compute it at all. A second analytics surface that quietly kept processing
  // the same activity would make that switch a lie — and this one reads more
  // of it, not less: publish times, formats, follower deltas.
  if (!(await hasAnalyticsConsent(user.id))) return null;

  // MeshPro is what this is for. Computing it for everyone and hiding the
  // result behind a paywall in the markup would run every query below for
  // people who cannot see the answer, and ship the numbers to the browser of
  // someone who has not paid for them.
  if (!user.isMeshPro) {
    return {
      isMeshPro: false,
      windowDays: WINDOW_DAYS,
      platformsWithData: [],
      platformsWithoutData: [],
      timing: [],
      formats: [],
      momentum: [],
      concentration: { largestShare: 0, largestPlatform: null },
    };
  }

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const accounts = await prisma.connectedAccount.findMany({
    where: { userId: user.id, isActive: true },
    select: {
      id: true,
      platform: true,
      platformPosts: {
        where: { publishedAt: { gte: since } },
        select: {
          publishedAt: true,
          postType: true,
          viewCount: true,
          likeCount: true,
          commentCount: true,
          shareCount: true,
        },
      },
      platformAnalytics: {
        where: { date: { gte: since } },
        orderBy: { date: "asc" },
        select: { date: true, followerCount: true, newFollowers: true, lostFollowers: true },
      },
    },
  });

  const timing: ProAnalytics["timing"] = [];
  const formats: ProAnalytics["formats"] = [];
  const momentum: PlatformMomentum[] = [];
  const platformsWithData: string[] = [];
  const platformsWithoutData: string[] = [];

  for (const account of accounts) {
    const capability = getPlatformCapability(account.platform);
    const platformName = capability?.name ?? account.platform;
    const scored = account.platformPosts.map((p) => ({ ...p, score: engagementScore(p) }));

    const hasData = scored.length > 0 || account.platformAnalytics.length > 0;
    if (hasData) platformsWithData.push(account.platform);
    else platformsWithoutData.push(account.platform);

    if (scored.length) {
      timing.push({ platform: account.platform, platformName, finding: bestTime(scored) });
      formats.push({ platform: account.platform, platformName, finding: bestFormat(scored) });
    }

    const snapshots = account.platformAnalytics;
    const latest = snapshots[snapshots.length - 1];
    momentum.push({
      platform: account.platform,
      platformName,
      followers: latest?.followerCount ?? 0,
      // Summed from the daily deltas rather than differenced between the first
      // and last snapshot: a gap in syncing shows up as a smaller sum, not as a
      // fabricated cliff between two dates that happen to bracket it.
      netFollowerChange: snapshots.reduce((sum, s) => sum + s.newFollowers - s.lostFollowers, 0),
      gained: snapshots.reduce((sum, s) => sum + s.newFollowers, 0),
      lost: snapshots.reduce((sum, s) => sum + s.lostFollowers, 0),
      audienceShare: 0,
      hasData,
    });
  }

  const totalAudience = momentum.reduce((sum, m) => sum + m.followers, 0);
  for (const m of momentum) {
    m.audienceShare = totalAudience > 0 ? Math.round((m.followers / totalAudience) * 100) : 0;
  }
  momentum.sort((a, b) => b.followers - a.followers);

  return {
    isMeshPro: user.isMeshPro,
    windowDays: WINDOW_DAYS,
    platformsWithData,
    platformsWithoutData,
    timing,
    formats,
    momentum,
    concentration: concentration(momentum),
  };
}
