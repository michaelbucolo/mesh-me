"use client";

import { useEffect } from "react";

const THROTTLE_KEY = "mesh-auto-sync-at";
const THROTTLE_MS = 5 * 60 * 1000;

/**
 * The caller /api/sync/auto never had. The endpoint that keeps connected
 * accounts fresh was fully built and wired to nothing, so "connect your
 * account" imported nothing until a person found the manual per-account Sync
 * button. This mounts once in the authenticated shell and fires a background
 * sync kick when the app opens and again whenever the tab comes back to the
 * foreground — which also covers the just-connected case for free, because a
 * brand-new account has lastSyncAt null and is always considered stale.
 *
 * Two throttles stack deliberately: this tab fires at most once per 5
 * minutes (sessionStorage stamp), and the server only syncs accounts whose
 * last sync is older than its own staleness window — so a burst of opens
 * can never starve the per-user sync budget that manual Sync clicks draw
 * from. Fire-and-forget: freshness is a background courtesy, never a
 * spinner, and a failure here costs nothing the next open won't retry.
 */
export function AutoSyncBeacon() {
  useEffect(() => {
    const kick = () => {
      if (document.visibilityState !== "visible") return;
      try {
        const last = Number(sessionStorage.getItem(THROTTLE_KEY) || 0);
        if (Date.now() - last < THROTTLE_MS) return;
        sessionStorage.setItem(THROTTLE_KEY, String(Date.now()));
      } catch {
        // sessionStorage unavailable — the server's staleness window still throttles.
      }
      void fetch("/api/sync/auto", { method: "POST", credentials: "same-origin" }).catch(() => {});
    };
    kick();
    document.addEventListener("visibilitychange", kick);
    return () => document.removeEventListener("visibilitychange", kick);
  }, []);

  return null;
}
