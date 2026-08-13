// Compose: post straight onto your constellation. Extracted verbatim from
// the old mesh-scene.tsx — a thin frame around the shared PostComposer.

"use client";

import { PenLine, X } from "lucide-react";
import { PostComposer } from "@/components/feed/post-composer";

export function MeshComposeModal({
  closing = false,
  meshUser,
  onClose,
  onPostCreated,
}: {
  meshUser: { displayName: string; avatarUrl: string | null };
  onClose: () => void;
  /** Chrome is playing the 170ms graceful exit — render leaving, swallow input. */
  closing?: boolean;
  onPostCreated: () => void;
}) {
  return (
    <div
      className={`absolute inset-0 z-50 flex ${closing ? "pointer-events-none animate-[fadeOut_.16s_var(--mesh-ease-press)_both]" : "animate-[fadeIn_.18s_var(--mesh-ease-out)]"} items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center`}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Create on your mesh" className={`w-full max-w-xl ${closing ? "animate-[bubbleOut_.16s_var(--mesh-ease-press)_both]" : "animate-[bubbleIn_.36s_var(--mesh-ease-out)]"} rounded-2xl mesh-panel p-3 shadow-2xl`}>
        <div className="mb-2 flex items-start justify-between px-1">
          <div className="flex items-center gap-2">
            <PenLine size={15} className="text-[var(--accent)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Create on your mesh</p>
              <p className="text-micro text-[var(--text-tertiary)]">Watch it weave itself into your web.</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--paper-hover)] hover:text-[var(--text-primary)]"
          >
            <X size={16} />
          </button>
        </div>
        <PostComposer user={meshUser} startExpanded onPostCreated={onPostCreated} />
      </div>
    </div>
  );
}
