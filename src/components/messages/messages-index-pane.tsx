"use client";

import Link from "next/link";
import { useMessagesData } from "@/components/messages/messages-data-context";
import { MeChatConversationList } from "@/components/messages/mechat-conversation-list";

export function MessagesIndexPane() {
  const { currentUser, initialThreads, initialNotes } = useMessagesData();

  return (
    <>
      <div className="lg:hidden">
        <MeChatConversationList
          variant="page"
          currentUser={currentUser}
          initialThreads={initialThreads}
          initialNotes={initialNotes}
        />
      </div>

      <div className="hidden h-full min-h-0 lg:flex lg:items-center lg:justify-center">
        <div className="mesh-surface mesh-pop-in mx-auto w-full max-w-3xl rounded-[32px] border border-[var(--mesh-border)] p-8 text-center shadow-[var(--shadow-lg)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] text-[var(--mesh-blue)] shadow-[0_0_34px_rgba(47,124,255,0.16)]">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M7 17l-3 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6" />
              <path d="M8 8h8" />
              <path d="M8 12h6" />
              <path d="M14 17h7" />
              <path d="M17.5 13.5v7" />
              <path d="M14 17h7" />
            </svg>
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mesh-text-secondary)]">
            Select a conversation
          </p>
          <h1 className="mt-2 text-4xl font-bold text-[var(--mesh-text)]">Open a thread to start chatting</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--mesh-text-secondary)]">
            Pick a conversation from the left rail to read the thread, share sources, and keep the discussion moving.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/messages?compose=true"
              className="mesh-action mesh-action-primary mesh-pressable px-5 text-sm"
            >
              Start new conversation
            </Link>
            <span className="rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-4 py-2 text-sm text-[var(--mesh-text-secondary)]">
              Universal messaging hub
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
