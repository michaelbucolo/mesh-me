// First-visit tips — how to explore the mesh. Shown once on first visit and
// now genuinely reopenable from the Help & shortcuts sheet (the old rail
// comment promised this and never delivered). Extracted from mesh-scene.tsx.

"use client";

import { X } from "lucide-react";

export function MeshTipsCard({
  isCoarsePointer,
  onDismiss,
}: {
  isCoarsePointer: boolean;
  onDismiss: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-50 flex animate-[fadeIn_.18s_ease] items-end justify-center bg-black/55 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:pb-4"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        className="w-full max-w-sm animate-[bubbleIn_.36s_cubic-bezier(0.22,1,0.36,1)] rounded-2xl mesh-panel p-5 shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-start justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Your mesh</p>
          <button
            type="button"
            aria-label="Close"
            onClick={onDismiss}
            className="rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--paper-hover)] hover:text-[var(--text-primary)]"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          The people and posts you&apos;re closest to sit closest to you.{" "}
          {isCoarsePointer
            ? "Drag to look around, pinch to zoom, tap anything to open it."
            : "Drag to look around, scroll to zoom, click anything to open it."}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mesh-bubble-btn mesh-cta ds-focus-ring mt-4 w-full rounded-full py-2 text-xs font-semibold"
        >
          Start exploring
        </button>
      </div>
    </div>
  );
}
