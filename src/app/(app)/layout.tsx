import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/lib/prisma";
import { NativeInit } from "@/components/native-init";
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

  const [unreadNotifications, unreadMessages] = await Promise.all([
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
    <ThemeProvider>
      <ToastProvider>
        <NativeInit />
        <div className="relative h-[100dvh] overflow-hidden bg-[var(--bg-primary)]">
          <MeshBackground density={30} className="opacity-30" />

          <AppShell
            user={{
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
              isAdmin: user.isAdmin,
            }}
            needsEmailVerification={needsEmailVerification}
            needsPhoneVerification={needsPhoneVerification}
            userEmail={userEmail}
            initialCounts={{ unreadNotifications, unreadMessages }}
          >
            {children}
          </AppShell>
          <MeshiFloat />
          <MeshiDeliveryWrapper />
          <AchievementChecker />
          <LiveSyncPulse />
          <DynamicFavicon />
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
