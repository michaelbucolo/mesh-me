import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BadgeCheck, LockKeyhole, Users } from "lucide-react";
import { ActiveNow } from "@/components/messages/active-now";
import { Avatar } from "@/components/ui/avatar";
import { MeChatInfoRail } from "@/components/messages/mechat-info-rail";
import { MeChatThread, type MeChatSerializedMessage } from "@/components/messages/mechat-thread";
import { getCurrentUser } from "@/lib/auth";
import { nsfwHiddenWhere } from "@/lib/content-safety";
import { directThreadWhere } from "@/lib/direct-thread";
import { parseMeChatMetadata } from "@/lib/mechat-metadata";
import { prisma } from "@/lib/prisma";
import { getPostById, getThreadMessages } from "@/lib/queries";

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
    // Gate the native-post lookup through getPostById, which enforces NSFW and
    // audience visibility, so a bare post id can't leak private/friends-only
    // content into the composer.
    const post = await getPostById(query.sharePostId);

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
            // Explicit link-shares may carry unlisted (link-only by design);
            // friends/private/draft content is never shareable by strangers.
            visibility: { in: ["public", "unlisted"] },
            connectedAccount: {
              user: {
                isSuspended: false,
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
  // Only awaited where it's rendered, so its (usually no-op) lookup overlaps
  // the thread queries below instead of preceding them.
  const sharedContentPromise = getOptionalSharedContent(query, user);

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
  // The viewer's lastRead as it stood BEFORE this visit bumps it — the client
  // anchors its "New" unread divider to this moment.
  let viewerLastReadAt: string | null = null;
  let conversationMembers: Array<{
    userId: string;
    role: string;
    notificationsMuted: boolean;
    lastRead: string;
    readReceipts: boolean;
    user: ConversationUser;
  }> = [{
    userId: user.id,
    role: "owner",
    notificationsMuted: false,
    lastRead: new Date().toISOString(),
    readReceipts: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    },
  }];

  if (isNewConversation) {
    // In new-conversation mode the route param IS the recipient id, so the
    // existing-thread lookup doesn't need to wait for the recipient row.
    const [foundRecipient, existingThread] = await Promise.all([
      prisma.user.findFirst({
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
          readReceipts: true,
        },
      }),
      // `threadId` is a USER id on this branch — /messages/<userId> opens the
      // conversation with that person. src/lib/direct-thread.ts holds what "the
      // conversation with that person" means.
      prisma.messageThread.findFirst({
        where: directThreadWhere(user.id, threadId),
      }),
    ]);
    recipient = foundRecipient;

    if (!recipient || recipient.id === user.id) notFound();

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
        readReceipts: foundRecipient?.readReceipts ?? false,
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
                readReceipts: true,
              },
            },
          },
        },
      },
    });

    if (!thread) notFound();
    const otherMembers = thread.members.filter((member) => member.userId !== user.id);
    viewerLastReadAt = thread.members.find((member) => member.userId === user.id)?.lastRead.toISOString() ?? null;
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
        ? `${memberCount} members · Mesh.me group chat`
        : recipient
          ? `@${recipient.username}`
          : "Private conversation";
    conversationAvatar = isGroupThread ? null : recipient?.avatarUrl;
    conversationMembers = thread.members.map((member) => ({
      userId: member.userId,
      role: member.role,
      notificationsMuted: member.notificationsMuted,
      lastRead: member.userId === user.id ? new Date().toISOString() : member.lastRead.toISOString(),
      readReceipts: member.user.readReceipts,
      user: {
        id: member.user.id,
        username: member.user.username,
        displayName: member.user.displayName,
        avatarUrl: member.user.avatarUrl,
        isVerified: member.user.isVerified,
      },
    }));
  }

  // Both branches above only produce an activeThreadId after proving the
  // viewer's membership, so the messages fetch can skip its own check and run
  // in parallel with the lastRead write instead of chaining three round trips.
  const [, messages] = activeThreadId
    ? await Promise.all([
        prisma.threadMember.update({
          where: { userId_threadId: { userId: user.id, threadId: activeThreadId } },
          data: { lastRead: new Date() },
        }).catch(() => {}),
        getThreadMessages(activeThreadId),
      ])
    : [undefined, []];
  const sharedContent = await sharedContentPromise;
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
        // Mirror GET /api/messages/[threadId]: the per-user "Read receipts"
        // toggle (default off) is honored on first paint too, so an opted-out
        // member never flashes as "Read" before the first poll corrects it.
        .filter((member) => member.readReceipts && new Date(member.lastRead).getTime() >= message.createdAt.getTime())
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
      {/* minmax(0,1fr) on the single-column tier too: an implicit `auto` track
          takes the thread's min-content width, which ran past narrow phones. */}
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] gap-0 px-0 py-0 md:gap-4 md:px-5 md:py-6 lg:grid-cols-[minmax(0,1fr)_380px]">
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
              {/* Wrapper carries the breakpoint: `.mesh-action` sets display in
                  unlayered CSS, which outranks Tailwind's `hidden` utility, so
                  the desktop pill used to double up with the mobile arrow. */}
              <span className="hidden md:inline-flex">
                <Link href="/messages" className="mesh-action mesh-action-secondary mesh-pressable px-3 text-sm">
                  <ArrowLeft size={15} aria-hidden="true" />
                  MeChat
                </Link>
              </span>

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
                  <Avatar src={conversationAvatar} alt={conversationTitle || "Conversation"} size="lg" className="h-11 w-11 ring-2 ring-[var(--accent)]/20 md:h-14 md:w-14" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <h1 className="truncate text-base font-semibold text-[var(--mesh-text)] md:text-2xl">{conversationTitle}</h1>
                  {!isGroupThread && recipient?.isVerified && <BadgeCheck size={16} className="shrink-0 text-[var(--accent)]" />}
                  {(isExternalThread || threadPlatform !== "mesh") && (
                    <span className="shrink-0 rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-semibold mesh-eyebrow text-[var(--accent)]">
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

              {/* Calls arrive when the real infrastructure exists — until then
                  no dead buttons pretend the capability is live. */}
            </div>
          </header>

          <div className="hidden border-b border-[var(--mesh-border)] px-4 py-3 text-sm text-[var(--mesh-text-secondary)] md:block">
            <div className="flex items-center gap-2">
              <LockKeyhole size={15} aria-hidden="true" className="text-[var(--accent)]" />
              <span>
                {isExternalThread
                  ? `This conversation lives on ${sourceLabel(threadPlatform)}. Replies you send here deliver there through your connected account.`
                  : "Messages stay tied to your private account session. Block and membership checks run on every send."}
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {/* Key per conversation so a soft navigation between threads remounts
                the client component — its message/thread state is seeded from
                props via useState and would otherwise stay pinned to the first
                thread, showing the wrong messages and sending to the wrong one. */}
            <MeChatThread
              key={activeThreadId ?? formRecipientId ?? "new"}
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
              initialLastReadAt={viewerLastReadAt}
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
