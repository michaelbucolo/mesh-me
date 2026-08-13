"use client";

import { useState } from "react";
import { GiftMeshiItemForm } from "@/components/meshpro/gift-meshi-item-form";
import { GiftMeshProForm } from "@/components/meshpro/gift-meshpro-form";

export type GiftMode = "months" | "piece";

/**
 * The gift page's two quiet modes. A local toggle, not routes: switching is a
 * thought mid-gesture ("actually, just the hat"), not a navigation.
 */
export function GiftModes({ initialMode = "months", initialUsername = "" }: { initialMode?: GiftMode; initialUsername?: string }) {
  const [mode, setMode] = useState<GiftMode>(initialMode);

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="What to give">
        {(
          [
            { id: "months" as const, title: "Months of MeshPro", detail: "The whole thing, for a while" },
            { id: "piece" as const, title: "One wardrobe piece", detail: "One small thing, forever" },
          ]
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={mode === option.id}
            onClick={() => setMode(option.id)}
            className={`mesh-choice rounded-xl p-3 text-left transition ${
              mode === option.id ? "border-[var(--accent-muted)] bg-[var(--accent-bg)]" : ""
            }`}
          >
            <p className="text-sm font-semibold text-[var(--text-primary)]">{option.title}</p>
            <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">{option.detail}</p>
          </button>
        ))}
      </div>

      {mode === "months" ? (
        <GiftMeshProForm initialUsername={initialUsername} />
      ) : (
        <GiftMeshiItemForm initialUsername={initialUsername} />
      )}
    </div>
  );
}
