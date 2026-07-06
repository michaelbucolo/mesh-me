"use client";

import { createContext, useContext, type ReactNode } from "react";

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
  return <MessagesDataContext.Provider value={value}>{children}</MessagesDataContext.Provider>;
}

export function useMessagesData() {
  const value = useContext(MessagesDataContext);
  if (!value) {
    throw new Error("MessagesDataProvider is missing");
  }
  return value;
}
