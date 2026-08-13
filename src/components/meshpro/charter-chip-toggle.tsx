"use client";

import { useState, useTransition } from "react";
import { setShowCharterNumber } from "@/lib/actions";

/**
 * The charter chip's off switch. The seat is permanent; wearing it is a
 * choice — same philosophy as activeTitle, which is also opt-in to display.
 */
export function CharterChipToggle({ initialShown }: { initialShown: boolean }) {
  const [shown, setShown] = useState(initialShown);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !shown;
    setShown(next);
    startTransition(async () => {
      const result = await setShowCharterNumber(next);
      if (result && "error" in result) setShown(!next);
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={shown}
      onClick={toggle}
      disabled={isPending}
      className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
    >
      <span
        aria-hidden="true"
        className={`relative h-4 w-7 rounded-full transition-colors ${shown ? "bg-[var(--accent-text)]" : "bg-[var(--text-muted)]/30"}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${shown ? "translate-x-3.5" : "translate-x-0.5"}`}
        />
      </span>
      Show on profile
    </button>
  );
}
