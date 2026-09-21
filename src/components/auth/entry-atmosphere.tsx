"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type RefObject } from "react";
import { areVisualEffectsEnabled, subscribeInteractionPreferences } from "@/lib/interaction-preferences";
import type { ConstellationState } from "@/components/auth/mesh-border-constellation";

const Constellation = dynamic(
  () => import("@/components/auth/mesh-border-constellation")
    .then((module) => module.MeshBorderConstellation)
    .catch(() => function UnavailableAtmosphere() { return null; }),
  { ssr: false, loading: () => null },
);

type SaveDataConnection = EventTarget & { saveData?: boolean };

/** Decorative work starts after the form is usable and only where it adds value. */
export function EntryAtmosphere({ state, anchorRef, reducedMotion }: {
  state: RefObject<ConstellationState>;
  anchorRef: RefObject<HTMLElement | null>;
  reducedMotion: boolean;
}) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px) and (min-height: 480px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const connection = (navigator as Navigator & { connection?: SaveDataConnection }).connection;
    let idle: number | undefined;
    let delay: number | undefined;
    let disposed = false;

    const cancelStart = () => {
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (delay !== undefined) window.clearTimeout(delay);
      idle = undefined;
      delay = undefined;
    };
    const eligible = () => !reducedMotion && desktop.matches && !document.hidden && !connection?.saveData && areVisualEffectsEnabled();
    const sync = () => {
      cancelStart();
      if (!eligible()) {
        setEnabled(false);
        return;
      }
      const start = () => {
        if (!disposed && eligible()) setEnabled(true);
      };
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(start, { timeout: 1200 });
      else delay = window.setTimeout(start, 320);
    };

    sync();
    desktop.addEventListener("change", sync);
    connection?.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    const unsubscribe = subscribeInteractionPreferences(sync);
    return () => {
      disposed = true;
      cancelStart();
      desktop.removeEventListener("change", sync);
      connection?.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      unsubscribe();
    };
  }, [reducedMotion]);

  return enabled ? <Constellation state={state} anchorRef={anchorRef} reducedMotion={reducedMotion} /> : null;
}
