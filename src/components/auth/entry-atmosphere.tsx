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
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
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
    const eligible = () => !reducedMotion && motion.matches && !document.hidden && !connection?.saveData && areVisualEffectsEnabled();
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
    motion.addEventListener("change", sync);
    connection?.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    const unsubscribe = subscribeInteractionPreferences(sync);
    return () => {
      disposed = true;
      cancelStart();
      motion.removeEventListener("change", sync);
      connection?.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      unsubscribe();
    };
  }, [reducedMotion]);

  return (
    <div className="entry-atmosphere" data-entry-atmosphere={enabled ? "live" : "still"} aria-hidden="true">
      {/* This light, static web also survives a slow/failed optional chunk. */}
      <svg className="entry-still-web" viewBox="0 0 1000 1000" preserveAspectRatio="none" focusable="false">
        <path d="M0 230 110 140 260 50 380 100 570 25 740 80 900 25 1000 190M0 540 75 360 110 140 20 20M0 880 90 740 75 360M90 740 230 940 410 900 600 975 780 895 930 950 1000 820M1000 530 925 385 900 25M925 385 950 680 780 895M260 50 180 0M230 940 100 1000M600 975 680 1000M110 140 0 120M950 680 1000 650" />
        <g>{[[110,140],[260,50],[380,100],[740,80],[900,25],[75,360],[90,740],[230,940],[410,900],[780,895],[925,385],[950,680]].map(([x,y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.4" />)}</g>
      </svg>
      {enabled ? <Constellation state={state} anchorRef={anchorRef} reducedMotion={reducedMotion} /> : null}
    </div>
  );
}
