"use client";

/**
 * "Share where you browse" — the OPT-IN behind the presence where-chips
 * ("in Ana's mesh", "watching the Flow") that mutual connections see at your
 * node. OFF by default: unless you opt in, the server redacts your location
 * from every payload lane that isn't the room you're actually sharing with
 * the viewer (see buildPresencePayload), and connections only see that
 * you're online — never where.
 *
 * Client plumbing mirrors Ghost Mode: localStorage is the per-device truth
 * the heartbeats read synchronously; a same-tab event keeps every control in
 * lockstep. Server-side enforcement is the real gate — users with
 * hide-activity or Ghost Mode on have no presence entry at all, so their
 * location can never surface regardless of this flag.
 */

import { readGhostMode } from "@/lib/ghost-mode";

const WHERE_SHARE_STORAGE_KEY = "meshShareWhere";

/** Same-tab event fired whenever the opt-in flips, so controls re-sync. */
export const WHERE_SHARE_EVENT = "meshShareWhereChanged";

/** Read the per-device opt-in. Defaults FALSE (opt-in, never opt-out). */
export function readWhereShare(): boolean {
  try {
    return localStorage.getItem(WHERE_SHARE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Persist + fan out a change, and push one heartbeat so live rooms apply
 * the new visibility immediately instead of waiting for the next beat. */
export function broadcastWhereShare(next: boolean): void {
  try {
    localStorage.setItem(WHERE_SHARE_STORAGE_KEY, String(next));
  } catch {
    // best-effort persistence
  }
  try {
    window.dispatchEvent(new Event(WHERE_SHARE_EVENT));
  } catch {
    // best-effort broadcast
  }
  void fetch("/api/mesh/presence", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ surface: "feed", shareWhere: next, ghostMode: readGhostMode() }),
  }).catch(() => {});
}
