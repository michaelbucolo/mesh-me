"use client";

/**
 * Ghost Mode client plumbing shared by every control that can flip it (the
 * header pill, the Settings > Privacy toggle). The account record is the
 * cross-device source of truth (persisted via the `setGhostMode` action);
 * localStorage is the in-tab source of truth that the mesh scene and presence
 * heartbeats read synchronously.
 */

// NOTE: where-share.ts imports readGhostMode from here, so this is a module
// cycle — safe because both modules only export hoisted function declarations
// that call each other at runtime, never at module-evaluation time.
import { readWhereShare } from "@/lib/where-share";

export const GHOST_STORAGE_KEY = "meshGhostMode";

/** Same-tab event fired whenever Ghost Mode flips, so every control re-syncs. */
export const GHOST_EVENT = "meshGhostModeChanged";

/** Read the per-device Ghost Mode flag. Safe on the server / before hydration. */
export function readGhostMode(): boolean {
  try {
    return localStorage.getItem(GHOST_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Fan a Ghost Mode change out to every in-tab consumer WITHOUT touching the
 * account record: writes localStorage (which the mesh scene + heartbeats read),
 * fires the same-tab event (so the header pill and the Settings toggle stay in
 * lockstep), and pushes one presence heartbeat so live rooms react immediately
 * instead of waiting for the next beat. Persisting to the account is the
 * caller's job (`setGhostMode`) so a screen with its own save status can own it.
 */
export function broadcastGhostMode(next: boolean): void {
  try {
    localStorage.setItem(GHOST_STORAGE_KEY, String(next));
  } catch {
    // best-effort persistence
  }
  try {
    window.dispatchEvent(new Event(GHOST_EVENT));
  } catch {
    // best-effort broadcast
  }
  void fetch("/api/mesh/presence", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    // Stamp the where-share opt-in too: the server treats an absent flag as
    // false, so this beat would otherwise knock an opted-in user's flag off
    // until their next regular heartbeat restored it.
    body: JSON.stringify({ surface: "feed", ghostMode: next, shareWhere: readWhereShare() }),
  }).catch(() => {});
}
