import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { RouteWait } from "@/components/loading/route-wait";
import { MessagesDataProvider } from "@/components/messages/messages-data-context";
import { MessagesRailList } from "@/components/messages/messages-rail";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBlockedUserIdSet } from "@/lib/privacy-policy";
import { getMessageThreads } from "@/lib/queries";

type MessagesLayoutProps = {
  children: ReactNode;
};

// Stream the whole MeChat shell: the route paints a loading state instantly
// while thread/member queries resolve, instead of blocking the response.
//
// The fallback mirrors MessagesShell's own grid — rail on the left at the same
// 360px, conversation on the right — so when the data lands nothing shifts. The
// old fallback was a full-bleed mascot, which meant every visit to /messages
// blanked the rail and then rebuilt it.
export default function MessagesLayout({ children }: MessagesLayoutProps) {
  return (
    <Suspense fallback={<MessagesWait />}>
      <MessagesShell>{children}</MessagesShell>
    </Suspense>
  );
}

/* The rail's divider, stated ONCE for both the loading and the loaded state.
 *
 * It used to be stated twice, differently: the fallback aside drew
 * `border-r border-[var(--border-primary)]` while the loaded shell's aside
 * drew nothing and left the border to the conversation list's own root, in a
 * different pigment (--mesh-border). So the divider changed colour the moment
 * the data landed — the exact "two places state one fact" drift the fallback's
 * own comment promises to avoid ("when the data lands nothing shifts"). */
const RAIL_ASIDE = "hidden min-h-0 border-r border-[var(--mesh-border)] lg:block";

function MessagesWait() {
  return (
    <div className="grid h-full min-h-0 lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className={RAIL_ASIDE}>
        <RouteWait shape="rail-list" label="Loading your conversations" />
      </aside>
      <div className="min-h-0 min-w-0">
        <RouteWait shape="conversation" label="Loading your messages" />
      </div>
    </div>
  );
}

async function MessagesShell({ children }: MessagesLayoutProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/messages");
  if (!user.onboarded) redirect("/onboarding");

  const [threadMemberRows, blockedIds] = await Promise.all([
    prisma.threadMember.findMany({
      where: { thread: { members: { some: { userId: user.id } } } },
      select: { userId: true },
    }),
    getBlockedUserIdSet(user.id),
  ]);
  // Mirror GET /api/mechat/notes: notes must not cross a block in either
  // direction, and the viewer's own note (never suspended) always stays.
  const noteAudienceIds = Array.from(
    new Set([user.id, ...threadMemberRows.map((row) => row.userId).filter((id) => !blockedIds.has(id))]),
  );

  const [threads, activeNotes] = await Promise.all([
    getMessageThreads(),
    prisma.meChatNote
      .findMany({
        where: {
          userId: { in: noteAudienceIds },
          expiresAt: { gt: new Date() },
          // Suspended accounts are locked to owner + admin.
          user: { isSuspended: false },
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
    // Deliberately NOT keyed: a key derived from thread-list state remounted
    // the entire subtree (list scroll, focus, entrance state) every time any
    // message arrived. The provider adopts fresh server payloads by baseline
    // comparison instead.
    <MessagesDataProvider value={sidebarData}>
      <div className="grid h-full min-h-0 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className={RAIL_ASIDE}>
          {/* Reads the provider's LIVE context (like the index pane does) —
              handing it the raw server prop froze it between navigations. */}
          <MessagesRailList />
        </aside>

        <main className="min-w-0 min-h-0">{children}</main>
      </div>
    </MessagesDataProvider>
  );
}
