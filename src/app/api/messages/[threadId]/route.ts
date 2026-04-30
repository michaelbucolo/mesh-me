import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  buildLinkPreview,
  normalizeAttachments,
  parseMeChatMetadata,
  serializeMeChatMetadata,
  toggleMessageReaction,
  type MeChatMessageMetadata,
} from "@/lib/mechat-metadata";
import { clearMeChatTyping, getMeChatTypingUsers } from "@/lib/mechat-presence";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";
import { rateLimit, sanitizeForDisplay } from "@/lib/security";

type RouteContext = {
  params: Promise<{ threadId: string }>;
};

type ThreadWithMembers = {
  id: string;
  title: string | null;
  threadType: string;
  sourcePlatform: string;
  isEncrypted: boolean;
  members: Array<{
    userId: string;
    role: string;
    notificationsMuted: boolean;
    lastRead: Date;
    user: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
  }>;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return sanitizeForDisplay(value).slice(0, maxLength);
}

function optionalCleanText(value: unknown, maxLength: number) {
  const text = cleanText(value, maxLength);
  return text || undefined;
}

async function getAuthorizedThread(threadId: string, userId: string) {
  return prisma.messageThread.findFirst({
    where: {
      id: threadId,
      members: { some: { userId } },
    },
    include: {
      members: {
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
      },
    },
  });
}

function serializeMessage(
  message: {
    id: string;
    content: string;
    senderId: string;
    threadId: string;
    sourcePlatform: string;
    messageType: string;
    sourceUrl: string | null;
    sourcePostId: string | null;
    platformPostId: string | null;
    platformCommentId: string | null;
    metadata: string | null;
    createdAt: Date;
    sender: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
  },
  thread: ThreadWithMembers,
  messagesById: Map<string, { id: string; content: string; sender: { displayName: string; username: string } }>,
) {
  const metadata = parseMeChatMetadata(message.metadata);
  const replyTo = metadata.replyToMessageId ? messagesById.get(metadata.replyToMessageId) : null;
  const readBy = thread.members
    .filter((member) => member.lastRead.getTime() >= message.createdAt.getTime())
    .map((member) => ({
      userId: member.userId,
      displayName: member.user.displayName,
      username: member.user.username,
      avatarUrl: member.user.avatarUrl,
    }));

  return {
    id: message.id,
    content: message.content,
    senderId: message.senderId,
    threadId: message.threadId,
    sourcePlatform: message.sourcePlatform,
    messageType: message.messageType,
    sourceUrl: message.sourceUrl,
    sourcePostId: message.sourcePostId,
    platformPostId: message.platformPostId,
    platformCommentId: message.platformCommentId,
    createdAt: message.createdAt.toISOString(),
    sender: message.sender,
    metadata,
    replyTo: replyTo ? {
      id: replyTo.id,
      content: replyTo.content,
      senderName: replyTo.sender.displayName || replyTo.sender.username,
    } : null,
    readBy,
  };
}

