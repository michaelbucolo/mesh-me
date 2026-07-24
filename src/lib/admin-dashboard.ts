"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const OAUTH_SECRET_KEYS = [
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_OAUTH_CLIENT_SECRET",
  "DISCORD_CLIENT_SECRET",
  "SPOTIFY_CLIENT_SECRET",
  "TWITTER_CLIENT_SECRET",
  "TWITCH_CLIENT_SECRET",
  "FACEBOOK_APP_SECRET",
  "LINKEDIN_CLIENT_SECRET",
  "REDDIT_CLIENT_SECRET",
  "TIKTOK_CLIENT_SECRET",
  "PINTEREST_APP_SECRET",
  "SNAPCHAT_CLIENT_SECRET",
  "THREADS_CLIENT_SECRET",
  "SOUNDCLOUD_CLIENT_SECRET",
  "PATREON_CLIENT_SECRET",
  "DRIBBBLE_CLIENT_SECRET",
] as const;

type CheckStatus = "pass" | "warn" | "fail";
type AlertSeverity = "low" | "medium" | "high";

function configuredEnvCount(keys: readonly string[]) {
  return keys.filter((key) => Boolean(process.env[key])).length;
}

function check(status: CheckStatus, label: string, description: string) {
  return { status, label, description };
}

function alert(severity: AlertSeverity, title: string, description: string, href = "/admin") {
  return { severity, title, description, href };
}

