// Putting a strum on the wire — and keeping it there without flooding the room.
//
// sim/strum is the instrument; this file is the microphone in front of it. It
// owns three things and nothing else: the outgoing cadence cap, the encoding
// of a strand into the action bus's one `targetId` field, and the decoding of
// an incoming one into the frame loop's queue.
//
// ── WHY THE BROADCAST IS CAPPED AND THE INSTRUMENT IS NOT ──────────────────
//
// A sweep is machine-paced. sim/strum admits up to MAX_STRUMS_PER_STEP (3)
// DISTINCT strands per frame, and its 550ms cooldown is per-strand, so it does
// not bound the aggregate at all: dragging across a fan at 60fps can produce
// ~180 strums a second, and every one of them is a real, wanted event locally.
// So the local mechanic keeps all of them — nothing below slows the hand — and
// this gate decides only which of them the ROOM hears about. Everything here
// is about the wire; nothing here is about the feel.
//
// ── A STRUM NEVER BUYS A HEARTBEAT. IT RIDES ONE YOU ARE ALREADY SPENDING ──
//
// This is the load-bearing decision, and it is not the obvious one. Every
// other verb here calls `rt.heartbeatNow()` — a flick heart wants to leave NOW,
// because a thrown like is a discrete moment and a quarter-second of lag is
// visible. So the first shape of this file did the same, and measuring it is
// what killed it.
//
// A CORRECTION, KEPT BECAUSE THE CONCLUSION SURVIVED IT. This paragraph used
// to claim that src/proxy.ts limits the whole `/api/mesh/presence` prefix at
// 180/min, with POSTs, the 2s poll fallback and every SSE reopen drawing on ONE
// allowance — and then summed posts and polls into a single figure that crossed
// it. That is not what the proxy does. src/proxy.ts:251 keys the bucket
// `${clientIp}:${request.method}:${pathname}`, so a POST and a GET to the same
// path hold SEPARATE allowances. The poll and the stream never compete with the
// heartbeat, and the summed number was measuring nothing.
//
// The honest measurement is POSTs alone, against their own 180/min. Driving a
// real presence client at 20 strums/second for a minute, forcing a beat on each
// admitted strum (the harness in scripts/mesh-live-contract.ts, worst case over
// every 50ms phase offset):
//
//     no strums at all       121 posts/min   ← the status quo
//     forced beat, gap  600  151 posts/min   ← +25%, and still under the limit
//     forced beat, gap  800  141 posts/min
//     forced beat, gap 1000  136 posts/min
//     forced beat, gap 2000  128 posts/min
//
// So forcing a beat would not have 429'd anybody, and the original "dead room"
// reasoning was wrong. The decision does not change, because the argument that
// actually carries it is the one below and it never depended on the ceiling: a
// quarter more writes, permanently, for something nobody can perceive. The
// headroom is worth keeping for its own sake — that same POST bucket carries
// every heartbeat, including the action beats of the other six verbs, which
// DO force a beat and should keep being able to.
//
// Every one of those spends real budget and buys nothing, because of a fact
// peculiar to this verb:
// YOU CANNOT STRUM WITHOUT MOVING. sim/strum needs a sweep of at least
// MIN_STEP_WU across the world; the transport's movement threshold is orders
// of magnitude smaller than that. So a strumming client is, by definition,
// already posting at its 500ms moving floor. A strum has a heartbeat leaving
// within half a second no matter what — forcing one merely inserts an extra
// request beside it.
//
// So this file stages and does NOT beat. The cost of putting a strum on the
// wire is exactly zero requests, and a sweeping user is indistinguishable from
// a walking one in the request log. The price is up to ~500ms of extra
// latency, which is nothing next to what the delivery side already spends: the
// SSE route coalesces pushes at 140ms and a receiver on the fallback poll is
// on a 2s cycle regardless. A strand rings for 620ms; nobody can tell.
//
// ── SO WHAT IS THE 1000ms GATE STILL FOR ──────────────────────────────────
//
// Two things that survive the above, neither of them request count.
//
// WRITE AMPLIFICATION, which no harness in this repo can see. A CHANGED
// `lastAction` is a SIGNIFICANT presence write (src/lib/presence-policy), so
// it bypasses the ~2s write-behind coalescing on what mesh-presence-store
// calls the app's heaviest sustained write path. Stage on every strum and
// every one of those 500ms beats carries a different strand — ~120 forced
// upserts/min. Gate at 1000ms, exactly TWO moving floors, and only every other
// beat changes: the ones between re-send a byte-identical action and coalesce
// away. That is a straight halving of the heaviest write path, for a cap the
// user cannot perceive.
//
// CADENCE. The shimmer runs 620ms and a strand's cooldown is 550ms, so at
// 1000ms a listener watches one strand finish ringing before the next begins —
// a played sequence, deliberate and readable, never two overlapping twangs.
// Sending faster could not carry more anyway: there is ONE action slot per
// heartbeat, so the room would still hear one strand at a time. It would just
// cost more to say the same thing.
//
// ── WHY IT DOES NOT NEED A COALESCING BUFFER ──────────────────────────────
//
// Because one already exists, structurally: `rt.pendingAction` is a single
// slot (last write wins) and `buildBody()` reads it at POST time, so a sweep
// across a fan broadcasts the strand crossed most recently, not a queue of
// three per frame. Most recent strand wins, for free.
//
// ── WHY A STRUM YIELDS TO A LIKE ──────────────────────────────────────────
//
// There is exactly ONE action slot per user on the wire, and the receive
// gate's dedupe watermark is per-SENDER, not per-verb — it is stamped before
// the verb is even inspected. So a high-frequency verb sharing that mailbox
// will silently EAT the social verbs: a heart staged a moment ago would be
// overwritten mid-flight, and on an older client the like is lost with nothing
// shown in its place. None of the other six verbs ever needed a priority rule
// because none of them fires faster than a hand. This one does, so it defers.

