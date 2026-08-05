// useCatchUp — the auto-advance behind Catch-up mode ("inbox zero for your
// mesh"). While a catch-up tour is live, the lens glides to the next unseen
// item every few seconds; any interaction inside the lens (or manual
// prev/next) pauses it, and the dots row's play button resumes. The stream
// itself (which ids, oldest-first) is owned by startCatchUp + the tour list;
// this hook only paces it.

"use client";

import { useCallback, useEffect, useState } from "react";
import type { LensCatchUp } from "./content-lens";

/** How long each stop gets before the tour glides on. */
const CATCHUP_DWELL_MS = 6000;

export function useCatchUp(opts: {
  /** The catch-up tour's ids (null = no tour running). */
  tourIds: string[] | null;
  /** The node currently open in the lens. */
  selectedId: string | null;
  navigate: (dir: 1 | -1) => void;
  /** The tour finished its last stop — close the lens, world un-dims. */
  end: () => void;
}): LensCatchUp | null {
  const { tourIds, selectedId, navigate, end } = opts;
  // Pause is scoped to ONE tour (keyed by the tour array's identity), so a
  // fresh tour always starts advancing — derived, no reset effect needed.
  const [pauseState, setPauseState] = useState<{ tour: string[] | null; paused: boolean }>({
    tour: null,
    paused: false,
  });

  const active = Boolean(tourIds && tourIds.length && selectedId);
  const paused = active && pauseState.tour === tourIds ? pauseState.paused : false;

  const index = active ? Math.max(0, tourIds!.indexOf(selectedId!)) : 0;
  const total = tourIds?.length ?? 0;

  useEffect(() => {
    if (!active || paused) return;
    const timer = setTimeout(() => {
      // Last stop dwelt out: catch-up complete.
      if (index >= total - 1) end();
      else navigate(1);
    }, CATCHUP_DWELL_MS);
    return () => clearTimeout(timer);
    // Keyed on index so each arrival restarts the dwell clock.
  }, [active, paused, index, total, navigate, end]);

  const onTogglePause = useCallback(() => {
    setPauseState((s) => ({ tour: tourIds, paused: s.tour === tourIds ? !s.paused : true }));
  }, [tourIds]);
  const onInteract = useCallback(() => setPauseState({ tour: tourIds, paused: true }), [tourIds]);

  if (!active) return null;
  return { index, total, paused, onTogglePause, onInteract };
}
