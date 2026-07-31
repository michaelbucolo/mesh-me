import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendPushForNotification } from "@/lib/push";
import {
  buildLinkPreview,
  normalizeAttachments,
  parseMeChatMetadata,
  serializeMeChatMetadata,
  toggleMessageReaction,
  type MeChatMessageMetadata,
} from "@/lib/mechat-metadata";
import { clearMeChatTyping, getMeChatTypingUsers, type TypingMeshi } from "@/lib/mechat-presence";
import { getCachedMeshiFor } from "@/lib/mechat-meshi-cache";
import { getPlatformMessagingCapability } from "@/lib/platform-capabilities";
import { deliverMeChatMessageToPlatform } from "@/lib/platform-sync";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";
import { rateLimit, sanitizeForDisplay, validateUrl } from "@/lib/security";

type RouteContext = {
  params: Promise<{ threadId: string }>;
};

type ThreadWithMembers = {
  id: string;
  title: string | null;
  threadType: string;
  sourcePlatform: string;
  isEncrypted: boolean;
  connectedAccountId: string | null;
  externalConversationId: string | null;
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
      readReceipts: boolean;
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
              readReceipts: true,
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
  meshiByUser: Map<string, TypingMeshi | null>,
) {
  const metadata = parseMeChatMetadata(message.metadata);
  const replyTo = metadata.replyToMessageId ? messagesById.get(metadata.replyToMessageId) : null;
  const readBy = thread.members
    // Honor the per-user "Read receipts" toggle (default off): a member who
    // hasn't opted in never appears as having read a message, so the sender
    // sees "Delivered" instead of "Read". Unread counts are unaffected (they
    // key off the viewer's own lastRead).
    .filter((member) => member.user.readReceipts && member.lastRead.getTime() >= message.createdAt.getTime())
    .map((member) => ({
      userId: member.userId,
      displayName: member.user.displayName,
      username: member.user.username,
      avatarUrl: member.user.avatarUrl,
      // The reader AS their Meshi — the read receipt is their face, not a
      // checkmark (Bitmoji-style; same cache the typing indicator uses).
      meshi: meshiByUser.get(member.userId) ?? null,
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

async function resolveMemberMeshis(thread: ThreadWithMembers): Promise<Map<string, TypingMeshi | null>> {
  const entries = await Promise.all(
    thread.members.map(async (member) => [member.userId, await getCachedMeshiFor(member.userId).catch(() => null)] as const),
  );
  return new Map(entries);
}

async function serializeThreadMessages(thread: ThreadWithMembers, currentUserId: string) {
  // Latest window only — long histories shouldn't make every poll heavier.
  const messages = (
    await prisma.message.findMany({
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
      orderBy: { createdAt: "desc" },
      take: 150,
    })
  ).reverse();
  const messagesById = new Map(messages.map((message) => [message.id, {
    id: message.id,
    content: message.content,
    sender: {
      displayName: message.sender.displayName,
      username: message.sender.username,
    },
  }]));

  const meshiByUser = await resolveMemberMeshis(thread);

  return {
    messages: messages.map((message) => serializeMessage(message, thread, messagesById, meshiByUser)),
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

  // This endpoint is polled every few seconds by every open thread — patch
  // the caller's lastRead into the already-loaded thread instead of paying
  // for a second full members+users query per poll.
  return NextResponse.json({
    thread: {
      id: thread.id,
      title: thread.title,
      threadType: thread.threadType,
      isEncrypted: thread.isEncrypted,
      sourcePlatform: thread.sourcePlatform,
      isExternal: Boolean(thread.connectedAccountId && thread.externalConversationId),
      members: thread.members.map((member) => ({
        userId: member.userId,
        role: member.role,
        notificationsMuted: member.notificationsMuted,
        lastRead: (member.userId === user.id ? now : member.lastRead).toISOString(),
        user: member.user,
      })),
    },
    ...(await serializeThreadMessages(thread, user.id)),
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

  const body = await readJsonObject(request);
  const content = cleanText(body.content, 4000);
  const attachments = normalizeAttachments(body.attachments);
  // Only persist http(s) source links. A `javascript:`/`data:` sourceUrl would
  // otherwise reach an anchor href on render; reject non-web schemes at the
  // write boundary (the render sink also guards with safeHref).
  const rawSourceUrl = optionalCleanText(body.sourceUrl, 500);
  const sourceUrl = rawSourceUrl && validateUrl(rawSourceUrl) ? rawSourceUrl : undefined;
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

  const isExternalThread = Boolean(thread.connectedAccountId && thread.externalConversationId);
  const sourcePlatform = isExternalThread
    ? thread.sourcePlatform
    : optionalCleanText(body.sourcePlatform, 40) || "mesh";
  const messageType = optionalCleanText(body.messageType, 40) || (attachments.length > 0 ? "media" : sourceUrl ? "platform_share" : "text");
  const metadata: MeChatMessageMetadata = {
    attachments,
    replyToMessageId,
    linkPreview: buildLinkPreview(content, sourceUrl, sourcePlatform),
  };

  let externalMessageId: string | undefined;
  if (isExternalThread && thread.connectedAccountId && thread.externalConversationId) {
    if (!content) {
      return NextResponse.json({ error: "Only text replies can be delivered to this platform." }, { status: 400 });
    }
    const delivery = await deliverMeChatMessageToPlatform({
      connectedAccountId: thread.connectedAccountId,
      externalConversationId: thread.externalConversationId,
      content,
    });
    metadata.delivery = {
      platform: delivery.platform,
      status: delivery.status,
      error: delivery.error,
    };
    externalMessageId = delivery.externalMessageId || undefined;
  }

  const created = await prisma.message.create({
    data: {
      content: content || (attachments.length > 0 ? "Shared media" : "Shared link"),
      senderId: user.id,
      threadId,
      sourcePlatform,
      messageType: isExternalThread ? "external_dm" : messageType,
      sourceUrl,
      sourcePostId: optionalCleanText(body.sourcePostId, 120),
      platformPostId: optionalCleanText(body.platformPostId, 120),
      platformCommentId: optionalCleanText(body.platformCommentId, 120),
      externalMessageId,
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
  // After the response: a new message is the notification people most expect
  // on a lock screen, and the one that decides whether MeChat can be a daily
  // messenger at all.
  const pushMessage = thread.threadType === "group"
    ? `${user.displayName} sent a message in ${thread.title || "a MeChat group"}`
    : `${user.displayName} sent you a message`;
  for (const member of thread.members) {
    if (member.userId === user.id) continue;
    const recipientId = member.userId;
    after(() => sendPushForNotification(recipientId, { type: "message", message: pushMessage }));
  }
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
    message: serializeMessage(created, refreshedThread, messageMap, await resolveMemberMeshis(refreshedThread)),
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

  // React/edit/unsend each do a DB read + write; throttle like POST so they
  // can't be looped into write amplification (POST caps sends, PATCH was open).
  if (!rateLimit(`msg-patch:${user.id}`, 120, 60 * 1000).allowed) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  const body = await readJsonObject(request);
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
      message: serializeMessage(updated, thread, messageMap, await resolveMemberMeshis(thread)),
    });
  }

  if (action === "edit" || action === "unsend") {
    if (thread.connectedAccountId && thread.externalConversationId) {
      const capability = getPlatformMessagingCapability(thread.sourcePlatform);
      return NextResponse.json({
        error: `Messages delivered to ${capability.supported ? thread.sourcePlatform : "this platform"} can't be edited or unsent after they leave Mesh.me.`,
      }, { status: 400 });
    }
    const messageId = cleanText(body.messageId, 120);
    if (!messageId) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const message = await prisma.message.findFirst({
      where: { id: messageId, threadId },
      select: { id: true, senderId: true, metadata: true, content: true },
    });
    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    // Only the author can edit or unsend their own message.
    if (message.senderId !== user.id) {
      return NextResponse.json({ error: "You can only change your own messages." }, { status: 403 });
    }

    const current = parseMeChatMetadata(message.metadata);
    if (current.unsent) {
      return NextResponse.json({ error: "This message was already unsent." }, { status: 400 });
    }

    let data: { content?: string; metadata: string | null };
    if (action === "unsend") {
      // Retract: drop the content and any media/link, keep a tombstone flag.
      data = {
        content: "",
        metadata: serializeMeChatMetadata({ unsent: true, replyToMessageId: current.replyToMessageId }),
      };
    } else {
      const nextContent = cleanText(body.content, 4000);
      if (!nextContent) {
        return NextResponse.json({ error: "Edited message can't be empty." }, { status: 400 });
      }
      data = {
        content: nextContent,
        metadata: serializeMeChatMetadata({ ...current, edited: true, linkPreview: buildLinkPreview(nextContent) }),
      };
    }

    const updated = await prisma.message.update({
      where: { id: message.id },
      data,
      include: {
        sender: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    const messageMap = new Map([[updated.id, {
      id: updated.id,
      content: updated.content,
      sender: { displayName: updated.sender.displayName, username: updated.sender.username },
    }]]);

    return NextResponse.json({
      message: serializeMessage(updated, thread, messageMap, await resolveMemberMeshis(thread)),
    });
  }

  return NextResponse.json({ error: "Unsupported message action." }, { status: 400 });
}
