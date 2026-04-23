"use client";

import { useEffect, useRef } from "react";

const LIVE_SYNC_INTERVAL_MS = 30_000;

export function LiveSyncPulse() {
  const inFlight = useRef(false);

  useEffect(() => {
    const triggerSync = async () => {
      if (inFlight.current || typeof document === "undefined" || document.visibilityState !== "visible") return;
      inFlight.current = true;
      try {
        await fetch("/api/sync/auto", {
          method: "POST",
          cache: "no-store",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        // ignore transient sync failures; next pulse retries
      } finally {
        inFlight.current = false;
      }
    };

    const handleOnline = () => { void triggerSync(); };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void triggerSync();
    };

    void triggerSync();
    const intervalId = window.setInterval(() => { void triggerSync(); }, LIVE_SYNC_INTERVAL_MS);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}
