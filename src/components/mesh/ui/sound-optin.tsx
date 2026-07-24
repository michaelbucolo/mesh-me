// The one-time "Sound on?" affordance — PR7's sound opt-in.
//
// The mesh's playful layer (strum tones, emote pops) is SILENT until the
// user explicitly opts in. The first playful gesture surfaces this quiet
// chip once; both answers persist through the ONE existing sound preference
// path (audio/sound-kit → src/lib/sound), so Settings' Sounds toggle and
// this chip can never disagree — no second toggle exists. Reduced motion:
// the chip appears without its pop-in.

"use client";

import { Volume2, X } from "lucide-react";
import { acceptSoundOptIn, declineSoundOptIn } from "../audio/sound-kit";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function MeshSoundOptIn({ onDone }: { onDone: () => void }) {
  const reducedMotion = prefersReducedMotion();
  return (
    <div
      role="dialog"
      aria-label="Turn sound on?"
      data-testid="mesh-sound-optin"
      className="mesh-glass absolute bottom-16 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full py-1.5 pl-3 pr-1.5"
      style={{ animation: reducedMotion ? undefined : "bubbleIn .28s cubic-bezier(0.22,1,0.36,1)" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Volume2 size={14} className="shrink-0 text-cyan-200/90" aria-hidden />
      <span className="text-xs font-medium text-white/85">The mesh can sing — sound on?</span>
      <button
        type="button"
        onClick={() => {
          acceptSoundOptIn();
          onDone();
        }}
        className="mesh-ctl ds-focus-ring rounded-full bg-cyan-400/20 px-2.5 py-1 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-400/30"
      >
        Sound on
      </button>
      <button
        type="button"
        aria-label="Keep it quiet"
        onClick={() => {
          declineSoundOptIn();
          onDone();
        }}
        className="mesh-ctl ds-focus-ring rounded-full p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X size={13} />
      </button>
    </div>
  );
}
