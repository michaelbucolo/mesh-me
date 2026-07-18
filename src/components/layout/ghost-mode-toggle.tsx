"use client";

import { useState } from "react";
import { Ghost } from "lucide-react";

const STORAGE_KEY = "meshGhostMode";

/**
 * One-tap Ghost Mode. While active, both presence heartbeats carry
 * ghostMode:true, which every consumer (mesh cursors, "Active now",
 * profile live badge, contact presence) already filters out. The control
 * itself is the persistent indicator: it stays visibly lit while ghosting.
 */
export function GhostModeToggle({ compact = false }: { compact?: boolean }) {
  const [ghost, setGhost] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const toggle = () => {
    const next = !ghost;
    setGhost(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // best-effort persistence
    }
    // Same-tab listeners (the mesh turns your Meshi into a ghost) react now.
    try {
      window.dispatchEvent(new Event("meshGhostModeChanged"));
    } catch {
      // best-effort broadcast
    }
    // Take effect immediately instead of waiting for the next heartbeat.
    void fetch("/api/mesh/presence", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ surface: "feed", ghostMode: next }),
    }).catch(() => {});
  };

  return (
    <button
      type="button"
      onClick={toggle}
      suppressHydrationWarning
      aria-pressed={ghost}
      aria-label={ghost ? "Ghost Mode is on — tap to become visible" : "Turn on Ghost Mode"}
      title={ghost ? "Ghost Mode on: others can't see you live" : "Ghost Mode: hide your live presence"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 transition ${
        compact ? "h-9 justify-center" : "h-9"
      } ${
        ghost
          ? "border-violet-400/50 bg-violet-500/20 text-violet-300"
          : "border-[var(--mesh-border)] bg-[var(--mesh-panel)] text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text)]"
      }`}
    >
      <Ghost size={15} className={ghost ? "animate-pulse" : undefined} aria-hidden="true" />
      {!compact && <span className="text-xs font-semibold">{ghost ? "Ghosting" : "Ghost"}</span>}
    </button>
  );
}
