/**
 * NativeInit — client component that bootstraps Capacitor plugins
 * on mount. Runs once at app startup to configure the status bar,
 * keyboard behaviour, and push notification listeners.
 *
 * Renders nothing visible — purely a side-effect provider.
 */

"use client";

import { useEffect } from "react";
import { isNative } from "@/lib/native/platform";
import { setStatusBarLight, setStatusBarOverlay } from "@/lib/native/status-bar";
import { setAccessoryBarVisible } from "@/lib/native/keyboard";

export function NativeInit() {
  useEffect(() => {
    if (!isNative()) return;

    // Configure status bar for dark theme
    setStatusBarLight();
    setStatusBarOverlay(true);

    // Show keyboard accessory bar (Done button) on iOS
    setAccessoryBarVisible(true);

    // Listen for app state changes
    let cleanup: (() => void) | undefined;

    (async () => {
      const { isPluginAvailable } = await import("@capacitor/core").then(
        (m) => m.Capacitor
      );
      if (isPluginAvailable("App")) {
        const { App } = await import("@capacitor/app");

        // Handle deep links
        const urlHandle = await App.addListener("appUrlOpen", (event) => {
          const url = new URL(event.url);
          // Navigate to the path from the deep link
          if (url.pathname) {
            window.location.href = url.pathname;
          }
        });

        // Handle back button (Android, but good to have)
        const backHandle = await App.addListener("backButton", () => {
          window.history.back();
        });

        cleanup = () => {
          urlHandle.remove();
          backHandle.remove();
        };
      }
    })();

    return () => {
      cleanup?.();
    };
  }, []);

  // Render nothing — this is a side-effect-only component
  return null;
}
