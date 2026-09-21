"use client";

import { useId, useRef, useState } from "react";
import { GiftMeshiItemForm } from "@/components/meshpro/gift-meshi-item-form";
import { GiftMeshProForm } from "@/components/meshpro/gift-meshpro-form";

export type GiftMode = "months" | "piece";

/**
 * The gift page's two quiet modes. A local toggle, not routes: switching is a
 * thought mid-gesture ("actually, just the hat"), not a navigation.
 */
export function GiftModes({ initialMode = "months", initialUsername = "" }: { initialMode?: GiftMode; initialUsername?: string }) {
  const [mode, setMode] = useState<GiftMode>(initialMode);
  const tabsId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  return (
    <div className="grid gap-5">
      <div className="personal-gift-modes grid grid-cols-2 gap-2" role="tablist" aria-label="What to give">
        {(
          [
            { id: "months" as const, title: "Months of MeshPro", detail: "The whole thing, for a while" },
            { id: "piece" as const, title: "One wardrobe piece", detail: "One small thing, forever" },
          ]
        ).map((option, index) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            id={`${tabsId}-${option.id}`}
            aria-controls={`${tabsId}-panel`}
            aria-selected={mode === option.id}
            tabIndex={mode === option.id ? 0 : -1}
            ref={(element) => { tabRefs.current[index] = element; }}
            onClick={() => setMode(option.id)}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
              setMode(next === 0 ? "months" : "piece");
              tabRefs.current[next]?.focus();
            }}
            className={`mesh-choice rounded-xl p-3 text-left transition ${
              mode === option.id ? "border-[var(--accent-muted)] bg-[var(--accent-bg)]" : ""
            }`}
          >
            <p className="text-sm font-semibold text-[var(--text-primary)]">{option.title}</p>
            <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">{option.detail}</p>
          </button>
        ))}
      </div>

      <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${mode}`}>
      {mode === "months" ? (
        <GiftMeshProForm initialUsername={initialUsername} />
      ) : (
        <GiftMeshiItemForm initialUsername={initialUsername} />
      )}
      </div>
    </div>
  );
}
