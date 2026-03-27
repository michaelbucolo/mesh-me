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

  const { platform } = await request.json();

  if (!platform) {
    return NextResponse.json({ error: "Platform is required" }, { status: 400 });
  }

  // Check if already connected
  const existing = await prisma.connectedAccount.findUnique({
    where: { userId_platform: { userId: user.id, platform } },
  });

  if (existing) {
    return NextResponse.json({ error: "Platform already connected" }, { status: 400 });
  }

  // In production, this would initiate OAuth flow
  // For now, create a placeholder connection
  const account = await prisma.connectedAccount.create({
    data: {
      userId: user.id,
      platform,
      platformUsername: user.username,
      isActive: true,
    },
  });

  return NextResponse.json({ account });
}
