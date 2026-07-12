import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { MeChatConversationList } from "@/components/messages/mechat-conversation-list";
import { MessagesDataProvider } from "@/components/messages/messages-data-context";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMessageThreads } from "@/lib/queries";

type MessagesLayoutProps = {
  children: ReactNode;
};

export default async function MessagesLayout({ children }: MessagesLayoutProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/messages");
  if (!user.onboarded) redirect("/onboarding");

  const threadMemberRows = await prisma.threadMember.findMany({
    where: { thread: { members: { some: { userId: user.id } } } },
    select: { userId: true },
  });
  const noteAudienceIds = Array.from(new Set([user.id, ...threadMemberRows.map((row) => row.userId)]));

  const [threads, activeNotes] = await Promise.all([
    getMessageThreads(),
    prisma.meChatNote
      .findMany({
        where: {
          userId: { in: noteAudienceIds },
          expiresAt: { gt: new Date() },
        },
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: "desc" },
      })
      .catch((error) => {
        console.error("Failed to load MeChat notes", error);
        return [];
      }),
  ]);

  const seenNoteUsers = new Set<string>();
  const initialNotes = activeNotes
    .filter((note) => {
      if (seenNoteUsers.has(note.userId)) return false;
      seenNoteUsers.add(note.userId);
      return true;
    })
    .map((note) => ({
      id: note.id,
      userId: note.userId,
      text: note.text,
      songTitle: note.songTitle,
      songArtist: note.songArtist,
      createdAt: note.createdAt.toISOString(),
      expiresAt: note.expiresAt.toISOString(),
      user: {
        id: note.user.id,
        username: note.user.username,
        displayName: note.user.displayName,
        avatarUrl: note.user.avatarUrl,
      },
    }));

  const currentUser = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };

  const sidebarData = {
    currentUser,
    initialThreads: threads.map((thread) => ({
      id: thread.id,
      title: thread.displayTitle,
      threadType: thread.threadType,
      memberCount: thread.memberCount,
      isEncrypted: thread.isEncrypted,
      otherUser: thread.otherUser
        ? {
            id: thread.otherUser.id,
            username: thread.otherUser.username,
            displayName: thread.otherUser.displayName,
            avatarUrl: thread.otherUser.avatarUrl,
            isVerified: thread.otherUser.isVerified,
          }
        : null,
      otherUsers: thread.otherUsers.map((member) => ({
        id: member.id,
        username: member.username,
        displayName: member.displayName,
        avatarUrl: member.avatarUrl,
        isVerified: member.isVerified,
      })),
      lastMessage: thread.lastMessage
        ? {
            content: thread.lastMessage.content,
            senderId: thread.lastMessage.senderId,
            createdAt: thread.lastMessage.createdAt.toISOString(),
          }
        : null,
      platform: thread.sourcePlatform || "mesh",
      unread: thread.unreadCount,
    })),
    initialNotes,
  };

  return (
    <MessagesDataProvider
      key={sidebarData.initialThreads
        .map((thread) => `${thread.id}:${thread.lastMessage?.createdAt ?? ""}:${thread.unread}`)
        .join("|")}
      value={sidebarData}
    >
      <div className="grid h-full min-h-0 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 lg:block">
          <MeChatConversationList
            variant="rail"
            currentUser={currentUser}
            initialThreads={sidebarData.initialThreads}
            initialNotes={initialNotes}
          />
        </aside>

        <main className="min-w-0 min-h-0">{children}</main>
      </div>
    </MessagesDataProvider>
  );
}
