import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    },
  });

  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { platform, username } = await request.json();

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

  // Manual-link platforms require a username
  const MANUAL_PLATFORMS = ["soundcloud", "bluesky", "threads"];
  if (MANUAL_PLATFORMS.includes(platform) && !username) {
    return NextResponse.json({ error: "Username is required for this platform" }, { status: 400 });
  }

  // Check if already connected
  const existing = await prisma.connectedAccount.findUnique({
    where: { userId_platform: { userId: user.id, platform } },
  });

  if (existing) {
    return NextResponse.json({ error: "Platform already connected" }, { status: 400 });
  }

  // Create the connection with the provided or default username
  const account = await prisma.connectedAccount.create({
    data: {
      userId: user.id,
      platform,
      platformUsername: username || user.username,
      isActive: true,
    },
  });

  return NextResponse.json({ account });
}
