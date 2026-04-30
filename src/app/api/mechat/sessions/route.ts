import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";

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

function cleanCallMode(value: unknown) {
  return value === "voice" || value === "video" ? value : "none";
}

function cleanParticipantIds(value: unknown, currentUserId: string) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item && item !== currentUserId),
    ),
  ).slice(0, 24);
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
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const title = cleanText(body.title, "Shared browsing room", 80);
  const sessionType = cleanText(body.sessionType, "co_browse", 32);
  const callMode = cleanCallMode(body.callMode);
  const rawItems = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
  const participantIds = cleanParticipantIds(body.participantIds, user.id);

  const participants = participantIds.length
    ? await prisma.user.findMany({
        where: {
          id: { in: participantIds },
          isSuspended: false,
          isPublic: true,
          showInDiscovery: true,
        },
        select: { id: true, displayName: true },
      })
    : [];

  if (participants.length !== participantIds.length) {
    return NextResponse.json({ error: "One or more invited people could not be added." }, { status: 400 });
  }

  if (participantIds.length > 0) {
    const blockExists = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: { in: participantIds } },
          { blockerId: { in: participantIds }, blockedId: user.id },
        ],
      },
      select: { id: true },
    });
    if (blockExists) {
      return NextResponse.json({ error: "One or more invited people cannot join this room." }, { status: 403 });
    }
  }

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.meChatSession.create({
      data: {
        hostId: user.id,
        title,
        status: callMode === "none" ? "draft" : "live",
        sessionType,
        callMode,
        callStatus: callMode === "none" ? "idle" : "live",
        callStartedAt: callMode === "none" ? null : new Date(),
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

    if (participantIds.length > 0) {
      await tx.meChatSessionParticipant.createMany({
        data: participantIds.map((participantId) => ({
          sessionId: created.id,
          userId: participantId,
          role: "participant",
          lastSeenAt: null,
        })),
      });

      await tx.notification.createMany({
        data: participantIds.map((participantId) => ({
          type: "mechat_session",
          recipientId: participantId,
          actorId: user.id,
          message: `${user.displayName} invited you to ${title}`,
        })),
      });
    }

    let firstItemId: string | null = null;
    for (const [index, item] of rawItems.entries()) {
      if (!item || typeof item !== "object") continue;
      const createdItem = await tx.meChatSessionItem.create({
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
      firstItemId ??= createdItem.id;
    }

    if (firstItemId) {
      await tx.meChatSession.update({
        where: { id: created.id },
        data: { currentItemId: firstItemId },
      });
    }

    return tx.meChatSession.findUnique({
      where: { id: created.id },
      include: SESSION_INCLUDE,
    });
  });

  return NextResponse.json({ session }, { status: 201 });
}
