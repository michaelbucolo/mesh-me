// Compose: post straight onto your constellation. Extracted verbatim from
// the old mesh-scene.tsx — a thin frame around the shared PostComposer.

"use client";

import { Sparkles, X } from "lucide-react";
import { PostComposer } from "@/components/feed/post-composer";

export function MeshComposeModal({
  meshUser,
  onClose,
  onPostCreated,
}: {
  meshUser: { displayName: string; avatarUrl: string | null };
  onClose: () => void;
  onPostCreated: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-50 flex animate-[fadeIn_.18s_ease] items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl animate-[bubbleIn_.36s_cubic-bezier(0.22,1,0.36,1)] rounded-2xl mesh-panel p-3 shadow-2xl">
        <div className="mb-2 flex items-start justify-between px-1">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-[var(--accent)]" />
            <div>
              <p className="text-sm font-semibold text-white">Create on your mesh</p>
              <p className="text-micro text-white/45">Watch it weave itself into your web.</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <PostComposer user={meshUser} startExpanded onPostCreated={onPostCreated} />
      </div>
    </div>
  );
}
