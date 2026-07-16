/**
 * Haptic feedback bridge for native navigation and Meshi interactions.
 * Calls are silent no-ops in a regular browser.
 */

import { isPluginAvailable } from "./platform";

type ImpactStyle = "HEAVY" | "MEDIUM" | "LIGHT";

export async function impactFeedback(style: ImpactStyle = "MEDIUM") {
  if (!isPluginAvailable("Haptics")) return;

  const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
  const styles = {
    HEAVY: ImpactStyle.Heavy,
    MEDIUM: ImpactStyle.Medium,
    LIGHT: ImpactStyle.Light,
  } as const;

  await Haptics.impact({ style: styles[style] });
}
