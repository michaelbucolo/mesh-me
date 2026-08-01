import { prisma } from "@/lib/prisma";
import { normalizeScopes } from "@/lib/platform-permissions";
import {
  getDefaultPermissionKeysForPlatform,
  getPermissionDefinition,
  getSupportedPlatformAdapter,
  getSupportedPlatformAdapters,
  type PlatformPermissionDefinition,
  type SupportedPlatformAdapter,
} from "@/lib/platform-adapters";
import {
  getDisplayNameForAnyPlatform,
  getPlatformCapability,
  type PlatformCapability,
} from "@/lib/platform-capabilities";

type ConnectedPermissionView = PlatformPermissionDefinition & {
  state: "granted" | "revoked" | "pending";
  source: string;
  grantedAt: string | null;
  revokedAt: string | null;
};

export type ConnectedAccountView = {
  id: string;
  platform: string;
  platformName: string;
  platformUsername: string | null;
  platformId: string | null;
  accountLabel: string | null;
  authType: "oauth" | "manual";
  isActive: boolean;
  syncStatus: string;
  syncError: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  hasCredential: boolean;
  hasRefreshToken: boolean;
  health: "ready" | "paused" | "needs_reconnect" | "sync_error" | "manual" | "retired";
  healthLabel: string;
  counts: {
    posts: number;
    comments: number;
    followers: number;
    media: number;
  };
  _count: {
    platformPosts: number;
    platformComments: number;
    platformFollowers: number;
    platformMedia: number;
  };
  capability: PlatformCapability | null;
  adapter: SupportedPlatformAdapter | null;
  permissions: ConnectedPermissionView[];
};

export type SupportedPlatformView = SupportedPlatformAdapter & {
  connectedCount: number;
  activeCount: number;
};

export type ConnectedAccountsDashboard = {
  accounts: ConnectedAccountView[];
  supportedPlatforms: SupportedPlatformView[];
  summary: {
    connected: number;
    active: number;
    oauthReady: number;
    manualAvailable: number;
    syncErrors: number;
  };
};

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function getAccountHealth(account: {
  isActive: boolean;
  syncStatus: string;
  syncError: string | null;
  accessToken: string | null;
  expiresAt: Date | null;
}, adapter: SupportedPlatformAdapter | null): ConnectedAccountView["health"] {
  // A platform mesh.me no longer offers has no adapter, which means nothing
  // will ever sync it again. It was still reporting "Ready" — the health check
  // only asked whether a token existed, and a retired platform's token is as
  // present as any other. So the page told someone a dead connection was live,
  // and counted it in "N of N syncing". Retired is checked FIRST because it
  // outranks every other state: paused, expired or erroring is a description of
  // a connection that could still work.
  if (!adapter) return "retired";
  if (!account.isActive) return "paused";
  if (account.syncStatus === "error" || account.syncError) return "sync_error";
  if (adapter.authType === "manual") return "manual";
  if (!account.accessToken) return "needs_reconnect";
  if (account.expiresAt && account.expiresAt.getTime() < Date.now()) return "needs_reconnect";
  return "ready";
}

function getHealthLabel(health: ConnectedAccountView["health"]) {
  switch (health) {
    case "manual":
      return "Manual reference";
    case "needs_reconnect":
      return "Reconnect needed";
    case "paused":
      return "Paused";
    case "sync_error":
      return "Needs review";
    case "retired":
      return "No longer supported";
    case "ready":
    default:
      return "Ready";
  }
}

