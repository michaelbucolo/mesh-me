import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NotificationsClient } from "./notifications-client";
import { getCurrentUserRedirectState } from "@/lib/auth";
import { buildNotificationCenterPayload, type NotificationPreferenceSummary } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { getNotifications } from "@/lib/queries";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await getCurrentUserRedirectState();
  if (!user) redirect("/login");
  if (!user.onboarded) redirect("/onboarding");

  const [result, preferences] = await Promise.all([
    getNotifications(1, 100),
    prisma.userNotificationPreference.findUnique({
      where: { userId: user.id },
      select: {
        pushEnabled: true,
        emailDigest: true,
        messages: true,
        mentions: true,
        comments: true,
        follows: true,
        platformAlerts: true,
        securityAlerts: true,
        productUpdates: true,
      },
    }),
  ]);

  const payload = buildNotificationCenterPayload(
    result.notifications,
    result.unreadCount,
    preferences as NotificationPreferenceSummary | null,
  );

  return <NotificationsClient initialPayload={payload} />;
}
