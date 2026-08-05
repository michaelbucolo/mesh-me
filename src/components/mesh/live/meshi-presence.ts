/**
 * WHERE MESHI CURRENTLY IS — so there is only ever one of him.
 *
 * Meshi exists in two bodies that are meant to be the same character: the
 * floating DOM companion (`meshi-float`, mounted once at the app root and never
 * unmounted), and the one the mesh canvas draws at the heart of your world
 * (`meshi-layer`). Only one may be visible at a time.
 *
 * The float used to decide that from the PATHNAME alone — `pathname === "/mesh"`
 * meant "the canvas has him now, hide". But the pathname changes on the first
 * frame of the navigation, and the canvas Meshi does not exist until the mesh
 * request comes back. In the gap, the loading gate drew a THIRD Meshi of its own.
 * So entering your own mesh played:
 *
 *     float hides  ->  gate's Meshi fades in, centred  ->  gate unmounts,
 *     canvas Meshi appears at the heart
 *
 * Three separate DOM nodes for one character, none of them continuous with the
 * next. That is the "more than one Meshi" you can see.
 *
 * The handoff is now driven by the fact rather than by the route: the canvas
 * says when it actually has him, and the float yields on that exact frame and
 * not before. The gate draws no Meshi at all — the one companion is already on
 * screen and stays there through the wait.
 *
 * Module-level rather than context on purpose: the two bodies live in different
 * subtrees (root shell vs the mesh route) with no common provider below the app
 * root, and a context spanning both would re-render the entire app on every
 * handoff.
 */

import { useSyncExternalStore } from "react";

let canvasHasMeshi = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/**
 * Called by the mesh canvas layer when the owner's Meshi mounts and unmounts.
 * Idempotent — a re-render that reports the same value wakes nobody.
 */
export function setCanvasMeshi(present: boolean): void {
  if (canvasHasMeshi === present) return;
  canvasHasMeshi = present;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => canvasHasMeshi;
/** The server never has a canvas, so the float renders and there is no flash. */
const getServerSnapshot = () => false;

/** True while the mesh canvas is drawing Meshi, i.e. while the float must yield. */
export function useCanvasHasMeshi(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
