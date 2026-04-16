import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const accounts = await prisma.connectedAccount.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      platform: true,
      platformUsername: true,
      isActive: true,
      createdAt: true,
      syncStatus: true,
      syncError: true,
      lastSyncAt: true,
      alterEgoId: true,
      accountLabel: true,
      _count: {
        select: {
          platformPosts: true,
          platformComments: true,
          platformFollowers: true,
          platformMedia: true,
        },
      },
    },
  });

  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rl = rateLimit(`connect-manual:${user.id}`, 10, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many connection attempts. Please try again later." }, { status: 429 });
  }

  const { platform, username, alterEgoId, accountLabel } = await request.json();

  if (!platform) {
    return NextResponse.json({ error: "Platform is required" }, { status: 400 });
  }

  const VALID_PLATFORMS = [
    "instagram", "youtube", "tiktok", "twitter", "twitch", "spotify",
    "soundcloud", "linkedin", "github", "discord", "snapchat",
    "pinterest", "reddit", "facebook", "threads", "bluesky",
  ];

  if (!VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  // Only manual-link platforms can be connected via this endpoint;
  // OAuth platforms must go through /api/auth/[platform]/callback
  const MANUAL_PLATFORMS = ["soundcloud", "bluesky", "threads"];
  if (!MANUAL_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "This platform must be connected via OAuth" }, { status: 400 });
  }
  const trimmedUsername = typeof username === "string" ? username.trim() : "";
  if (!trimmedUsername) {
    return NextResponse.json({ error: "Username is required for this platform" }, { status: 400 });
  }

  const trimmedAccountLabel = typeof accountLabel === "string" ? accountLabel.trim() : "";

  // Validate alter ego belongs to this user if provided
  if (alterEgoId) {
    const alterEgo = await prisma.alterEgo.findFirst({
      where: { id: alterEgoId, userId: user.id, isActive: true },
    });
    if (!alterEgo) {
      return NextResponse.json({ error: "Alter ego not found" }, { status: 400 });
    }
  }

  // Check if this exact username is already connected on this platform
  const existing = await prisma.connectedAccount.findFirst({
    where: { userId: user.id, platform, platformUsername: trimmedUsername },
  });

  if (existing) {
    return NextResponse.json({ error: "This account is already connected" }, { status: 400 });
  }

  // Create the connection with optional alter ego association
  const account = await prisma.connectedAccount.create({
    data: {
      userId: user.id,
      platform,
      platformUsername: trimmedUsername,
      isActive: true,
      alterEgoId: alterEgoId || null,
      accountLabel: trimmedAccountLabel || null,
    },
    select: {
      id: true,
      platform: true,
      platformUsername: true,
      isActive: true,
      alterEgoId: true,
      accountLabel: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ account });
}
