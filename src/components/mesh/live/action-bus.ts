// The versioned action bus — the ONE wire format for the tiny world actions
// Meshis broadcast to a room (a thrown heart, a reaction burst, a wave hello).
//
// Wire contract (PR6):
// - OUTGOING actions ride the presence heartbeat as a versioned JSON envelope
//   `{v, type, targetId, atMs}` (plus a legacy `at` alias so an old server
//   that still reads `action.at` accepts a new client unchanged).
// - The SERVER normalizes either envelope at its edge (`parseActionBody`) and
//   stores the room-visible `lastAction` in the legacy pipe encoding
//   `"type|targetId|atMs"` — old clients split("|") that format today and
//   already skip verbs they don't know, so mixed-version rooms keep working.
// - RECEIVERS parse `lastAction` through `admitRoomAction`, which accepts the
//   pipe encoding AND a JSON envelope (so a future server can switch storage
//   formats without another client migration), dedupes by sender+timestamp,
//   and enforces the explicit compatibility rule:
//
//   UNKNOWN VERBS ARE IGNORED. A newer client's verb this build doesn't know
//   still consumes its dedupe slot (so it can never replay later as a stale
//   surprise) but produces no event — a mixed-version room degrades to
//   silence for the unknown verb, never to an error or a mis-replay.
//
// This module is isomorphic on purpose: the presence API route imports the
// same parse/encode used by the client, so the two edges can't drift.

const ACTION_BUS_VERSION = 1;

/** Every world action this build understands. PR7 extends this list — old
 * clients ignore the new entries by the unknown-verb rule above. */
export const ACTION_VERBS = ["heart", "star", "spark", "wow", "wave"] as const;
export type ActionVerb = (typeof ACTION_VERBS)[number];

const VERB_SET: ReadonlySet<string> = new Set(ACTION_VERBS);

export function isKnownVerb(verb: string): verb is ActionVerb {
  return VERB_SET.has(verb);
}

/** A validated, known action ready to replay. */
export interface ActionEvent {
  verb: ActionVerb;
  targetId: string;
  atMs: number;
}

/** A structurally-valid action off the wire, verb NOT yet validated. */
export interface WireAction {
  verb: string;
  targetId: string;
  atMs: number;
}

/** The versioned outgoing envelope (`at` = legacy alias for old servers). */
export interface ActionEnvelope {
  v: number;
  type: string;
  targetId: string;
  atMs: number;
  at: number;
}

const MAX_TARGET_ID = 160;

export function encodeActionEnvelope(action: {
  kind: string;
  targetId: string;
  at: number;
}): ActionEnvelope {
  const atMs = Math.round(action.at);
  return {
    v: ACTION_BUS_VERSION,
    type: action.kind,
    targetId: action.targetId.slice(0, MAX_TARGET_ID),
    atMs,
    at: atMs,
  };
}

/** SERVER EDGE: normalize an incoming heartbeat `action` body. Accepts the v1
 * envelope (`atMs`) and the legacy shape (`at`). Returns null for anything
 * structurally invalid — the heartbeat then simply carries no action. */
export function parseActionBody(raw: unknown): WireAction | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  if (typeof a.type !== "string" || a.type.length === 0 || a.type.length > 40) return null;
  const stamp = typeof a.atMs === "number" ? a.atMs : a.at;
  if (typeof stamp !== "number" || !Number.isFinite(stamp)) return null;
  const targetId = typeof a.targetId === "string" ? a.targetId.slice(0, MAX_TARGET_ID) : "";
  return { verb: a.type, targetId, atMs: Math.round(stamp) };
}

/** Encode for the roster's `lastAction` slot — the legacy pipe format IS the
 * storage format (old clients split("|") it; verbs never contain "|"). */
export function encodeLastAction(action: WireAction): string {
  return `${action.verb}|${action.targetId}|${Math.round(action.atMs)}`;
}

/** RECEIVE EDGE: parse a roster `lastAction` — pipe encoding today, JSON
 * envelope tolerated for a future server. Verb is NOT validated here. */
export function parseLastAction(raw: string | null | undefined): WireAction | null {
  if (!raw) return null;
  if (raw.startsWith("{")) {
    try {
      return parseActionBody(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  const sep1 = raw.indexOf("|");
  const sep2 = raw.indexOf("|", sep1 + 1);
  if (sep1 <= 0 || sep2 < 0) return null;
  const verb = raw.slice(0, sep1);
  const targetId = raw.slice(sep1 + 1, sep2).slice(0, MAX_TARGET_ID);
  const atMs = Number(raw.slice(sep2 + 1));
  if (!Number.isFinite(atMs)) return null;
  return { verb, targetId, atMs };
}

// ---------------------------------------------------------------------------
// Replay gate — per-sender timestamp dedupe with a first-payload baseline.
// ---------------------------------------------------------------------------

/** Actions older than this never replay (a late-joining viewer must not see
 * a minutes-old heart fly again). */
export const ACTION_REPLAY_MAX_AGE_MS = 12000;
/** Dedupe stamps outlive a brief departure (a flickering visitor's heart
 * must not replay on rejoin) and are pruned by age instead. */
const ACTION_DEDUPE_TTL_MS = 60000;

export interface ActionReplayGate {
  /** The first payload only records baselines — stale actions never replay. */
  baselineReady: boolean;
  /** senderId → newest action timestamp already consumed. */
  seen: Map<string, number>;
}

export function createReplayGate(): ActionReplayGate {
  return { baselineReady: false, seen: new Map() };
}

/** The whole receive edge in one call: parse, dedupe, age-gate, verb-gate.
 * Returns the event to replay, or null (recording the dedupe stamp either
 * way, so unknown/stale actions can never replay later). */
export function admitRoomAction(
  gate: ActionReplayGate,
  senderId: string,
  raw: string | null | undefined,
  now: number,
): ActionEvent | null {
  const wire = parseLastAction(raw);
  if (!wire) return null;
  const prev = gate.seen.get(senderId) ?? 0;
  if (wire.atMs <= prev) return null;
  gate.seen.set(senderId, wire.atMs);
  if (!gate.baselineReady) return null;
  if (now - wire.atMs > ACTION_REPLAY_MAX_AGE_MS) return null;
  // THE mixed-version rule: unknown verbs are ignored, gracefully.
  if (!isKnownVerb(wire.verb)) return null;
  return { verb: wire.verb, targetId: wire.targetId, atMs: wire.atMs };
}

/** After the first processed payload, later actions become replayable. */
export function sealReplayBaseline(gate: ActionReplayGate): void {
  gate.baselineReady = true;
}

export function pruneReplayGate(gate: ActionReplayGate, now: number): void {
  gate.seen.forEach((atMs, id) => {
    if (now - atMs > ACTION_DEDUPE_TTL_MS) gate.seen.delete(id);
  });
}
