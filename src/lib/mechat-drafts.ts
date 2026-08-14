"use client";

// MECHAT DRAFTS — one key builder, shared by the writer (the thread
// composer) and the reader (the conversation list's Draft badge), so the
// two can never drift apart. Drafts live in sessionStorage: they survive
// navigation, die with the tab, and never touch the server.

import { useMemo, useSyncExternalStore } from "react";

export const mechatDraftKey = (id: string) => `mechat-draft:${id}`;

// Same-tab sessionStorage writes fire no "storage" event, so this
// subscription only catches other tabs; same-tab freshness rides the
// list's own 10s poll re-render, which re-reads the snapshot below.
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

/**
 * Which of these thread ids currently hold a non-empty draft. Server
 * snapshot is empty — the badge appears after hydration, never mismatched.
 * Note the boundary: drafts keyed by recipientId/"new" (a conversation
 * that does not exist yet) have no list row to badge, by construction.
 */
export function useMeChatDraftIds(threadIds: string[]): Set<string> {
  const getSnapshot = () => {
    try {
      return threadIds
        .filter((id) => (window.sessionStorage.getItem(mechatDraftKey(id)) ?? "").trim() !== "")
        .join("|");
    } catch {
      return "";
    }
  };
  const withDrafts = useSyncExternalStore(subscribe, getSnapshot, () => "");
  return useMemo(() => new Set(withDrafts ? withDrafts.split("|") : []), [withDrafts]);
}
