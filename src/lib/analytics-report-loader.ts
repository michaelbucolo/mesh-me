// THE MESH REPORT'S ONLY DOOR.
//
// Everything the pure composer (analytics-report.ts) refuses to know lives
// here, in a fixed order the gate script pins:
//
//   1. CONSENT BEFORE COMPUTATION. The same Analytics rule that gates the
//      dashboard gates this reader — and this is a NEW reader of the same
//      activity, which consent-check cannot see (it pins only the dashboard
//      loader), so the new gate pins it instead. Withdrawn consent means no
//      queries at all, not a report with a privacy note.
//   2. MESHPRO BEFORE THE QUERIES. The document is what Pro sells; computing
//      it for everyone and hiding the result in markup would run the whole
//      period scan for people who cannot see the answer (the pro-analytics
//      precedent, stated in its own comment).
//   3. NO OTHER PERSON'S IDENTITY ENTERS. The report is a hand-overable file.
//      Follower reads here select handles for COUNTING overlap and nothing a
//      person could be recognized by — no displayName, no avatarUrl — and the
//      composed report carries the count, never the list.
import { getCurrentUser } from "./auth";
import { hasAnalyticsConsent } from "./consent";
import { getPlatformCapability } from "./platform-capabilities";
import { prisma } from "./prisma";
import { memoizeWithTtl } from "./ttl-memo";
import { bestFormat, bestTime } from "./pro-analytics";
import {
  composeAnalyticsReport,
  reportWindows,
  resolveReportPeriod,
  type AnalyticsReport,
  type ReportPeriod,
  type ReportWindow,
  type ReportWindowAggregate,
} from "./analytics-report";

export type ReportRequestResult =
  | { status: "unauthenticated" }
  | { status: "consent-withheld" }
  | { status: "not-pro" }
  | { status: "invalid-period" }
  | { status: "ok"; report: AnalyticsReport };

/** Shared with the dashboard/Pro rankings so surfaces cannot disagree. */
function score(p: { viewCount: number; likeCount: number; commentCount: number; shareCount: number }) {
  return p.viewCount + p.likeCount * 8 + p.commentCount * 12 + p.shareCount * 15;
}

function excerpt(...values: Array<string | null | undefined>) {
  const text = values.find((value) => value?.trim())?.trim() || "Untitled";
  return text.length > 90 ? `${text.slice(0, 87)}...` : text;
}

