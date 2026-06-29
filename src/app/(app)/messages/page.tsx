import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MeChatHome } from "@/components/messages/mechat-home";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMessageThreads } from "@/lib/queries";

export const metadata: Metadata = {
  title: "MeChat",
  description: "Unified private messaging for Mesh.me.",
};

type MessagesPageProps = {
  searchParams: Promise<{
    sharePostId?: string;
    sharePlatformPostId?: string;
    shareUrl?: string;
    shareTitle?: string;
    sourcePlatform?: string;
  }>;
};

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/messages");
  if (!user.onboarded) redirect("/onboarding");

  const threadMemberRows = await prisma.threadMember.findMany({
    where: { thread: { members: { some: { userId: user.id } } } },
    select: { userId: true },
  });
  const noteAudienceIds = Array.from(new Set([user.id, ...threadMemberRows.map((row) => row.userId)]));

  const [{ sharePostId, sharePlatformPostId, shareUrl, shareTitle, sourcePlatform }, threads, activeNotes] = await Promise.all([
    searchParams,
    getMessageThreads(),
    // The notes/stories strip is an ephemeral, non-essential surface. Keep MeChat
    // loading even if it cannot be read, so conversations are never blocked by it.
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
      user: note.user,
    }));

  const shareParams = new URLSearchParams();
  if (sharePostId) shareParams.set("sharePostId", sharePostId);
  if (sharePlatformPostId) shareParams.set("sharePlatformPostId", sharePlatformPostId);
  if (shareUrl) shareParams.set("shareUrl", shareUrl);
  if (shareTitle) shareParams.set("shareTitle", shareTitle);
  if (sourcePlatform) shareParams.set("sourcePlatform", sourcePlatform);
  const shareQuery = shareParams.toString() || undefined;

  return (
    <MeChatHome
      currentUser={{
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      }}
      shareQuery={shareQuery}
      initialNotes={initialNotes}
      initialThreads={threads.map((thread) => ({
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
            }
          : null,
        otherUsers: thread.otherUsers.map((member) => ({
          id: member.id,
          username: member.username,
          displayName: member.displayName,
          avatarUrl: member.avatarUrl,
        })),
        lastMessage: thread.lastMessage
          ? {
              content: thread.lastMessage.content,
              senderId: thread.lastMessage.senderId,
              createdAt: thread.lastMessage.createdAt.toISOString(),
            }
          : null,
        platform: "mesh",
        unread: thread.unreadCount,
      }))}
    />
  );
}