function fallbackPermission(platform: string, key: string): PlatformPermissionDefinition {
  const known = getPermissionDefinition(platform, key);
  if (known) return known;

  return {
    key,
    label: key
      .replace(/^https:\/\/www\.googleapis\.com\/auth\//, "")
      .replace(/[._:/[\]-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (value) => value.toUpperCase()) || "Permission",
    description: "Granted by the connected platform for this account.",
    mode: "oauth_scope",
    required: true,
  };
}

function buildPermissionViews(account: {
  platform: string;
  scopes: string | null;
  isActive: boolean;
  platformPermissions: {
    permissionKey: string;
    permissionState: string;
    source: string;
    grantedAt: Date;
    revokedAt: Date | null;
  }[];
}) {
  const dbPermissions = account.platformPermissions.map((permission) => {
    const definition = fallbackPermission(account.platform, permission.permissionKey);
    return {
      ...definition,
      state: permission.permissionState === "revoked" ? "revoked" : "granted",
      source: permission.source,
      grantedAt: toIso(permission.grantedAt),
      revokedAt: toIso(permission.revokedAt),
    } satisfies ConnectedPermissionView;
  });

  if (dbPermissions.length > 0) return dbPermissions;

  const scopePermissions = normalizeScopes(account.scopes).map((scope) => {
    const definition = fallbackPermission(account.platform, scope);
    return {
      ...definition,
      state: account.isActive ? "granted" : "revoked",
      source: "oauth_scope",
      grantedAt: null,
      revokedAt: account.isActive ? null : new Date().toISOString(),
    } satisfies ConnectedPermissionView;
  });

  if (scopePermissions.length > 0) return scopePermissions;

  return getDefaultPermissionKeysForPlatform(account.platform).map((key) => {
    const definition = fallbackPermission(account.platform, key);
    return {
      ...definition,
      state: account.isActive ? "granted" : "revoked",
      source: definition.mode,
      grantedAt: null,
      revokedAt: null,
    } satisfies ConnectedPermissionView;
  });
}

export async function getConnectedAccountsDashboard(userId: string): Promise<ConnectedAccountsDashboard> {
  const [accounts, supportedPlatforms] = await Promise.all([
    prisma.connectedAccount.findMany({
      where: { userId },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        platform: true,
        platformUsername: true,
        platformId: true,
        accountLabel: true,
        accessToken: true,
        refreshToken: true,
        expiresAt: true,
        isActive: true,
        syncStatus: true,
        syncError: true,
        lastSyncAt: true,
        scopes: true,
        createdAt: true,
        platformPermissions: {
          orderBy: [{ permissionState: "asc" }, { permissionKey: "asc" }],
          select: {
            permissionKey: true,
            permissionState: true,
            source: true,
            grantedAt: true,
            revokedAt: true,
          },
        },
      },
    }),
    Promise.resolve(getSupportedPlatformAdapters()),
  ]);

  const accountIds = accounts.map((account) => account.id);
  const [postCounts, commentCounts, followerCounts, mediaCounts] = await Promise.all([
    prisma.platformPost.groupBy({
      by: ["connectedAccountId"],
      where: { connectedAccountId: { in: accountIds } },
      _count: { _all: true },
    }),
    prisma.platformComment.groupBy({
      by: ["connectedAccountId"],
      where: { connectedAccountId: { in: accountIds } },
      _count: { _all: true },
    }),
    prisma.platformFollower.groupBy({
      by: ["connectedAccountId"],
      // "Followers" must not count "following" rows (accounts the user follows,
      // stored in the same table) — otherwise the stat is followers + following.
      where: { connectedAccountId: { in: accountIds }, relationshipType: { not: "following" } },
      _count: { _all: true },
    }),
    prisma.platformMedia.groupBy({
      by: ["connectedAccountId"],
      where: { connectedAccountId: { in: accountIds } },
      _count: { _all: true },
    }),
  ]);

  const countsByAccount = new Map(
    accountIds.map((id) => [id, { platformPosts: 0, platformComments: 0, platformFollowers: 0, platformMedia: 0 }]),
  );
  for (const row of postCounts) countsByAccount.get(row.connectedAccountId)!.platformPosts = row._count._all;
  for (const row of commentCounts) countsByAccount.get(row.connectedAccountId)!.platformComments = row._count._all;
  for (const row of followerCounts) countsByAccount.get(row.connectedAccountId)!.platformFollowers = row._count._all;
  for (const row of mediaCounts) countsByAccount.get(row.connectedAccountId)!.platformMedia = row._count._all;

  const connectedCounts = new Map<string, { connected: number; active: number }>();
  for (const account of accounts) {
    const current = connectedCounts.get(account.platform) ?? { connected: 0, active: 0 };
    current.connected += 1;
    if (account.isActive) current.active += 1;
    connectedCounts.set(account.platform, current);
  }

  const accountViews = accounts.map((account) => {
    const adapter = getSupportedPlatformAdapter(account.platform);
    const health = getAccountHealth(account, adapter);
    const counts = countsByAccount.get(account.id) ?? {
      platformPosts: 0,
      platformComments: 0,
      platformFollowers: 0,
      platformMedia: 0,
    };

    return {
      id: account.id,
      platform: account.platform,
      // Never the bare storage key: a retired platform still has a name, and
      // "spotify" in a card that says Spotify everywhere else reads as a bug.
      platformName: adapter?.name ?? getDisplayNameForAnyPlatform(account.platform),
      platformUsername: account.platformUsername,
      platformId: account.platformId,
      accountLabel: account.accountLabel,
      authType: adapter?.authType ?? "manual",
      isActive: account.isActive,
      syncStatus: account.syncStatus,
      syncError: account.syncError,
      lastSyncAt: toIso(account.lastSyncAt),
      createdAt: account.createdAt.toISOString(),
      expiresAt: toIso(account.expiresAt),
      hasCredential: Boolean(account.accessToken),
      hasRefreshToken: Boolean(account.refreshToken),
      health,
      healthLabel: getHealthLabel(health),
      counts: {
        posts: counts.platformPosts,
        comments: counts.platformComments,
        followers: counts.platformFollowers,
        media: counts.platformMedia,
      },
      _count: counts,
      capability: getPlatformCapability(account.platform),
      adapter,
      permissions: buildPermissionViews(account),
    } satisfies ConnectedAccountView;
  });

  const supportedViews = supportedPlatforms.map((adapter) => {
    const counts = connectedCounts.get(adapter.id) ?? { connected: 0, active: 0 };
    return {
      ...adapter,
      connectedCount: counts.connected,
      activeCount: counts.active,
    } satisfies SupportedPlatformView;
  });

  return {
    accounts: accountViews,
    supportedPlatforms: supportedViews,
    summary: {
      connected: accountViews.length,
      // "N of M syncing" must not count a connection nothing syncs. A retired
      // platform's row still has isActive = true — it was true the day the
      // platform left and no migration touched it — so counting isActive alone
      // reported a dead account as one of the live ones.
      active: accountViews.filter((account) => account.isActive && account.health !== "retired").length,
      oauthReady: supportedViews.filter((platform) => platform.authType === "oauth" && platform.configured).length,
      manualAvailable: supportedViews.filter((platform) => platform.authType === "manual").length,
      syncErrors: accountViews.filter((account) => account.health === "sync_error").length,
    },
  };
}
