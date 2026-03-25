import { getCurrentUser } from "@/lib/auth";
import { getMessageThreads } from "@/lib/queries";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const threads = await getMessageThreads();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Messages</h1>
        <p className="text-sm text-zinc-400 mt-1">Your conversations</p>
      </div>

      {threads.length > 0 ? (
        <div className="space-y-1">
          {threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/messages/${thread.id}`}
              className="flex items-center gap-3 p-4 rounded-xl hover:bg-zinc-800/50 transition-colors"
            >
              <Avatar
                src={thread.otherUser?.avatarUrl}
                alt={thread.otherUser?.displayName || "User"}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-100 truncate">
                    {thread.otherUser?.displayName || "Unknown"}
                  </h3>
                  {thread.lastMessage && (
                    <span className="text-xs text-zinc-500">
                      {formatRelativeTime(thread.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                {thread.lastMessage && (
                  <p className="text-sm text-zinc-400 truncate">
                    {thread.lastMessage.senderId === user.id ? "You: " : ""}
                    {thread.lastMessage.content}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={MessageCircle}
          title="No messages yet"
          description="Start a conversation by visiting someone's profile and sending them a message."
        />
      )}
    </div>
  );
}