async function aggregateWindow(userId: string, window: ReportWindow): Promise<ReportWindowAggregate> {
  const [accounts, nativePosts] = await Promise.all([
    prisma.connectedAccount.findMany({
      where: { userId, isActive: true },
      select: {
        platform: true,
        platformPosts: {
          where: { publishedAt: { gte: window.start, lt: window.end } },
          select: {
            title: true,
            content: true,
            postType: true,
            publishedAt: true,
            viewCount: true,
            likeCount: true,
            commentCount: true,
            shareCount: true,
          },
          // Mirrors the dashboard's widest post scan cap: a pathological month
          // stays a bounded query, and top-5/findings don't need the tail.
          take: 1000,
          orderBy: { publishedAt: "desc" },
        },
        platformAnalytics: {
          where: { date: { gte: window.start, lt: window.end } },
          select: { newFollowers: true, lostFollowers: true },
        },
      },
    }),
    prisma.post.findMany({
      where: { authorId: userId, createdAt: { gte: window.start, lt: window.end } },
      select: {
        content: true,
        createdAt: true,
        _count: { select: { reactions: true, comments: true, reposts: true } },
      },
      take: 1000,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const platforms: ReportWindowAggregate["platforms"] = [];
  const scoredPosts: ReportWindowAggregate["scoredPosts"] = [];

  for (const account of accounts) {
    const platformName = getPlatformCapability(account.platform)?.name ?? account.platform;
    const row = {
      platform: account.platform,
      platformName,
      posts: account.platformPosts.length,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      followersGained: account.platformAnalytics.reduce((sum, s) => sum + s.newFollowers, 0),
      followersLost: account.platformAnalytics.reduce((sum, s) => sum + s.lostFollowers, 0),
    };
    for (const post of account.platformPosts) {
      row.views += post.viewCount;
      row.likes += post.likeCount;
      row.comments += post.commentCount;
      row.shares += post.shareCount;
      scoredPosts.push({
        title: excerpt(post.title, post.content),
        platformName,
        postType: post.postType,
        publishedAt: post.publishedAt,
        score: score(post),
        views: post.viewCount,
        likes: post.likeCount,
        comments: post.commentCount,
      });
    }
    if (row.posts > 0 || row.followersGained > 0 || row.followersLost > 0) platforms.push(row);
  }

  // Native Mesh.me posts join on the same weighted scale the dashboard uses
  // (reactions 8, comments 12, reposts 15; no view term exists natively).
  const native = {
    platform: "mesh",
    platformName: "Mesh.me",
    posts: nativePosts.length,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    followersGained: 0,
    followersLost: 0,
  };
  for (const post of nativePosts) {
    native.likes += post._count.reactions;
    native.comments += post._count.comments;
    native.shares += post._count.reposts;
    scoredPosts.push({
      title: excerpt(post.content),
      platformName: "Mesh.me",
      postType: "post",
      publishedAt: post.createdAt,
      score: post._count.reactions * 8 + post._count.comments * 12 + post._count.reposts * 15,
      views: 0,
      likes: post._count.reactions,
      comments: post._count.comments,
    });
  }
  if (native.posts > 0) platforms.push(native);

  return {
    posts: platforms.reduce((sum, p) => sum + p.posts, 0),
    views: platforms.reduce((sum, p) => sum + p.views, 0),
    likes: platforms.reduce((sum, p) => sum + p.likes, 0),
    comments: platforms.reduce((sum, p) => sum + p.comments, 0),
    shares: platforms.reduce((sum, p) => sum + p.shares, 0),
    engagement: scoredPosts.reduce((sum, p) => sum + p.score, 0),
    followersGained: platforms.reduce((sum, p) => sum + p.followersGained, 0),
    followersLost: platforms.reduce((sum, p) => sum + p.followersLost, 0),
    platforms,
    scoredPosts,
  };
}

/**
 * Overlap as a COUNT. Handles only — never displayName/avatarUrl — read to
 * match the same handle across platforms, then discarded; name-only matches
 * are skipped entirely (the dashboard treats them as too collision-prone to
 * show, and a count built on them would be a guess). Lower bound by design:
 * each platform syncs a capped follower sample.
 */
async function countMultiPlatformFollowers(userId: string): Promise<number> {
  const rows = await prisma.platformFollower.findMany({
    where: { connectedAccount: { userId, isActive: true } },
    select: { username: true, platformUserId: true, connectedAccount: { select: { platform: true } } },
    take: 4000,
  });
  const platformsByHandle = new Map<string, Set<string>>();
  for (const row of rows) {
    const handle = (row.username ?? "").trim().toLowerCase().replace(/^@+/, "");
    if (!handle) continue;
    (platformsByHandle.get(handle) ?? platformsByHandle.set(handle, new Set()).get(handle)!).add(
      row.connectedAccount.platform,
    );
  }
  let count = 0;
  platformsByHandle.forEach((platforms) => {
    if (platforms.size >= 2) count += 1;
  });
  return count;
}

type ReportUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

const loadReport = memoizeWithTtl(loadReportUncached, {
  ttlMs: 60_000,
  key: (user: ReportUser, period: ReportPeriod) => `${user.id}:${period.param}:${user.updatedAt.getTime()}`,
});

async function loadReportUncached(user: ReportUser, period: ReportPeriod): Promise<AnalyticsReport> {
  const windows = reportWindows(period);
  // The previous window is a COMPARISON only if the account existed for all
  // of it; otherwise the report says "no complete prior period" instead of
  // differencing against a fabricated zero baseline.
  const hasCompletePrevious = user.createdAt.getTime() <= windows.previous.start.getTime();

  const [current, previous, multiPlatformCount, accounts] = await Promise.all([
    aggregateWindow(user.id, windows.current),
    hasCompletePrevious ? aggregateWindow(user.id, windows.previous) : Promise.resolve(null),
    countMultiPlatformFollowers(user.id),
    prisma.connectedAccount.findMany({
      where: { userId: user.id, isActive: true },
      select: { platform: true },
    }),
  ]);

  // Coverage: which connected platforms could contribute content at all.
  const readable: { id: string; name: string }[] = [];
  const unreadable: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const account of accounts) {
    if (seen.has(account.platform)) continue;
    seen.add(account.platform);
    const capability = getPlatformCapability(account.platform);
    const entry = { id: account.platform, name: capability?.name ?? account.platform };
    // Same authority as the lifetime inventory: importContent decides whether
    // a platform could contribute rows at all (content-inventory.ts).
    if (capability?.importContent) readable.push(entry);
    else unreadable.push(entry);
  }

  return composeAnalyticsReport(
    period,
    current,
    previous,
    {
      timing: bestTime(current.scoredPosts.map((p) => ({ publishedAt: p.publishedAt, score: p.score }))),
      formats: bestFormat(current.scoredPosts.map((p) => ({ postType: p.postType, score: p.score }))),
    },
    { multiPlatformCount, coverage: { readable, unreadable }, composedAt: new Date() },
  );
}

/**
 * The one entry point routes call. Refusals are typed, not thrown, so each
 * route can answer with its honest status code (trail's 403 precedent).
 */
export async function getAnalyticsReport(rawPeriod: string | null): Promise<ReportRequestResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "unauthenticated" };
  if (!(await hasAnalyticsConsent(user.id))) return { status: "consent-withheld" };
  if (!user.isMeshPro) return { status: "not-pro" };

  const period = resolveReportPeriod(rawPeriod, user.createdAt);
  if (!period) return { status: "invalid-period" };

  return { status: "ok", report: await loadReport(user, period) };
}
