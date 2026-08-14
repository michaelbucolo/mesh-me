"use client";

import { useMessagesData } from "@/components/messages/messages-data-context";
import { MeChatConversationList } from "@/components/messages/mechat-conversation-list";

// The rail reads the SAME live context as the /messages index pane. The
// layout used to hand it the raw server prop, so between navigations the
// rail never saw a poll update — new conversations, previews, and unread
// counts froze the moment the page loaded.
export function MessagesRailList() {
  const { currentUser, initialThreads, initialNotes } = useMessagesData();
  return (
    <MeChatConversationList
      variant="rail"
      currentUser={currentUser}
      initialThreads={initialThreads}
      initialNotes={initialNotes}
    />
  );
}
