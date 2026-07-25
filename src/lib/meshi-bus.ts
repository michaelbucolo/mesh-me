/**
 * THE CAUSE BUS — how the product tells Meshi that something happened.
 *
 * Meshi is meant to represent the user: where they are, what they are doing,
 * how it went. Until now nothing in the product could tell Meshi anything.
 * `meshi-events.ts` was eight lines and one event ("open a panel"), and there
 * were four `dispatchEvent(new CustomEvent(...))` calls in the entire tree.
 *
 * So Meshi guessed. It inferred the world from raw `mousemove`, `keydown` and
 * `scroll`, and cycled through a per-route list of moods on an eight-second
 * `setInterval` — a character pulling faces on a timer while the user sat
 * still. That is the thing that reads as decorative rather than alive, and it
 * is the design system's DO-NOT #9 (no ambient motion when nothing is
 * happening) with a face on it.
 *
 * The fix is not more inference. It is that every reaction has a CAUSE with a
 * name, published at the moment the thing actually occurred:
 *
 *     publishMeshiCause({ kind: "post:published" })
 *
 * THE RULE THIS FILE EXISTS TO HOLD
 *
 * If you cannot answer "whose hand caused this?" in one sentence, Meshi does
 * not react. The three legitimate answers are: the user did something, another
 * person did something, or a fact changed. A timer is not an answer, which is
 * why there is no `publishAmbient` here and no way to schedule a cause.
 *
 * Causes are fire-and-forget and never queue. If Meshi is not mounted, or is
 * suppressed, or the panel is open, the cause is simply missed — a reaction
 * that arrives late is worse than one that never arrives, because the user has
 * already moved on and the reaction now points at nothing.
 */

import type { MeshiMood } from "@/components/meshi/meshi-mascot";

/** Not exported: publish and subscribe are the only ways in, deliberately. */
const MESHI_CAUSE_EVENT = "meshi:cause";

/**
 * Everything the product can tell Meshi. Deliberately a closed union: adding a
 * cause should be a decision someone makes on purpose, not a string typed at a
 * call site.
 */
export type MeshiCauseKind =
  // ── The user did something ──
  | "post:published"
  | "post:liked"
  | "message:sent"
  | "follow:added"
  | "account:connected"
  | "account:disconnected"
  | "search:started"
  | "settings:saved"
  | "action:failed"
  // ── Someone else did something ──
  | "message:received"
  | "follow:received"
  | "reaction:received"
  // ── A fact changed ──
  | "sync:completed"
  | "mesh:woven";

export type MeshiCause = {
  kind: MeshiCauseKind;
  /**
   * A real, counted number where one exists ("12 posts woven"). Never a
   * fabricated one — a number the user cannot verify costs every later number
   * its credibility.
   */
  count?: number;
  /** Who caused it, when the cause came from another person. */
  actor?: { displayName: string | null; username: string } | null;
};

/**
 * How Meshi reacts to each cause, and for how long. The mood is the whole
 * reaction: no bespoke animation per cause, because that is how a mascot
 * becomes a slot machine.
 *
 * `holdMs` is short by design. Meshi reacts and returns to itself, the way a
 * person's expression settles — a face that stays surprised for ten seconds is
 * not reacting, it is posing.
 */
const REACTIONS: Record<MeshiCauseKind, { mood: MeshiMood; holdMs: number }> = {
  "post:published": { mood: "celebrating", holdMs: 2600 },
  "post:liked": { mood: "love", holdMs: 1600 },
  "message:sent": { mood: "happy", holdMs: 1400 },
  "follow:added": { mood: "excited", holdMs: 2000 },
  "account:connected": { mood: "celebrating", holdMs: 2600 },
  "account:disconnected": { mood: "thinking", holdMs: 1800 },
  "search:started": { mood: "searching", holdMs: 1800 },
  "settings:saved": { mood: "happy", holdMs: 1400 },
  // Failure gets a real reaction rather than a cheerful one. Meshi represents
  // the user, and the user is not delighted that it failed.
  "action:failed": { mood: "surprised", holdMs: 2200 },

  "message:received": { mood: "excited", holdMs: 2200 },
  "follow:received": { mood: "love", holdMs: 2400 },
  "reaction:received": { mood: "giggle", holdMs: 2000 },

  "sync:completed": { mood: "cool", holdMs: 2000 },
  "mesh:woven": { mood: "excited", holdMs: 2000 },
};

export function reactionFor(kind: MeshiCauseKind): { mood: MeshiMood; holdMs: number } {
  return REACTIONS[kind];
}

/**
 * Tell Meshi something happened. Call this AT the moment it happened — after
 * the server confirmed it, not when the request was sent, or Meshi celebrates
 * posts that failed to publish.
 */
export function publishMeshiCause(cause: MeshiCause): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<MeshiCause>(MESHI_CAUSE_EVENT, { detail: cause }));
}

/** Listen for causes. Returns the unsubscribe function. */
export function subscribeMeshiCause(handler: (cause: MeshiCause) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<MeshiCause>).detail;
    if (detail && detail.kind in REACTIONS) handler(detail);
  };
  window.addEventListener(MESHI_CAUSE_EVENT, listener);
  return () => window.removeEventListener(MESHI_CAUSE_EVENT, listener);
}
