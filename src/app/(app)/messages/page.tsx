import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { directThreadWhere } from "@/lib/direct-thread";
import { MessagesIndexPane } from "@/components/messages/messages-index-pane";

export const metadata: Metadata = {
  title: "MeChat",
  description: "Unified private messaging for Mesh.me.",
};

// Message doors carry ?with=<username> instead of a threadId — the
// Notification row never stored one. This resolver turns "who spoke" into
// "the conversation with them" so a message notification or a Meshi delivery
// lands IN the thread, not on the index with a "Start a conversation"
// placeholder (journey audit). No direct thread with that person → the index,
// same as before.
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string }>;
}) {
  const { with: withUsername } = await searchParams;
  if (withUsername) {
    const user = await getCurrentUser();
    const other = user
      ? await prisma.user.findUnique({ where: { username: withUsername }, select: { id: true } })
      : null;
    if (user && other) {
      // Should the pair somehow hold more than one direct thread, the door
      // opens the one they actually talk in — the most recently touched.
      const thread = await prisma.messageThread.findFirst({
        where: directThreadWhere(user.id, other.id),
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      if (thread) redirect(`/messages/${thread.id}`);
    }
  }
  return <MessagesIndexPane />;
}
