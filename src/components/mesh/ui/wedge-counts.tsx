// Wedge unseen counts — the manage layer's "what's piled up where".
//
// One chip per branch wedge carrying unseen content ("People · 12 new"):
// tapping the chip focuses that wedge in the world; the ✓ pill marks the
// branch seen. Marking seen is a VIEWER-SIDE preference (a local watermark,
// scene/seen-marks.ts) — it clears New marks for this viewer only and never
// mutates anything another user can observe. DOM overlay, zero canvas work.

"use client";

import { Check } from "lucide-react";
import type { BranchKey } from "../scene/scene-model";
import type { UnseenBranchCount } from "../scene/seen-marks";

const BRANCH_LABELS: Partial<Record<BranchKey, string>> = {
  posts: "Your posts",
  people: "People",
  platforms: "Platforms",
};

export function MeshWedgeCounts({
  unseen,
  onFocusBranch,
  onMarkSeen,
}: {
  unseen: UnseenBranchCount[];
  onFocusBranch: (branch: BranchKey) => void;
  onMarkSeen: (branch: BranchKey) => void;
}) {
  if (unseen.length === 0) return null;
  return (
    <div className="absolute bottom-5 left-3 z-30 flex flex-col items-start gap-1.5">
      {unseen.map(({ branch, count }) => (
        <div
          key={branch}
          className="mesh-glass flex items-center gap-0.5 rounded-full p-1"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onFocusBranch(branch)}
            className="mesh-ctl ds-focus-ring rounded-full px-2.5 py-1 text-[11px] font-semibold text-white/85"
          >
            {BRANCH_LABELS[branch] ?? branch}
            <span className="ml-1.5 rounded-full bg-cyan-400/15 px-1.5 py-px text-[10px] font-bold text-cyan-200">
              {count} new
            </span>
          </button>
          <button
            type="button"
            aria-label={`Mark ${BRANCH_LABELS[branch] ?? branch} seen`}
            title="Mark seen"
            onClick={() => onMarkSeen(branch)}
            className="mesh-ctl ds-focus-ring rounded-full p-1.5 text-white/55 transition-colors hover:text-white"
          >
            <Check size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
