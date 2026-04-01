import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { MeshBackground } from "@/components/mesh-background";
import { DynamicFavicon } from "@/components/dynamic-favicon";
import { MeshiFloat } from "@/components/meshi/meshi-float";
import { AchievementChecker } from "@/components/achievements/achievement-toast";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) redirect("/");
  if (!user.onboarded) redirect("/onboarding");

  const unreadCount = await prisma.notification.count({
    where: { recipientId: user.id, read: false },
  });

  return (
    <div className="relative min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Subtle constellation mesh behind entire app */}
      <MeshBackground density={30} className="opacity-40" />
      <div className="relative z-10 flex">
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
        <main className="flex-1 min-h-screen pb-20 lg:pb-0">
          {children}
        </main>
      </div>
      <MobileNav unreadNotifications={unreadCount} username={user.username} />
      <MeshiFloat />
      <AchievementChecker />
      <DynamicFavicon />
    </div>
  );
}
