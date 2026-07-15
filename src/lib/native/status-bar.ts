/**
 * Status bar bridge — controls the iOS status bar style and
 * visibility from JavaScript.
 */

import { isPluginAvailable } from "./platform";

async function getStatusBarPlugin() {
  if (!isPluginAvailable("StatusBar")) return null;
  const { StatusBar } = await import("@capacitor/status-bar");
  return StatusBar;
}

/** Set the status bar to light content (white text). */
export async function setStatusBarLight(): Promise<void> {
  const bar = await getStatusBarPlugin();
  if (!bar) return;
  const { Style } = await import("@capacitor/status-bar");
  await bar.setStyle({ style: Style.Dark }); // Dark = light text on dark bg
}

/** Enable overlay mode (content renders behind status bar). */
export async function setStatusBarOverlay(overlay: boolean): Promise<void> {
  const bar = await getStatusBarPlugin();
  if (!bar) return;
  await bar.setOverlaysWebView({ overlay });
}
