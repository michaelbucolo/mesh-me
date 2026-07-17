"use client";

import { useEffect, useState } from "react";

/**
 * Live "who's on mesh.me right now" among the viewer's MeChat contacts.
 * Polls lightly, pauses when the tab is hidden, and returns a set of online
 * user ids for dots and "Active now" lines.
 */
export function useContactPresence(pollMs = 12000): Set<string> {
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      const res = await fetch("/api/messages/presence", {
        credentials: "same-origin",
        cache: "no-store",
      }).catch(() => null);
      if (!res?.ok || cancelled) return;
      const data = await res.json().catch(() => null);
      if (!cancelled && data && Array.isArray(data.online)) {
        setOnline(new Set<string>(data.online));
      }
    };

    void load();
    const id = window.setInterval(load, pollMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pollMs]);

  return online;
}
