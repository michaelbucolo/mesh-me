import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildNotificationCenterPayload, type NotificationPreferenceSummary } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { getNotifications } from "@/lib/queries";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";

function noStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      ...(init?.headers ?? {}),
    },
  });
}

const MAX_NOTIFICATION_LIMIT = 100;

function cleanNotificationIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean),
  )).slice(0, MAX_NOTIFICATION_LIMIT);
}

async function loadNotificationCenter(page: number, limit: number, userId: string) {
  const [result, preferences] = await Promise.all([
    getNotifications(page, limit),
    prisma.userNotificationPreference.findUnique({
      where: { userId },
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

  const center = buildNotificationCenterPayload(
    result.notifications,
    result.unreadCount,
    preferences as NotificationPreferenceSummary | null,
  );

  return { result, center };
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return noStore({ error: "Not authenticated" }, { status: 401 });

  const page = Math.max(Number(req.nextUrl.searchParams.get("page") ?? "1"), 1);
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? "60"), 1), MAX_NOTIFICATION_LIMIT);
  const { center } = await loadNotificationCenter(page, limit, user.id);

  return noStore({
    ...center,
    notifications: center.notifications,
  });
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return noStore({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return noStore({ error: "Not authenticated" }, { status: 401 });

  const payload = await readJsonObject(req);
  const action = typeof payload.action === "string" ? payload.action : "";
  const notificationIds = cleanNotificationIds(payload.notificationIds);
  const scopedWhere = notificationIds.length > 0
    ? { recipientId: user.id, id: { in: notificationIds } }
    : { recipientId: user.id };

  if (action === "mark-read") {
    const updated = await prisma.notification.updateMany({
      where: { ...scopedWhere, read: false },
      data: { read: true },
    });
    const { center } = await loadNotificationCenter(1, 100, user.id);
    return noStore({ success: true, updated: updated.count, ...center, notifications: center.notifications });
  }

  if (action === "mark-unread") {
    const updated = await prisma.notification.updateMany({
      where: { ...scopedWhere, read: true },
      data: { read: false },
    });
    const { center } = await loadNotificationCenter(1, 100, user.id);
    return noStore({ success: true, updated: updated.count, ...center, notifications: center.notifications });
  }

  if (action === "delete-read") {
    const deleted = await prisma.notification.deleteMany({
      where: { ...scopedWhere, read: true },
    });
    const { center } = await loadNotificationCenter(1, 100, user.id);
    return noStore({ success: true, deleted: deleted.count, ...center, notifications: center.notifications });
  }

  if (action === "create-test-alert" && process.env.NODE_ENV !== "production") {
    await prisma.notification.create({
      data: {
        type: "security_alert",
        recipientId: user.id,
        actorId: user.id,
        message: "Security check: a new trusted notification test was created.",
      },
    });
    const { center } = await loadNotificationCenter(1, 100, user.id);
    return noStore({ success: true, ...center, notifications: center.notifications });
  }

  return noStore({ error: "Unsupported action" }, { status: 400 });
}
