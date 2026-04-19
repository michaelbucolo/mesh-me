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

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/");
  if (!user.onboarded) redirect("/onboarding");

  const unreadCount = await prisma.notification.count({
    where: { recipientId: user.id, read: false },
  });

  const unreadMessages = await prisma
    .$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM Message m
     INNER JOIN ThreadMember tm ON tm.threadId = m.threadId
     WHERE tm.userId = ? AND m.senderId != ? AND m.createdAt > tm.lastRead`,
      user.id,
      user.id
    )
    .then((rows) => Number(rows[0]?.count ?? 0))
    .catch(() => 0);

  const now = new Date();
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  if (oneMonthAgo.getDate() !== now.getDate()) oneMonthAgo.setDate(0);
  const accountOldEnough = user.createdAt < oneMonthAgo;
  const needsEmailVerification = accountOldEnough && !user.emailVerified;
  const needsPhoneVerification = accountOldEnough && !user.phoneVerified;

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[var(--bg-primary)]">
      <MeshBackground density={30} className="opacity-20" />

      <div className="relative z-10 flex h-full">
        {/* Desktop sidebar */}
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

        {/* Main content area */}
        <div className="flex h-full min-w-0 flex-1 flex-col">
          {/* Desktop top bar — minimal, just quick actions */}
          <header className="sticky top-0 z-30 hidden h-11 shrink-0 items-center justify-end gap-1 border-b border-[var(--border-secondary)] bg-[var(--bg-primary)]/80 px-4 backdrop-blur-xl lg:flex">
            <Link
              href="/search"
              className="inline-flex items-center justify-center rounded-full p-2 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              title="Search"
            >
              <Search className="h-4 w-4" />
            </Link>
            <Link
              href="/messages"
              className="relative inline-flex items-center justify-center rounded-full p-2 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
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
              className="relative inline-flex items-center justify-center rounded-full p-2 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
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

          {/* Scrollable content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-native">
            <div className="px-4 pb-24 pt-4 md:px-6 lg:pb-6 lg:pt-5">
              {(needsEmailVerification || needsPhoneVerification) && (
                <VerificationBanner
                  needsEmailVerification={needsEmailVerification}
                  needsPhoneVerification={needsPhoneVerification}
                  userEmail={user.email}
                />
              )}
              <div className="mx-auto w-full max-w-5xl animate-page-enter">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav
        unreadNotifications={unreadCount}
        unreadMessages={unreadMessages}
        username={user.username}
      />

      {/* Global overlays */}
      <MeshiFloat />
      <MeshiDeliveryWrapper />
      <AchievementChecker />
      <DynamicFavicon />
    </div>
  );
}
