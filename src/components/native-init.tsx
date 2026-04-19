/**
 * NativeInit — client component that bootstraps Capacitor plugins
 * on mount. Runs once at app startup to configure the status bar,
 * keyboard behaviour, and push notification listeners.
 *
 * Renders nothing visible — purely a side-effect provider.
 */

"use client";

import { useEffect } from "react";
import { isIOS, isNative } from "@/lib/native/platform";
import { setStatusBarLight, setStatusBarOverlay } from "@/lib/native/status-bar";
import { setAccessoryBarVisible } from "@/lib/native/keyboard";

export function NativeInit() {
  useEffect(() => {
    const body = document.body;
    body.classList.add("platform-web");

    if (isNative()) {
      body.classList.add("platform-native");
      body.classList.remove("platform-web");
    }

    if (isIOS()) body.classList.add("platform-ios");
    else body.classList.add("platform-android");

    if (!isNative()) {
      return () => {
        body.classList.remove("platform-web", "platform-native", "platform-ios", "platform-android");
      };
    }

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
          if (url.pathname) {
            window.location.href = url.pathname;
          }
        });

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
      body.classList.remove("platform-web", "platform-native", "platform-ios", "platform-android");
    };
  }, []);

  return null;
}
