import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Glance",
  description: "mesh.me at a glance — built for the smallest screens.",
};

// The watch-scale mesh.me: one narrow, high-contrast column of what matters
// right now — unread activity and your latest conversations — with tap
// targets sized for a fingertip on a 40mm screen. Works in any tiny-viewport
// browser (Apple Watch WebKit included); no canvas, no motion, no chrome.
export default async function WatchGlancePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="watch-glance">
        <p className="watch-brand">mesh.me</p>
        <p className="watch-muted">Sign in on your phone first — your session carries over here.</p>
        <Link href="/login?next=/watch" className="watch-item watch-action">
          Sign in
        </Link>
      </main>
    );
  }

  const [unreadNotifications, latestNotifications, threads] = await Promise.all([
    prisma.notification.count({ where: { recipientId: user.id, read: false } }),
    prisma.notification.findMany({
      where: { recipientId: user.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        message: true,
        type: true,
        createdAt: true,
        actor: { select: { displayName: true, username: true } },
      },
    }),
    prisma.messageThread.findMany({
      where: { members: { some: { userId: user.id } } },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: {
        id: true,
        updatedAt: true,
        members: {
          where: { userId: { not: user.id } },
          take: 1,
          select: { user: { select: { displayName: true, username: true } } },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true },
        },
      },
    }),
  ]);

  return (
    <main className="watch-glance">
      <p className="watch-brand">mesh.me</p>
      <p className="watch-muted">
        {unreadNotifications > 0
          ? `${unreadNotifications} unread ${unreadNotifications === 1 ? "notification" : "notifications"}`
          : "You're all caught up"}
      </p>

      {latestNotifications.length > 0 && (
        <section aria-label="Latest activity">
          {latestNotifications.map((n) => (
            <Link key={n.id} href="/notifications" className="watch-item">
              <span className="watch-item-title">
                {n.message ||
                  `${n.actor?.displayName || (n.actor ? "@" + n.actor.username : "Someone")} · ${n.type.replace(/_/g, " ")}`}
              </span>
              <span className="watch-item-meta">{formatRelativeTime(n.createdAt)}</span>
            </Link>
          ))}
        </section>
      )}

      {threads.length > 0 && (
        <section aria-label="Conversations">
          {threads.map((t) => {
            const other = t.members[0]?.user;
            return (
              <Link key={t.id} href={`/messages/${t.id}`} className="watch-item">
                <span className="watch-item-title">
                  {other ? other.displayName || "@" + other.username : "Conversation"}
                </span>
                <span className="watch-item-meta">
                  {(t.messages[0]?.content || "No messages yet").slice(0, 40)}
                </span>
              </Link>
            );
          })}
        </section>
      )}

      <Link href="/mesh" className="watch-item watch-action">
        Open the mesh
      </Link>
    </main>
  );
}
