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
import { getPlatformCapability, type PlatformCapability } from "@/lib/platform-capabilities";

export type ConnectedPermissionView = PlatformPermissionDefinition & {
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
  health: "ready" | "paused" | "needs_reconnect" | "sync_error" | "manual";
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
  if (!account.isActive) return "paused";
  if (account.syncStatus === "error" || account.syncError) return "sync_error";
  if (adapter?.authType === "manual") return "manual";
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
        _count: {
          select: {
            platformPosts: true,
            platformComments: true,
            platformFollowers: true,
            platformMedia: true,
          },
        },
      },
    }),
    Promise.resolve(getSupportedPlatformAdapters()),
  ]);

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

    return {
      id: account.id,
      platform: account.platform,
      platformName: adapter?.name ?? account.platform,
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
        posts: account._count.platformPosts,
        comments: account._count.platformComments,
        followers: account._count.platformFollowers,
        media: account._count.platformMedia,
      },
      _count: account._count,
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
      active: accountViews.filter((account) => account.isActive).length,
      oauthReady: supportedViews.filter((platform) => platform.authType === "oauth" && platform.configured).length,
      manualAvailable: supportedViews.filter((platform) => platform.authType === "manual").length,
      syncErrors: accountViews.filter((account) => account.health === "sync_error").length,
    },
  };
}
