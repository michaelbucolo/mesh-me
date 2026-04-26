import type { SuperAppReadinessReport } from "@/lib/super-app-readiness";

export type LegacyAppKey =
  | "wechat"
  | "messenger"
  | "imessage"
  | "instagram"
  | "x"
  | "tiktok"
  | "discord"
  | "snapchat";

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
  wechat: {
    label: "WeChat",
    replacementArea: "Messaging + social hub",
    scoreDomain: "messaging",
    readinessGate: 90,
    blockerHints: ["Cross-platform messaging consistency", "Group reliability and media sharing parity"],
    nextSteps: ["Use MeChat daily for active threads", "Complete migration checklist security milestones"],
  },
  messenger: {
    label: "Messenger",
    replacementArea: "Messaging",
    scoreDomain: "messaging",
    readinessGate: 90,
    blockerHints: ["Thread continuity", "Notification reliability"],
    nextSteps: ["Increase weekly message activity in MeChat", "Verify push alerts and read receipts"],
  },
  imessage: {
    label: "iMessage",
    replacementArea: "Messaging",
    scoreDomain: "messaging",
    readinessGate: 92,
    blockerHints: ["High trust and delivery confidence", "Media and attachment parity"],
    nextSteps: ["Enable 2FA and verification", "Use Mesh.me as default for active conversations"],
  },
  instagram: {
    label: "Instagram",
    replacementArea: "Social publishing",
    scoreDomain: "social",
    readinessGate: 85,
    blockerHints: ["Posting cadence", "Source import + discovery depth"],
    nextSteps: ["Publish natively in Feed", "Connect additional creator/social sources"],
  },
  x: {
    label: "X / Twitter",
    replacementArea: "Social publishing",
    scoreDomain: "social",
    readinessGate: 85,
    blockerHints: ["Cross-post consistency", "Conversation + replies volume"],
    nextSteps: ["Increase native posting frequency", "Connect X and validate sync/writeback"],
  },
  tiktok: {
    label: "TikTok",
    replacementArea: "Media-first social",
    scoreDomain: "social",
    readinessGate: 88,
    blockerHints: ["Media pipeline and discovery habits", "Creator workflow migration"],
    nextSteps: ["Post media content in Mesh feed", "Track engagement from imported records"],
  },
  discord: {
    label: "Discord",
    replacementArea: "Community + messaging",
    scoreDomain: "migration",
    readinessGate: 90,
    blockerHints: ["Group coordination workflow", "Community room activity"],
    nextSteps: ["Use Communities + MeChat rooms for recurring groups", "Complete all migration tasks"],
  },
  snapchat: {
    label: "Snapchat",
    replacementArea: "Messaging + ephemeral social",
    scoreDomain: "messaging",
    readinessGate: 88,
    blockerHints: ["Fast media send and response loops", "Notification freshness"],
    nextSteps: ["Use MeChat for frequent media threads", "Confirm replacement score above migration gate"],
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
