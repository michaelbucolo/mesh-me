// Fun-verb emitters — the flick-heart and the emote wheel's sends.
//
// Every verb here rides the EXISTING versioned action bus exactly like the
// lens's heart and the arrival wave do: staged on `rt.pendingAction`,
// broadcast by the next heartbeat, validated server-side against the fixed
// verb set. Fun-verb hearts ride the `fling` verb — NOT `heart` — because a
// `heart` on the wire has always meant "a real like was written", and every
// landing heart ticks the displayed count. A fling spawns the NON-COUNTING
// heart on every client instead, so play never inflates the Likes tick. Old
// clients ignore `fling` by the action bus's unknown-verb rule (no envelope
// change — one new entry in the shared verb list the server validates too).
//
// CAPABILITY-BY-CONSTRUCTION: none of these functions gate on ViewerCaps
// themselves — the surface only WIRES them (rail button, person long-press,
// flick release) when `viewer.canBroadcastPresence` is true, so on the
// read-only Global view the emitters are simply never instantiated.
//
// RATE CAPS: the server already budgets the presence route; the FunVerbGate
// here is the client-side courtesy cap on top — a minimum gap between fun
// verbs plus a rolling window, so play can never flood the room (or the
// heartbeat) no matter how enthusiastically someone spins the wheel.

import type { ReactionGlyph } from "../scene/reaction-glyphs";
import type { MeshRuntime } from "../scene/runtime";
import type { SceneNode } from "../scene/scene-model";
import { playFunSound } from "../audio/sound-kit";
import { spawnBurst, spawnCosmeticHeart } from "./hearts";

/** Fun verbs come one at a time, humanly. */
const FUN_VERB_MIN_GAP_MS = 700;
/** …and at most this many per rolling window (well under the server budget). */
const FUN_VERB_WINDOW_MS = 10000;
const FUN_VERB_WINDOW_MAX = 8;

export interface FunVerbGate {
  lastAt: number;
  windowStart: number;
  sent: number;
}

export function createFunVerbGate(): FunVerbGate {
  return { lastAt: 0, windowStart: 0, sent: 0 };
}

/** Admit one outgoing fun verb through the courtesy caps (records it). */
export function admitFunVerb(gate: FunVerbGate, now: number): boolean {
  if (now - gate.lastAt < FUN_VERB_MIN_GAP_MS) return false;
  if (now - gate.windowStart > FUN_VERB_WINDOW_MS) {
    gate.windowStart = now;
    gate.sent = 0;
  }
  if (gate.sent >= FUN_VERB_WINDOW_MAX) return false;
  gate.lastAt = now;
  gate.sent += 1;
  return true;
}

/** Where fun verbs launch from: your Meshi (cursor Meshi when visiting). */
function selfWorldPos(rt: MeshRuntime, isOwnMesh: boolean): { x: number; y: number } {
  return !isOwnMesh ? rt.cursorWorldPos : rt.ownerWorldPos;
}

/**
 * FLICK-HEART: the plucked node was flung — release throws a heart from your
 * Meshi at it, and the room sees it through the `fling` verb. Cosmetic +
 * broadcast only (a like is a deliberate act — the lens and the pluck ring
 * own that write), so the heart is the NON-COUNTING variant: it lands with
 * the full flourish but never ticks the displayed Likes count, here or on
 * any room member's client. Returns false when the courtesy cap held it.
 */
export function flickHeart(rt: MeshRuntime, isOwnMesh: boolean, node: SceneNode): boolean {
  const now = Date.now();
  if (!admitFunVerb(rt.funGate, now)) return false;
  const from = selfWorldPos(rt, isOwnMesh);
  // Reduced motion is handled inside spawnCosmeticHeart (no flying garnish);
  // the broadcast still goes out — motion preferences never mute the social act.
  spawnCosmeticHeart(rt, from.x, from.y, node.id);
  playFunSound("heart");
  rt.pendingAction = { kind: "fling", targetId: node.id, at: now };
  rt.heartbeatNow?.();
  return true;
}

/**
 * EMOTE WHEEL send: the heart needs a target (it flies somewhere — the server
 * enforces the same rule), and it broadcasts as `fling` — the wheel's heart
 * writes no like, so it must spawn the non-counting variant everywhere, never
 * a `heart` (which has always meant a real like and ticks the count). The
 * rest are targetless flourishes blooming at your Meshi, exactly like the
 * existing star/wave/wow moments. Returns false when the courtesy cap held
 * it (the wheel tells the user to ease up).
 */
export function sendEmote(
  rt: MeshRuntime,
  isOwnMesh: boolean,
  verb: ReactionGlyph,
  target: SceneNode | null,
): boolean {
  const now = Date.now();
  if (verb === "heart" && !target) return false;
  if (!admitFunVerb(rt.funGate, now)) return false;
  const from = selfWorldPos(rt, isOwnMesh);
  if (verb === "heart" && target) {
    spawnCosmeticHeart(rt, from.x, from.y, target.id);
    playFunSound("heart");
  } else {
    spawnBurst(rt, from.x, from.y - 16, verb, 5);
    playFunSound("pop");
  }
  rt.pendingAction = {
    kind: verb === "heart" ? "fling" : verb,
    targetId: verb === "heart" && target ? target.id : "",
    at: now,
  };
  rt.heartbeatNow?.();
  return true;
}
