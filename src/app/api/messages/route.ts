import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildLinkPreview, normalizeAttachments, serializeMeChatMetadata } from "@/lib/mechat-metadata";
import { prisma } from "@/lib/prisma";
import { getMessageThreads } from "@/lib/queries";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";
import { rateLimit, sanitizeForDisplay } from "@/lib/security";

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return sanitizeForDisplay(value).slice(0, maxLength);
}

function cleanMemberIds(value: unknown, currentUserId: string) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item && item !== currentUserId),
    ),
  ).slice(0, 49);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const threads = await getMessageThreads();

  const serializedThreads = threads.map((t) => ({
    id: t.id,
    title: t.displayTitle,
    threadType: t.threadType,
    memberCount: t.memberCount,
    isEncrypted: t.isEncrypted,
    otherUser: t.otherUser || null,
    otherUsers: t.otherUsers || [],
    lastMessage: t.lastMessage
      ? { content: t.lastMessage.content, senderId: t.lastMessage.senderId, createdAt: String(t.lastMessage.createdAt) }
      : null,
    platform: t.sourcePlatform || "mesh",
    unread: t.unreadCount,
  }));

  return NextResponse.json({ threads: serializedThreads, currentUserId: user.id });
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rl = rateLimit(`thread-create:${user.id}`, 12, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Creating chats too quickly. Please slow down." }, { status: 429 });
  }

  const body = await readJsonObject(req);
  const memberIds = cleanMemberIds((body as Record<string, unknown>).memberIds, user.id);
  const title = cleanText((body as Record<string, unknown>).title, 80);
  const openingMessage = cleanText((body as Record<string, unknown>).openingMessage, 2000);
  const openingAttachments = normalizeAttachments((body as Record<string, unknown>).attachments);
  const openingSourceUrl = cleanText((body as Record<string, unknown>).sourceUrl, 500);
  const openingSourcePlatform = cleanText((body as Record<string, unknown>).sourcePlatform, 40) || "mesh";
  const openingMessageType = cleanText((body as Record<string, unknown>).messageType, 40)
    || (openingAttachments.length > 0 ? "media" : openingSourceUrl ? "platform_share" : "text");

  if (memberIds.length === 0) {
    return NextResponse.json({ error: "Choose at least one person." }, { status: 400 });
  }

  // A private profile is not an unreachable one — requiring isPublic +
  // showInDiscovery here meant nobody could DM a private account at all
  // (and with early accounts private by default, nobody could DM anyone).
  // Blocks — checked right below — are the opt-out for unwanted messages.
  const members = await prisma.user.findMany({
    where: {
      id: { in: memberIds },
      isSuspended: false,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  });

  if (members.length !== memberIds.length) {
    return NextResponse.json({ error: "One or more people could not be added." }, { status: 400 });
  }

  const blockExists = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: user.id, blockedId: { in: memberIds } },
        { blockerId: { in: memberIds }, blockedId: user.id },
      ],
    },
    select: { id: true },
  });
  if (blockExists) {
    return NextResponse.json({ error: "One or more people cannot be added to this chat." }, { status: 403 });
  }

  if (memberIds.length === 1) {
    const existing = await prisma.messageThread.findFirst({
      where: {
        threadType: "direct",
        AND: [
          { members: { some: { userId: user.id } } },
          { members: { some: { userId: memberIds[0] } } },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ thread: { id: existing.id, threadType: "direct" } });
    }
  }

  const thread = await prisma.$transaction(async (tx) => {
    const created = await tx.messageThread.create({
      data: {
        title: memberIds.length > 1 ? title || "MeChat group" : null,
        threadType: memberIds.length > 1 ? "group" : "direct",
        sourcePlatform: "mesh",
        isEncrypted: true,
        members: {
          create: [
            { userId: user.id, role: "owner" },
            ...memberIds.map((memberId) => ({ userId: memberId, role: "member" })),
          ],
        },
      },
      select: { id: true, threadType: true },
    });

    if (openingMessage || openingAttachments.length > 0 || openingSourceUrl) {
      await tx.message.create({
        data: {
          threadId: created.id,
          senderId: user.id,
          content: openingMessage || (openingAttachments.length > 0 ? "Shared media" : "Shared link"),
          sourcePlatform: openingSourcePlatform,
          messageType: openingMessageType,
          sourceUrl: openingSourceUrl || null,
          sourcePostId: cleanText((body as Record<string, unknown>).sourcePostId, 120) || null,
          platformPostId: cleanText((body as Record<string, unknown>).platformPostId, 120) || null,
          platformCommentId: cleanText((body as Record<string, unknown>).platformCommentId, 120) || null,
          metadata: serializeMeChatMetadata({
            attachments: openingAttachments,
            linkPreview: buildLinkPreview(openingMessage, openingSourceUrl, openingSourcePlatform),
          }),
        },
      });
    }

    await tx.notification.createMany({
      data: memberIds.map((memberId) => ({
        type: "message",
        recipientId: memberId,
        actorId: user.id,
        message: memberIds.length > 1
          ? `${user.displayName} added you to ${title || "a MeChat group"}`
          : `${user.displayName} started a MeChat with you`,
      })),
    });

    return created;
  });

  return NextResponse.json({ thread }, { status: 201 });
}
