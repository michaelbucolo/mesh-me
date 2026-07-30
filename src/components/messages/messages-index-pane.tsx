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
          <h2 className="mt-6 text-2xl font-semibold text-[var(--mesh-text)]">Your messages</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--mesh-text-secondary)]">
            Your mesh.me conversations live here. Connected platforms keep their own inboxes — none of
            them opens messages to other apps — so MeChat links out to those rather than pretending to
            hold them.
          </p>
          {/* The one action on an otherwise empty screen, and it had no material:
              `.mesh-pressable` (globals.css:2192) LIFTS 2px on hover and swaps in a
              wide blurred shadow, the fill was raw --accent under an EMITTING glow
              (`0 4px 20px var(--accent-glow)`), and the press was `active:scale-95`
              — the control shrinking away from the finger. It is the shared key
              now, moulded from jade because --domain-messages is jade
              (tokens.css:102). `.key-lit` supplies the pinned --mould-jade-ink, so
              the unpinned `text-white` goes with it. */}
          <Link
            href="/messages?compose=true"
            className="mechat-key key key-lit [--mould:var(--mould-jade)] [--mould-ink:var(--mould-jade-ink)] [--mould-plinth:var(--mould-jade-plinth)] mt-6 inline-flex min-h-11 items-center px-6 py-2.5 text-sm font-semibold"
          >
            Start a conversation
          </Link>
        </div>
      </div>
    </>
  );
}
