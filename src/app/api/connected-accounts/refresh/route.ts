import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";
import { isPlatformOAuth, usesLongLivedTokenExchange } from "@/lib/oauth";
import { refreshConnectedAccountToken } from "@/lib/oauth-token-refresh";
import { rateLimit } from "@/lib/security";

const REFRESH_WINDOW_MS = 120_000;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Each call fans out to outbound OAuth token endpoints; throttle so it can't be
  // looped into an amplification vector against the providers.
  if (!rateLimit(`refresh-tokens:${user.id}`, 12, 60_000).allowed) {
    return NextResponse.json({ error: "Too many refresh attempts. Please try again shortly." }, { status: 429 });
  }

  const threshold = new Date(Date.now() + REFRESH_WINDOW_MS);
  const accounts = await prisma.connectedAccount.findMany({
    where: {
      userId: user.id,
      isActive: true,
    },
    select: {
      id: true,
      platform: true,
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
    },
  });

  const refreshable = accounts.filter((account) => (
    isPlatformOAuth(account.platform)
    && (account.refreshToken !== null || usesLongLivedTokenExchange(account.platform))
    && (!account.accessToken || (account.expiresAt !== null && account.expiresAt <= threshold))
    // Skip accounts already marked needs-reconnect (expiresAt pinned to epoch by
    // a prior failed refresh) — re-firing them just repeats a doomed outbound
    // request on every call until the user reconnects.
    && !(account.expiresAt !== null && account.expiresAt.getTime() === 0)
  ));
  const results = await Promise.all(refreshable.map((account) => refreshConnectedAccountToken(account.id)));

  return NextResponse.json({
    refreshed: results.filter((result) => result === "refreshed").length,
  });
}
