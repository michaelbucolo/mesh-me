// ONE INBOX FOR THE WHOLE INTERNET.
//
// This is the feature the product actually turns on. Consuming other people's
// feeds inside mesh.me is not obtainable — no platform lets a third party
// render its home feed, and the ones that tried got their API access removed.
// But EVERYTHING THAT REACHES YOU is obtainable almost everywhere: DMs,
// mentions, replies and comments are exactly what the platform APIs are
// willing to hand over, because they are yours.
//
// So this is the honest version of "delete the other apps": you still cannot
// scroll Instagram here, but you never have to open Instagram to find out
// whether someone is waiting on you — and that is where the app-switching
// actually hurts.
//
// ── ONE DEFINITION OF "OWED", NOT TWO ──────────────────────────────────────
//
// Whether something is waiting on you is decided by `wants-you.ts` and nowhere
// else. This read calls it and joins the answer back onto its own richer rows,
// rather than re-deriving the rule with a second `senderId !== me` test that
// would drift from the gated one the moment either changed.

import { prisma } from "@/lib/prisma";
import { wantsYou, type NotificationRow, type ThreadRow } from "@/lib/mesh/wants-you";

export type InboxKind = "message" | "mention" | "reply" | "comment" | "follow" | "activity";

export type InboxEntry = {
  id: string;
  kind: InboxKind;
  /** Where it came from. "mesh" for native. Drives the badge. */
  platform: string;
  /** The human on the other end, when there is one. */
  who: { name: string | null; avatarUrl: string | null } | null;
  /** What it is, in a few words. */
  title: string;
  /** The message itself, when there is one to preview. */
  preview: string | null;
  atMs: number;
  /** You have not opened it. */
  unread: boolean;
  /** It is addressed to you and you have not answered — the gated judgement. */
  awaitingYou: boolean;
  /** Where acting on it goes. */
  href: string;
};

/** What the inbox is showing. "Needs you" is the default because that is the
 * question people open an inbox to answer. */
export type InboxFilter = "needs-you" | "all" | "messages";

export type InboxRead = {
  entries: InboxEntry[];
  /** Counts for the filter chips — computed over the same rows, so a chip can
   * never disagree with the list it switches to. */
  counts: { needsYou: number; all: number; messages: number };
  /** Which platforms actually appear, for the platform filter row. */
  platforms: string[];
  nowMs: number;
};

/** Read cap. Generous — this is a list people scroll, not a radial layout with
 * a few dozen slots — but still bounded, because an inbox is not an archive. */
const MAX_THREADS = 120;
const MAX_NOTIFICATIONS = 120;

export async function readInbox(
  userId: string,
  filter: InboxFilter = "needs-you",
): Promise<InboxRead> {
  const nowMs = Date.now();

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
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true, senderId: true, content: true },
            },
            members: {
              where: { userId: { not: userId } },
              take: 1,
              select: {
                user: { select: { displayName: true, username: true, avatarUrl: true } },
              },
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
        actor: { select: { displayName: true, username: true, avatarUrl: true } },
      },
    }),
  ]);

  // Build the plain rows the judgement takes, then ask it once.
  const threadRows: ThreadRow[] = memberships.map((m) => {
    const newest = m.thread.messages[0];
    return {
      threadId: m.thread.id,
      title: m.thread.title,
      sourcePlatform: m.thread.sourcePlatform,
      lastMessageAtMs: newest ? newest.createdAt.getTime() : null,
      lastMessageFromViewer: newest ? newest.senderId === userId : false,
      lastMessagePreview: newest ? newest.content : null,
      lastReadMs: m.lastRead.getTime(),
      muted: m.notificationsMuted,
    };
  });

  const notificationRows: NotificationRow[] = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    actorName: n.actor?.displayName ?? n.actor?.username ?? null,
    actorAvatarUrl: n.actor?.avatarUrl ?? null,
    message: n.message,
    read: n.read,
    createdAtMs: n.createdAt.getTime(),
    postId: n.postId,
  }));

  // The single source of truth for "is this owed". Keyed by the ids the
  // judgement itself assigns, so the join cannot silently miss.
  const owed = new Set(
    wantsYou({ threads: threadRows, notifications: notificationRows, nowMs })
      .filter((i) => i.awaitingViewer)
      .map((i) => i.id),
  );

  const entries: InboxEntry[] = [];

  for (const m of memberships) {
    const newest = m.thread.messages[0];
    const other = m.thread.members[0]?.user ?? null;
    const atMs = newest ? newest.createdAt.getTime() : 0;
    entries.push({
      id: `thread:${m.thread.id}`,
      kind: "message",
      platform: m.thread.sourcePlatform || "mesh",
      who: other
        ? { name: other.displayName ?? other.username, avatarUrl: other.avatarUrl }
        : null,
      // Never invented: a thread with no title is called what it is.
      title: m.thread.title?.trim() || other?.displayName || other?.username || "Direct message",
      preview: newest?.content?.trim() || null,
      atMs,
      unread: atMs > m.lastRead.getTime() && !!newest && newest.senderId !== userId,
      awaitingYou: owed.has(`thread:${m.thread.id}`),
      href: `/messages/${encodeURIComponent(m.thread.id)}`,
    });
  }

  for (const n of notificationRows) {
    entries.push({
      id: `notification:${n.id}`,
      kind: kindOfNotification(n.type),
      platform: "mesh",
      who: n.actorName ? { name: n.actorName, avatarUrl: n.actorAvatarUrl ?? null } : null,
      title: n.message?.trim() || describe(n.type, n.actorName),
      preview: null,
      atMs: n.createdAtMs,
      unread: !n.read,
      awaitingYou: owed.has(`notification:${n.id}`),
      href: n.postId ? `/feed/${encodeURIComponent(n.postId)}` : "/notifications",
    });
  }

  entries.sort((a, b) => {
    // Owed first — an inbox that buries the thing you owe under a like has
    // failed at the one job it has — then newest.
    const byOwed = Number(b.awaitingYou) - Number(a.awaitingYou);
    return byOwed !== 0 ? byOwed : b.atMs - a.atMs;
  });

  const counts = {
    needsYou: entries.filter((e) => e.awaitingYou).length,
    all: entries.length,
    messages: entries.filter((e) => e.kind === "message").length,
  };

  const shown =
    filter === "needs-you"
      ? entries.filter((e) => e.awaitingYou)
      : filter === "messages"
        ? entries.filter((e) => e.kind === "message")
        : entries;

  return {
    entries: shown,
    counts,
    platforms: [...new Set(entries.map((e) => e.platform))],
    nowMs,
  };
}

function kindOfNotification(type: string): InboxKind {
  if (type === "mention") return "mention";
  if (type === "reply") return "reply";
  if (type === "comment") return "comment";
  if (type === "message") return "message";
  if (type === "follow") return "follow";
  return "activity";
}

/** Plain language for a type with no message attached. Never a raw enum. */
function describe(type: string, actor: string | null): string {
  const who = actor ?? "Someone";
  switch (type) {
    case "follow":
      return `${who} started following you`;
    case "like":
      return `${who} liked your post`;
    case "comment":
      return `${who} commented on your post`;
    case "mention":
      return `${who} mentioned you`;
    case "reply":
      return `${who} replied to you`;
    default:
      return `${who} — ${type.replace(/_/g, " ")}`;
  }
}
