"use client";

import { useEffect } from "react";

// Registers the service worker that makes mesh.me installable everywhere a
// browser exists (iOS/Android home screen, macOS/Windows/Linux desktop) and
// keeps a graceful offline shell. Production only — dev stays uncached.
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failing (old browser, private mode) never breaks the app.
    });
  }, []);
  return null;
}
