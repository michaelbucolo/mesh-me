// The "?" shortcuts sheet — the mesh's keyboard map, finally surfaced (the
// old scene shipped `/ + - 0 f l` with no UI mentioning any of them), plus
// the way back into the welcome tips. Opens with `?` on fine-pointer devices
// and from the rail's Help button everywhere.

"use client";

import { X } from "lucide-react";

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ["/"], label: "Search this mesh" },
  { keys: ["L"], label: "Explore as a list" },
  { keys: ["+", "−"], label: "Zoom in / out" },
  { keys: ["0", "F"], label: "Fit the whole mesh" },
  { keys: ["←", "→"], label: "Previous / next in the reader" },
  { keys: ["Esc"], label: "Close the topmost panel" },
  { keys: ["?"], label: "Open this sheet" },
];

export function MeshShortcutsSheet({
  isCoarsePointer,
  onShowTips,
  onClose,
}: {
  isCoarsePointer: boolean;
  onShowTips: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-50 flex animate-[fadeIn_.18s_ease] items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Help and keyboard shortcuts"
        className="w-full max-w-sm animate-[bubbleIn_.36s_cubic-bezier(0.22,1,0.36,1)] rounded-2xl mesh-panel p-5 shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-start justify-between">
          <p className="text-sm font-semibold text-white">Help &amp; shortcuts</p>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        {!isCoarsePointer && (
          <ul className="mt-1 space-y-1.5">
            {SHORTCUTS.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-3">
                <span className="text-xs text-white/70">{s.label}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {s.keys.map((k) => (
                    <kbd
                      key={k}
                      className="rounded-md border border-white/15 bg-white/8 px-1.5 py-0.5 text-micro font-semibold text-white/85"
                    >
                      {k}
                    </kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
        {isCoarsePointer && (
          <p className="text-xs leading-relaxed text-white/70">
            Drag to look around, pinch to zoom, tap anything to open it. Double-tap empty space to zoom in.
            Press and hold a post to pluck it — quick actions pop out around it; fling it to throw a heart.
            Hold a person to send them a reaction, and sweep across the strands to strum them.
          </p>
        )}
        {!isCoarsePointer && (
          <p className="mt-3 text-micro leading-relaxed text-white/50">
            Tip: press and hold a post to pluck it — Like, Save, Share and Mute pop out around it
            (fling it to throw a heart). Hold a person to send a reaction, and sweep your cursor
            across the strands to strum them.
          </p>
        )}
        <button
          type="button"
          onClick={onShowTips}
          className="mesh-bubble-btn mesh-glass mesh-ctl ds-focus-ring mt-4 w-full rounded-full py-2 text-xs font-semibold text-white/85"
        >
          Show the welcome tips again
        </button>
      </div>
    </div>
  );
}
