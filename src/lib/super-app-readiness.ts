import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PLATFORM_CAPABILITIES } from "@/lib/platform-capabilities";

type ReadinessDomain = {
  key: string;
  label: string;
  score: number;
  description: string;
  target: string;
};

type MigrationTask = {
  id: string;
  label: string;
  completed: boolean;
  href: string;
};

type ReplacementJob = {
  id: string;
  label: string;
  category: string;
  status: "ready" | "foundation" | "permission-dependent";
  coverage: string;
  description: string;
  href: string;
};

export type SuperAppReadinessReport = {
  overallScore: number;
  domains: ReadinessDomain[];
  replacementJobs: ReplacementJob[];
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
async function getSuperAppReadinessReport(userId: string): Promise<SuperAppReadinessReport> {
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
    prisma.twoFactorMethod.count({ where: { userId, isEnabled: true } }),
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

  const replacementJobs: ReplacementJob[] = [
    {
      id: "feed-browsing",
      label: "Feed browsing",
      category: "Social feeds",
      status: "ready",
      coverage: "Native Feed",
      description: "Browse native Mesh posts and connected content in one familiar surface.",
      href: "/feed",
    },
    {
      id: "video-discovery",
      label: "Video discovery",
      category: "Video and creator platforms",
      status: "foundation",
      coverage: importCapablePlatforms > 0 ? "Embeds + imports" : "Embeds + Vault",
      description: "Surface video links, saved references, imported records, and source-labeled media.",
      href: "/content-hub",
    },
    {
      id: "messaging",
      label: "Messaging",
      category: "Messaging and calling",
      status: "ready",
      coverage: "MeChat",
      description: "Direct conversations, source-aware shared posts, and private thread history.",
      href: "/messages",
    },
    {
      id: "group-chats",
      label: "Group chats",
      category: "Messaging and calling",
      status: "foundation",
      coverage: "MeChat rooms",
      description: "Shared rooms and participants establish the group communication layer.",
      href: "/messages",
    },
    {
      id: "shared-scrolling",
      label: "Shared scrolling",
      category: "Shared social activity",
      status: "ready",
      coverage: "Group rooms",
      description: "Group browsing sessions let people vote, add items, and interact as themselves.",
      href: "/messages",
    },
    {
      id: "communities",
      label: "Communities",
      category: "Communities and forums",
      status: "ready",
      coverage: "Mesh communities",
      description: "Create, join, and post inside topic and group spaces without leaving Mesh.me.",
      href: "/communities",
    },
    {
      id: "creator-analytics",
      label: "Creator analytics",
      category: "Creator dashboards",
      status: "ready",
      coverage: "Analytics",
      description: "View content, platform, privacy, and growth signals in one control center.",
      href: "/analytics",
    },
    {
      id: "notifications",
      label: "Notifications",
      category: "Notification hubs",
      status: "ready",
      coverage: "Unified hub",
      description: "Centralize alerts and mark them read from one calmer notification surface.",
      href: "/notifications",
    },
    {
      id: "profiles",
      label: "Profiles",
      category: "Digital identity",
      status: "ready",
      coverage: "Meshi identity",
      description: "Mesh.me profiles combine Meshi, bio, links, visibility, and connected platforms.",
      href: "/profile",
    },
    {
      id: "native-posting",
      label: "Native posting",
      category: "Publishing",
      status: "ready",
      coverage: "Mesh posts",
      description: "Post directly to Mesh.me and build an account-owned content base.",
      href: "/feed",
    },
    {
      id: "cross-platform-sharing",
      label: "Cross-platform sharing",
      category: "Publishing",
      status: crossPostCapablePlatforms > 0 ? "permission-dependent" : "foundation",
      coverage: "API-gated",
      description: "Cross-posting and writeback stay bounded by provider APIs and user consent.",
      href: "/content-hub",
    },
    {
      id: "privacy-controls",
      label: "Privacy controls",
      category: "Trust",
      status: "ready",
      coverage: "Settings",
      description: "Visibility, data export, connected account review, and deletion paths are exposed.",
      href: "/settings",
    },
    {
      id: "saved-content",
      label: "Saved content",
      category: "Vault",
      status: "foundation",
      coverage: "Mesh Vault",
      description: "Keep important memories, links, posts, and creator references in a private archive.",
      href: "/vault",
    },
    {
      id: "voice-and-video",
      label: "Voice and video calls",
      category: "Messaging and calling",
      status: "foundation",
      coverage: "Meshi Voice + rooms",
      description: "Voice interaction and room-based shared browsing provide the calling foundation.",
      href: "/meshi-voice",
    },
    {
      id: "creator-monetization",
      label: "Creator monetization",
      category: "Marketplace",
      status: "foundation",
      coverage: "Mesh Pro + Marketplace",
      description: "Subscriptions, creator packs, themes, and accessories support a no-ads model.",
      href: "/marketplace",
    },
    {
      id: "identity-management",
      label: "Digital identity management",
      category: "Digital identity",
      status: "ready",
      coverage: "Profile + Meshi",
      description: "Meshi, profile controls, connected accounts, and visibility form one identity layer.",
      href: "/profile",
    },
    {
      id: "account-syncing",
      label: "Connected account display",
      category: "Connected hub",
      status: "ready",
      coverage: `${PLATFORM_CAPABILITIES.length} providers`,
      description: "Users can connect supported platforms or add manual public sources with revocable access.",
      href: "/connected-accounts",
    },
    {
      id: "source-credit",
      label: "Source credit",
      category: "Connected hub",
      status: "ready",
      coverage: "Origin labels",
      description: "Imported and embedded content keeps platform and creator context visible.",
      href: "/content-hub",
    },
    {
      id: "data-export-delete",
      label: "Data export and deletion",
      category: "Trust",
      status: "ready",
      coverage: "Data controls",
      description: "Export personal records or delete synced data from the privacy control center.",
      href: "/settings",
    },
    {
      id: "replacement-planning",
      label: "App migration planning",
      category: "Super app",
      status: "ready",
      coverage: "Top apps",
      description: "Generate a personalized plan for replacing daily social and communication apps.",
      href: "/super-app",
    },
  ];

  const recommendedActions = buildRecommendedActions(domains, migrationTasks);

  return {
    overallScore,
    domains,
    replacementJobs,
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
