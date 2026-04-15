import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { MeshBackground } from "@/components/mesh-background";
import { DynamicFavicon } from "@/components/dynamic-favicon";
import { MeshiFloat } from "@/components/meshi/meshi-float";
import { MeshiDeliveryWrapper } from "@/components/meshi/meshi-delivery-wrapper";
import { AchievementChecker } from "@/components/achievements/achievement-toast";
import { VerificationBanner } from "@/components/verification/verification-banner";
import { prisma } from "@/lib/prisma";
import { Search, MessageCircle, Bell } from "lucide-react";

export const metadata: Metadata = {
  title: {
    template: "%s — mesh.me",
    default: "mesh.me",
  },
};

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

  // Check if user needs verification (after 1 month of signup)
  const now = new Date();
  const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const accountOldEnough = user.createdAt < oneMonthAgo;
  const needsEmailVerification = accountOldEnough && !user.emailVerified;
  const needsPhoneVerification = accountOldEnough && !user.phoneVerified;

  // Get user email for the verification banner
  const userEmail = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true },
  }).then((u) => u?.email || "");

  return (
    <div className="relative min-h-screen bg-[var(--bg-primary)]">
      <MeshBackground density={30} className="opacity-30" />

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
          unreadMessages={unreadMessages}
        />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          {/* Minimal top bar — just quick actions, no redundant text */}
          <header className="sticky top-0 z-30 hidden h-12 items-center justify-end gap-1.5 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] px-5 backdrop-blur-2xl lg:flex">
            <Link
              href="/search"
              className="inline-flex items-center justify-center rounded-full p-2 text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              title="Search"
            >
              <Search className="h-4 w-4" />
            </Link>
            <Link
              href="/messages"
              className="relative inline-flex items-center justify-center rounded-full p-2 text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              title="Messages"
            >
              <MessageCircle className="h-4 w-4" />
              {unreadMessages > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[8px] font-bold text-white">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
            </Link>
            <Link
              href="/notifications"
              className="relative inline-flex items-center justify-center rounded-full p-2 text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          </header>

          <main className="min-h-[calc(100vh-3rem)] flex-1 px-4 pb-24 pt-5 md:px-6 lg:pb-6">
            {(needsEmailVerification || needsPhoneVerification) && (
              <VerificationBanner
                needsEmailVerification={needsEmailVerification}
                needsPhoneVerification={needsPhoneVerification}
                userEmail={userEmail}
              />
            )}
            <div className="mx-auto w-full max-w-5xl animate-page-enter">{children}</div>
          </main>
        </div>
      </div>

      <MobileNav unreadNotifications={unreadCount} unreadMessages={unreadMessages} username={user.username} />
      <MeshiFloat />
      <MeshiDeliveryWrapper />
      <AchievementChecker />
      <DynamicFavicon />
    </div>
  );
}
