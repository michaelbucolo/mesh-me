/**
 * Haptic feedback bridge for native navigation and Meshi interactions.
 * Uses native haptics or short vibration on supported touch browsers.
 */

import { isNative, isPluginAvailable } from "./platform";
import { isHapticsEnabled } from "../interaction-preferences";

type ImpactStyle = "HEAVY" | "MEDIUM" | "LIGHT";
let lastFeedback = -Infinity;

function canPlay(): boolean {
  return typeof document !== "undefined" && document.visibilityState !== "hidden" && isHapticsEnabled();
}

async function haptic(style: ImpactStyle | "SUCCESS" | "ERROR") {
  if (!canPlay()) return;
  const started = performance.now();
  if (started - lastFeedback < 65) return;
  lastFeedback = started;
  try {
    if (isNative() && isPluginAvailable("Haptics")) {
      const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
      // A late module download must not produce a buzz after the moment passed.
      if (!canPlay() || performance.now() - started > 180) return;
      if (style === "SUCCESS" || style === "ERROR") {
        await Haptics.notification({ type: style === "SUCCESS" ? NotificationType.Success : NotificationType.Error });
      } else {
        await Haptics.impact({ style: { HEAVY: ImpactStyle.Heavy, MEDIUM: ImpactStyle.Medium, LIGHT: ImpactStyle.Light }[style] });
      }
    } else if (typeof navigator.vibrate === "function" && window.matchMedia?.("(pointer: coarse)").matches) {
      // Supported touch browsers only. iOS Safari and desktop browsers simply
      // keep the visual response; no hidden switches or audio-based workarounds.
      navigator.vibrate(style === "SUCCESS" ? [8, 35, 12] : style === "ERROR" ? [12, 40, 12] : style === "LIGHT" ? 6 : 12);
    }
  } catch { /* Unsupported hardware must never interrupt the action. */ }
}

export async function impactFeedback(style: ImpactStyle = "MEDIUM") {
  await haptic(style);
}

export async function notificationFeedback(type: "SUCCESS" | "ERROR") {
  await haptic(type);
}
