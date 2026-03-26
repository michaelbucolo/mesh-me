import { getCurrentUser } from "@/lib/auth";
import { getThreadMessages } from "@/lib/queries";
import { Avatar } from "@/components/ui/avatar";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MessageForm } from "./message-form";
import { formatRelativeTime } from "@/lib/utils";

export default async function ThreadDetailPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
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

  const otherUser = thread.members.find((m) => m.userId !== user.id)?.user;
  const messages = await getThreadMessages(threadId);

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-zinc-800">
        <Link href="/messages" className="text-zinc-400 hover:text-zinc-200 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {otherUser && (
          <Link href={`/profile/${otherUser.username}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Avatar src={otherUser.avatarUrl} alt={otherUser.displayName} size="sm" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">{otherUser.displayName}</h2>
              <p className="text-xs text-zinc-500">@{otherUser.username}</p>
            </div>
          </Link>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((message) => {
          const isOwn = message.senderId === user.id;
          return (
            <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] ${isOwn ? "order-2" : ""}`}>
                {!isOwn && (
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar src={message.sender.avatarUrl} alt={message.sender.displayName} size="xs" />
                    <span className="text-xs text-zinc-500">{message.sender.displayName}</span>
                  </div>
                )}
                <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                  isOwn
                    ? "bg-blue-600 text-white rounded-br-md"
                    : "bg-zinc-800 text-zinc-200 rounded-bl-md"
                }`}>
                  {message.content}
                </div>
                <p className={`text-xs text-zinc-600 mt-1 ${isOwn ? "text-right" : ""}`}>
                  {formatRelativeTime(message.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Message input */}
      <MessageForm threadId={threadId} />
    </div>
  );
}
