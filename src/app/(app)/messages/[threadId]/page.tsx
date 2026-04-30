import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, LockKeyhole, Phone, ShieldCheck, Users, Video } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MeshiBrandLockup } from "@/components/meshi/meshi-identity";
import { MeChatThread, type MeChatSerializedMessage } from "@/components/messages/mechat-thread";
import { getCurrentUser } from "@/lib/auth";
import { nsfwHiddenWhere } from "@/lib/content-safety";
import { parseMeChatMetadata } from "@/lib/mechat-metadata";
import { prisma } from "@/lib/prisma";
import { getThreadMessages } from "@/lib/queries";

export const metadata: Metadata = {
  title: "MeChat Thread",
  description: "A unified MeChat conversation with cross-platform shares, group scrolling, and source-aware replies.",
};

type ThreadPageProps = {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<{
    new?: string;
    sharePostId?: string;
    sharePlatformPostId?: string;
    shareUrl?: string;
    shareTitle?: string;
    sourcePlatform?: string;
  }>;
};

type ConversationUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

type SharedMessageSource = {
  content: string;
  messageType?: string;
  sourcePlatform?: string;
  sourceUrl?: string;
  sourcePostId?: string;
  platformPostId?: string;
  metadata?: string;
};

async function buildSharedContent(
  query: Awaited<ThreadPageProps["searchParams"]>,
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
): Promise<SharedMessageSource | null> {
  if (query.sharePostId) {
    const post = await prisma.post.findUnique({
      where: { id: query.sharePostId },
      select: {
        id: true,
        content: true,
        author: {
          select: {
            username: true,
            displayName: true,
          },
        },
      },
    });

    if (!post) return null;

    const preview = post.content.length > 240 ? `${post.content.slice(0, 237)}...` : post.content;
    return {
      content: [
        `Shared a Mesh.me post by ${post.author.displayName} (@${post.author.username})`,
        preview,
        `/feed/${post.id}`,
      ].join("\n"),
      messageType: "shared_post",
      sourcePlatform: "mesh",
      sourcePostId: post.id,
    };
  }

  if (query.sharePlatformPostId) {
    const platformPost = await prisma.platformPost.findFirst({
      where: {
        id: query.sharePlatformPostId,
        ...nsfwHiddenWhere(user),
        OR: [
          { connectedAccount: { userId: user.id } },
          {
            visibility: { not: "private" },
            connectedAccount: {
              user: {
                isSuspended: false,
                isPublic: true,
                showInDiscovery: true,
              },
            },
          },
        ],
      },
      include: {
        connectedAccount: {
          select: {
            platform: true,
            platformUsername: true,
          },
        },
      },
    });

    if (!platformPost) return null;

    const platform = platformPost.connectedAccount.platform;
    const author = platformPost.connectedAccount.platformUsername ? ` from @${platformPost.connectedAccount.platformUsername}` : "";
    const preview = [platformPost.title, platformPost.content].filter(Boolean).join("\n").slice(0, 240);
    return {
      content: [
        `Shared a ${platform} post${author}`,
        preview || query.shareTitle || "Source-linked post",
        platformPost.url,
      ].filter(Boolean).join("\n"),
      messageType: "platform_share",
      sourcePlatform: platform,
      sourceUrl: platformPost.url ?? undefined,
      platformPostId: platformPost.id,
      metadata: JSON.stringify({ platformPostId: platformPost.platformPostId }),
    };
  }

  if (query.shareUrl) {
    const platform = query.sourcePlatform || "web";
    return {
      content: [
        `Shared a ${platform} link`,
        query.shareTitle,
        query.shareUrl,
      ].filter(Boolean).join("\n"),
      messageType: "platform_share",
      sourcePlatform: platform,
      sourceUrl: query.shareUrl,
    };
  }

  return null;
}

