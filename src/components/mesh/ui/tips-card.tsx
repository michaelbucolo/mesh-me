// First-visit tips — how to explore the mesh. Shown once on first visit and
// now genuinely reopenable from the Help & shortcuts sheet (the old rail
// comment promised this and never delivered). Extracted from mesh-scene.tsx.

"use client";

import { Compass, Hand, MousePointer2, X } from "lucide-react";

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
        className="presence-world-welcome w-full max-w-sm animate-[bubbleIn_.36s_cubic-bezier(0.22,1,0.36,1)] rounded-2xl mesh-panel p-5 shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-start justify-between">
          <div><span className="presence-empty-symbol"><Compass size={24} aria-hidden="true" /></span><p className="presence-kicker">Meet your mesh</p><h2 className="presence-page-title">This is your world</h2></div>
          <button
            type="button"
            aria-label="Close"
            onClick={onDismiss}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--paper-hover)] hover:text-[var(--text-primary)]"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
          The people and posts you&apos;re closest to sit closest to you.{" "}
          {isCoarsePointer
            ? "Drag to look around, pinch to zoom, tap anything to open it."
            : "Drag to look around, scroll to zoom, click anything to open it."}
        </p>
        <div className="presence-world-gestures"><span><Hand size={16} aria-hidden="true" />Drag to explore</span><span><MousePointer2 size={16} aria-hidden="true" />{isCoarsePointer ? "Tap to discover" : "Click to discover"}</span></div>
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
