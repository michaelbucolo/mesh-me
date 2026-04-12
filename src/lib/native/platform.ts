/**
 * Platform detection — identifies whether the app is running inside
 * a native Capacitor shell (iOS / Mac Catalyst) or in the browser.
 */

import { Capacitor } from "@capacitor/core";

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function isIOS(): boolean {
  return Capacitor.getPlatform() === "ios";
}

export function isWeb(): boolean {
  return Capacitor.getPlatform() === "web";
}

/**
 * Returns true when the viewport looks like an iPad or Mac Catalyst
 * (native iOS + screen width >= 768).
 */
export function isTabletOrDesktop(): boolean {
  if (!isIOS()) return false;
  return window.innerWidth >= 768;
}

/**
 * Safely check whether a specific Capacitor plugin is available on
 * the current platform. Returns false on web so callers can fall
 * back gracefully.
 */
export function isPluginAvailable(name: string): boolean {
  return Capacitor.isPluginAvailable(name);
}
