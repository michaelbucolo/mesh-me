import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { prisma } from "@/lib/prisma";
import { AppChrome } from "@/components/layout/app-chrome";
import { MeshBackground } from "@/components/mesh-background";
import { DynamicFavicon } from "@/components/dynamic-favicon";
import { MeshiFloat } from "@/components/meshi/meshi-float";
import { MeshiDeliveryWrapper } from "@/components/meshi/meshi-delivery-wrapper";
import { AchievementChecker } from "@/components/achievements/achievement-toast";
import { LiveSyncPulse } from "@/components/live-sync-pulse";

export const metadata: Metadata = {
  title: {
    template: "%s | mesh.me",
    default: "mesh.me",
  },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) redirect("/");
  if (!user.onboarded) redirect("/onboarding");

  const [unreadCount, unreadMessages] = await Promise.all([
    prisma.notification.count({
      where: { recipientId: user.id, read: false },
    }),
    prisma
      .$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*) as count
        FROM "Message" m
        INNER JOIN "ThreadMember" tm ON tm."threadId" = m."threadId"
        WHERE tm."userId" = ${user.id}
          AND m."senderId" != ${user.id}
          AND m."createdAt" > tm."lastRead"
      `
      .then((rows) => Number(rows[0]?.count ?? 0))
      .catch(() => 0),
  ]);

  const now = new Date();
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  if (oneMonthAgo.getDate() !== now.getDate()) oneMonthAgo.setDate(0);
  const accountOldEnough = user.createdAt < oneMonthAgo;
  const needsEmailVerification = accountOldEnough && !user.emailVerified;
  const needsPhoneVerification = accountOldEnough && !user.phoneVerified;
  const userEmail = user.email;

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[var(--bg-primary)]">
      <MeshBackground density={30} className="opacity-30" />

      <div className="relative z-10 flex h-full">
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

        <div className="flex h-full min-w-0 flex-1 flex-col">
          <AppChrome
            unreadNotifications={unreadCount}
            unreadMessages={unreadMessages}
            username={user.username}
            needsEmailVerification={needsEmailVerification}
            needsPhoneVerification={needsPhoneVerification}
            userEmail={userEmail}
          >
            {children}
          </AppChrome>
        </div>
      </div>

      <MobileNav unreadNotifications={unreadCount} unreadMessages={unreadMessages} username={user.username} />
      <MeshiFloat />
      <MeshiDeliveryWrapper />
      <AchievementChecker />
      <LiveSyncPulse />
      <DynamicFavicon />
    </div>
  );
}
