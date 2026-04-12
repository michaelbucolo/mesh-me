/**
 * Haptic feedback bridge — wraps @capacitor/haptics so callers can
 * fire-and-forget without worrying about platform checks.
 *
 * On web the calls are silent no-ops.
 */

import { isPluginAvailable } from "./platform";

type ImpactStyle = "HEAVY" | "MEDIUM" | "LIGHT";

async function getHapticsPlugin() {
  if (!isPluginAvailable("Haptics")) return null;
  const { Haptics } = await import("@capacitor/haptics");
  return Haptics;
}

/** Trigger an impact haptic (button taps, toggles). */
export async function impactFeedback(style: ImpactStyle = "MEDIUM") {
  const haptics = await getHapticsPlugin();
  if (!haptics) return;
  const { ImpactStyle } = await import("@capacitor/haptics");
  const map: Record<string, typeof ImpactStyle[keyof typeof ImpactStyle]> = {
    HEAVY: ImpactStyle.Heavy,
    MEDIUM: ImpactStyle.Medium,
    LIGHT: ImpactStyle.Light,
  };
  await haptics.impact({ style: map[style] ?? ImpactStyle.Medium });
}

/** Trigger a notification haptic (success, warning, error). */
export async function notificationFeedback(
  type: "SUCCESS" | "WARNING" | "ERROR" = "SUCCESS"
) {
  const haptics = await getHapticsPlugin();
  if (!haptics) return;
  const { NotificationType } = await import("@capacitor/haptics");
  const map: Record<string, typeof NotificationType[keyof typeof NotificationType]> = {
    SUCCESS: NotificationType.Success,
    WARNING: NotificationType.Warning,
    ERROR: NotificationType.Error,
  };
  await haptics.notification({ type: map[type] ?? NotificationType.Success });
}

/** Light selection-changed haptic (scrolling through items). */
export async function selectionFeedback() {
  const haptics = await getHapticsPlugin();
  if (!haptics) return;
  await haptics.selectionStart();
  await haptics.selectionChanged();
  await haptics.selectionEnd();
}
