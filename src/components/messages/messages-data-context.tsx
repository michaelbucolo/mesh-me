"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Person = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified?: boolean;
};

type MeChatThread = {
  id: string;
  title: string;
  threadType: string;
  memberCount: number;
  isEncrypted: boolean;
  otherUser: Person | null;
  otherUsers: Person[];
  lastMessage: {
    content: string;
    senderId: string;
    createdAt: string;
  } | null;
  platform: string;
  unread: number;
};

type MeChatNoteEntry = {
  id: string;
  userId: string;
  text: string;
  songTitle: string | null;
  songArtist: string | null;
  createdAt: string;
  expiresAt: string;
  user: Person;
};

export type MessagesSidebarData = {
  currentUser: Person;
  initialThreads: MeChatThread[];
  initialNotes: MeChatNoteEntry[];
};

const MessagesDataContext = createContext<MessagesSidebarData | null>(null);

export function MessagesDataProvider({
  value,
  children,
}: {
  value: MessagesSidebarData;
  children: ReactNode;
}) {
  // The server renders the initial inbox; from there the thread list stays
  // live by polling while the tab is visible, so new conversations, latest
  // messages, and unread counts appear without a reload.
  //
  // The poll snapshot is KEYED to the server payload it was polled on top
  // of. When a navigation brings a fresh server payload, the stale snapshot
  // is ignored by derivation — no remount required. (The provider used to be
  // <MessagesDataProvider key={thread-list fingerprint}>, which threw away
  // the entire subtree — list scroll, focus, entrance state — every time a
  // message arrived anywhere.)
  const [polled, setPolled] = useState<{ baseline: MeChatThread[]; threads: MeChatThread[] } | null>(null);
  const baselineRef = useRef(value.initialThreads);
  const threads = polled && polled.baseline === value.initialThreads ? polled.threads : value.initialThreads;

  useEffect(() => {
    // A poll that raced this sync stamps the OLD baseline and is ignored by
    // the derivation above — self-healing on the next 10s tick.
    baselineRef.current = value.initialThreads;
  }, [value.initialThreads]);

  useEffect(() => {
    let stopped = false;
    let refreshInFlight = false;
    let syncInFlight = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (stopped || refreshInFlight || document.visibilityState !== "visible") return;
      refreshInFlight = true;
      const baseline = baselineRef.current;
      try {
        const res = await fetch("/api/messages", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!stopped && baseline === baselineRef.current && data && Array.isArray(data.threads)) {
          const fingerprint = JSON.stringify(data.threads);
          setPolled((previous) => {
            const current = previous?.baseline === baseline ? previous.threads : baseline;
            return JSON.stringify(current) === fingerprint ? previous : { baseline, threads: data.threads };
          });
        }
      } catch {
        // Best-effort — the next tick retries.
      } finally {
        refreshInFlight = false;
      }
    };
    const interval = window.setInterval(refresh, 10000);
    // Pull connected-account conversations into the unified inbox while the
    // tab is open, then refresh the thread list with anything new.
    const syncExternal = async () => {
      if (stopped || syncInFlight || document.visibilityState !== "visible") return;
      syncInFlight = true;
      try {
        await fetch("/api/mechat/sync", { method: "POST", credentials: "same-origin", signal: controller.signal });
        await refresh();
      } catch {
        // Best-effort — the next cycle retries.
      } finally {
        syncInFlight = false;
      }
    };
    void syncExternal();
    const syncInterval = window.setInterval(syncExternal, 120_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(interval);
      window.clearInterval(syncInterval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const live = useMemo(
    () => ({ ...value, initialThreads: threads }),
    [value, threads],
  );

  return <MessagesDataContext.Provider value={live}>{children}</MessagesDataContext.Provider>;
}

export function useMessagesData() {
  const value = useContext(MessagesDataContext);
  if (!value) {
    throw new Error("MessagesDataProvider is missing");
  }
  return value;
}
