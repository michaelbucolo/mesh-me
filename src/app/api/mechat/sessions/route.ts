import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SESSION_INCLUDE = {
  participants: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" as const },
  },
  items: {
    include: {
      votes: true,
    },
    orderBy: { position: "asc" as const },
  },
};

function cleanText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function cleanOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sessions = await prisma.meChatSession.findMany({
    where: {
      OR: [
        { hostId: user.id },
        { participants: { some: { userId: user.id } } },
      ],
    },
    include: SESSION_INCLUDE,
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const title = cleanText(body.title, "Shared browsing room", 80);
  const rawItems = Array.isArray(body.items) ? body.items.slice(0, 20) : [];

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.meChatSession.create({
      data: {
        hostId: user.id,
        title,
        status: "draft",
      },
    });

    await tx.meChatSessionParticipant.create({
      data: {
        sessionId: created.id,
        userId: user.id,
        role: "host",
        lastSeenAt: new Date(),
      },
    });

    for (const [index, item] of rawItems.entries()) {
      if (!item || typeof item !== "object") continue;
      await tx.meChatSessionItem.create({
        data: {
          sessionId: created.id,
          addedById: user.id,
          sourcePlatform: cleanText((item as Record<string, unknown>).sourcePlatform, "mesh", 32),
          sourceUrl: cleanOptionalText((item as Record<string, unknown>).sourceUrl, 500),
          title: cleanOptionalText((item as Record<string, unknown>).title, 120),
          content: cleanOptionalText((item as Record<string, unknown>).content, 1000),
          postId: cleanOptionalText((item as Record<string, unknown>).postId, 80),
          platformPostId: cleanOptionalText((item as Record<string, unknown>).platformPostId, 120),
          position: index,
        },
      });
    }

    return tx.meChatSession.findUnique({
      where: { id: created.id },
      include: SESSION_INCLUDE,
    });
  });

  return NextResponse.json({ session }, { status: 201 });
}
