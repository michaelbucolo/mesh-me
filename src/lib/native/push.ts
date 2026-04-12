/**
 * Push notification helpers — registers for push, listens for
 * incoming notifications, and provides token management.
 */

import { isPluginAvailable } from "./platform";

export interface PushToken {
  value: string;
}

export interface PushNotificationData {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

async function getPushPlugin() {
  if (!isPluginAvailable("PushNotifications")) return null;
  const { PushNotifications } = await import("@capacitor/push-notifications");
  return PushNotifications;
}

/**
 * Request push notification permission and register with APNs.
 * Returns the device token on success, null on web / declined.
 */
export async function registerPush(): Promise<PushToken | null> {
  const push = await getPushPlugin();
  if (!push) return null;

  const permission = await push.requestPermissions();
  if (permission.receive !== "granted") return null;

  await push.register();

  return new Promise((resolve) => {
    push.addListener("registration", (token) => {
      resolve({ value: token.value });
    });
    push.addListener("registrationError", () => {
      resolve(null);
    });
  });
}

/**
 * Listen for incoming push notifications (foreground).
 * Returns a cleanup function to remove the listener.
 */
export async function onPushReceived(
  callback: (notification: PushNotificationData) => void
): Promise<(() => void) | null> {
  const push = await getPushPlugin();
  if (!push) return null;

  const handle = await push.addListener(
    "pushNotificationReceived",
    (notification) => {
      callback({
        title: notification.title ?? undefined,
        body: notification.body ?? undefined,
        data: notification.data,
      });
    }
  );

  return () => handle.remove();
}

/**
 * Listen for notification taps (user opened the app via a notification).
 */
export async function onPushTapped(
  callback: (notification: PushNotificationData) => void
): Promise<(() => void) | null> {
  const push = await getPushPlugin();
  if (!push) return null;

  const handle = await push.addListener(
    "pushNotificationActionPerformed",
    (action) => {
      callback({
        title: action.notification.title ?? undefined,
        body: action.notification.body ?? undefined,
        data: action.notification.data,
      });
    }
  );

  return () => handle.remove();
}

/** Get current notification permission status. */
export async function getPushPermissionStatus(): Promise<
  "granted" | "denied" | "prompt" | null
> {
  const push = await getPushPlugin();
  if (!push) return null;
  const status = await push.checkPermissions();
  return status.receive as "granted" | "denied" | "prompt";
}
