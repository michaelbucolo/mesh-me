import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MeChatHome } from "@/components/messages/mechat-home";
import { getCurrentUser } from "@/lib/auth";
import { PLATFORM_CAPABILITIES, normalizePlatformId } from "@/lib/platform-capabilities";
import { prisma } from "@/lib/prisma";
import { getMessageThreads } from "@/lib/queries";

export const metadata: Metadata = {
  title: "MeChat",
  description: "Unified private messaging and shared scrolling for Mesh.me.",
};

type MessagesPageProps = {
  searchParams: Promise<{
    sharePostId?: string;
    sharePlatformPostId?: string;
    shareUrl?: string;
    shareTitle?: string;
    sourcePlatform?: string;
    roomTitle?: string;
    callMode?: string;
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

  const [{ sharePostId, sharePlatformPostId, shareUrl, shareTitle, sourcePlatform, roomTitle, callMode }, threads, sessions, connectedAccounts, activeNotes] = await Promise.all([
    searchParams,
    getMessageThreads(),
    prisma.meChatSession.findMany({
      where: {
        OR: [
          { hostId: user.id },
          { participants: { some: { userId: user.id } } },
        ],
      },
      include: {
        participants: {
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
          orderBy: { joinedAt: "asc" },
        },
        items: {
          include: {
            votes: true,
          },
          orderBy: { position: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 24,
    }),
    prisma.connectedAccount.findMany({
      where: { userId: user.id, isActive: true },
      include: {
        _count: {
          select: {
            platformComments: true,
            platformPosts: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.meChatNote.findMany({
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

  const capabilityByPlatform = new Map(
    PLATFORM_CAPABILITIES.map((capability) => [normalizePlatformId(capability.id), capability]),
  );

  return (
    <MeChatHome
      currentUser={{
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      }}
      sharedPostId={sharePostId}
      sharedPlatformPostId={sharePlatformPostId}
      sharedUrl={shareUrl}
      sharedTitle={shareTitle}
      sourcePlatform={sourcePlatform}
      suggestedRoomTitle={roomTitle}
      suggestedCallMode={callMode === "voice" || callMode === "video" ? callMode : undefined}
      initialNotes={initialNotes}
      connectedInboxes={connectedAccounts.map((account) => {
        const platformId = normalizePlatformId(account.platform);
        const capability = capabilityByPlatform.get(platformId);
        return {
          id: account.id,
          platform: account.platform,
          platformUsername: account.platformUsername,
          syncStatus: account.syncStatus,
          messageSync: Boolean(capability?.messageSync),
          platformComments: account._count.platformComments,
          platformPosts: account._count.platformPosts,
          lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
        };
      })}
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
      initialSessions={sessions.map((session) => ({
        id: session.id,
        hostId: session.hostId,
        title: session.title,
        status: session.status,
        sessionType: session.sessionType,
        callMode: session.callMode,
        callStatus: session.callStatus,
        currentItemId: session.currentItemId,
        callStartedAt: session.callStartedAt?.toISOString() ?? null,
        callEndedAt: session.callEndedAt?.toISOString() ?? null,
        participants: session.participants.map((participant) => ({
          id: participant.id,
          userId: participant.userId,
          role: participant.role,
          user: participant.user,
        })),
        items: session.items.map((item) => ({
          id: item.id,
          sourcePlatform: item.sourcePlatform,
          sourceUrl: item.sourceUrl,
          title: item.title,
          content: item.content,
          status: item.status,
          votes: item.votes.map((vote) => ({
            id: vote.id,
            userId: vote.userId,
            vote: vote.vote,
          })),
        })),
      }))}
    />
  );
}
