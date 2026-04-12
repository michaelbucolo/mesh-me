/**
 * React hook that detects whether the app is running inside a
 * native Capacitor shell. Useful for conditional rendering.
 */

"use client";

import { useSyncExternalStore } from "react";
import { isNative, isIOS, isWeb } from "@/lib/native/platform";

interface PlatformState {
  native: boolean;
  ios: boolean;
  web: boolean;
}

const defaultState: PlatformState = { native: false, ios: false, web: true };

// Compute once on the client — platform doesn't change at runtime.
let clientState: PlatformState | null = null;

function getSnapshot(): PlatformState {
  if (clientState) return clientState;
  clientState = {
    native: isNative(),
    ios: isIOS(),
    web: isWeb(),
  };
  return clientState;
}

function getServerSnapshot(): PlatformState {
  return defaultState;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function subscribe(onStoreChange: () => void): () => void {
  // Platform never changes — no subscription needed.
  return () => {};
}

export function usePlatform(): PlatformState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
