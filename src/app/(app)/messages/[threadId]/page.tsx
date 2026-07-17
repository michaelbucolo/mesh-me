import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BadgeCheck, LockKeyhole, Phone, ShieldCheck, Video, Users } from "lucide-react";
import { ActiveNow } from "@/components/messages/active-now";
import { Avatar } from "@/components/ui/avatar";
import { MeChatInfoRail } from "@/components/messages/mechat-info-rail";
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
  isVerified?: boolean;
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


type ThreadSourceSummary = {
  platform: string;
  label: string;
  count: number;
};

function sourceLabel(platform: string) {
  if (platform.toLowerCase() === "twitter") return "X";
  if (platform.toLowerCase() === "meshme" || platform.toLowerCase() === "mesh") return "Mesh.me";
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

function buildThreadInsights(messages: MeChatSerializedMessage[]) {
  const sourceCounts = new Map<string, number>();
  let mediaCount = 0;
  let fileCount = 0;

  for (const message of messages) {
    const sourcePlatform = message.sourcePlatform?.toLowerCase() || "";
    const isNativePlatform = sourcePlatform === "mesh" || sourcePlatform === "meshme";
    const isExternalSharedSource = Boolean(message.sourcePlatform)
      && !isNativePlatform
      && message.messageType !== "text";

    if (isExternalSharedSource && message.sourcePlatform) {
      sourceCounts.set(sourcePlatform, (sourceCounts.get(sourcePlatform) || 0) + 1);
    }

    for (const attachment of message.metadata.attachments || []) {
      if (attachment.type === "file") {
        fileCount += 1;
      }
      if (attachment.type === "image" || attachment.type === "video" || attachment.type === "audio") {
        mediaCount += 1;
      }
    }
  }

  const sourceSummaries: ThreadSourceSummary[] = [...sourceCounts.entries()]
    .map(([platform, count]) => ({ platform, label: sourceLabel(platform), count }))
    .sort((left, right) => right.count - left.count);

  return {
    sourceSummaries,
    mediaCount,
    fileCount,
  };
}

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

async function getOptionalSharedContent(
  query: Awaited<ThreadPageProps["searchParams"]>,
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
) {
  try {
    return await buildSharedContent(query, user);
  } catch (error) {
    console.error("[messages] Shared content unavailable", error);
    return null;
  }
}

export default async function ThreadDetailPage({ params, searchParams }: ThreadPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/messages");
  if (!user.onboarded) redirect("/onboarding");

  const [{ threadId }, query] = await Promise.all([params, searchParams]);
  const isNewConversation = query.new === "true";
  const sharedContent = await getOptionalSharedContent(query, user);

  let activeThreadId = isNewConversation ? "" : threadId;
  let recipient: ConversationUser | null = null;
  let conversationTitle = "Secure MeChat thread";
  let conversationSubtitle = "Private conversation";
  let conversationAvatar: string | null | undefined = null;
  let isGroupThread = false;
  let isExternalThread = false;
  let threadPlatform = "mesh";
  let memberCount = 0;
  let threadCreatedAt = new Date().toISOString();
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
        isVerified: true,
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
      threadCreatedAt = existingThread.createdAt.toISOString();
    } else {
      formRecipientId = recipient.id;
      threadCreatedAt = new Date().toISOString();
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
        user: {
          id: recipient.id,
          username: recipient.username,
          displayName: recipient.displayName,
          avatarUrl: recipient.avatarUrl,
          isVerified: recipient.isVerified,
        },
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
                isVerified: true,
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
    isExternalThread = Boolean(thread.connectedAccountId && thread.externalConversationId);
    threadPlatform = thread.sourcePlatform || "mesh";
    memberCount = thread.members.length;
    threadCreatedAt = thread.createdAt.toISOString();
    conversationTitle = thread.title || (isGroupThread
      ? otherMembers.map((member) => member.user.displayName).join(", ")
      : recipient?.displayName || "MeChat thread");
    conversationSubtitle = isExternalThread
      ? `Synced from ${sourceLabel(threadPlatform)}`
      : isGroupThread
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
      user: {
        id: member.user.id,
        username: member.user.username,
        displayName: member.user.displayName,
        avatarUrl: member.user.avatarUrl,
        isVerified: member.user.isVerified,
      },
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
  const threadInsights = buildThreadInsights(serializedMessages);

  const threadCreatedBy = isGroupThread
    ? conversationMembers.find((member) => member.role === "owner")?.user.displayName || null
    : null;

  const threadSummary = isExternalThread
    ? `Synced from ${sourceLabel(threadPlatform)} · replies deliver there`
    : isGroupThread
      ? `${memberCount} member${memberCount === 1 ? "" : "s"} · member-only group chat`
      : recipient
        ? `Direct conversation with @${recipient.username}`
        : "Private conversation";

  return (
    <div className="h-full min-h-0 overflow-hidden text-[var(--mesh-text)] animate-page-enter">
      <div className="grid h-full min-h-0 gap-0 px-0 py-0 md:gap-4 md:px-5 md:py-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="mesh-surface mesh-pop-in flex min-h-0 flex-col overflow-hidden rounded-none border-0 md:rounded-[32px] md:border md:border-[var(--mesh-border)] md:shadow-[var(--shadow-lg)]">
          <header className="border-b border-[var(--mesh-border)] px-2 py-2 md:px-5 md:py-4">
            <div className="flex items-center gap-2 md:gap-4">
              <Link
                href="/messages"
                aria-label="Back to MeChat"
                className="mesh-pressable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--mesh-text-secondary)] transition hover:text-[var(--mesh-text)] active:bg-[var(--mesh-bg-elevated)] md:hidden"
              >
                <ArrowLeft size={20} aria-hidden="true" />
              </Link>
              <Link href="/messages" className="mesh-action mesh-action-secondary mesh-pressable hidden px-3 text-sm md:inline-flex">
                <ArrowLeft size={15} aria-hidden="true" />
                MeChat
              </Link>

              <div className="relative shrink-0">
                {isGroupThread ? (
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] text-[var(--mesh-text-secondary)] md:h-14 md:w-14">
                    {conversationMembers.length > 1 ? (
                      <div className="relative h-9 w-9 md:h-10 md:w-10">
                        {conversationMembers.filter((member) => member.userId !== user.id).slice(0, 3).map((member, index) => (
                          <Avatar
                            key={member.userId}
                            src={member.user.avatarUrl}
                            alt={member.user.displayName}
                            size="xs"
                            className={`absolute h-5 w-5 border-2 border-[var(--mesh-bg)] ${index === 0 ? "left-0 top-2" : index === 1 ? "right-0 top-0" : "bottom-0 left-1/2 -translate-x-1/2"}`}
                          />
                        ))}
                      </div>
                    ) : (
                      <Users size={20} aria-hidden="true" />
                    )}
                  </div>
                ) : (
                  <Avatar src={conversationAvatar} alt={conversationTitle || "Conversation"} size="lg" className="h-11 w-11 ring-2 ring-[var(--mesh-blue)]/20 md:h-14 md:w-14" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <h1 className="truncate text-base font-bold text-[var(--mesh-text)] md:text-2xl">{conversationTitle}</h1>
                  {!isGroupThread && recipient?.isVerified && <BadgeCheck size={16} className="shrink-0 text-[var(--mesh-blue)]" />}
                  {(isExternalThread || threadPlatform !== "mesh") && (
                    <span className="shrink-0 rounded-full bg-[var(--mesh-blue)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--mesh-blue)]">
                      {sourceLabel(threadPlatform)}
                    </span>
                  )}
                </div>
                {!isGroupThread && recipient ? (
                  <ActiveNow userId={recipient.id} fallback={threadSummary} />
                ) : (
                  <p className="truncate text-xs text-[var(--mesh-text-secondary)] md:text-sm">{threadSummary}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1 md:gap-2">
                <button type="button" className="mesh-pressable inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--mesh-text-secondary)] transition hover:text-[var(--mesh-text)] active:bg-[var(--mesh-bg-elevated)] md:border md:border-[var(--mesh-border)] md:bg-[var(--mesh-bg-elevated)] md:hover:border-[var(--mesh-border-active)]" aria-label="Call">
                  <Phone size={18} />
                </button>
                <button type="button" className="mesh-pressable inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--mesh-text-secondary)] transition hover:text-[var(--mesh-text)] active:bg-[var(--mesh-bg-elevated)] md:border md:border-[var(--mesh-border)] md:bg-[var(--mesh-bg-elevated)] md:hover:border-[var(--mesh-border-active)]" aria-label="Video call">
                  <Video size={18} />
                </button>
                <button type="button" className="mesh-pressable hidden h-11 w-11 items-center justify-center rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] text-[var(--mesh-text-secondary)] transition hover:border-[var(--mesh-border-active)] hover:text-[var(--mesh-text)] md:inline-flex" aria-label="Conversation info">
                  <ShieldCheck size={16} />
                </button>
              </div>
            </div>
          </header>

          <div className="hidden border-b border-[var(--mesh-border)] px-4 py-3 text-sm text-[var(--mesh-text-secondary)] md:block">
            <div className="flex items-center gap-2">
              <LockKeyhole size={15} aria-hidden="true" className="text-[var(--mesh-blue)]" />
              <span>
                {isExternalThread
                  ? `This conversation lives on ${sourceLabel(threadPlatform)}. Replies you send here deliver there through your connected account.`
                  : "Messages stay tied to your private account session. Block and membership checks run on every send."}
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
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
              isExternalThread={isExternalThread}
              threadPlatform={threadPlatform}
            />
          </div>
        </section>

        <div className="hidden min-h-0 lg:block">
          <MeChatInfoRail
            title={conversationTitle}
            subtitle={conversationSubtitle}
            avatarUrl={conversationAvatar}
            isGroupThread={isGroupThread}
            isVerified={!isGroupThread ? recipient?.isVerified : undefined}
            createdAt={threadCreatedAt}
            createdBy={threadCreatedBy}
            description={
              isGroupThread
                ? `Private group conversation with ${memberCount} members.`
                : recipient
                  ? `Private direct message with @${recipient.username}.`
                  : "Private conversation."
            }
            members={conversationMembers}
            sourceSummaries={threadInsights.sourceSummaries}
            mediaCount={threadInsights.mediaCount}
            fileCount={threadInsights.fileCount}
          />
        </div>
      </div>
    </div>
  );
}
