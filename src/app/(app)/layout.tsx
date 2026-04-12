import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { MeshBackground } from "@/components/mesh-background";
import { DynamicFavicon } from "@/components/dynamic-favicon";
import { MeshiFloat } from "@/components/meshi/meshi-float";
import { AchievementChecker } from "@/components/achievements/achievement-toast";
import { prisma } from "@/lib/prisma";
import { Sparkles, Search, MessageCircle, Bell, Settings } from "lucide-react";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) redirect("/");
  if (!user.onboarded) redirect("/onboarding");

  const unreadCount = await prisma.notification.count({
    where: { recipientId: user.id, read: false },
  });

  // Single aggregated query for unread messages across all threads
  const unreadMessages = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM Message m
     INNER JOIN ThreadMember tm ON tm.threadId = m.threadId
     WHERE tm.userId = ? AND m.senderId != ? AND m.createdAt > tm.lastRead`,
    user.id,
    user.id
  ).then((rows) => Number(rows[0]?.count ?? 0)).catch(() => 0);

  return (
    <div className="relative min-h-screen bg-[var(--bg-primary)]">
      <MeshBackground density={34} className="opacity-45" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_10%_10%,rgba(45,127,249,0.12),transparent_35%),radial-gradient(circle_at_90%_20%,rgba(0,198,251,0.1),transparent_28%)]" />

      <div className="relative z-10 flex min-h-screen">
        <Sidebar
          user={{
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            isAdmin: user.isAdmin,
          }}
          unreadNotifications={unreadCount}
        />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-[var(--glass-border)] bg-[var(--glass-bg)] px-8 backdrop-blur-2xl lg:flex">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Welcome back, {user.displayName}</p>
              <p className="text-xs text-[var(--text-muted)]">@{user.username}</p>
            </div>
            <div className="flex items-center gap-2.5">
              <Link href="/search" className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]">
                <Search className="h-3.5 w-3.5" />
                Search
              </Link>
              <Link href="/messages" className="relative inline-flex items-center gap-2 rounded-full border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]">
                <MessageCircle className="h-3.5 w-3.5" />
                Inbox
                {unreadMessages > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-white">
                    {unreadMessages > 99 ? "99+" : unreadMessages}
                  </span>
                )}
              </Link>
              <Link href="/notifications" className="relative inline-flex items-center gap-2 rounded-full border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]">
                <Bell className="h-3.5 w-3.5" />
                Alerts
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/settings" className="inline-flex items-center rounded-full border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-1.5 text-[var(--text-muted)] transition hover:text-[var(--text-primary)]">
                <Settings className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/meshpro"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-muted)] bg-[var(--accent-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] transition hover:brightness-110"
              >
                <Sparkles className="h-3.5 w-3.5" />
                MeshPro
              </Link>
            </div>
          </header>

          <main className="min-h-[calc(100vh-4rem)] flex-1 px-3 pb-20 pt-4 md:px-5 md:pt-6 lg:pb-8 lg:pt-6">
            <div className="mx-auto w-full max-w-6xl animate-page-enter">{children}</div>
          </main>
        </div>
      </div>

      <MobileNav unreadNotifications={unreadCount} username={user.username} />
      <MeshiFloat />
      <AchievementChecker />
      <DynamicFavicon />
    </div>
  );
}
