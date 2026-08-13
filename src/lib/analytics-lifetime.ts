import "server-only";

// THE LONG VIEW'S LOADER — bounded reads, one axis, once a day.
//
// Adjudication order is the contract (gate-pinned): consent, then the plan
// through the SAME decider the dashboard asks (analyticsWindow — the
// /meshpro card's enforcedIn pointer), and only then the memo — so a lapsed
// account can never hit a warm cache, and a withdrawn consent computes
// nothing at all.
//
// Every read is bounded: month-grouped aggregates (rows out ≤ the axis, raw
// event rows never cross the wire) or a hard LIMIT/take. The whole fold runs
// at most once per user per UTC day per instance — "Counted {date}; recounts
// daily" is the surface's honest disclosure of exactly that.
//
// DateTime is stored as ISO TEXT under the libSQL adapter (verified against
// the live database before this module chose its bucket expression), so
// strftime('%Y-%m', col) is the month bucket — no unixepoch modifiers.

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasAnalyticsConsent } from "@/lib/consent";
import { hasMeshPro } from "@/lib/mesh-pro";
import { nsfwHiddenWhere } from "@/lib/content-safety";
import { memoizeWithTtl } from "@/lib/ttl-memo";
import { analyticsWindow } from "@/lib/analytics-dashboard";
import {
  composeLifetime,
  evidenceStart,
  lifetimeMonthKeys,
  monthKeyOf,
  type LifetimePayload,
  type UntrackedReason,
} from "@/lib/analytics-eras";

type LifetimeUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

type MonthRow = { month: string; value: number | bigint };

const toRows = (rows: MonthRow[]) =>
  rows.filter((r) => typeof r.month === "string").map((r) => ({ month: r.month, value: Number(r.value) }));

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getLifetimeAnalytics(): Promise<LifetimePayload | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  // Consent first: a withdrawn Analytics rule means nothing is computed, not
  // computed-and-hidden. Then the plan, through the one decider. The page
  // additionally mounts this only inside its explicit isMeshPro condition —
  // defense in depth, both pinned.
  if (!(await hasAnalyticsConsent(user.id))) return null;
  if (!analyticsWindow(hasMeshPro(user)).lifetime) return null;
  return loadLifetime(user);
}

// Deep history moves at sync speed, not at page-view speed: one fold per
// user per UTC day. The key's user.id prefix is the cross-user isolation.
const loadLifetime = memoizeWithTtl(loadLifetimeUncached, {
  ttlMs: 24 * 60 * 60 * 1000,
  key: (user) => `${user.id}:${utcDayKey()}`,
  maxEntries: 300,
});

