import { NextResponse } from "next/server";
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
  outfit: "none",
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
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientIp = forwardedFor || request.headers.get("x-real-ip") || "unknown";
  const rl = rateLimit(`meshi-preview:${clientIp}`, 30, 60 * 1000);
  if (!rl.allowed) {
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

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      username: true,
      displayName: true,
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
          outfitStyle: true,
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
      displayName: user.displayName,
      meshi: {
        color: preference?.colorTheme ?? DEFAULT_MESHI.color,
        hat: preference?.hatStyle ?? DEFAULT_MESHI.hat,
        face: preference?.faceStyle ?? DEFAULT_MESHI.face,
        hair: preference?.hairStyle ?? DEFAULT_MESHI.hair,
        accessory: preference?.accessoryStyle ?? DEFAULT_MESHI.accessory,
        eye: preference?.eyeStyle ?? DEFAULT_MESHI.eye,
        badge: preference?.badgeStyle ?? DEFAULT_MESHI.badge,
        outfit: preference?.outfitStyle ?? DEFAULT_MESHI.outfit,
      },
    },
    { headers: NO_STORE_HEADERS },
  );
}
