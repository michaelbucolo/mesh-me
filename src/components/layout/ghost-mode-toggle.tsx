"use client";

import { useEffect, useState } from "react";
import { Ghost } from "lucide-react";
import { setGhostMode } from "@/lib/actions";
import { playSound } from "@/lib/sound";

const STORAGE_KEY = "meshGhostMode";

/**
 * One-tap Ghost Mode. While active, presence heartbeats carry ghostMode:true —
 * which every consumer (mesh cursors, "Active now", profile live badge, contact
 * presence) already filters out — and the account setting is the authoritative
 * signal server-side. Ghost Mode is persisted per-account (`initialGhost`), so it
 * follows the user across devices; the control itself stays visibly lit while on.
 */
export function GhostModeToggle({ compact = false, initialGhost = false }: { compact?: boolean; initialGhost?: boolean }) {
  const [ghost, setGhost] = useState(initialGhost);

  // The account value is the source of truth. Sync the per-device localStorage
  // (which the mesh scene and heartbeats read) to it on mount, so Ghost Mode
  // reflects the account state on every device — not just the one you toggled on.
  useEffect(() => {
    try {
      if ((localStorage.getItem(STORAGE_KEY) === "true") !== initialGhost) {
        localStorage.setItem(STORAGE_KEY, String(initialGhost));
        window.dispatchEvent(new Event("meshGhostModeChanged"));
      }
    } catch {
      // best-effort sync
    }
  }, [initialGhost]);

  const toggle = () => {
    const next = !ghost;
    setGhost(next);
    playSound(next ? "ghost" : "pop");
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
    // Persist to the account so Ghost Mode follows the user to other devices.
    void setGhostMode(next).catch(() => {});
    // Take effect immediately in the live room instead of waiting for the next heartbeat.
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