import type { MeshRuntime } from "../scene/runtime";
import { MAX_STRUMS_PER_STEP, type StrumSide } from "../sim/strum";

/** The wire floor between strum broadcasts — deliberately exactly TWO of
 * presence-client's HEARTBEAT_MOVE_FLOOR_MS (500), so every other movement
 * beat carries a new strand and the ones between coalesce away in the presence
 * store's write-behind. See the header before changing it: this number governs
 * DB write-through and the room's reading cadence, NOT request count (a strum
 * never buys a heartbeat), and it must stay above the 620ms shimmer or remote
 * strands start ringing over each other. */
export const STRUM_BROADCAST_MIN_GAP_MS = 1000;

/**
 * How long a freshly staged social verb is safe from being clobbered by a
 * strum. Not the 8s ACTION_RIDE_MS: a heart only needs to survive long enough
 * to be DELIVERED at least once, and 2.5s covers an immediate SSE push, a full
 * 2s poll-fallback cycle for a receiver with no stream, and the 350ms hard
 * post gap on top. Holding the slot for the whole ride window instead would
 * mute strums for eight seconds after every like — the room would go quiet
 * exactly when it is busiest.
 */
const SOCIAL_VERB_HOLD_MS = 2500;

export interface StrumBroadcastGate {
  lastAt: number;
}

export function createStrumBroadcastGate(): StrumBroadcastGate {
  return { lastAt: 0 };
}

/**
 * May this strum go on the wire? Pure, so the contract gate can drive it on a
 * fake clock. Two rules, in order: the cadence floor, then deference to any
 * social verb staged in the last SOCIAL_VERB_HOLD_MS.
 *
 * A held strum is simply DROPPED, never queued: it is a moment, and while a
 * sweep continues the next one is only a gap away. Deliberately no rolling-
 * window cap of the kind live/emotes uses — a window would go silent partway
 * through a long sweep, which is precisely the moment somebody is playing.
 */