export async function getAdminDashboard() {
  const admin = await getCurrentUser();
  if (!admin?.isAdmin) return null;

  const now = new Date();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    userCount,
    postCount,
    communityCount,
    pendingReportCount,
    totalReportCount,
    recentSignups,
    recentPostCount,
    suspendedUserCount,
    adminUserCount,
    verifiedUserCount,
    activeSessionCount,
    expiredSessionCount,
    connectedAccountCount,
    erroredConnectedAccountCount,
    publicCommunityCount,
    privateCommunityCount,
    unreadSecurityNotificationCount,
    recentUsers,
    recentReports,
    communities,
    adminLogs,
    recentSecurityLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.community.count(),
    prisma.report.count({ where: { status: "pending" } }),
    prisma.report.count(),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.post.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { isSuspended: true } }),
    prisma.user.count({ where: { isAdmin: true } }),
    prisma.user.count({ where: { isVerified: true } }),
    prisma.session.count({ where: { expiresAt: { gt: now } } }),
    prisma.session.count({ where: { expiresAt: { lte: now } } }),
    prisma.connectedAccount.count({ where: { isActive: true } }),
    prisma.connectedAccount.count({
      where: {
        isActive: true,
        OR: [
          { syncStatus: "error" },
          { syncStatus: "rate_limited" },
          { syncError: { not: null } },
        ],
      },
    }),
    prisma.community.count({ where: { isPublic: true } }),
    prisma.community.count({ where: { isPublic: false } }),
    prisma.notification.count({
      where: {
        read: false,
        // Match the authoritative notification `type` only — matching `message`
        // let a user-controlled display name (e.g. "Security Alert liked your
        // post") inflate this admin metric with unrelated, non-security events.
        type: { contains: "security" },
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        isAdmin: true,
        isSuspended: true,
        isVerified: true,
        createdAt: true,
        _count: { select: { posts: true, followers: true, communityMemberships: true } },
      },
    }),
    prisma.report.findMany({
      where: { status: "pending" },
      include: {
        reporter: { select: { username: true, displayName: true, avatarUrl: true } },
        reportedUser: { select: { id: true, username: true, displayName: true, isSuspended: true } },
        reportedPost: { select: { id: true, content: true, createdAt: true } },
        reportedComment: { select: { id: true, content: true, createdAt: true } },
        reportedCommunity: { select: { id: true, name: true, slug: true, isPublic: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.community.findMany({
      include: {
        _count: { select: { members: true, posts: true, reports: true } },
        members: {
          where: { role: "admin" },
          include: {
            user: { select: { username: true, displayName: true, avatarUrl: true } },
          },
          take: 3,
        },
      },
      orderBy: [
        { updatedAt: "desc" },
        { members: { _count: "desc" } },
      ],
      take: 24,
    }),
    prisma.adminLog.findMany({
      where: { action: { not: "feedback" } },
      include: { admin: { select: { username: true, displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.adminLog.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        OR: [
          { action: { contains: "suspend" } },
          { action: { contains: "delete" } },
          { action: { contains: "report" } },
          { action: { contains: "community" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const oauthConfiguredCount = configuredEnvCount(OAUTH_SECRET_KEYS);
  const stripeConfigured = Boolean(
    process.env.STRIPE_SECRET_KEY &&
      (process.env.STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) &&
      process.env.STRIPE_WEBHOOK_SECRET
  );
  const emailConfigured = Boolean(process.env.RESEND_API_KEY && (process.env.RESEND_FROM_EMAIL || process.env.PASSWORD_RESET_FROM_EMAIL));
  const adultVerificationConfigured = Boolean(
    process.env.ADULT_VERIFICATION_PROVIDER_URL && process.env.ADULT_VERIFICATION_WEBHOOK_SECRET
  );
  const appUrlConfigured = Boolean(process.env.NEXT_PUBLIC_APP_URL);

  const launchChecks = [
    check("pass", "Admin route gated", "Only users with isAdmin can open this panel."),
    check(adminUserCount > 0 ? "pass" : "fail", "Admin account exists", `${adminUserCount} admin account${adminUserCount === 1 ? "" : "s"} found.`),
    check(pendingReportCount === 0 ? "pass" : pendingReportCount > 10 ? "fail" : "warn", "Moderation queue", `${pendingReportCount} report${pendingReportCount === 1 ? "" : "s"} pending.`),
    check(stripeConfigured ? "pass" : "warn", "Mesh Pro payments", stripeConfigured ? "Stripe keys and webhook secret are configured." : "Stripe payment environment is incomplete."),
    check(emailConfigured ? "pass" : "warn", "Account email", emailConfigured ? "Transactional email is configured." : "Password reset and verification email need provider env keys."),
    check(appUrlConfigured ? "pass" : "warn", "Public app URL", appUrlConfigured ? "NEXT_PUBLIC_APP_URL is set." : "NEXT_PUBLIC_APP_URL should be set before launch."),
    check(oauthConfiguredCount > 0 ? "pass" : "warn", "Connected account OAuth", `${oauthConfiguredCount} social OAuth secret${oauthConfiguredCount === 1 ? "" : "s"} configured.`),
    check(adultVerificationConfigured ? "pass" : "warn", "Adult verification", adultVerificationConfigured ? "NSFW verification provider is configured." : "NSFW stays off until verification provider keys are configured."),
    check(expiredSessionCount === 0 ? "pass" : "warn", "Expired sessions", `${expiredSessionCount} expired session${expiredSessionCount === 1 ? "" : "s"} should be cleaned up.`),
    check(erroredConnectedAccountCount === 0 ? "pass" : "warn", "Sync health", `${erroredConnectedAccountCount} connected account${erroredConnectedAccountCount === 1 ? "" : "s"} need attention.`),
  ];

  const securityAlerts = [
    ...(pendingReportCount > 0
      ? [alert(pendingReportCount > 10 ? "high" : "medium", "Reports need review", `${pendingReportCount} pending report${pendingReportCount === 1 ? "" : "s"} are waiting in moderation.`, "#moderation")]
      : []),
    ...(unreadSecurityNotificationCount > 0
      ? [alert("high", "Unread security alerts", `${unreadSecurityNotificationCount} security notification${unreadSecurityNotificationCount === 1 ? "" : "s"} are unread.`, "/notifications")]
      : []),
    ...(erroredConnectedAccountCount > 0
      ? [alert("medium", "Connected account sync errors", `${erroredConnectedAccountCount} linked account${erroredConnectedAccountCount === 1 ? "" : "s"} have sync errors or rate limits.`, "/connected-accounts")]
      : []),
    ...(expiredSessionCount > 0
      ? [alert("low", "Expired sessions remain", `${expiredSessionCount} expired session${expiredSessionCount === 1 ? "" : "s"} can be cleaned from storage.`, "#security")]
      : []),
    ...(!stripeConfigured
      ? [alert("medium", "Stripe launch setup incomplete", "Mesh Pro payments should not be public until Stripe keys and webhooks are configured.", "#launch")]
      : []),
    ...(!adultVerificationConfigured
      ? [alert("medium", "Adult verification inactive", "NSFW content is off by default; configure verification before enabling it.", "#launch")]
      : []),
  ];

  return {
    admin: {
      id: admin.id,
      username: admin.username,
      displayName: admin.displayName,
    },
    counts: {
      users: userCount,
      posts: postCount,
      communities: communityCount,
      pendingReports: pendingReportCount,
      totalReports: totalReportCount,
      recentSignups,
      recentPosts: recentPostCount,
      suspendedUsers: suspendedUserCount,
      adminUsers: adminUserCount,
      verifiedUsers: verifiedUserCount,
      activeSessions: activeSessionCount,
      expiredSessions: expiredSessionCount,
      connectedAccounts: connectedAccountCount,
      erroredConnectedAccounts: erroredConnectedAccountCount,
      publicCommunities: publicCommunityCount,
      privateCommunities: privateCommunityCount,
      securityNotifications: unreadSecurityNotificationCount,
    },
    recentUsers,
    recentReports,
    communities,
    adminLogs,
    recentSecurityLogs,
    launchChecks,
    securityAlerts,
  };
}
