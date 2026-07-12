import { prisma } from "@/lib/prisma";
import {
  OAUTH_CONFIGS,
  buildTokenRequest,
  exchangeLongLivedToken,
  getOAuthClientId,
  getOAuthClientSecret,
  isPlatformOAuth,
} from "@/lib/oauth";
import { encryptSecret, decryptSecret } from "@/lib/secret-store";

export type RefreshResult = "refreshed" | "needs_reconnect" | "not_applicable";

function expiresAtFromResponse(value: unknown): Date | null {
  const expiresIn = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number(value)
      : NaN;
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) return null;
  return new Date(Date.now() + expiresIn * 1000);
}

async function markNeedsReconnect(accountId: string) {
  await prisma.connectedAccount.update({
    where: { id: accountId },
    data: { expiresAt: new Date(0), syncStatus: "idle", syncError: null },
  }).catch(() => {});
}

export async function refreshConnectedAccountToken(accountId: string): Promise<RefreshResult> {
  try {
    const account = await prisma.connectedAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        platform: true,
        accessToken: true,
        refreshToken: true,
      },
    });

    if (!account || !isPlatformOAuth(account.platform)) {
      return "not_applicable";
    }

    const config = OAUTH_CONFIGS[account.platform];

    // Meta platforms issue long-lived tokens instead of refresh tokens;
    // extend them by re-running the long-lived token exchange.
    if (!account.refreshToken && config.longLivedTokenExchange) {
      const accessToken = decryptSecret(account.accessToken);
      if (!accessToken) {
        await markNeedsReconnect(account.id);
        return "needs_reconnect";
      }
      const longLived = await exchangeLongLivedToken(config, accessToken);
      if (!longLived) {
        await markNeedsReconnect(account.id);
        return "needs_reconnect";
      }
      await prisma.connectedAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encryptSecret(longLived.accessToken),
          expiresAt: longLived.expiresAt,
          isActive: true,
          syncStatus: "idle",
          syncError: null,
        },
      });
      return "refreshed";
    }

    if (!account.refreshToken) {
      return "not_applicable";
    }

    const refreshToken = decryptSecret(account.refreshToken);
    if (!refreshToken || !getOAuthClientId(config) || !getOAuthClientSecret(config)) {
      await markNeedsReconnect(account.id);
      return "needs_reconnect";
    }

    const { headers, body } = buildTokenRequest(config, {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    if (config.extraTokenParams) {
      for (const [key, value] of Object.entries(config.extraTokenParams)) {
        body.set(key, value);
      }
    }
    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers,
      body,
    });
    if (!response.ok) {
      await markNeedsReconnect(account.id);
      return "needs_reconnect";
    }

    const tokenData = await response.json().catch(() => null) as {
      access_token?: unknown;
      refresh_token?: unknown;
      expires_in?: unknown;
    } | null;
    const accessToken = typeof tokenData?.access_token === "string" ? tokenData.access_token : "";
    if (!accessToken) {
      await markNeedsReconnect(account.id);
      return "needs_reconnect";
    }

    const responseRefreshToken = tokenData?.refresh_token;
    const nextRefreshToken = typeof responseRefreshToken === "string" && responseRefreshToken
      ? encryptSecret(responseRefreshToken)
      : undefined;

    await prisma.connectedAccount.update({
      where: { id: account.id },
      data: {
        accessToken: encryptSecret(accessToken),
        ...(nextRefreshToken ? { refreshToken: nextRefreshToken } : {}),
        expiresAt: expiresAtFromResponse(tokenData?.expires_in),
        isActive: true,
        syncStatus: "idle",
        syncError: null,
      },
    });

    return "refreshed";
  } catch {
    await markNeedsReconnect(accountId);
    return "needs_reconnect";
  }
}
