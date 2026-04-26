import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getMessageThreads } from "@/lib/queries";
import { MeChatClient } from "./mechat-client";

export const metadata: Metadata = { title: "MeChat" };

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ sharePostId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const query = await searchParams;

  const threads = await getMessageThreads();

  const serializedThreads = threads.map((t) => ({
    id: t.id,
    otherUser: t.otherUser || null,
    lastMessage: t.lastMessage
      ? { content: t.lastMessage.content, senderId: t.lastMessage.senderId, createdAt: String(t.lastMessage.createdAt) }
      : null,
    platform: "mesh" as const,
    unread: 0,
  }));

  return <MeChatClient threads={serializedThreads} currentUserId={user.id} sharePostId={query.sharePostId} />;
}
