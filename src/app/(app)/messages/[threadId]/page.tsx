import { getCurrentUser } from "@/lib/auth";
import { getThreadMessages } from "@/lib/queries";
import { Avatar } from "@/components/ui/avatar";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MessageForm } from "./message-form";
import { formatRelativeTime } from "@/lib/utils";

export default async function ThreadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { threadId } = await params;
  const query = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;

  const isNewChat = query.new === "true";

  // If this is a new chat, threadId is actually a userId — find or create thread
  let resolvedThreadId = threadId;
  let otherUserDirect: { id: string; username: string; displayName: string; avatarUrl: string | null } | null = null;

  if (isNewChat) {
    const recipientId = threadId;

    // Don't allow messaging yourself
    if (recipientId === user.id) notFound();

    // Look up the recipient to make sure they exist
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, username: true, displayName: true, avatarUrl: true, isSuspended: true },
    });
    if (!recipient || recipient.isSuspended) notFound();

    // Check for blocks
    const blockExists = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: recipientId },
          { blockerId: recipientId, blockedId: user.id },
        ],
      },
    });
    if (blockExists) notFound();

    // Find existing thread between these two users
    const existingThread = await prisma.messageThread.findFirst({
      where: {
        AND: [
          { members: { some: { userId: user.id } } },
          { members: { some: { userId: recipientId } } },
        ],
      },
    });

    if (existingThread) {
      resolvedThreadId = existingThread.id;
    } else {
      // Create a new thread
      const newThread = await prisma.messageThread.create({
        data: {
          members: {
            create: [
              { userId: user.id },
              { userId: recipientId },
            ],
          },
        },
      });
      resolvedThreadId = newThread.id;
    }

    otherUserDirect = recipient;
  }

  const thread = await prisma.messageThread.findUnique({
    where: { id: resolvedThreadId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
      },
    },
  });

  if (!thread) notFound();

  // Verify current user is a member of this thread
  const isMember = thread.members.some((m) => m.userId === user.id);
  if (!isMember) notFound();

  const otherUser = otherUserDirect || thread.members.find((m) => m.userId !== user.id)?.user;
  const messages = await getThreadMessages(resolvedThreadId);

  return (
    <div data-meshi-zone="thread-detail" className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-2rem)] animate-page-enter">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border-primary)]">
        <Link href="/messages" className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {otherUser && (
          <Link href={`/profile/${otherUser.username}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Avatar src={otherUser.avatarUrl} alt={otherUser.displayName} size="sm" />
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">{otherUser.displayName}</h2>
              <p className="text-xs text-[var(--text-muted)]">@{otherUser.username}</p>
            </div>
          </Link>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-[var(--text-muted)]">
              No messages yet. Say hello!
            </p>
          </div>
        )}
        {messages.map((message) => {
          const isOwn = message.senderId === user.id;
          return (
            <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] ${isOwn ? "order-2" : ""}`}>
                {!isOwn && (
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar src={message.sender.avatarUrl} alt={message.sender.displayName} size="xs" />
                    <span className="text-xs text-[var(--text-muted)]">{message.sender.displayName}</span>
                  </div>
                )}
                <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                  isOwn
                    ? "text-white rounded-br-md"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-bl-md"
                }`} style={isOwn ? { background: "var(--accent)" } : undefined}>
                  {message.content}
                </div>
                <p className={`text-xs text-[var(--text-muted)] mt-1 ${isOwn ? "text-right" : ""}`}>
                  {formatRelativeTime(message.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Message input */}
      <MessageForm threadId={resolvedThreadId} />
    </div>
  );
}
