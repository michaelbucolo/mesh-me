import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PLATFORM_CAPABILITIES } from "@/lib/platform-capabilities";

export type ReadinessDomain = {
  key: string;
  label: string;
  score: number;
  description: string;
  target: string;
};

export type MigrationTask = {
  id: string;
  label: string;
  completed: boolean;
  href: string;
};

export type SuperAppReadinessReport = {
  overallScore: number;
  domains: ReadinessDomain[];
  migrationTasks: MigrationTask[];
  recommendedActions: string[];
  metrics: {
    connectedAccounts: number;
    activeConnections: number;
    conversationThreads: number;
    messagesSent: number;
    postsCreated: number;
    importedRecords: number;
  };
};



export async function getCachedSuperAppReadinessReport(userId: string): Promise<SuperAppReadinessReport> {
  const load = unstable_cache(
    () => getSuperAppReadinessReport(userId),
    ["super-app-readiness", userId],
    {
      revalidate: 30,
      tags: [`super-app-readiness:${userId}`],
    },
  );

  return load();
}
export async function getSuperAppReadinessReport(userId: string): Promise<SuperAppReadinessReport> {
  const [
    connectedAccounts,
    activeConnections,
    conversationThreads,
    messagesSent,
    postsCreated,
    importedPosts,
    importedComments,
    importedFollowers,
    twoFactorMethods,
    user,
  ] = await Promise.all([
    prisma.connectedAccount.count({ where: { userId } }),
    prisma.connectedAccount.count({ where: { userId, isActive: true } }),
    prisma.threadMember.count({ where: { userId } }),
    prisma.message.count({ where: { senderId: userId } }),
    prisma.post.count({ where: { authorId: userId } }),
    prisma.platformPost.count({ where: { connectedAccount: { userId } } }),
    prisma.platformComment.count({ where: { connectedAccount: { userId } } }),
    prisma.platformFollower.count({ where: { connectedAccount: { userId } } }),
    prisma.twoFactorMethod.count({ where: { userId, enabled: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        emailVerified: true,
        phoneVerified: true,
      },
    }),
  ]);

  const importedRecords = importedPosts + importedComments + importedFollowers;

  const messageCapablePlatforms = PLATFORM_CAPABILITIES.filter((capability) => capability.messageSync).length;
  const crossPostCapablePlatforms = PLATFORM_CAPABILITIES.filter((capability) => capability.crossPost).length;
  const notificationCapablePlatforms = PLATFORM_CAPABILITIES.filter((capability) => capability.notificationSync).length;
  const importCapablePlatforms = PLATFORM_CAPABILITIES.filter((capability) => capability.importContent).length;

  const messagingScore = normalizeScore(
    (conversationThreads >= 3 ? 45 : conversationThreads * 15) +
      (messagesSent >= 40 ? 35 : Math.floor(messagesSent * 0.875)) +
      (messageCapablePlatforms > 0 ? 20 : 0),
  );

  const socialScore = normalizeScore(
    (postsCreated >= 10 ? 40 : postsCreated * 4) +
      (importedRecords >= 200 ? 30 : Math.floor(importedRecords * 0.15)) +
      (crossPostCapablePlatforms > 0 ? 15 : 0) +
      (importCapablePlatforms >= 3 ? 15 : importCapablePlatforms * 5),
  );

  const trustScore = normalizeScore(
    (twoFactorMethods > 0 ? 40 : 0) +
      (user?.emailVerified ? 25 : 0) +
      (user?.phoneVerified ? 20 : 0) +
      (activeConnections >= 2 ? 15 : activeConnections * 7),
  );

  const migrationScore = normalizeScore(
    (connectedAccounts >= 3 ? 40 : connectedAccounts * 12) +
      (importedRecords >= 100 ? 35 : Math.floor(importedRecords * 0.35)) +
      (notificationCapablePlatforms > 0 ? 10 : 0) +
      (postsCreated > 0 && conversationThreads > 0 ? 15 : 0),
  );

  const domains: ReadinessDomain[] = [
    {
      key: "messaging",
      label: "Messaging replacement",
      score: messagingScore,
      description: "Thread quality, message volume, and platform messaging coverage.",
      target: "90+ before replacing chat-first apps.",
    },
    {
      key: "social",
      label: "Social publishing replacement",
      score: socialScore,
      description: "Creation consistency, source imports, and cross-post surface area.",
      target: "85+ before replacing social-first apps.",
    },
    {
      key: "trust",
      label: "Trust and account resilience",
      score: trustScore,
      description: "2FA, verification, and secure account baseline.",
      target: "95+ for high-confidence daily usage.",
    },
    {
      key: "migration",
      label: "Migration confidence",
      score: migrationScore,
      description: "How ready this account is to uninstall parallel apps.",
      target: "90+ before full app deletion guidance.",
    },
  ];

  const overallScore = Math.round(domains.reduce((sum, domain) => sum + domain.score, 0) / domains.length);

  const migrationTasks: MigrationTask[] = [
    {
      id: "verify-account",
      label: "Enable at least one two-factor method",
      completed: twoFactorMethods > 0,
      href: "/settings?tab=security",
    },
    {
      id: "verify-contact",
      label: "Verify email or phone",
      completed: Boolean(user?.emailVerified || user?.phoneVerified),
      href: "/settings?tab=security-hub",
    },
    {
      id: "connect-platforms",
      label: "Connect 3+ social platforms",
      completed: connectedAccounts >= 3,
      href: "/connected-accounts",
    },
    {
      id: "seed-feed",
      label: "Create at least one native Mesh post",
      completed: postsCreated > 0,
      href: "/feed",
    },
    {
      id: "seed-mechat",
      label: "Start and use at least one MeChat conversation",
      completed: conversationThreads > 0 && messagesSent > 0,
      href: "/messages",
    },
  ];

  const recommendedActions = buildRecommendedActions(domains, migrationTasks);

  return {
    overallScore,
    domains,
    migrationTasks,
    recommendedActions,
    metrics: {
      connectedAccounts,
      activeConnections,
      conversationThreads,
      messagesSent,
      postsCreated,
      importedRecords,
    },
  };
}

function normalizeScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}


function buildRecommendedActions(domains: ReadinessDomain[], migrationTasks: MigrationTask[]): string[] {
  const weakestDomains = [...domains].sort((a, b) => a.score - b.score).slice(0, 2);
  const openTasks = migrationTasks.filter((task) => !task.completed).slice(0, 3);

  const domainActions = weakestDomains.map((domain) => `Raise ${domain.label.toLowerCase()} toward ${domain.target}`);
  const taskActions = openTasks.map((task) => `Complete: ${task.label}`);

  return [...domainActions, ...taskActions].slice(0, 5);
}
