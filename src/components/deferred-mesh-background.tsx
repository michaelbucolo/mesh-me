"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { ComponentProps } from "react";

const MeshBackground = dynamic(() => import("@/components/mesh-background").then((mod) => mod.MeshBackground), {
  ssr: false,
});

type DeferredMeshBackgroundProps = ComponentProps<typeof MeshBackground> & {
  delayMs?: number;
};

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

function prefersReducedDecorations() {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    Boolean(nav.connection?.saveData) ||
    nav.connection?.effectiveType === "slow-2g" ||
    nav.connection?.effectiveType === "2g"
  );
}

export function DeferredMeshBackground({ delayMs = 360, className = "", ...props }: DeferredMeshBackgroundProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (prefersReducedDecorations()) return;

    const win = window as WindowWithIdleCallback;
    let timeoutId: number | null = null;
    let idleId: number | null = null;
    let rafId: number | null = null;

    rafId = window.requestAnimationFrame(() => {
      if (win.requestIdleCallback) {
        idleId = win.requestIdleCallback(() => setReady(true), { timeout: delayMs + 700 });
      } else {
        timeoutId = window.setTimeout(() => setReady(true), delayMs);
      }
    });

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (idleId !== null) win.cancelIdleCallback?.(idleId);
    };
  }, [delayMs]);

  return (
    <>
      <div
        className={`mesh-field-canvas absolute inset-0 h-full w-full ${className} mesh-background-placeholder`}
        style={{ pointerEvents: "none", position: props.fixed ? "fixed" : undefined }}
        aria-hidden="true"
      />
      {ready ? <MeshBackground {...props} className={className} /> : null}
    </>
  );
}
