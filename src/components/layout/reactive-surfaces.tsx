"use client";

import { useEffect } from "react";

/**
 * Brings the login's alive, reactive feel to the whole app. A single delegated
 * pointer listener tracks the cursor over any interactive surface and writes its
 * local position into CSS custom properties (--mx/--my), which the stylesheet
 * uses to float a soft brand-tinted spotlight toward the cursor. Pure transform/
 * opacity work, rAF-throttled, and fully disabled under reduced-motion — no React
 * re-renders, so it stays smooth everywhere.
 */
const REACTIVE_SELECTOR = [
  ".ds-interactive",
  ".glass-card",
  ".simple-card",
  ".mesh-surface",
  ".premium-surface",
  ".ds-glass-panel",
  "[data-reactive]",
].join(",");

export function ReactiveSurfaces() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia?.("(hover: none)").matches) return;

    let current: HTMLElement | null = null;
    let frame = 0;
    let pending: { el: HTMLElement; x: number; y: number } | null = null;

    // How far the surface leans toward the cursor, in degrees. Kept small so
    // the tilt reads as depth, not a novelty flip.
    const MAX_TILT = 4;

    const apply = () => {
      frame = 0;
      if (!pending) return;
      const { el, x, y } = pending;
      el.style.setProperty("--mx", `${x}%`);
      el.style.setProperty("--my", `${y}%`);
      // Cursor offset from centre (−1…1) → a gentle 3D tilt. rotateY follows
      // the horizontal offset; rotateX is inverted so the near edge dips toward
      // the pointer, which is what "leaning toward you" looks like.
      const tiltY = ((x - 50) / 50) * MAX_TILT;
      const tiltX = ((50 - y) / 50) * MAX_TILT;
      el.style.setProperty("--tiltY", `${tiltY.toFixed(2)}deg`);
      el.style.setProperty("--tiltX", `${tiltX.toFixed(2)}deg`);
    };

    const clear = (el: HTMLElement | null) => {
      if (!el) return;
      el.removeAttribute("data-hot");
      el.style.removeProperty("--mx");
      el.style.removeProperty("--my");
      el.style.removeProperty("--tiltX");
      el.style.removeProperty("--tiltY");
    };

    const onMove = (event: PointerEvent) => {
      const target = event.target as Element | null;
      const el = target?.closest?.(REACTIVE_SELECTOR) as HTMLElement | null;
      if (el !== current) {
        clear(current);
        current = el;
        if (el) el.setAttribute("data-hot", "true");
      }
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      pending = { el, x, y };
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    const onLeave = () => {
      clear(current);
      current = null;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (frame) window.cancelAnimationFrame(frame);
      clear(current);
    };
  }, []);

  return null;
}
