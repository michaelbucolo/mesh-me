// Meshi mood policy — every mood decision the live room makes, extracted
// PURE. Two ladders live here:
//
// - `stepBehaviorMood`: your Meshi's inner life (warm when another Meshi
//   drifts close, a look-around fidget when you go quiet, a doze when you
//   stay away), with the hysteresis bands that keep a face from flickering.
// - `deriveBroadcastMood`: what your heartbeat tells the room you're DOING
//   (smitten after a heart-throw, focused while composing, sleepy once
//   you've gone quiet) — the richer the read, the more your Meshi feels
//   like you.
//
// No DOM, no React, no timers: callers feed observations in, moods come out.
// The 700ms sampling cadence and the broadcast schedule live with the
// callers; the thresholds and transitions live here, tested in
// scripts/mesh-live-contract.ts.

import type { MeshiMood } from "@/components/meshi/meshi-mascot";

/** The warm reaction cycle when a neighbour is close. */
const WARM_MOODS: readonly MeshiMood[] = ["giggle", "love", "wink", "happy"];

/** Warm up when a neighbour comes within this (screen px)… */
const WARM_ENTER_PX = 118;
/** …but stay warm until they drift past this — hysteresis, so a Meshi
 * hovering near the boundary can't flip the face on and off. */
const WARM_STAY_PX = 165;
/** Each warm beat holds this long, so it reads as a reaction, not a flicker. */
const WARM_HOLD_MS = 2600;
/** Quiet this long → look-around fidget (thinking/searching alternation). */
const IDLE_FIDGET_MS = 7000;
/** The fidget alternates on this period. */
const FIDGET_ALTERNATE_MS = 3400;
/** Quiet this long → doze off. */
const IDLE_SLEEP_MS = 22000;

export interface BehaviorMoodState {
  warmIdx: number;
  /** Wall/perf-clock stamp until which the current warm beat is held. */
  holdUntil: number;
  mood: MeshiMood | null;
}

export function createBehaviorMoodState(): BehaviorMoodState {
  return { warmIdx: 0, holdUntil: 0, mood: null };
}

export interface BehaviorMoodInput {
  /** performance.now() timebase (matches idleForMs). */
  now: number;
  /** Distance to the nearest OTHER Meshi in screen px; Infinity when alone. */
  nearestMeshiPx: number;
  /** How long since the viewer's last input; 0 when unknown. */
  idleForMs: number;
}

/** One behaviour sample. Mutates `state`, returns the mood (null = resting
 * face). Mirrors the old inner-life ticker exactly, hysteresis included. */
export function stepBehaviorMood(
  state: BehaviorMoodState,
  input: BehaviorMoodInput,
): MeshiMood | null {
  const { now, nearestMeshiPx, idleForMs } = input;
  const wasWarm = state.mood != null && WARM_MOODS.includes(state.mood);
  let next: MeshiMood | null = null;
  if (nearestMeshiPx < (wasWarm ? WARM_STAY_PX : WARM_ENTER_PX)) {
    // Someone's right here — react warmly, holding each beat.
    if (now > state.holdUntil) {
      state.warmIdx = (state.warmIdx + 1) % WARM_MOODS.length;
      state.holdUntil = now + WARM_HOLD_MS;
    }
    next = WARM_MOODS[state.warmIdx];
  } else {
    state.holdUntil = 0;
    if (idleForMs > IDLE_SLEEP_MS) next = "sleepy";
    else if (idleForMs > IDLE_FIDGET_MS) {
      next = Math.floor(now / FIDGET_ALTERNATE_MS) % 2 === 0 ? "thinking" : "searching";
    }
  }
  state.mood = next;
  return next;
}

/** A recent world action beams for this long on the broadcast face. */
const BROADCAST_ACTION_GLOW_MS = 4000;
/** Idle this long → the broadcast face goes sleepy. */
const BROADCAST_IDLE_SLEEPY_MS = 15000;

export interface BroadcastMoodInput {
  /** Date.now() timebase (matches pendingAction.at). */
  now: number;
  pendingAction: { kind: string; at: number } | null;
  composing: boolean;
  hovering: boolean;
  nodeOpen: boolean;
  /** The room-driven behaviour mood (stepBehaviorMood's output). */
  behaviorMood: MeshiMood | null;
  /** performance.now()-based idle span; 0 when unknown. */
  idleForMs: number;
  /** The resting face preference. */
  restingFace: string;
}

/** The mood ladder the heartbeat broadcasts — what you're DOING, not just
 * your default face. Priorities mirror the old inline ladder verbatim. */
export function deriveBroadcastMood(input: BroadcastMoodInput): string {
  const { now, pendingAction } = input;
  if (pendingAction && now - pendingAction.at < BROADCAST_ACTION_GLOW_MS) {
    // A heart-throw (real like or cosmetic fling) beams love; a wave, a
    // reaction burst or a strand being played reads as excited. The strum is
    // the one verb that can hold this rung for a whole sweep rather than a
    // single beat — which is right: your face should say you are playing for
    // as long as you are playing.
    return pendingAction.kind === "heart" || pendingAction.kind === "fling" ? "love" : "excited";
  }
  if (input.composing) return "thinking";
  if (input.hovering) return "excited";
  if (input.nodeOpen) return "learning";
  if (input.behaviorMood) return input.behaviorMood;
  if (input.idleForMs > BROADCAST_IDLE_SLEEPY_MS) return "sleepy";
  return input.restingFace;
}