export default async function ThreadDetailPage({ params, searchParams }: ThreadPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/messages");
  if (!user.onboarded) redirect("/onboarding");

  const [{ threadId }, query] = await Promise.all([params, searchParams]);
  const isNewConversation = query.new === "true";
  const sharedContent = await buildSharedContent(query, user);
  const sourcePlatform = sharedContent?.sourcePlatform || "mesh";

  let activeThreadId = isNewConversation ? "" : threadId;
  let recipient: ConversationUser | null = null;
  let conversationTitle = "Secure MeChat thread";
  let conversationSubtitle = "Private conversation";
  let conversationAvatar: string | null | undefined = null;
  let isGroupThread = false;
  let memberCount = 0;
  let formRecipientId: string | undefined;
  let conversationMembers: Array<{
    userId: string;
    role: string;
    notificationsMuted: boolean;
    lastRead: string;
    user: ConversationUser;
  }> = [{
    userId: user.id,
    role: "owner",
    notificationsMuted: false,
    lastRead: new Date().toISOString(),
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    },
  }];

  if (isNewConversation) {
    recipient = await prisma.user.findFirst({
      where: {
        id: threadId,
        isSuspended: false,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
      },
    });

    if (!recipient || recipient.id === user.id) notFound();

    const existingThread = await prisma.messageThread.findFirst({
      where: {
        threadType: "direct",
        AND: [
          { members: { some: { userId: user.id } } },
          { members: { some: { userId: recipient.id } } },
        ],
      },
    });

    if (existingThread) {
      activeThreadId = existingThread.id;
    } else {
      formRecipientId = recipient.id;
    }
    conversationTitle = recipient.displayName;
    conversationSubtitle = `@${recipient.username}`;
    conversationAvatar = recipient.avatarUrl;
    conversationMembers = [
      ...conversationMembers,
      {
        userId: recipient.id,
        role: "member",
        notificationsMuted: false,
        lastRead: new Date(0).toISOString(),
        user: recipient,
      },
    ];
  } else {
    const thread = await prisma.messageThread.findFirst({
      where: {
        id: threadId,
        members: { some: { userId: user.id } },
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

    if (!thread) notFound();
    const otherMembers = thread.members.filter((member) => member.userId !== user.id);
    recipient = otherMembers[0]?.user ?? null;
    isGroupThread = thread.threadType === "group" || otherMembers.length > 1;
    memberCount = thread.members.length;
    conversationTitle = thread.title || (isGroupThread
      ? otherMembers.map((member) => member.user.displayName).join(", ")
      : recipient?.displayName || "Secure MeChat thread");
    conversationSubtitle = isGroupThread
      ? `${memberCount} members - Mesh.me group chat`
      : recipient
        ? `@${recipient.username}`
        : "Private conversation";
    conversationAvatar = isGroupThread ? null : recipient?.avatarUrl;
    conversationMembers = thread.members.map((member) => ({
      userId: member.userId,
      role: member.role,
      notificationsMuted: member.notificationsMuted,
      lastRead: member.userId === user.id ? new Date().toISOString() : member.lastRead.toISOString(),
      user: member.user,
    }));
  }

  if (activeThreadId) {
    await prisma.threadMember.update({
      where: { userId_threadId: { userId: user.id, threadId: activeThreadId } },
      data: { lastRead: new Date() },
    }).catch(() => {});
  }
  const messages = activeThreadId ? await getThreadMessages(activeThreadId) : [];
  const messagesById = new Map(messages.map((message) => [message.id, {
    id: message.id,
    content: message.content,
    senderName: message.sender.displayName || message.sender.username,
  }]));
  const serializedMessages: MeChatSerializedMessage[] = messages.map((message) => {
    const metadata = parseMeChatMetadata(message.metadata);
    const replyTo = metadata.replyToMessageId ? messagesById.get(metadata.replyToMessageId) : null;
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
        senderName: replyTo.senderName,
      } : null,
      readBy: conversationMembers
        .filter((member) => new Date(member.lastRead).getTime() >= message.createdAt.getTime())
        .map((member) => ({
          userId: member.userId,
          displayName: member.user.displayName,
          username: member.user.username,
          avatarUrl: member.user.avatarUrl,
        })),
    };
  });

  return (
    <main className="mesh-aurora min-h-full overflow-hidden rounded-lg text-[var(--text-primary)]">
      <div className="mx-auto grid max-w-4xl gap-4 px-3 py-4 md:px-5 md:py-6">
        <header className="mesh-surface mesh-pop-in rounded-lg p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/messages" className="mesh-action mesh-action-secondary mesh-pressable px-3 text-sm">
              <ArrowLeft size={15} aria-hidden="true" />
              MeChat
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-100">
              <ShieldCheck size={14} aria-hidden="true" />
              Account-only encrypted surface
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            {isGroupThread ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)]/70 text-[var(--text-primary)]">
                <Users size={22} aria-hidden="true" />
              </div>
            ) : (
              <Avatar src={conversationAvatar} alt={conversationTitle || "Conversation"} size="lg" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {isGroupThread ? "MeChat group" : sourcePlatform === "mesh" ? "Mesh.me conversation" : `${sourcePlatform} source-aware conversation`}
              </p>
              <h1 className="mt-1 truncate text-3xl font-black">
                {conversationTitle}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{conversationSubtitle}</p>
            </div>
            <MeshiBrandLockup size={34} label="Meshi" subtitle="represents you" useUserMeshi className="text-left" />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/messages?roomTitle=${encodeURIComponent(conversationTitle)}`} className="mesh-action mesh-action-secondary px-3 text-sm">
              <Phone size={15} aria-hidden="true" />
              Voice room
            </Link>
            <Link href={`/messages?roomTitle=${encodeURIComponent(conversationTitle)}&callMode=video`} className="mesh-action mesh-action-secondary px-3 text-sm">
              <Video size={15} aria-hidden="true" />
              Video room
            </Link>
            <Link href={`/messages?roomTitle=${encodeURIComponent(conversationTitle)}&shareTitle=${encodeURIComponent(conversationTitle)}`} className="mesh-action mesh-action-secondary px-3 text-sm">
              <Users size={15} aria-hidden="true" />
              Shared scroll
            </Link>
          </div>
        </header>

        <section className="mesh-surface overflow-hidden rounded-lg">
          <div className="flex items-center gap-2 border-b border-[var(--border-primary)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            <LockKeyhole size={15} aria-hidden="true" />
            Messages stay tied to your private account session. Block and membership checks run on every send.
          </div>

          <MeChatThread
            currentUser={{
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
            }}
            initialThreadId={activeThreadId || null}
            recipientId={formRecipientId}
            initialMessages={serializedMessages}
            initialSource={sharedContent ?? undefined}
          />
        </section>
      </div>
    </main>
  );
}
