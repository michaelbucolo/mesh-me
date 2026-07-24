import { getCurrentUser } from "@/lib/auth";
import { nsfwHiddenWhere } from "@/lib/content-safety";
import { prisma } from "@/lib/prisma";
import { memoizeWithTtl } from "@/lib/ttl-memo";

type AnalyticsUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

const CHART_DAYS = 14;
const METRIC_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type ChartPoint = {
  key: string;
  label: string;
  value: number;
};

function startOfUtcDay(date: Date) {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function daysAgoStart(days: number) {
  return new Date(startOfUtcDay(new Date()).getTime() - (days - 1) * DAY_MS);
}

function dateKey(date: Date | string | null | undefined) {
  if (!date) return "";
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return value.toISOString().slice(0, 10);
}

function shortDayLabel(key: string) {
  const date = new Date(`${key}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function makeSeries(days = CHART_DAYS) {
  const start = daysAgoStart(days);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS);
    const key = dateKey(date);
    return { key, label: shortDayLabel(key), value: 0 };
  });
}

function addToSeries(series: ChartPoint[], date: Date | string | null | undefined, amount = 1) {
  const key = dateKey(date);
  if (!key) return;
  const point = series.find((item) => item.key === key);
  if (point) point.value += amount;
}

function sum(values: Array<number | null | undefined>) {
  return values.reduce<number>((total, value) => total + (Number.isFinite(Number(value)) ? Number(value) : 0), 0);
}

// Returns a FRACTION (0–1), the scale every consumer expects: the UI's pct()
// helper caps at 1.0 = 100% and the command center multiplies by 100. Snapshot
// rates are already stored as percentages and divided by 100 at the call site,
// so this keeps the fallback path on the same 0–1 scale (previously it returned
// 0–100, which made pct() clamp every real rate to a flat "100%").
function engagementRate(engagements: number, views: number, fallbackAudience: number) {
  const denominator = views > 0 ? views : fallbackAudience;
  if (denominator <= 0) return 0;
  return Math.min(1, engagements / denominator);
}

function totalPostEngagement(post: {
  likeCount?: number | null;
  commentCount?: number | null;
  shareCount?: number | null;
  viewCount?: number | null;
  _count?: { reactions?: number; comments?: number; reposts?: number };
}) {
  if (post._count) {
    return sum([post._count.reactions, post._count.comments, post._count.reposts]);
  }
  return sum([post.likeCount, post.commentCount, post.shareCount]);
}

function totalPostScore(post: {
  likeCount?: number | null;
  commentCount?: number | null;
  shareCount?: number | null;
  viewCount?: number | null;
  _count?: { reactions?: number; comments?: number; reposts?: number };
}) {
  if (post._count) {
    // Weight native engagement the same way as the platform branch below, so
    // native and platform posts are scored on one comparable scale (bestContent
    // sorts across both). Native posts have no view count, so there's no view term.
    return sum([
      (post._count.reactions || 0) * 8,
      (post._count.comments || 0) * 12,
      (post._count.reposts || 0) * 15,
    ]);
  }
  return sum([
    post.viewCount,
    (post.likeCount || 0) * 8,
    (post.commentCount || 0) * 12,
    (post.shareCount || 0) * 15,
  ]);
}

function safeExcerpt(...values: Array<string | null | undefined>) {
  const text = values.find((value) => value?.trim())?.trim() || "Untitled content";
  return text.length > 130 ? `${text.slice(0, 127)}...` : text;
}

function growthDelta(points: Array<{ followerCount: number }>) {
  if (points.length < 2) return 0;
  return points[points.length - 1].followerCount - points[0].followerCount;
}

export async function getAnalyticsDashboardData() {
  const user = await getCurrentUser();
  if (!user) return null;
  return loadAnalyticsDashboard(user);
}

// This is the heaviest per-request computation in the app (25+ queries, two
// wide post scans). A short per-user memo makes tab switches and quick
// revisits instant; user.updatedAt in the key busts it the moment any account
// or privacy setting changes.
const loadAnalyticsDashboard = memoizeWithTtl(loadAnalyticsDashboardUncached, {
  ttlMs: 30_000,
  key: (user) => `${user.id}:${user.updatedAt.getTime()}`,
});

// ── Cross-platform audience overlap ─────────────────────────────────────────
// Match the same person across a user's connected platforms by normalized
// handle, to surface their "superfans" — people who follow them in more than
// one place, something no single platform can see. Operates on the SYNCED
// follower sample (each platform syncs a capped page), so it's presented as a
// lower bound ("fans we've found"), never an inflated total.
type FollowerRowForOverlap = {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  platformUserId: string;
  connectedAccount: { platform: string };
};

function computeAudienceOverlap(rows: FollowerRowForOverlap[]) {
  const platformsWithFollowers = new Set<string>();
  const people = new Map<
    string,
    {
      byHandle: boolean;
      name: string | null;
      avatarUrl: string | null;
      profileUrl: string | null;
      platforms: Set<string>;
      seen: Set<string>;
    }
  >();

  for (const r of rows) {
    const platform = r.connectedAccount.platform;
    platformsWithFollowers.add(platform);
    const handle = r.username ? r.username.trim().toLowerCase().replace(/^@+/, "") : "";
    const byHandle = handle.length > 0;
    const key = byHandle ? `h:${handle}` : r.displayName ? `n:${r.displayName.trim().toLowerCase()}` : "";
    if (!key) continue;
    let p = people.get(key);
    if (!p) {
      p = {
        byHandle,
        name: r.displayName || r.username || null,
        avatarUrl: r.avatarUrl,
        profileUrl: r.profileUrl,
        platforms: new Set(),
        seen: new Set(),
      };
      people.set(key, p);
    }
    // Dedupe a person within one platform (two of the user's own accounts on the
    // same platform shouldn't count them twice).
    const dedupe = `${platform}:${r.platformUserId}`;
    if (p.seen.has(dedupe)) continue;
    p.seen.add(dedupe);
    p.platforms.add(platform);
    if (!p.avatarUrl && r.avatarUrl) p.avatarUrl = r.avatarUrl;
    if (!p.profileUrl && r.profileUrl) p.profileUrl = r.profileUrl;
    if (!p.name && (r.displayName || r.username)) p.name = r.displayName || r.username;
  }

  const superfans: {
    name: string | null;
    avatarUrl: string | null;
    profileUrl: string | null;
    platforms: string[];
  }[] = [];
  let multiPlatformCount = 0;
  people.forEach((p) => {
    if (p.platforms.size >= 2) {
      multiPlatformCount += 1;
      // Only surface high-confidence (handle-matched) people as named superfans;
      // display-name-only matches are too collision-prone to show as a person.
      if (p.byHandle) {
        superfans.push({
          name: p.name,
          avatarUrl: p.avatarUrl,
          profileUrl: p.profileUrl,
          platforms: Array.from(p.platforms).sort(),
        });
      }
    }
  });
  superfans.sort((a, b) => b.platforms.length - a.platforms.length);

  return {
    platformsWithFollowers: Array.from(platformsWithFollowers).sort(),
    // Whether at least two platforms have any synced followers to overlap.
    hasEnoughData: platformsWithFollowers.size >= 2,
    syncedFollowerSample: rows.length,
    // Lower bound: people we FOUND following on 2+ platforms in the sample.
    multiPlatformCount,
    superfans: superfans.slice(0, 8),
  };
}

async function loadAnalyticsDashboardUncached(user: AnalyticsUser) {
  const chartStart = daysAgoStart(CHART_DAYS);
  const windowStart = daysAgoStart(METRIC_WINDOW_DAYS);
  const contentSafetyWhere = nsfwHiddenWhere(user);
  const platformPostWhere = {
    ...contentSafetyWhere,
    connectedAccount: { userId: user.id },
  };

  const [
    accounts,
    nativePosts,
    nativePostCount,
    nativeCommentCount,
    nativeReactionCount,
    commentsOnUserPosts,
    reactionsOnUserPosts,
    commentsWritten,
    reactionsMade,
    followerEvents,
    followingEvents,
    nativeFollowerTotal,
    nativeFollowingTotal,
    savedPostCount,
    savedPostEvents,
    messageCount,
    messageEvents,
    communityCount,
    platformPosts,
    platformTotals,
    recentCommentsWritten,
    recentReactionsMade,
    recentFollowers,
    recentSyncJobs,
    visibilityPolicies,
    sessionCount,
    twoFactorCount,
    meshPrivacy,
    notificationsCount,
    nativeLikesReceived,
    nativeCommentsReceived,
    platformFollowerRows,
  ] = await Promise.all([
    prisma.connectedAccount.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: {
            platformPosts: true,
            platformComments: true,
            platformFollowers: true,
            platformMedia: true,
          },
        },
        platformAnalytics: {
          where: { date: { gte: windowStart } },
          orderBy: { date: "asc" },
          take: METRIC_WINDOW_DAYS,
        },
      },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.post.findMany({
      where: { ...contentSafetyWhere, authorId: user.id },
      select: {
        id: true,
        content: true,
        visibility: true,
        createdAt: true,
        media: { select: { url: true, type: true }, take: 1 },
        tags: { select: { tag: true }, take: 3 },
        community: { select: { name: true, slug: true } },
        _count: { select: { comments: true, reactions: true, reposts: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.post.count({ where: { authorId: user.id } }),
    prisma.comment.count({ where: { authorId: user.id } }),
    prisma.reaction.count({ where: { userId: user.id } }),
    prisma.comment.findMany({
      where: { createdAt: { gte: chartStart }, post: { authorId: user.id } },
      select: { createdAt: true },
    }),
    prisma.reaction.findMany({
      where: { createdAt: { gte: chartStart }, post: { authorId: user.id } },
      select: { createdAt: true },
    }),
    prisma.comment.findMany({
      where: { authorId: user.id, createdAt: { gte: chartStart } },
      select: { createdAt: true },
    }),
    prisma.reaction.findMany({
      where: { userId: user.id, createdAt: { gte: chartStart } },
      select: { createdAt: true },
    }),
    prisma.follow.findMany({
      where: { followingId: user.id, createdAt: { gte: chartStart } },
      select: { createdAt: true },
    }),
    prisma.follow.findMany({
      where: { followerId: user.id, createdAt: { gte: chartStart } },
      select: { createdAt: true },
    }),
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.savedPost.count({ where: { userId: user.id } }),
    prisma.savedPost.findMany({
      where: { userId: user.id, createdAt: { gte: chartStart } },
      select: { createdAt: true },
    }),
    prisma.message.count({ where: { senderId: user.id } }),
    prisma.message.findMany({
      where: { senderId: user.id, createdAt: { gte: chartStart } },
      select: { createdAt: true },
    }),
    prisma.communityMember.count({ where: { userId: user.id } }),
    prisma.platformPost.findMany({
      where: platformPostWhere,
      select: {
        id: true,
        connectedAccountId: true,
        platformPostId: true,
        title: true,
        content: true,
        url: true,
        postType: true,
        likeCount: true,
        commentCount: true,
        shareCount: true,
        viewCount: true,
        watchTimeSeconds: true,
        thumbnailUrl: true,
        visibility: true,
        publishedAt: true,
        createdAt: true,
        connectedAccount: {
          select: {
            platform: true,
            platformUsername: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 1000,
    }),
    prisma.platformPost.aggregate({
      where: platformPostWhere,
      _count: { id: true },
      _sum: {
        likeCount: true,
        commentCount: true,
        shareCount: true,
        viewCount: true,
        watchTimeSeconds: true,
      },
    }),
    prisma.comment.findMany({
      where: { authorId: user.id },
      select: {
        id: true,
        content: true,
        createdAt: true,
        post: {
          select: {
            id: true,
            content: true,
            author: { select: { displayName: true, username: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.reaction.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        createdAt: true,
        type: true,
        post: {
          select: {
            id: true,
            content: true,
            author: { select: { displayName: true, username: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.follow.findMany({
      where: { followingId: user.id },
      select: {
        id: true,
        createdAt: true,
        follower: { select: { displayName: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.syncJob.findMany({
      where: { connectedAccount: { userId: user.id } },
      select: {
        id: true,
        syncType: true,
        status: true,
        itemsSynced: true,
        createdAt: true,
        completedAt: true,
        connectedAccount: { select: { platform: true, platformUsername: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.dataVisibilityPolicy.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        entityType: true,
        visibility: true,
        allowAnalytics: true,
        allowMeshiUse: true,
        allowDiscovery: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    prisma.session.count({ where: { userId: user.id } }),
    prisma.twoFactorMethod.count({ where: { userId: user.id, isEnabled: true } }),
    prisma.meshPrivacy.findUnique({ where: { userId: user.id } }),
    prisma.notification.count({ where: { recipientId: user.id } }),
    // Lifetime likes/comments received across ALL native posts — the nativePosts
    // array is capped at 500, so reducing over it undercounts prolific authors.
    prisma.reaction.count({ where: { post: { authorId: user.id } } }),
    prisma.comment.count({ where: { post: { authorId: user.id } } }),
    // Followers across every connected platform, to find the "superfans" who
    // follow on more than one. Hard-scoped to this user's OWN accounts (self-
    // only, like the rest of this loader). Capped generously — each platform
    // syncs only a page of followers, so a few hundred rows is typical.
    prisma.platformFollower.findMany({
      where: { connectedAccount: { userId: user.id } },
      select: {
        username: true,
        displayName: true,
        avatarUrl: true,
        profileUrl: true,
        platformUserId: true,
        connectedAccount: { select: { platform: true } },
      },
      take: 5000,
    }),
  ]);

  const totalNativeEngagement = nativePosts.reduce((total, post) => total + totalPostEngagement(post), 0);
  const totalPlatformEngagement = sum([
    platformTotals._sum.likeCount,
    platformTotals._sum.commentCount,
    platformTotals._sum.shareCount,
  ]);
  const totalPlatformViews = platformTotals._sum.viewCount || 0;
  const totalWatchSeconds = platformTotals._sum.watchTimeSeconds || 0;
  const totalPlatformContent = platformTotals._count.id || 0;
  const totalFollowersFromPlatforms = accounts.reduce((total, account) => {
    const latest = account.platformAnalytics.at(-1);
    return total + (latest?.followerCount || account._count.platformFollowers);
  }, 0);
  // The deduplicated view only mesh.me can compute: who follows you across
  // more than one platform.
  const audienceOverlap = computeAudienceOverlap(platformFollowerRows);

  const engagementSeries = makeSeries();
  const contentSeries = makeSeries();
  const followerGrowthSeries = makeSeries();
  const activitySeries = makeSeries();

  for (const post of nativePosts) {
    addToSeries(contentSeries, post.createdAt, 1);
    addToSeries(activitySeries, post.createdAt, 1);
  }
  for (const post of platformPosts) {
    addToSeries(contentSeries, post.publishedAt || post.createdAt, 1);
    addToSeries(activitySeries, post.createdAt, 1);
  }
  for (const event of commentsOnUserPosts) addToSeries(engagementSeries, event.createdAt, 1);
  for (const event of reactionsOnUserPosts) addToSeries(engagementSeries, event.createdAt, 1);
  for (const event of commentsWritten) addToSeries(activitySeries, event.createdAt, 1);
  for (const event of reactionsMade) addToSeries(activitySeries, event.createdAt, 1);
  for (const event of savedPostEvents) addToSeries(activitySeries, event.createdAt, 1);
  for (const event of messageEvents) addToSeries(activitySeries, event.createdAt, 1);
  for (const event of followerEvents) {
    addToSeries(followerGrowthSeries, event.createdAt, 1);
    addToSeries(activitySeries, event.createdAt, 1);
  }
  for (const event of followingEvents) addToSeries(activitySeries, event.createdAt, 1);
  for (const account of accounts) {
    for (const snapshot of account.platformAnalytics) {
      addToSeries(engagementSeries, snapshot.date, sum([snapshot.totalLikes, snapshot.totalComments, snapshot.totalShares]));
      addToSeries(followerGrowthSeries, snapshot.date, snapshot.newFollowers - snapshot.lostFollowers);
    }
  }

  const platformMetrics = new Map<string, { views: number; likes: number; comments: number; shares: number; watchTimeSeconds: number }>();
  for (const post of platformPosts) {
    const current = platformMetrics.get(post.connectedAccountId) || { views: 0, likes: 0, comments: 0, shares: 0, watchTimeSeconds: 0 };
    current.views += post.viewCount;
    current.likes += post.likeCount;
    current.comments += post.commentCount;
    current.shares += post.shareCount;
    current.watchTimeSeconds += post.watchTimeSeconds || 0;
    platformMetrics.set(post.connectedAccountId, current);
  }

  const platformComparison = accounts.map((account) => {
    const latest = account.platformAnalytics.at(-1);
    const metrics = platformMetrics.get(account.id) || { views: 0, likes: 0, comments: 0, shares: 0, watchTimeSeconds: 0 };
    const interactions = sum([latest?.totalLikes ?? metrics.likes, latest?.totalComments ?? metrics.comments, latest?.totalShares ?? metrics.shares]);
    const views = latest?.totalViews ?? metrics.views ?? 0;
    const followers = latest?.followerCount ?? account._count.platformFollowers ?? 0;
    return {
      id: account.id,
      platform: account.platform,
      platformUsername: account.platformUsername,
      isActive: account.isActive,
      scopes: account.scopes,
      lastSyncAt: account.lastSyncAt,
      syncStatus: account.syncStatus,
      syncError: account.syncError,
      postCount: account._count.platformPosts,
      followerCount: followers,
      followingCount: latest?.followingCount || 0,
      commentCount: account._count.platformComments,
      mediaCount: account._count.platformMedia,
      totalViews: views,
      totalLikes: latest?.totalLikes ?? metrics.likes,
      totalComments: latest?.totalComments ?? metrics.comments,
      totalShares: latest?.totalShares ?? metrics.shares,
      watchTimeSeconds: metrics.watchTimeSeconds,
      engagementRate: latest?.engagementRate ? latest.engagementRate / 100 : engagementRate(interactions, views, Math.max(followers, 1)),
      followerGrowth: growthDelta(account.platformAnalytics),
      snapshotCount: account.platformAnalytics.length,
    };
  });

  const bestContent = [
    ...nativePosts.map((post) => ({
      id: post.id,
      source: "Mesh.me",
      platform: "mesh.me",
      label: post.community?.name || "Native post",
      title: safeExcerpt(post.content),
      href: `/feed/${post.id}`,
      thumbnailUrl: post.media[0]?.url || null,
      postType: post.media[0]?.type || "text",
      views: 0,
      likes: post._count.reactions,
      comments: post._count.comments,
      shares: post._count.reposts,
      engagement: totalPostEngagement(post),
      score: totalPostScore(post),
      publishedAt: post.createdAt,
      visibility: post.visibility,
    })),
    ...platformPosts.map((post) => ({
      id: post.id,
      source: post.connectedAccount.platform,
      platform: post.connectedAccount.platform,
      label: post.connectedAccount.platformUsername || post.connectedAccount.platform,
      title: safeExcerpt(post.title, post.content),
      href: post.url,
      thumbnailUrl: post.thumbnailUrl,
      postType: post.postType,
      views: post.viewCount,
      likes: post.likeCount,
      comments: post.commentCount,
      shares: post.shareCount,
      engagement: totalPostEngagement(post),
      score: totalPostScore(post),
      publishedAt: post.publishedAt || post.createdAt,
      visibility: post.visibility,
    })),
  ]
    .sort((a, b) => b.score - a.score || b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, 8);

  const recentActivity = [
    ...nativePosts.slice(0, 6).map((post) => ({
      id: `native-post-${post.id}`,
      type: "Post",
      title: safeExcerpt(post.content),
      detail: post.community?.name ? `Shared in ${post.community.name}` : "Published on Mesh.me",
      timestamp: post.createdAt,
      href: `/feed/${post.id}`,
    })),
    ...platformPosts.slice(0, 6).map((post) => ({
      id: `platform-post-${post.id}`,
      type: "Synced",
      title: safeExcerpt(post.title, post.content),
      detail: `${post.connectedAccount.platform} content imported`,
      timestamp: post.createdAt,
      href: post.url || "/connected-accounts",
    })),
    ...recentCommentsWritten.map((comment) => ({
      id: `comment-${comment.id}`,
      type: "Comment",
      title: safeExcerpt(comment.content),
      detail: `On ${comment.post.author.displayName}'s post`,
      timestamp: comment.createdAt,
      href: `/feed/${comment.post.id}`,
    })),
    ...recentReactionsMade.map((reaction) => ({
      id: `reaction-${reaction.id}`,
      type: "Reaction",
      title: safeExcerpt(reaction.post.content),
      detail: `${reaction.type} on ${reaction.post.author.displayName}'s post`,
      timestamp: reaction.createdAt,
      href: `/feed/${reaction.post.id}`,
    })),
    ...recentFollowers.map((follow) => ({
      id: `follower-${follow.id}`,
      type: "Follower",
      title: `${follow.follower.displayName} followed you`,
      detail: `@${follow.follower.username}`,
      timestamp: follow.createdAt,
      href: `/profile/${follow.follower.username}`,
    })),
    ...recentSyncJobs.map((job) => ({
      id: `sync-${job.id}`,
      type: "Sync",
      title: `${job.connectedAccount.platform} ${job.syncType} sync ${job.status}`,
      detail: `${job.itemsSynced.toLocaleString()} items synced`,
      timestamp: job.completedAt || job.createdAt,
      href: "/connected-accounts",
    })),
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 12);

  const visibilityBreakdown = [...nativePosts, ...platformPosts].reduce(
    (acc, item) => {
      const key = item.visibility in acc ? item.visibility : "other";
      acc[key as keyof typeof acc] += 1;
      return acc;
    },
    { public: 0, friends: 0, private: 0, unlisted: 0, hidden: 0, other: 0 },
  );

  const activeAccounts = accounts.filter((account) => account.isActive);
  const syncErrors = accounts.filter((account) => account.syncStatus === "error" || Boolean(account.syncError)).length;
  const privacyChecks = [
    { label: "Email verified", passed: user.emailVerified, detail: "Protects account recovery and security alerts." },
    { label: "Second factor ready", passed: user.phoneVerified || twoFactorCount > 0, detail: "Add phone or 2FA for stronger login protection." },
    { label: "Activity hidden", passed: user.hideActivityStatus, detail: "Keeps your presence private by default." },
    { label: "Read receipts controlled", passed: !user.readReceipts, detail: "Prevents automatic social pressure in messages." },
    { label: "Sensitive content locked", passed: !user.nsfwEnabled || user.adultVerificationStatus === "verified", detail: "NSFW stays off unless verified." },
    { label: "Sessions tidy", passed: sessionCount <= 5, detail: "Review old devices when sessions grow." },
    { label: "Connected apps healthy", passed: syncErrors === 0, detail: "No connected account is reporting sync errors." },
    {
      label: "Mesh visibility reviewed",
      passed: Boolean(meshPrivacy) || !user.isPublic || !user.showInDiscovery,
      detail: "Confirm who can see your Mesh and public profile.",
    },
  ];
  const privacyHealthScore = Math.round((privacyChecks.filter((check) => check.passed).length / privacyChecks.length) * 100);

  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      isMeshPro: user.isMeshPro,
      isPublic: user.isPublic,
      showInDiscovery: user.showInDiscovery,
      hideActivityStatus: user.hideActivityStatus,
      readReceipts: user.readReceipts,
      createdAt: user.createdAt,
    },
    overview: {
      totalContent: nativePostCount + totalPlatformContent,
      nativePosts: nativePostCount,
      importedPosts: totalPlatformContent,
      totalViews: totalPlatformViews,
      totalLikes: (platformTotals._sum.likeCount || 0) + nativeLikesReceived,
      totalComments: (platformTotals._sum.commentCount || 0) + nativeCommentsReceived,
      totalShares: platformTotals._sum.shareCount || 0,
      totalEngagement: totalNativeEngagement + totalPlatformEngagement,
      // fallbackAudience is a follower count — privacyHealthScore (a 0-100
      // percentage) was a copy/paste error that inflated the denominator.
      engagementRate: engagementRate(totalNativeEngagement + totalPlatformEngagement, totalPlatformViews, totalFollowersFromPlatforms + nativeFollowerTotal),
      totalFollowers: totalFollowersFromPlatforms + nativeFollowerTotal,
      connectedAccounts: accounts.length,
      activeAccounts: activeAccounts.length,
      watchTimeSeconds: totalWatchSeconds,
      privacyHealthScore,
    },
    personal: {
      commentsWritten: nativeCommentCount,
      reactionsMade: nativeReactionCount,
      savedPosts: savedPostCount,
      messagesSent: messageCount,
      followers: nativeFollowerTotal,
      following: nativeFollowingTotal,
      communities: communityCount,
      notifications: notificationsCount,
      postsThisWindow: nativePosts.filter((post) => post.createdAt >= windowStart).length,
    },
    creator: {
      totalViews: totalPlatformViews,
      totalLikes: (platformTotals._sum.likeCount || 0) + nativeLikesReceived,
      totalComments: (platformTotals._sum.commentCount || 0) + nativeCommentsReceived,
      totalShares: platformTotals._sum.shareCount || 0,
      totalFollowers: totalFollowersFromPlatforms,
      watchTimeSeconds: totalWatchSeconds,
      averageEngagementRate: engagementRate(totalNativeEngagement + totalPlatformEngagement, totalPlatformViews, totalFollowersFromPlatforms),
      bestPlatform: platformComparison
        .slice()
        .sort((a, b) => b.totalViews + b.totalLikes * 8 + b.totalComments * 12 - (a.totalViews + a.totalLikes * 8 + a.totalComments * 12))[0] || null,
    },
    charts: {
      engagement: engagementSeries,
      followerGrowth: followerGrowthSeries,
      content: contentSeries,
      activity: activitySeries,
    },
    platformComparison,
    audienceOverlap,
    bestContent,
    recentActivity,
    privacy: {
      score: privacyHealthScore,
      checks: privacyChecks,
      visibilityBreakdown,
      visibilityPolicies,
      sessions: sessionCount,
      twoFactorMethods: twoFactorCount,
    },
    accounts: accounts.map((account) => ({
      id: account.id,
      platform: account.platform,
      platformUsername: account.platformUsername,
      isActive: account.isActive,
      scopes: account.scopes,
      _count: account._count,
    })),
  };
}

export type AnalyticsDashboardData = NonNullable<Awaited<ReturnType<typeof getAnalyticsDashboardData>>>;
