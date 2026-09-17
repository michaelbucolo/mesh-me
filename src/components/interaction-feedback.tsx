"use client";

import { useEffect } from "react";
import { feedback } from "@/lib/feedback";

export function InteractionFeedback() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!event.isTrusted || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-feedback], [role="tab"], [role="switch"]') : null;
      if (!target || target.closest('[disabled], [aria-disabled="true"], [aria-busy="true"]') || target.dataset.feedback === "off") return;
      if (target.getAttribute("aria-selected") === "true" || target.getAttribute("aria-current") === "page") return;
      feedback(target.dataset.feedback === "navigate" ? "navigate" : "select");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
