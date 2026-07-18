import { prisma } from "@/lib/prisma";
import {
  getConnectedAccountsDashboard,
  type ConnectedAccountView,
} from "@/lib/connected-accounts";

export type MergePillarKey = "connected" | "identity" | "content" | "unified";

const MERGE_PILLARS: { key: MergePillarKey; label: string }[] = [
  { key: "connected", label: "Connected" },
  { key: "identity", label: "Identity" },
  { key: "content", label: "Content" },
  { key: "unified", label: "Unified" },
];

export type OneAccountAccountView = ConnectedAccountView & {
  persona: { id: string; username: string; displayName: string } | null;
  pillars: Record<MergePillarKey, boolean>;
  mergeScore: number;
  nextStep:
    | { kind: "reconnect"; label: string }
    | { kind: "resume"; label: string }
    | { kind: "sync"; label: string }
    | { kind: "fold"; label: string }
    | null;
};

type OneAccountPersonaView = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  accountCount: number;
};

type OneAccountMergeRequestView = {
  id: string;
  secondaryEmail: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
};

export type OneAccountOverview = {
  identity: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    accentColor: string;
    hasBio: boolean;
    interestCount: number;
    linkCount: number;
  };
  accounts: OneAccountAccountView[];
  personas: OneAccountPersonaView[];
  mergeRequests: OneAccountMergeRequestView[];
  summary: {
    totalAccounts: number;
    fullyMerged: number;
    overallPercent: number;
    contentItems: number;
    platforms: number;
  };
};

function buildPillars(
  account: ConnectedAccountView,
  personaByAccountId: Map<string, string>,
): Record<MergePillarKey, boolean> {
  const contentItems =
    account.counts.posts + account.counts.comments + account.counts.followers + account.counts.media;

  return {
    connected: account.isActive && account.health !== "needs_reconnect",
    identity: Boolean(account.platformUsername || account.accountLabel),
    // Manual references cannot import content, so the pillar is about what the
    // connection can honestly do: for OAuth accounts it means a completed sync.
    content: account.authType === "manual" ? true : Boolean(account.lastSyncAt) || contentItems > 0,
    unified: !personaByAccountId.has(account.id),
  };
}

function buildNextStep(
  account: ConnectedAccountView,
  pillars: Record<MergePillarKey, boolean>,
): OneAccountAccountView["nextStep"] {
  if (account.health === "needs_reconnect") {
    return { kind: "reconnect", label: "Reconnect to keep this account merged" };
  }
  if (!account.isActive) {
    return { kind: "resume", label: "Resume this connection to merge it" };
  }
  if (!pillars.content) {
    return { kind: "sync", label: "Sync to bring this content into your mesh" };
  }
  if (!pillars.unified) {
    return { kind: "fold", label: "Fold into your main identity" };
  }
  return null;
}

export async function getOneAccountOverview(userId: string): Promise<OneAccountOverview> {
  const [dashboard, identity, accountPersonaRows, personas, mergeRequests] = await Promise.all([
    getConnectedAccountsDashboard(userId),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        username: true,
        displayName: true,
        avatarUrl: true,
        accentColor: true,
        bio: true,
        _count: { select: { interests: true, links: true } },
      },
    }),
    prisma.connectedAccount.findMany({
      where: { userId, alterEgoId: { not: null } },
      select: { id: true, alterEgoId: true },
    }),
    prisma.alterEgo.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        _count: { select: { connectedAccounts: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.accountMergeRequest.findMany({
      where: { primaryUserId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        secondaryEmail: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
    }),
  ]);

  const personaById = new Map(personas.map((persona) => [persona.id, persona]));
  const personaByAccountId = new Map<string, string>();
  for (const row of accountPersonaRows) {
    if (row.alterEgoId) personaByAccountId.set(row.id, row.alterEgoId);
  }

  const accounts = dashboard.accounts.map((account) => {
    const pillars = buildPillars(account, personaByAccountId);
    const personaId = personaByAccountId.get(account.id);
    const persona = personaId ? personaById.get(personaId) : undefined;

    return {
      ...account,
      persona: persona
        ? { id: persona.id, username: persona.username, displayName: persona.displayName }
        : null,
      pillars,
      mergeScore: MERGE_PILLARS.filter(({ key }) => pillars[key]).length,
      nextStep: buildNextStep(account, pillars),
    } satisfies OneAccountAccountView;
  });

  const fullyMerged = accounts.filter((account) => account.mergeScore === MERGE_PILLARS.length).length;
  const contentItems = accounts.reduce(
    (total, account) =>
      total + account.counts.posts + account.counts.comments + account.counts.followers + account.counts.media,
    0,
  );
  const overallPercent =
    accounts.length === 0
      ? 0
      : Math.round(
          (accounts.reduce((total, account) => total + account.mergeScore, 0) /
            (accounts.length * MERGE_PILLARS.length)) *
            100,
        );

  return {
    identity: {
      username: identity.username,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      accentColor: identity.accentColor,
      hasBio: Boolean(identity.bio),
      interestCount: identity._count.interests,
      linkCount: identity._count.links,
    },
    accounts,
    personas: personas.map((persona) => ({
      id: persona.id,
      username: persona.username,
      displayName: persona.displayName,
      avatarUrl: persona.avatarUrl,
      accountCount: persona._count.connectedAccounts,
    })),
    mergeRequests: mergeRequests.map((request) => ({
      id: request.id,
      secondaryEmail: request.secondaryEmail,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      completedAt: request.completedAt ? request.completedAt.toISOString() : null,
    })),
    summary: {
      totalAccounts: accounts.length,
      fullyMerged,
      overallPercent,
      contentItems,
      platforms: new Set(accounts.map((account) => account.platform)).size,
    },
  };
}
