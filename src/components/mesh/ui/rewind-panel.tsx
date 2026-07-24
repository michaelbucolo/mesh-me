// Rewind — drag through time and watch this world re-assemble. The slider
// UI extracted verbatim from the old mesh-scene.tsx; the time-mapping and
// model rebuilds stay in useMeshWorld.

"use client";

import { History, X } from "lucide-react";

export function MeshRewindPanel({
  oldestMoment,
  rewindAt,
  rewindValue,
  headingSubject,
  onInput,
  onBackToNow,
  onClose,
}: {
  oldestMoment: number;
  rewindAt: number | null;
  rewindValue: number;
  /** "Your mesh" / "This mesh" — from meshCopy. */
  headingSubject: string;
  onInput: (value: number) => void;
  onBackToNow: () => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* A whisper of amber over the whole world while viewing the past. */}
      {rewindAt != null && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[4] bg-amber-400/[0.05]" />
      )}
      <div className="absolute inset-x-0 bottom-5 z-30 flex justify-center px-4">
      <div
        className="mesh-glass w-full max-w-xl animate-[bubbleIn_.32s_cubic-bezier(0.22,1,0.36,1)] rounded-2xl px-4 py-3"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 truncate text-[11px] font-semibold text-white/85">
            <History size={12} className="shrink-0 text-amber-300/90" />
            {rewindAt
              ? `${headingSubject} on ${new Date(rewindAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
              : "Rewind — drag to travel back through this world"}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {rewindAt != null && (
              <button
                type="button"
                onClick={onBackToNow}
                className="mesh-bubble-btn rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-white/15"
              >
                Back to now
              </button>
            )}
            <button
              type="button"
              aria-label="Close rewind"
              onClick={onClose}
              className="rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={13} />
            </button>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={1000}
          value={rewindValue}
          aria-label="Rewind this mesh through time"
          onChange={(e) => onInput(Number(e.target.value))}
          className="w-full accent-amber-300"
        />
        <div className="flex justify-between text-[9px] font-medium uppercase tracking-wide text-white/35">
          <span>{new Date(oldestMoment).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
          <span>Now</span>
        </div>
      </div>
      </div>
    </>
  );
}
