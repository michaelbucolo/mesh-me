"use client";

// Mute silences INTERRUPTIONS — the notification row and the lock-screen
// push — never messages. The unread badge keeps counting, the thread keeps
// arriving, nothing hides. The toggle writes only the caller's own
// membership row (the PATCH "mute" action refuses anything else).

import { useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";

export function MeChatMuteToggle({ threadId, initialMuted }: { threadId: string; initialMuted: boolean }) {
  const [muted, setMuted] = useState(initialMuted);
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      aria-pressed={muted}
      aria-label={muted ? "Unmute this conversation" : "Mute this conversation"}
      title={muted ? "Muted — notifications off, messages still arrive" : "Mute notifications"}
      onClick={() => {
        startTransition(async () => {
          try {
            const response = await fetch(`/api/messages/${threadId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "mute" }),
            });
            const data = (await response.json().catch(() => null)) as { muted?: boolean } | null;
            if (response.ok && typeof data?.muted === "boolean") setMuted(data.muted);
          } catch {
            // Shown state stays put; the next tap retries.
          }
        });
      }}
      className="mechat-key mechat-key-chip key inline-flex h-9 w-9 shrink-0 items-center justify-center text-[var(--mesh-text-secondary)] disabled:opacity-50"
    >
      {muted ? <BellOff size={15} aria-hidden="true" /> : <Bell size={15} aria-hidden="true" />}
    </button>
  );
}
