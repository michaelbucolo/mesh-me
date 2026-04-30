import type { SuperAppReadinessReport } from "@/lib/super-app-readiness";

export type LegacyAppKey =
  | "youtube"
  | "instagram"
  | "tiktok"
  | "x"
  | "threads"
  | "facebook"
  | "discord"
  | "messenger"
  | "whatsapp"
  | "telegram"
  | "signal"
  | "snapchat"
  | "twitch"
  | "reddit"
  | "pinterest"
  | "bluesky"
  | "wechat"
  | "line"
  | "kakaotalk"
  | "viber"
  | "zalo"
  | "facetime";

export type AppMigrationPlan = {
  app: LegacyAppKey;
  label: string;
  replacementArea: string;
  readinessGate: number;
  currentScore: number;
  readyToReplace: boolean;
  blockers: string[];
  nextSteps: string[];
};

const APP_MIGRATION_CONFIG: Record<
  LegacyAppKey,
  {
    label: string;
    replacementArea: string;
    scoreDomain: "messaging" | "social" | "migration";
    readinessGate: number;
    blockerHints: string[];
    nextSteps: string[];
  }
> = {
  youtube: {
    label: "YouTube",
    replacementArea: "Video discovery + creator dashboard",
    scoreDomain: "social",
    readinessGate: 88,
    blockerHints: ["Video import coverage", "Creator analytics depth", "Watch and save workflow parity"],
    nextSteps: ["Connect YouTube when available", "Save creator references into Vault", "Track video engagement in Analytics"],
  },
  instagram: {
    label: "Instagram",
    replacementArea: "Visual identity + social publishing",
    scoreDomain: "social",
    readinessGate: 85,
    blockerHints: ["Posting cadence", "Source import + discovery depth"],
    nextSteps: ["Publish natively in Feed", "Connect additional creator/social sources", "Use Meshi/profile customization for identity"],
  },
  tiktok: {
    label: "TikTok",
    replacementArea: "Short-form video + discovery",
    scoreDomain: "social",
    readinessGate: 88,
    blockerHints: ["Media pipeline and discovery habits", "Creator workflow migration"],
    nextSteps: ["Post media content in Mesh feed", "Track engagement from imported records", "Use shared scrolling rooms for group viewing"],
  },
  x: {
    label: "X / Twitter",
    replacementArea: "Public conversation",
    scoreDomain: "social",
    readinessGate: 85,
    blockerHints: ["Cross-post consistency", "Conversation + replies volume"],
    nextSteps: ["Increase native posting frequency", "Connect X and validate sync/writeback", "Use Search for people and posts"],
  },
  threads: {
    label: "Threads",
    replacementArea: "Public conversation",
    scoreDomain: "social",
    readinessGate: 84,
    blockerHints: ["Conversation import depth", "Threaded reply parity"],
    nextSteps: ["Use Mesh posts for text updates", "Route shared posts into MeChat", "Review source labels before cross-posting"],
  },
  facebook: {
    label: "Facebook",
    replacementArea: "Family updates + groups",
    scoreDomain: "migration",
    readinessGate: 86,
    blockerHints: ["Family/community adoption", "Group posting flow", "Classic layout comfort"],
    nextSteps: ["Create a family community", "Use Feed as the familiar default", "Move recurring group updates into Spaces"],
  },
  discord: {
    label: "Discord",
    replacementArea: "Community + messaging",
    scoreDomain: "migration",
    readinessGate: 90,
    blockerHints: ["Group coordination workflow", "Community room activity"],
    nextSteps: ["Use Communities + MeChat rooms for recurring groups", "Complete all migration tasks", "Start shared scrolling sessions for group activity"],
  },
  messenger: {
    label: "Messenger",
    replacementArea: "Messaging",
    scoreDomain: "messaging",
    readinessGate: 90,
    blockerHints: ["Thread continuity", "Notification reliability"],
    nextSteps: ["Increase weekly message activity in MeChat", "Verify push alerts and read receipts", "Create direct threads for key contacts"],
  },
  whatsapp: {
    label: "WhatsApp",
    replacementArea: "Private messaging + groups",
    scoreDomain: "messaging",
    readinessGate: 92,
    blockerHints: ["High-volume thread continuity", "Group reliability", "End-to-end trust expectations"],
    nextSteps: ["Enable account security milestones", "Use MeChat for active groups", "Confirm notification delivery before migration"],
  },
  telegram: {
    label: "Telegram",
    replacementArea: "Messaging + broadcast communities",
    scoreDomain: "messaging",
    readinessGate: 88,
    blockerHints: ["Channel/broadcast parity", "Large group handling"],
    nextSteps: ["Create a Mesh community", "Use MeChat rooms for shared content", "Export important references into Vault"],
  },
  signal: {
    label: "Signal",
    replacementArea: "Privacy-first messaging",
    scoreDomain: "messaging",
    readinessGate: 95,
    blockerHints: ["E2EE trust bar", "Device/session hardening", "Sensitive contact migration"],
    nextSteps: ["Enable 2FA", "Review sessions in Settings", "Use MeChat only for contacts who accept the trust model"],
  },
  snapchat: {
    label: "Snapchat",
    replacementArea: "Messaging + ephemeral social",
    scoreDomain: "messaging",
    readinessGate: 88,
    blockerHints: ["Fast media send and response loops", "Notification freshness"],
    nextSteps: ["Use MeChat for frequent media threads", "Confirm replacement score above migration gate", "Save important moments into Vault"],
  },
  twitch: {
    label: "Twitch",
    replacementArea: "Live creator interaction",
    scoreDomain: "social",
    readinessGate: 86,
    blockerHints: ["Live-event alerts", "Creator community workflow", "Stream analytics"],
    nextSteps: ["Connect creator sources", "Use Notifications for live alerts", "Move creator community discussion into Mesh communities"],
  },
  reddit: {
    label: "Reddit",
    replacementArea: "Topic communities + discussion",
    scoreDomain: "migration",
    readinessGate: 84,
    blockerHints: ["Topic community density", "Threaded discussion depth"],
    nextSteps: ["Join or create topic communities", "Use Search for public discussion", "Save high-value references to Vault"],
  },
  pinterest: {
    label: "Pinterest",
    replacementArea: "Saved inspiration + visual discovery",
    scoreDomain: "social",
    readinessGate: 80,
    blockerHints: ["Visual save workflow", "Board-style organization"],
    nextSteps: ["Save links and visuals into Vault", "Use Mesh branches for collections", "Connect visual platforms where supported"],
  },
  bluesky: {
    label: "Bluesky",
    replacementArea: "Open social conversation",
    scoreDomain: "social",
    readinessGate: 82,
    blockerHints: ["Conversation import coverage", "Federated identity mapping"],
    nextSteps: ["Add Bluesky as a manual connected account", "Use Mesh posts for public updates", "Route links into Feed and MeChat"],
  },
  wechat: {
    label: "WeChat",
    replacementArea: "Messaging + social hub",
    scoreDomain: "messaging",
    readinessGate: 90,
    blockerHints: ["Cross-platform messaging consistency", "Group reliability and media sharing parity"],
    nextSteps: ["Use MeChat daily for active threads", "Complete migration checklist security milestones"],
  },
  line: {
    label: "Line",
    replacementArea: "Messaging + regional communities",
    scoreDomain: "messaging",
    readinessGate: 88,
    blockerHints: ["Regional contact migration", "Sticker/media parity"],
    nextSteps: ["Use MeChat for frequent contacts", "Confirm notifications", "Save important shared links into Vault"],
  },
  kakaotalk: {
    label: "KakaoTalk",
    replacementArea: "Messaging + groups",
    scoreDomain: "messaging",
    readinessGate: 88,
    blockerHints: ["Regional contact migration", "Group continuity"],
    nextSteps: ["Move core groups into MeChat", "Enable account protection", "Use shared rooms for media browsing"],
  },
  viber: {
    label: "Viber",
    replacementArea: "Messaging + calling",
    scoreDomain: "messaging",
    readinessGate: 86,
    blockerHints: ["Call replacement confidence", "Thread continuity"],
    nextSteps: ["Use MeChat for primary groups", "Check notification reliability", "Use profile controls for visibility"],
  },
  zalo: {
    label: "Zalo",
    replacementArea: "Messaging + regional social",
    scoreDomain: "messaging",
    readinessGate: 86,
    blockerHints: ["Regional contacts", "Message reliability"],
    nextSteps: ["Create direct MeChat threads", "Confirm security setup", "Keep original source labels on shared content"],
  },
  facetime: {
    label: "FaceTime-style calling",
    replacementArea: "Calls + shared browsing",
    scoreDomain: "messaging",
    readinessGate: 90,
    blockerHints: ["Voice/video reliability", "Shared browsing adoption"],
    nextSteps: ["Use shared scrolling rooms for co-browsing", "Move group viewing into MeChat", "Verify devices and sessions"],
  },
};

export function getSupportedLegacyApps(): Array<{ key: LegacyAppKey; label: string }> {
  return Object.entries(APP_MIGRATION_CONFIG).map(([key, value]) => ({ key: key as LegacyAppKey, label: value.label }));
}

export function buildAppMigrationPlan(
  selectedApps: LegacyAppKey[],
  report: SuperAppReadinessReport,
): AppMigrationPlan[] {
  const domainScores = new Map(report.domains.map((domain) => [domain.key, domain.score]));
  const incompleteTasks = report.migrationTasks.filter((task) => !task.completed).map((task) => task.label);

  return selectedApps.map((app) => {
    const config = APP_MIGRATION_CONFIG[app];
    const currentScore = domainScores.get(config.scoreDomain) ?? 0;
    const readyToReplace = currentScore >= config.readinessGate;

    return {
      app,
      label: config.label,
      replacementArea: config.replacementArea,
      readinessGate: config.readinessGate,
      currentScore,
      readyToReplace,
      blockers: readyToReplace ? [] : [...config.blockerHints, ...incompleteTasks.slice(0, 2)],
      nextSteps: config.nextSteps,
    };
  });
}
