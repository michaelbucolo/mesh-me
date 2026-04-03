import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MeshBackground } from "@/components/mesh-background";
import { DynamicFavicon } from "@/components/dynamic-favicon";
import { AchievementChecker } from "@/components/achievements/achievement-toast";
import { AppShell } from "@/components/layout/app-shell";
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
      <MeshBackground density={30} className="opacity-40" />
      <AppShell
        user={{
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          isAdmin: user.isAdmin,
        }}
        unreadNotifications={unreadCount}
      >
        {children}
      </AppShell>
      <AchievementChecker />
      <DynamicFavicon />
    </div>
  );
}