export function admitStrumBroadcast(
  gate: StrumBroadcastGate,
  pending: { kind: string; at: number } | null,
  now: number,
): boolean {
  if (now - gate.lastAt < STRUM_BROADCAST_MIN_GAP_MS) return false;
  if (pending && pending.kind !== "strum" && now - pending.at < SOCIAL_VERB_HOLD_MS) return false;
  gate.lastAt = now;
  return true;
}

/**
 * The strand, as one `targetId`. The child node id names the strand (the
 * receiver rebuilds `parent>child` from its own model); a leading "-" carries
 * the one thing a receiver cannot derive — which way the hand swept across the
 * filament — so the room bows the strand the way the player actually bowed it
 * instead of every screen picking a sign. Node ids are built from server DB
 * ids and never begin with "-", so the marker is unambiguous, and an older
 * client never sees it: it drops the whole verb before it reads the target.
 */
export function encodeStrumTarget(childId: string, side: StrumSide): string {
  return side === -1 ? `-${childId}` : childId;
}

export function decodeStrumTarget(targetId: string): { childId: string; side: StrumSide } | null {
  const negative = targetId.startsWith("-");
  const childId = negative ? targetId.slice(1) : targetId;
  if (!childId) return null;
  return { childId, side: negative ? -1 : 1 };
}

/**
 * A strand you just played goes out to the room. Called from the surface's
 * single `onStrum` hook for LOCAL strums only — a strum arriving off the wire
 * must never re-broadcast, or one pluck would ring around a room forever.
 *
 * Note what is NOT here: a `rt.heartbeatNow?.()`. Every other emitter in this
 * directory ends with that line and this one deliberately does not — see the
 * header. The strand is left in the single `pendingAction` slot and the
 * movement heartbeat that is already leaving (you cannot strum without moving)
 * picks it up. That is also the coalescing: the slot is last-write-wins and
 * `buildBody()` reads it at POST time, so a sweep across a fan broadcasts the
 * strand crossed most recently rather than a queue of them.
 *
 * Ghost mode needs nothing here either. A strum rides `lastAction` and gets no
 * payload field of its own, and a ghosting person's presence row never reaches
 * another client's payload at all — the store drops the whole entry before any
 * field is copied. The suppression is server-authoritative and a strum
 * inherits it whole.
 */
export function broadcastStrum(
  rt: MeshRuntime,
  childId: string,
  side: StrumSide,
  now: number,
): boolean {
  if (!admitStrumBroadcast(rt.strumWire, rt.pendingAction, now)) return false;
  rt.pendingAction = { kind: "strum", targetId: encodeStrumTarget(childId, side), at: now };
  return true;
}

/**
 * An incoming strum, staged for the frame loop. It is NOT applied here: the
 * network callback runs on the wall clock, while `rt.strandStrums` is measured
 * in the scheduler's rAF clock by both the painter and the stamp collector.
 * Stamping it here with the sender's timestamp would produce a shimmer that
 * never draws and a map entry that is never collected — a silent leak. So the
 * sim phase drains this queue and re-stamps every strum on the local clock,
 * through the same `applyStrum` the local sweep uses.
 *
 * Bounded by the same MAX_STRUMS_PER_STEP the sweep obeys: a burst of payloads
 * (or a room of enthusiastic strummers) can add a chord to a frame, never a
 * cluster bomb. Excess is dropped, not queued — a strum is a moment.
 */
export function stageIncomingStrum(rt: MeshRuntime, targetId: string): void {
  if (rt.incomingStrums.length >= MAX_STRUMS_PER_STEP) return;
  const decoded = decodeStrumTarget(targetId);
  if (!decoded) return;
  // Stamped on the WALL clock at arrival, purely so the frame loop can tell a
  // strum that just landed from one staged before the tab was backgrounded.
  // Not the ringing clock — see use-mesh-frame, which re-stamps on rAF.
  rt.incomingStrums.push({ ...decoded, atMs: Date.now() });
}
