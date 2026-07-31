import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { buildPushPayload, type NotificationCategory } from "@/lib/notifications";

/**
 * Web Push delivery — the half of notifications that reaches a person whose
 * tab is CLOSED. Until this existed, mesh.me requested notification
 * permission during onboarding and then never sent anything: every
 * "notification" was a row a person only saw by opening the app, which means
 * the native platforms won every session by default.
 *
 * Configuration is three env vars (WEB_PUSH_VAPID_PUBLIC_KEY,
 * WEB_PUSH_VAPID_PRIVATE_KEY, WEB_PUSH_CONTACT — generate a pair with
 * `npx web-push generate-vapid-keys`). Absent keys, every function here is a
 * quiet no-op: the client never subscribes (the public key endpoint returns
 * null) and the sender returns before touching the database, so the feature
 * is dormant, never broken.
 */

function vapidConfig(): { publicKey: string; privateKey: string; contact: string } | null {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  const contact = process.env.WEB_PUSH_CONTACT?.trim() || "mailto:hello@mesh.me";
  return { publicKey, privateKey, contact };
}

export function getVapidPublicKey(): string | null {
  return vapidConfig()?.publicKey ?? null;
}

/** Which per-category preference column gates a push, when one exists.
 *  Likes/shares have no dedicated toggle — pushEnabled alone governs them. */
const CATEGORY_PREFERENCE: Partial<Record<NotificationCategory, "messages" | "mentions" | "comments" | "follows" | "securityAlerts" | "platformAlerts">> = {
  messages: "messages",
  mentions: "mentions",
  comments: "comments",
  follows: "follows",
  security: "securityAlerts",
  privacy: "platformAlerts",
};

/**
 * Deliver a just-created Notification row to every browser the recipient has
 * subscribed. Always fire-and-forget from the caller's perspective (wrap in
 * `after()` or `void`): a push failure must never fail a like. Dead
 * subscriptions (push service says 404/410 — the browser revoked or expired
 * it) are pruned as they are discovered.
 */
export async function sendPushForNotification(
  recipientId: string,
  notification: { type: string; message: string | null; postId?: string | null },
): Promise<void> {
  const config = vapidConfig();
  if (!config) return;

  try {
    const [subscriptions, preference] = await Promise.all([
      prisma.pushSubscription.findMany({
        where: { userId: recipientId },
        select: { id: true, endpoint: true, p256dh: true, auth: true },
      }),
      prisma.userNotificationPreference.findUnique({
        where: { userId: recipientId },
        select: {
          pushEnabled: true,
          messages: true,
          mentions: true,
          comments: true,
          follows: true,
          securityAlerts: true,
          platformAlerts: true,
        },
      }),
    ]);
    if (subscriptions.length === 0) return;
    // No preference row means the defaults (everything on) apply.
    if (preference && !preference.pushEnabled) return;

    const payload = buildPushPayload(notification);
    const gate = CATEGORY_PREFERENCE[payload.category];
    if (preference && gate && !preference[gate]) return;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: payload.tag,
    });

    webpush.setVapidDetails(config.contact, config.publicKey, config.privateKey);
    const dead: string[] = [];
    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            body,
            { TTL: 60 * 60 * 24 },
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) dead.push(subscription.id);
          // Any other failure (transient push-service error) is dropped —
          // the notification row itself is the durable record.
        }
      }),
    );
    if (dead.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } });
    }
  } catch {
    // Never let push delivery surface an error into the action that caused it.
  }
}