async function loadLifetimeUncached(user: LifetimeUser): Promise<LifetimePayload> {
  const now = new Date();
  const hideNsfw = "isNsfw" in nsfwHiddenWhere(user) ? 1 : 0;

  // ── Day one: the earliest CREDIBLE evidence ────────────────────────────
  const [firstNative, firstPlatform] = await Promise.all([
    prisma.post.findFirst({
      where: { authorId: user.id },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.platformPost.findFirst({
      where: {
        connectedAccount: { userId: user.id },
        publishedAt: { not: null, gte: new Date("2005-01-01T00:00:00Z"), lte: now },
      },
      orderBy: { publishedAt: "asc" },
      select: { publishedAt: true, connectedAccount: { select: { platform: true } } },
    }),
  ]);

  const start = evidenceStart(user.createdAt, firstPlatform?.publishedAt ?? null);
  const { keys, clamped } = lifetimeMonthKeys(start, now);
  const floorIso = "2005-01-01T00:00:00.000Z";
  const nowIso = now.toISOString();

  // ── Month-grouped aggregates: rows out ≤ the axis, never raw events ────
  const [nativePosts, nativeReactions, nativeComments, followerArrivals, platformMonthly, undatedPlatform] =
    await Promise.all([
      prisma.$queryRaw<MonthRow[]>`
        SELECT strftime('%Y-%m', createdAt) AS month, COUNT(*) AS value
        FROM Post WHERE authorId = ${user.id}
        GROUP BY month ORDER BY month LIMIT 400`,
      prisma.$queryRaw<MonthRow[]>`
        SELECT strftime('%Y-%m', r.createdAt) AS month, COUNT(*) AS value
        FROM Reaction r JOIN Post p ON r.postId = p.id
        WHERE p.authorId = ${user.id}
        GROUP BY month ORDER BY month LIMIT 400`,
      prisma.$queryRaw<MonthRow[]>`
        SELECT strftime('%Y-%m', c.createdAt) AS month, COUNT(*) AS value
        FROM Comment c JOIN Post p ON c.postId = p.id
        WHERE p.authorId = ${user.id}
        GROUP BY month ORDER BY month LIMIT 400`,
      prisma.$queryRaw<MonthRow[]>`
        SELECT strftime('%Y-%m', createdAt) AS month, COUNT(*) AS value
        FROM Follow WHERE followingId = ${user.id}
        GROUP BY month ORDER BY month LIMIT 400`,
      prisma.$queryRaw<Array<{ month: string; platform: string; posts: number | bigint; views: number | bigint }>>`
        SELECT strftime('%Y-%m', pp.publishedAt) AS month, ca.platform AS platform,
               COUNT(*) AS posts, SUM(pp.viewCount) AS views
        FROM PlatformPost pp JOIN ConnectedAccount ca ON pp.connectedAccountId = ca.id
        WHERE ca.userId = ${user.id}
          AND pp.publishedAt IS NOT NULL
          AND pp.publishedAt >= ${floorIso} AND pp.publishedAt <= ${nowIso}
          AND (${hideNsfw} = 0 OR pp.isNsfw = 0)
        GROUP BY month, platform ORDER BY month LIMIT 3200`,
      // Corrupt or missing timestamps: counted, never slotted.
      prisma.platformPost.count({
        where: {
          connectedAccount: { userId: user.id },
          OR: [
            { publishedAt: null },
            { publishedAt: { lt: new Date("2005-01-01T00:00:00Z") } },
            { publishedAt: { gt: now } },
          ],
        },
      }),
    ]);

  // ── All-time bests, scored on the dashboard's own scale (8/12/15+views) ─
  const [topPlatformPosts, topNativeCandidates, bestPerYearRows] = await Promise.all([
    prisma.$queryRaw<Array<{ label: string | null; title: string | null; platform: string; score: number | bigint }>>`
      SELECT pp.content AS label, pp.title AS title, ca.platform AS platform,
             (pp.viewCount + pp.likeCount * 8 + pp.commentCount * 12 + pp.shareCount * 15) AS score
      FROM PlatformPost pp JOIN ConnectedAccount ca ON pp.connectedAccountId = ca.id
      WHERE ca.userId = ${user.id}
        AND (${hideNsfw} = 0 OR pp.isNsfw = 0)
      ORDER BY score DESC LIMIT 5`,
    prisma.post.findMany({
      where: { authorId: user.id },
      select: { content: true, _count: { select: { reactions: true, comments: true, reposts: true } } },
      orderBy: { reactions: { _count: "desc" } },
      take: 25,
    }),
    // One winner per calendar year, decided in SQL — the era card's "best
    // post" is a real title, never a guess from an unyeared top list.
    prisma.$queryRaw<Array<{ year: string; label: string | null; title: string | null; score: number | bigint }>>`
      SELECT year, label, title, score FROM (
        SELECT strftime('%Y', pp.publishedAt) AS year, pp.content AS label, pp.title AS title,
               (pp.viewCount + pp.likeCount * 8 + pp.commentCount * 12 + pp.shareCount * 15) AS score,
               ROW_NUMBER() OVER (
                 PARTITION BY strftime('%Y', pp.publishedAt)
                 ORDER BY (pp.viewCount + pp.likeCount * 8 + pp.commentCount * 12 + pp.shareCount * 15) DESC
               ) AS rank
        FROM PlatformPost pp JOIN ConnectedAccount ca ON pp.connectedAccountId = ca.id
        WHERE ca.userId = ${user.id}
          AND pp.publishedAt IS NOT NULL
          AND pp.publishedAt >= ${floorIso} AND pp.publishedAt <= ${nowIso}
          AND (${hideNsfw} = 0 OR pp.isNsfw = 0)
      ) WHERE rank = 1 LIMIT 400`,
  ]);

  const topNative = topNativeCandidates
    .map((post) => ({
      label: excerpt(post.content),
      platform: "mesh",
      score: post._count.reactions * 8 + post._count.comments * 12 + post._count.reposts * 15,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const topPosts = [
    ...topPlatformPosts.map((row) => ({
      label: excerpt(row.title ?? row.label),
      platform: row.platform,
      score: Number(row.score),
    })),
    ...topNative,
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // ── Fold the platform monthly rows into spine + per-year dominance ─────
  const platformRows = platformMonthly.filter((r) => typeof r.month === "string");
  const spineRows = mergeMonthly([
    ...toRows(nativePosts),
    ...platformRows.map((r) => ({ month: r.month, value: Number(r.posts) })),
  ]);
  const viewRows = mergeMonthly(platformRows.map((r) => ({ month: r.month, value: Number(r.views) })));

  const platformPerYear = new Map<number, Map<string, number>>();
  for (const row of platformRows) {
    const year = Number(row.month.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    const byPlatform = platformPerYear.get(year) ?? new Map<string, number>();
    byPlatform.set(row.platform, (byPlatform.get(row.platform) ?? 0) + Number(row.posts));
    platformPerYear.set(year, byPlatform);
  }
  for (const row of toRows(nativePosts)) {
    const year = Number(row.month.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    const byPlatform = platformPerYear.get(year) ?? new Map<string, number>();
    byPlatform.set("mesh.me", (byPlatform.get("mesh.me") ?? 0) + row.value);
    platformPerYear.set(year, byPlatform);
  }

  // ── The representation canary: one cheap cross-check per fold ──────────
  const nativeTotalFromBuckets = toRows(nativePosts).reduce((sum, r) => sum + r.value, 0);
  const nativeTotalFromCount = await prisma.post.count({ where: { authorId: user.id } });
  if (nativeTotalFromBuckets !== nativeTotalFromCount) {
    console.error(
      `Lifetime analytics bucket mismatch for ${user.id}: buckets=${nativeTotalFromBuckets} count=${nativeTotalFromCount} — check the DateTime at-rest encoding.`,
    );
  }

  // Native series existed only once the account did: months before signup
  // are "pre-mesh", a different truth from "not tracked yet".
  const signupMonth = monthKeyOf(user.createdAt);
  const preMesh: UntrackedReason = "pre-mesh";

  const firsts: Array<{ label: string; at: Date }> = [];
  if (firstNative) firsts.push({ label: "First post on mesh.me", at: firstNative.createdAt });
  if (firstPlatform?.publishedAt) {
    firsts.push({
      label: `First post we can see, on ${firstPlatform.connectedAccount.platform}`,
      at: firstPlatform.publishedAt,
    });
  }

  return composeLifetime({
    now,
    keys,
    clamped,
    undatedCount: undatedPlatform,
    spineRows,
    spineTrackedFrom: keys[0] ?? null,
    series: [
      { key: "views", label: "Views", trackedFrom: keys[0] ?? null, reason: null, rows: viewRows },
      { key: "reactions", label: "Reactions received", trackedFrom: signupMonth, reason: preMesh, rows: toRows(nativeReactions) },
      { key: "comments", label: "Comments received", trackedFrom: signupMonth, reason: preMesh, rows: toRows(nativeComments) },
      // Follow rows are hard-deleted on unfollow, so this series answers
      // "when did the people who follow you TODAY arrive" — labeled exactly
      // that, never "followers gained".
      { key: "followerArrivals", label: "When today's followers arrived", trackedFrom: signupMonth, reason: preMesh, rows: toRows(followerArrivals) },
    ],
    platformPerYear,
    bestPostPerYear: new Map(
      bestPerYearRows
        .filter((row) => /^\d{4}$/.test(row.year))
        .map((row) => [Number(row.year), { label: excerpt(row.title ?? row.label), score: Number(row.score) }]),
    ),
    firsts,
    topPosts,
  });
}

function mergeMonthly(rows: Array<{ month: string; value: number }>): Array<{ month: string; value: number }> {
  const merged = new Map<string, number>();
  for (const row of rows) merged.set(row.month, (merged.get(row.month) ?? 0) + row.value);
  return [...merged.entries()].map(([month, value]) => ({ month, value })).sort((a, b) => a.month.localeCompare(b.month));
}

function excerpt(value: string | null | undefined): string {
  const text = value?.trim() || "Untitled";
  return text.length > 90 ? `${text.slice(0, 87)}...` : text;
}
