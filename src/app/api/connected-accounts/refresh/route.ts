import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";
import { isPlatformOAuth, usesLongLivedTokenExchange } from "@/lib/oauth";
import { refreshConnectedAccountToken } from "@/lib/oauth-token-refresh";

const REFRESH_WINDOW_MS = 120_000;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
  ));
  const results = await Promise.all(refreshable.map((account) => refreshConnectedAccountToken(account.id)));

  return NextResponse.json({
    refreshed: results.filter((result) => result === "refreshed").length,
  });
}
