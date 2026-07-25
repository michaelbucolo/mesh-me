"use client";

import Link from "next/link";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";
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
        <div className="mesh-pop-in mx-auto flex w-full max-w-md flex-col items-center px-8 text-center">
          <MeshiMascot size={110} mood="happy" prop="envelope" animate showGlow />
          <h1 className="mt-6 text-2xl font-semibold text-[var(--mesh-text)]">Your messages</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--mesh-text-secondary)]">
            Every conversation — from mesh.me and all your connected platforms — lives here. Pick one on the left, or start something new.
          </p>
          <Link
            href="/messages?compose=true"
            className="mesh-pressable mt-6 rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_var(--accent-glow)] transition hover:brightness-110 active:scale-95"
          >
            Start a conversation
          </Link>
        </div>
      </div>
    </>
  );
}
