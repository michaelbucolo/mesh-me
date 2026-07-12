"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

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
  const [threads, setThreads] = useState(value.initialThreads);

  useEffect(() => {
    let stopped = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/messages", { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!stopped && data && Array.isArray(data.threads)) setThreads(data.threads);
      } catch {
        // Best-effort — the next tick retries.
      }
    };
    const interval = window.setInterval(refresh, 10000);
    // Pull connected-account conversations into the unified inbox while the
    // tab is open, then refresh the thread list with anything new.
    const syncExternal = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        await fetch("/api/mechat/sync", { method: "POST", credentials: "same-origin" });
        await refresh();
      } catch {
        // Best-effort — the next cycle retries.
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
