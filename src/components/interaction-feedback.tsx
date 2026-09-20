"use client";

import { useEffect } from "react";
import { feedback } from "@/lib/feedback";
import { installCelebrations } from "@/lib/celebration";

export function InteractionFeedback() {
  useEffect(() => {
    const removeCelebrations = installCelebrations();
    const onClick = (event: MouseEvent) => {
      if (!event.isTrusted || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-feedback], [role="tab"], [role="switch"]') : null;
      if (!target || target.closest('[disabled], [aria-disabled="true"], [aria-busy="true"]') || target.dataset.feedback === "off") return;
      if (target.getAttribute("aria-selected") === "true" || target.getAttribute("aria-current") === "page") return;
      feedback(target.dataset.feedback === "navigate" ? "navigate" : "select");
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      removeCelebrations();
    };
  }, []);
  return null;
}
