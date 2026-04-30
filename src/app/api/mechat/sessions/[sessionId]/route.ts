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

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

function cleanOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function cleanText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function cleanCallMode(value: unknown) {
  return value === "voice" || value === "video" ? value : "voice";
}

async function getSessionForUser(sessionId: string, userId: string) {
  return prisma.meChatSession.findFirst({
    where: {
      id: sessionId,
      OR: [
        { hostId: userId },
        { participants: { some: { userId } } },
      ],
    },
    include: SESSION_INCLUDE,
  });
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const session = await getSessionForUser(sessionId, user.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ session });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";

  const session = await getSessionForUser(sessionId, user.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (
    (action === "start" ||
      action === "end" ||
      action === "end-call" ||
      action === "invite" ||
      action === "remove-participant" ||
      action === "rename" ||
      action === "set-current-item") &&
    session.hostId !== user.id
  ) {
    return NextResponse.json({ error: "Only the host can change room status" }, { status: 403 });
  }

  if (action === "start" || action === "end") {
    const updated = await prisma.meChatSession.update({
      where: { id: sessionId },
      data: action === "start"
        ? { status: "live" }
        : {
            status: "ended",
            callStatus: session.callStatus === "live" ? "ended" : session.callStatus,
            callEndedAt: session.callStatus === "live" ? new Date() : session.callEndedAt,
          },
      include: SESSION_INCLUDE,
    });
    return NextResponse.json({ session: updated });
  }

  if (action === "start-call") {
    const callMode = cleanCallMode(body.callMode);
    const updated = await prisma.meChatSession.update({
      where: { id: sessionId },
      data: {
        status: "live",
        callMode,
        callStatus: "live",
        callStartedAt: new Date(),
        callEndedAt: null,
      },
      include: SESSION_INCLUDE,
    });
    return NextResponse.json({ session: updated });
  }

  if (action === "end-call") {
    const updated = await prisma.meChatSession.update({
      where: { id: sessionId },
      data: {
        callStatus: "ended",
        callEndedAt: new Date(),
      },
      include: SESSION_INCLUDE,
    });
    return NextResponse.json({ session: updated });
  }

  if (action === "add-item") {
    const lastItem = await prisma.meChatSessionItem.findFirst({
      where: { sessionId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const item = await prisma.meChatSessionItem.create({
      data: {
        sessionId,
        addedById: user.id,
        sourcePlatform: cleanOptionalText(body.sourcePlatform, 32) || "mesh",
        sourceUrl: cleanOptionalText(body.sourceUrl, 500),
        title: cleanOptionalText(body.title, 120),
        content: cleanOptionalText(body.content, 1000),
        postId: cleanOptionalText(body.postId, 80),
        platformPostId: cleanOptionalText(body.platformPostId, 120),
        position: (lastItem?.position ?? -1) + 1,
      },
      include: { votes: true },
    });

    if (!session.currentItemId) {
      await prisma.meChatSession.update({
        where: { id: sessionId },
        data: { currentItemId: item.id },
      });
    }

    return NextResponse.json({ item }, { status: 201 });
  }

  if (action === "set-current-item") {
    const itemId = cleanOptionalText(body.itemId, 120);
    if (!itemId) {
      return NextResponse.json({ error: "Choose an item to focus." }, { status: 400 });
    }

    const item = await prisma.meChatSessionItem.findFirst({
      where: { id: itemId, sessionId },
      select: { id: true },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const updated = await prisma.meChatSession.update({
      where: { id: sessionId },
      data: { currentItemId: item.id, status: session.status === "draft" ? "live" : session.status },
      include: SESSION_INCLUDE,
    });

    return NextResponse.json({ session: updated });
  }

  if (action === "rename") {
    const title = cleanText(body.title, session.title, 80);
    const updated = await prisma.meChatSession.update({
      where: { id: sessionId },
      data: { title },
      include: SESSION_INCLUDE,
    });

    return NextResponse.json({ session: updated });
  }

  if (action === "mark-seen") {
    await prisma.meChatSessionParticipant.update({
      where: { sessionId_userId: { sessionId, userId: user.id } },
      data: { lastSeenAt: new Date() },
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if (action === "invite") {
    const targetUserId = cleanOptionalText(body.userId, 120);
    if (!targetUserId || targetUserId === user.id) {
      return NextResponse.json({ error: "Choose a valid person to invite." }, { status: 400 });
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        isSuspended: false,
        isPublic: true,
        showInDiscovery: true,
      },
      select: { id: true, displayName: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "That person could not be invited." }, { status: 404 });
    }

    const blockExists = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: targetUser.id },
          { blockerId: targetUser.id, blockedId: user.id },
        ],
      },
      select: { id: true },
    });
    if (blockExists) {
      return NextResponse.json({ error: "That person cannot join this room." }, { status: 403 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.meChatSessionParticipant.upsert({
        where: { sessionId_userId: { sessionId, userId: targetUser.id } },
        create: {
          sessionId,
          userId: targetUser.id,
          role: "participant",
          lastSeenAt: null,
        },
        update: {},
      });

      await tx.notification.create({
        data: {
          type: "mechat_session",
          recipientId: targetUser.id,
          actorId: user.id,
          message: `${user.displayName} invited you to ${session.title}`,
        },
      });

      return tx.meChatSession.findUnique({
        where: { id: sessionId },
        include: SESSION_INCLUDE,
      });
    });

    return NextResponse.json({ session: updated });
  }

  if (action === "remove-participant") {
    const targetUserId = cleanOptionalText(body.userId, 120);
    if (!targetUserId || targetUserId === session.hostId) {
      return NextResponse.json({ error: "The host cannot be removed from their room." }, { status: 400 });
    }

    await prisma.meChatSessionParticipant.delete({
      where: { sessionId_userId: { sessionId, userId: targetUserId } },
    }).catch(() => {});

    const updated = await prisma.meChatSession.findUnique({
      where: { id: sessionId },
      include: SESSION_INCLUDE,
    });

    return NextResponse.json({ session: updated });
  }

  if (action === "vote") {
    const itemId = typeof body.itemId === "string" ? body.itemId : "";
    const vote = body.vote === "keep" ? "keep" : body.vote === "skip" ? "skip" : "";
    if (!itemId || !vote) {
      return NextResponse.json({ error: "A valid itemId and vote are required" }, { status: 400 });
    }

    const item = await prisma.meChatSessionItem.findFirst({
      where: { id: itemId, sessionId },
      select: { id: true },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const savedVote = await prisma.meChatSessionVote.upsert({
      where: { itemId_userId: { itemId, userId: user.id } },
      create: { itemId, userId: user.id, vote },
      update: { vote },
    });

    return NextResponse.json({ vote: savedVote });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
