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

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

function cleanOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
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

  if ((action === "start" || action === "end") && session.hostId !== user.id) {
    return NextResponse.json({ error: "Only the host can change room status" }, { status: 403 });
  }

  if (action === "start" || action === "end") {
    const updated = await prisma.meChatSession.update({
      where: { id: sessionId },
      data: { status: action === "start" ? "live" : "ended" },
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

    return NextResponse.json({ item }, { status: 201 });
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
