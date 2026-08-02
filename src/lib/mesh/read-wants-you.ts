// THE DATABASE HALF OF "WHAT WANTS YOU".
//
// `wants-you.ts` holds the judgement and takes plain rows, so it can be checked
// without a database in the room. This is the other half: the read that
// produces those rows, and nothing else. No judgement lives here — if a rule
// about what counts as an obligation appeared in this file it would be a second
// copy of a decision that already has one, and the two would drift.
//
// ── WHY THE PAGE READS THIS DIRECTLY AND THERE IS NO ENDPOINT ───────────────
//
// The mesh page is a server component. It can await this and hand the result
// straight to the client component, which is one round trip instead of two and
// removes a request that would otherwise fire after the bundle has downloaded.
// An endpoint would also need a caller to satisfy the reachability gate, and
// the only honest caller would be the very page that can just call the function.
//
// ── BOUNDED, BECAUSE A HOME TAB CANNOT BE A FULL TABLE SCAN ─────────────────
//
// Both reads are capped and ordered by recency. A person with four thousand
// threads gets the most recent slice of them, which is the same slice the rings
// could show anyway — the geometry drops all but a few dozen nodes at any
// viewport, so reading more would be work whose result is thrown away.

import type { FieldItem } from "@/components/meshfield/model/rings";
import { prisma } from "@/lib/prisma";
import { wantsYou, type NotificationRow, type ThreadRow } from "./wants-you";

/**
 * Caps. Comfortably more than any viewport can place, so the budget that
 * decides what is shown stays in the geometry where it is checked, rather than
 * being silently pre-applied here by a LIMIT nobody can see.
 */
const MAX_THREADS = 60;
const MAX_NOTIFICATIONS = 60;

/**
 * Everything across this account that might want the viewer, as field items.
 *
 * Returns items for the WHOLE field, not just the urgent ring: the rings module
 * decides which band each one lands in, and it needs the quiet things too or
 * there is no field for the urgent things to stand out against.
 */
export async function readWantsYou(userId: string, nowMs: number): Promise<FieldItem[]> {
  const [memberships, notifications] = await Promise.all([
    prisma.threadMember.findMany({
      where: { userId },
      take: MAX_THREADS,
      orderBy: { thread: { updatedAt: "desc" } },
      select: {
        lastRead: true,
        notificationsMuted: true,
        thread: {
          select: {
            id: true,
            title: true,
            sourcePlatform: true,
            // Newest message only. The preview and the "is the last word
            // theirs" test both come from this one row.
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true, senderId: true, content: true },
            },
          },
        },
      },
    }),
    prisma.notification.findMany({
      where: { recipientId: userId },
      take: MAX_NOTIFICATIONS,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        message: true,
        read: true,
        createdAt: true,
        postId: true,
        actor: { select: { displayName: true, username: true } },
      },
    }),
  ]);

  const threads: ThreadRow[] = memberships.map((member) => {
    const newest = member.thread.messages[0];
    return {
      threadId: member.thread.id,
      title: member.thread.title,
      sourcePlatform: member.thread.sourcePlatform,
      lastMessageAtMs: newest ? newest.createdAt.getTime() : null,
      lastMessageFromViewer: newest ? newest.senderId === userId : false,
      lastMessagePreview: newest ? newest.content : null,
      lastReadMs: member.lastRead.getTime(),
      muted: member.notificationsMuted,
    };
  });

  const rows: NotificationRow[] = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    actorName: n.actor?.displayName ?? n.actor?.username ?? null,
    message: n.message,
    read: n.read,
    createdAtMs: n.createdAt.getTime(),
    postId: n.postId,
  }));

  return wantsYou({ threads, notifications: rows, nowMs });
}