async function serializeThreadMessages(thread: ThreadWithMembers, currentUserId: string) {
  const messages = await prisma.message.findMany({
    where: { threadId: thread.id },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  const messagesById = new Map(messages.map((message) => [message.id, {
    id: message.id,
    content: message.content,
    sender: {
      displayName: message.sender.displayName,
      username: message.sender.username,
    },
  }]));

  return {
    messages: messages.map((message) => serializeMessage(message, thread, messagesById)),
    typingUsers: getMeChatTypingUsers(thread.id, currentUserId),
  };
}

async function blockedInsideThread(thread: ThreadWithMembers, currentUserId: string) {
  const otherMemberIds = thread.members
    .map((member) => member.userId)
    .filter((memberId) => memberId !== currentUserId);
  if (otherMemberIds.length === 0) return false;

  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: currentUserId, blockedId: { in: otherMemberIds } },
        { blockerId: { in: otherMemberIds }, blockedId: currentUserId },
      ],
    },
    select: { id: true },
  });

  return Boolean(block);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { threadId } = await context.params;
  const thread = await getAuthorizedThread(threadId, user.id);
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const now = new Date();
  await prisma.threadMember.update({
    where: { userId_threadId: { userId: user.id, threadId } },
    data: { lastRead: now },
  }).catch(() => {});
  const refreshedThread = await getAuthorizedThread(threadId, user.id);
  if (!refreshedThread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  return NextResponse.json({
    thread: {
      id: refreshedThread.id,
      title: refreshedThread.title,
      threadType: refreshedThread.threadType,
      isEncrypted: refreshedThread.isEncrypted,
      sourcePlatform: refreshedThread.sourcePlatform,
      members: refreshedThread.members.map((member) => ({
        userId: member.userId,
        role: member.role,
        notificationsMuted: member.notificationsMuted,
        lastRead: member.lastRead.toISOString(),
        user: member.user,
      })),
    },
    ...(await serializeThreadMessages(refreshedThread, user.id)),
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { threadId } = await context.params;
  const thread = await getAuthorizedThread(threadId, user.id);
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const rl = rateLimit(`msg:${user.id}`, 40, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Sending too fast. Please slow down." }, { status: 429 });
  }

  if (await blockedInsideThread(thread, user.id)) {
    return NextResponse.json({ error: "Cannot send message to this chat." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const content = cleanText(body.content, 4000);
  const attachments = normalizeAttachments(body.attachments);
  const sourceUrl = optionalCleanText(body.sourceUrl, 500);
  if (!content && attachments.length === 0 && !sourceUrl) {
    return NextResponse.json({ error: "Message, media, or link is required." }, { status: 400 });
  }

  let replyToMessageId = optionalCleanText(body.replyToMessageId, 120);
  if (replyToMessageId) {
    const replyExists = await prisma.message.findFirst({
      where: { id: replyToMessageId, threadId },
      select: { id: true },
    });
    if (!replyExists) replyToMessageId = undefined;
  }

  const sourcePlatform = optionalCleanText(body.sourcePlatform, 40) || "mesh";
  const messageType = optionalCleanText(body.messageType, 40) || (attachments.length > 0 ? "media" : sourceUrl ? "platform_share" : "text");
  const metadata: MeChatMessageMetadata = {
    attachments,
    replyToMessageId,
    linkPreview: buildLinkPreview(content, sourceUrl, sourcePlatform),
  };

  const created = await prisma.message.create({
    data: {
      content: content || (attachments.length > 0 ? "Shared media" : "Shared link"),
      senderId: user.id,
      threadId,
      sourcePlatform,
      messageType,
      sourceUrl,
      sourcePostId: optionalCleanText(body.sourcePostId, 120),
      platformPostId: optionalCleanText(body.platformPostId, 120),
      platformCommentId: optionalCleanText(body.platformCommentId, 120),
      metadata: serializeMeChatMetadata(metadata),
    },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  await prisma.$transaction([
    prisma.messageThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    }),
    prisma.threadMember.update({
      where: { userId_threadId: { userId: user.id, threadId } },
      data: { lastRead: new Date() },
    }),
    prisma.notification.createMany({
      data: thread.members
        .filter((member) => member.userId !== user.id)
        .map((member) => ({
          type: "message",
          recipientId: member.userId,
          actorId: user.id,
          message: thread.threadType === "group"
            ? `${user.displayName} sent a message in ${thread.title || "a MeChat group"}`
            : `${user.displayName} sent you a message`,
        })),
    }),
  ]);
  clearMeChatTyping(threadId, user.id);

  const refreshedThread = await getAuthorizedThread(threadId, user.id);
  if (!refreshedThread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }
  const messageMap = new Map([[created.id, {
    id: created.id,
    content: created.content,
    sender: { displayName: created.sender.displayName, username: created.sender.username },
  }]]);

  return NextResponse.json({
    message: serializeMessage(created, refreshedThread, messageMap),
  }, { status: 201 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { threadId } = await context.params;
  const thread = await getAuthorizedThread(threadId, user.id);
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = cleanText(body.action, 40);

  if (action === "read") {
    await prisma.threadMember.update({
      where: { userId_threadId: { userId: user.id, threadId } },
      data: { lastRead: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "react") {
    const messageId = cleanText(body.messageId, 120);
    const emoji = cleanText(body.emoji, 12);
    if (!messageId || !emoji) {
      return NextResponse.json({ error: "Message and emoji are required." }, { status: 400 });
    }

    const message = await prisma.message.findFirst({
      where: { id: messageId, threadId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const nextMetadata = toggleMessageReaction(parseMeChatMetadata(message.metadata), emoji, user.id);
    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { metadata: serializeMeChatMetadata(nextMetadata) },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const messageMap = new Map([[updated.id, {
      id: updated.id,
      content: updated.content,
      sender: { displayName: updated.sender.displayName, username: updated.sender.username },
    }]]);

    return NextResponse.json({
      message: serializeMessage(updated, thread, messageMap),
    });
  }

  return NextResponse.json({ error: "Unsupported message action." }, { status: 400 });
}
