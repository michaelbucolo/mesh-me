import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { prisma } from "@/lib/prisma";
import { AppChrome } from "@/components/layout/app-chrome";
import dynamic from "next/dynamic";

const MeshBackground = dynamic(() => import("@/components/mesh-background").then((module) => module.MeshBackground));
const DynamicFavicon = dynamic(() => import("@/components/dynamic-favicon").then((module) => module.DynamicFavicon), { ssr: false });
const MeshiFloat = dynamic(() => import("@/components/meshi/meshi-float").then((module) => module.MeshiFloat), { ssr: false });
const MeshiDeliveryWrapper = dynamic(
  () => import("@/components/meshi/meshi-delivery-wrapper").then((module) => module.MeshiDeliveryWrapper),
  { ssr: false },
);
const AchievementChecker = dynamic(
  () => import("@/components/achievements/achievement-toast").then((module) => module.AchievementChecker),
  { ssr: false },
);
const LiveSyncPulse = dynamic(() => import("@/components/live-sync-pulse").then((module) => module.LiveSyncPulse), { ssr: false });

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

  // Check if user needs verification (after 1 month of signup)
  const now = new Date();
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  if (oneMonthAgo.getDate() !== now.getDate()) oneMonthAgo.setDate(0);
  const accountOldEnough = user.createdAt < oneMonthAgo;
  const needsEmailVerification = accountOldEnough && !user.emailVerified;
  const needsPhoneVerification = accountOldEnough && !user.phoneVerified;

  // Get user email for the verification banner
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
