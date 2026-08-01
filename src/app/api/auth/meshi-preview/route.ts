import { NextResponse } from "next/server";
import { getTrustedClientIp } from "@/lib/client-ip";
import { durableRateLimit } from "@/lib/durable-rate-limit";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

const USERNAME_PATTERN = /^[a-z0-9_]{2,24}$/;

const DEFAULT_MESHI = {
  color: "blue",
  hat: "none",
  face: "happy",
  hair: "none",
  accessory: "none",
  eye: "regular",
  badge: "none",
};

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

function normalizeUsername(value: string | null) {
  if (!value) return null;
  const normalized = value.trim().replace(/^@+/, "").toLowerCase();

  if (!USERNAME_PATTERN.test(normalized)) return null;
  return normalized;
}

export async function GET(request: Request) {
  const clientIp = getTrustedClientIp(request.headers);
  // Requests already rejected per-IP must not consume the shared budget.
  //
  // DURABLE, not the in-memory limiter. This endpoint is unauthenticated by
  // design — the entry screen draws your Meshi as you type your username, before
  // there is any session — so its rate limit IS the enumeration budget. The
  // in-memory limiter is a per-process Map that resets on every serverless cold
  // start, which on Vercel means the budget resets far more often than the
  // window it claims to enforce. The sibling entry-flow lookup already uses the
  // cross-instance limiter for exactly this reason.
  const rl = await durableRateLimit(`meshi-preview:ip:${clientIp}`, 60, 15 * 60 * 1000);
  if (!rl.allowed || !rateLimit("meshi-preview:global", 600, 60 * 1000).allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: NO_STORE_HEADERS },
    );
  }

  const url = new URL(request.url);
  const username = normalizeUsername(url.searchParams.get("username"));

  if (!username) {
    return NextResponse.json({ found: false }, { headers: NO_STORE_HEADERS });
  }

  // NO displayName. This endpoint answers anyone, with no session, for any
  // username they can guess — and the entry screen rendered what it returned as
  // "You're {displayName}. What's your password?", so guessing a username handed
  // an anonymous visitor a real name. Every other user lookup in the product
  // requires a session and filters on isPublic / showInDiscovery / discovery
  // consent; this one is deliberately outside that, so what it returns has to be
  // the minimum the screen needs to draw a Meshi and nothing more.
  //
  // The greeting now uses the username the visitor typed, which they already
  // know, so nothing is lost.
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      username: true,
      isSuspended: true,
      meshiPreference: {
        select: {
          colorTheme: true,
          hatStyle: true,
          faceStyle: true,
          hairStyle: true,
          accessoryStyle: true,
          eyeStyle: true,
          badgeStyle: true,
        },
      },
    },
  });

  if (!user || user.isSuspended) {
    return NextResponse.json({ found: false }, { headers: NO_STORE_HEADERS });
  }

  const preference = user.meshiPreference;

  return NextResponse.json(
    {
      found: true,
      username: user.username,
      meshi: {
        color: preference?.colorTheme ?? DEFAULT_MESHI.color,
        hat: preference?.hatStyle ?? DEFAULT_MESHI.hat,
        face: preference?.faceStyle ?? DEFAULT_MESHI.face,
        hair: preference?.hairStyle ?? DEFAULT_MESHI.hair,
        accessory: preference?.accessoryStyle ?? DEFAULT_MESHI.accessory,
        eye: preference?.eyeStyle ?? DEFAULT_MESHI.eye,
        badge: preference?.badgeStyle ?? DEFAULT_MESHI.badge,
      },
    },
    { headers: NO_STORE_HEADERS },
  );
}
