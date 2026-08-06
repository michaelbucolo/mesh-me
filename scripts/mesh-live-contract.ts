// Live-room contract gate for Presence v2 (`npm run mesh:live-contract`).
//
// Runs standalone (no DOM, no DB) against the PURE halves of the live stack:
//
// 1. ACTION BUS — versioned envelope out, legacy pipe parsed at the edge,
//    and the mixed-version rule: UNKNOWN VERBS ARE IGNORED (while still
//    consuming their dedupe slot). Baseline/age/dedupe gates.
// 1b. THE SOCIAL STRUM — the seventh verb, and the first that names a STRAND
//    rather than a point and fires faster than a hand. What is gated is not
//    that the verb exists but that it is SAFE: an unknown strand is ignored
//    and leaves no trace, the pitch is a property of the strand rather than of
//    anyone's animation, reduced motion is the RECEIVER'S and silences motion
//    not sound, and the wire is capped and defers to the social verbs.
// 2. HEARTBEAT BUDGET — a mock-transport presence client under sustained
//    movement stays at the 500ms moving floor (~120/min); even with an
//    action-beat flood the hard global gap keeps it under the 180/min
//    rate-limit budget; and a 20-strums-per-second SWEEP costs no more
//    requests than a plain walk.
// 3. TRANSPORT LIFECYCLE — SSE-primary/poll-fallback (no polling while the
//    stream is healthy), 429 → "paused" backoff with zero traffic, payload
//    dedupe.
// 4. ROSTER GRACE — sightings register instantly, removal only after
//    sustained absence; join events suppressed on the baseline payload;
//    object identity stable while appearance is unchanged (the per-Meshi
//    memoization contract).
// 5. MESHI MACHINE — mode transitions never teleport (world persists), the
//    glide honours its speed cap.
// 6. MOOD — warm hysteresis bands + idle ladder.
// 7. SERVER POLICY — heartbeat write-behind significance and the opt-in
//    where-chip redaction (privacy: location never leaves the room without
//    the subject's opt-in).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACTION_REPLAY_MAX_AGE_MS,
  ACTION_VERBS,
  actionNeedsTarget,
  admitRoomAction,
  createReplayGate,
  encodeActionEnvelope,
  encodeLastAction,
  isKnownVerb,
  parseActionBody,
  parseLastAction,
  pruneReplayGate,
  sealReplayBaseline,
} from "../src/components/mesh/live/action-bus";
import {
  admitStrumBroadcast,
  createStrumBroadcastGate,
  decodeStrumTarget,
  encodeStrumTarget,
  STRUM_BROADCAST_MIN_GAP_MS,
} from "../src/components/mesh/live/strum-broadcast";
import { createPhysicsState } from "../src/components/mesh/sim/physics";
import { applyStrum, STRUM_STALE_MS } from "../src/components/mesh/sim/strum";
import type { SceneModel, SceneNode } from "../src/components/mesh/scene/scene-model";
import {
  applySighting,
  createSprite,
  deriveOwnerMode,
  glideStep,
  stepSpriteToward,
} from "../src/components/mesh/live/meshi-machine";
import {
  createBehaviorMoodState,
  deriveBroadcastMood,
  stepBehaviorMood,
} from "../src/components/mesh/live/mood";
import {
  createPresenceClient,
  HEARTBEAT_MIN_GAP_MS,
  HEARTBEAT_MOVE_FLOOR_MS,
  type EventSourceLike,
} from "../src/components/mesh/live/presence-client";
import {
  applySightings,
  createRoster,
  PRESENCE_GRACE_MS,
  sweepRoster,
  type RemotePresence,
} from "../src/components/mesh/live/roster";
import {
  isSignificantPresenceWrite,
  redactWhere,
  type PresenceWriteFacts,
} from "../src/lib/presence-policy";

let checks = 0;
function ok(condition: boolean, label: string): void {
  checks += 1;
  assert.ok(condition, label);
}

// ───────────────────────────────────────────────────────────── action bus ──

{
  // THE VERB SET. This assertion used to end `&& !isKnownVerb("strum")` — it
  // pinned the design sim/strum's header stated: "Nothing is broadcast: a
  // strum is a local instrument, not a social verb." That design is what
  // changed: a strand is the edge between two nodes both people can see, so
  // playing one is now something the room hears. The pin is RE-STATED at seven
  // rather than deleted, because the thing worth gating was never the number —
  // it is that the set is closed and both edges import the same closed set.
  //
  // `yodel` replaces `strum` as the standing proof that the set is closed. The
  // unknown-verb fixture below needs a verb that will never ship, and `strum`
  // stopped being one the moment it shipped; leaving it there would have left
  // an assertion labelled "unknown verbs are IGNORED" quietly testing a KNOWN
  // verb, which is worse than no coverage at all.
  ok(
    ACTION_VERBS.length === 7 &&
      ACTION_VERBS.every((v) => isKnownVerb(v)) &&
      isKnownVerb("strum") &&
      !isKnownVerb("yodel"),
    "the verb set is exactly heart/star/spark/wow/wave/fling/strum (fling = PR7's cosmetic heart; strum = the shared strand)",
  );
  // Verbs that ADDRESS something are dropped without a target at the server
  // edge — a receiver has nothing to resolve. The rule lives in the bus so the
  // route and the client can't keep two lists of verb names in step by hand.
  ok(
    actionNeedsTarget("heart") && actionNeedsTarget("fling") && actionNeedsTarget("strum"),
    "hearts fly AT a node and a strum rings a NAMED strand — all three require a target",
  );
  ok(
    !actionNeedsTarget("wave") && !actionNeedsTarget("star") && !actionNeedsTarget("wow"),
    "targetless flourishes still ride without one",
  );
  const env = encodeActionEnvelope({ kind: "heart", targetId: "post:1", at: 1000.6 });
  ok(env.v === 1 && env.atMs === 1001 && env.at === 1001, "envelope carries v + atMs + legacy at alias");
  const fromEnvelope = parseActionBody(env);
  ok(fromEnvelope?.verb === "heart" && fromEnvelope.atMs === 1001, "server edge parses the v1 envelope");
  const fromLegacy = parseActionBody({ type: "wave", targetId: "", at: 2000 });
  ok(fromLegacy?.verb === "wave" && fromLegacy.atMs === 2000, "server edge still parses the legacy shape");
  ok(parseActionBody({ type: "heart" }) === null, "timestampless actions are rejected");

  const pipe = encodeLastAction({ verb: "heart", targetId: "post:1", atMs: 1001 });
  ok(pipe === "heart|post:1|1001", "lastAction storage stays the legacy pipe format");
  const parsed = parseLastAction(pipe);
  ok(parsed?.verb === "heart" && parsed.targetId === "post:1" && parsed.atMs === 1001, "pipe parses back");
  ok(parseLastAction('{"v":1,"type":"wow","targetId":"","atMs":5}')?.verb === "wow", "a future JSON lastAction parses too");
  ok(parseLastAction("garbage") === null && parseLastAction("") === null, "malformed lastAction is null");

  // Replay gate: baseline, dedupe, age, and the unknown-verb rule.
  const gate = createReplayGate();
  const t0 = 100_000;
  ok(admitRoomAction(gate, "ana", "heart|p|90000", t0) === null, "first payload only records a baseline");
  sealReplayBaseline(gate);
  ok(admitRoomAction(gate, "ana", "heart|p|90000", t0) === null, "same timestamp never replays twice");
  const fresh = admitRoomAction(gate, "ana", `heart|p|${t0 - 100}`, t0);
  ok(fresh?.verb === "heart", "a fresh action replays after the baseline");
  const stale = admitRoomAction(gate, "ana", `heart|p|${t0 - ACTION_REPLAY_MAX_AGE_MS - 1000}`, t0);
  ok(stale === null, "actions older than the age gate never replay");
  // MIXED-VERSION ROOM: a verb from a newer client is ignored…
  const unknown = admitRoomAction(gate, "bo", `yodel|edge|${t0 - 50}`, t0);
  ok(unknown === null, "unknown verbs are IGNORED on receive");
  // …and it consumed its dedupe slot, so re-delivery stays silent too.
  ok(admitRoomAction(gate, "bo", `yodel|edge|${t0 - 50}`, t0 + 100) === null, "ignored verbs still consume their dedupe slot");
  // THE OTHER HALF OF THE MIXED-VERSION PROMISE, from the far side: an older
  // client meeting a strum runs exactly the path above (parse, stamp, drop at
  // the verb gate) and shows nothing. That is the degradation this build is
  // relying on when it adds a seventh verb, so it is asserted with the strum's
  // real wire shape rather than assumed — a strand named on the wire is inert
  // to anyone who does not know the word.
  const oldGate = createReplayGate();
  sealReplayBaseline(oldGate);
  ok(
    parseLastAction(`strum|post:1|${t0 - 50}`)?.verb === "strum",
    "an older client still PARSES a strum cleanly — no crash, no malformed action",
  );
  ok(
    admitRoomAction(oldGate, "cy", `strum|post:1|${t0 - 50}`, t0) !== null,
    "…while this build, which knows the verb, replays it",
  );
  const newer = admitRoomAction(gate, "bo", `wave||${t0 + 200}`, t0 + 300);
  ok(newer?.verb === "wave", "a KNOWN verb from the same sender still replays afterwards");
  // PR7's fun-verb heart: `fling` replays with its target so receivers can fly
  // the NON-COUNTING heart (a `heart` on the wire stays a real like).
  const fling = admitRoomAction(gate, "bo", `fling|p|${t0 + 400}`, t0 + 450);
  ok(fling?.verb === "fling" && fling.targetId === "p", "the cosmetic fling heart replays as its own verb");
  pruneReplayGate(gate, t0 + 120_000);
  ok(gate.seen.size === 0, "dedupe stamps prune by age");
}

// ─────────────────────────────────────────────────────────── social strum ──
//
// A strum is the first verb that names a STRAND rather than a point, and the
// first that fires faster than a hand. Adding it to the verb set above is the
// easy half; these are the four properties that make it SAFE to have done so,
// and each of them fails silently if a later edit breaks it:
//
//   1. an unknown strand is ignored, cheaply, and leaves no trace;
//   2. the pitch is a property of the STRAND, not of anyone's animation;
//   3. reduced motion is the RECEIVER'S, and it silences motion, not sound;
//   4. the wire is capped and defers to the social verbs (rate cap below, in
//      the transport section, where it can be measured through a real client).

function strandNode(
  id: string,
  parentId: string | null,
  at: { x: number; y: number; dx?: number; dy?: number },
): SceneNode {
  return {
    id,
    kind: "post",
    label: id,
    color: "#fff",
    parentId,
    childIds: [],
    branch: null,
    weight: 1,
    x: at.x,
    y: at.y,
    angle: 0,
    depth: 1,
    // The ANIMATED position defaults to the laid-out one, but the two are
    // deliberately separable here: that gap is the whole point of check 2.
    dx: at.dx ?? at.x,
    dy: at.dy ?? at.y,
    vx: 0,
    vy: 0,
  };
}

/** One parent + one child = one strand, keyed "me>post:1". */
function strandModel(child: { x: number; y: number; dx?: number; dy?: number }): SceneModel {
  const parent = strandNode("me", null, { x: 0, y: 0 });
  const node = strandNode("post:1", "me", child);
  return { selfId: "me", nodes: new Map([[parent.id, parent], [node.id, node]]) };
}

{
  const KEY = "me>post:1";

  // 1. AN UNKNOWN STRAND IS IGNORED, EXACTLY AS AN UNKNOWN VERB IS — and for a
  // stronger reason. Unknown verbs are a rare version skew; unknown strands are
  // NORMAL, because two people in one room are not served the same node set (a
  // visitor's payload carries no friend-post nodes and no platform top-posts at
  // all, per-viewer mutes and branch privacy remove more, and a viewer in
  // Rewind has fewer nodes still). The miss must therefore be cheap AND leave
  // nothing behind: a synthesized control point would be deleted by the
  // physics sweep on the very next frame and re-created on the one after,
  // forever.
  {
    const model = strandModel({ x: 0, y: 100 });
    const physics = createPhysicsState();
    const strums = new Map<string, number>();
    ok(
      applyStrum(model, physics, strums, "post:nope", 1000, false, 1) === false,
      "a strand this viewer does not have is IGNORED, exactly like an unknown verb",
    );
    ok(
      applyStrum(model, physics, strums, "me", 1000, false, 1) === false,
      "…so is a node with no parent (the root has no strand above it)",
    );
    ok(
      strums.size === 0 && physics.strands.size === 0,
      "…and a miss writes NOTHING — no fx stamp, no control point for the physics sweep to thrash on",
    );
  }

  // A known strand rings: it stamps the shared map and kicks the EXISTING
  // filament spring. Nothing here touches a laid-out x/y — a strum arrives over
  // the network now, and a networked event that could move a node would let one
  // client reorder another client's world.
  {
    const model = strandModel({ x: 0, y: 100 });
    const physics = createPhysicsState();
    const strums = new Map<string, number>();
    physics.strands.set(KEY, { mx: 0, my: 50, vx: 0, vy: 0 });
    const rang = applyStrum(model, physics, strums, "post:1", 1000, false, 1);
    ok(rang && strums.get(KEY) === 1000, "a known strand rings and stamps the fx/cooldown map");
    ok(physics.strands.get(KEY)!.vx !== 0, "…and twangs the filament through the spring that was already there");
    const laid = model.nodes.get("post:1")!;
    ok(laid.x === 0 && laid.y === 100, "…and never moves a laid-out position (the layout gate is untouched)");
    // ONE strand, ONE cooldown, shared by you and the room. That is a real
    // behaviour change to the local instrument and it is the correct one: a
    // remote sender can no more machine-gun a strand than you can.
    ok(
      applyStrum(model, physics, strums, "post:1", 1300, false, 1) === false,
      "a strand still ringing cannot be re-strummed — by you OR by the room",
    );
    ok(
      applyStrum(model, physics, strums, "post:1", 1600, false, 1) === true,
      "…and it rings again once the cooldown is spent",
    );
  }

  // 2. THERE IS NO PITCH, AND THAT IS THE POINT.
  //
  // This slot held the assertion the feature was originally briefed on:
  // "everyone hears its tone, at the same pitch, because it is the same
  // strand". It was real engineering — the note was moved off the animated
  // dx/dy and onto the gated laid-out x/y so that two clients could not
  // disagree — and it is gone, with the tone it existed for.
  //
  // #363 removed the mesh's music under the heading "Two things the owner
  // didn't like, gone". The strum module's header had not been updated, so
  // this feature was briefed off a stale promise and briefly re-shipped a
  // shared tone: the disliked thing, now playing to a whole room at once.
  //
  // Keeping the assertion would have left a gate proving a property of a
  // number nobody plays — the precise defect this suite exists to catch
  // elsewhere. A strum is motion. The assertions above and below already pin
  // that the same strand rings, stamps and bows identically for everyone.

  // 2b. A BACKGROUNDED TAB DOES NOT REPLAY A CROWD. rAF stops while a tab is
  // hidden; payloads do not. Without an arrival stamp and a staleness sweep,
  // refocusing rings every strum staged in the meantime, all at once, seconds
  // after those hands moved. The window must clear the SLOWEST legitimate
  // delivery — a receiver on the 2s fallback poll is already two seconds
  // behind and must not be the only one silenced.
  {
    const src = readFileSync(join(process.cwd(), "src/components/mesh/scene/use-mesh-frame.ts"), "utf8");
    ok(
      /wallNow\s*-\s*rt\.incomingStrums\[i\]\.atMs\s*>\s*STRUM_STALE_MS/.test(src),
      "the frame loop drops staged strums that went stale while rAF was paused",
    );
    ok(
      /const wallNow = Date\.now\(\)/.test(src),
      "…measured on the WALL clock, the one that keeps running while rAF does not",
    );
    ok(
      STRUM_STALE_MS > 2000,
      `the staleness window clears the 2s fallback poll (${STRUM_STALE_MS}ms)`,
    );
    ok(
      STRUM_STALE_MS <= 5000,
      `…without letting a strand ring a lie about when a hand was there (${STRUM_STALE_MS}ms)`,
    );
    const staged = readFileSync(join(process.cwd(), "src/components/mesh/live/strum-broadcast.ts"), "utf8");
    ok(
      /incomingStrums\.push\(\{ \.\.\.decoded, atMs: Date\.now\(\) \}\)/.test(staged),
      "…and every staged strum carries the arrival stamp that sweep needs",
    );
  }

  // 3. REDUCED MOTION IS THE RECEIVER'S, AND IT SILENCES MOTION, NOT SOUND.
  // The flag passed here is the local runtime's, set from this viewer's own
  // media query — the sender's preference never travels — and the rule is the
  // one the local strum already had: no kick, no shimmer, but the stamp still
  // lands (it is the re-strum cooldown, not just the shimmer's start time) and
  // the tone still sounds.
  {
    const model = strandModel({ x: 0, y: 100 });
    const physics = createPhysicsState();
    const strums = new Map<string, number>();
    const point = { mx: 0, my: 50, vx: 0, vy: 0 };
    physics.strands.set(KEY, point);
    const rang = applyStrum(model, physics, strums, "post:1", 5000, true, 1);
    ok(rang, "reduced motion still rings the strand — it silences the MOTION, not the event");
    ok(strums.get(KEY) === 5000, "…still takes the stamp, because that stamp IS the re-strum cooldown");
    ok(point.vx === 0 && point.vy === 0, "…and never kicks the filament");
  }

  // THE SWEEP DIRECTION IS THE ONE THING A RECEIVER CANNOT DERIVE, so it rides
  // the wire as a single character on the existing targetId — and a positive
  // strum is just the node id, i.e. the field keeps its ordinary meaning.
  {
    ok(encodeStrumTarget("post:1", 1) === "post:1", "a strum's target is just the child node id");
    const back = decodeStrumTarget(encodeStrumTarget("post:1", -1));
    ok(back?.childId === "post:1" && back.side === -1, "…and the sweep direction round-trips on one character");
    ok(decodeStrumTarget("") === null && decodeStrumTarget("-") === null, "an empty target decodes to nothing, never to a bare sign");
    // Through the real storage format, at a realistic worst-case id length.
    const worst = `platform-post:${"c".repeat(25)}:${"p".repeat(25)}`;
    const pipe = encodeLastAction({ verb: "strum", targetId: encodeStrumTarget(worst, -1), atMs: 7 });
    const parsed = parseLastAction(pipe);
    const decoded = parsed ? decodeStrumTarget(parsed.targetId) : null;
    ok(
      parsed?.verb === "strum" && decoded?.childId === worst && decoded.side === -1,
      "the longest realistic strand survives the pipe format uncut (the targetId cap truncates SILENTLY)",
    );
  }

  // 4a. THE CADENCE FLOOR AND THE PRIORITY RULE. (The floor's effect on real
  // request volume is measured through a live client further down — this is the
  // policy; that is the budget.)
  {
    const gate = createStrumBroadcastGate();
    const t = 10_000;
    ok(admitStrumBroadcast(gate, null, t), "the first strand of a sweep goes out at once");
    ok(
      !admitStrumBroadcast(gate, null, t + STRUM_BROADCAST_MIN_GAP_MS - 1),
      "…the next is held by the cadence floor (the sweep keeps every strum LOCALLY; only the wire waits)",
    );
    ok(admitStrumBroadcast(gate, null, t + STRUM_BROADCAST_MIN_GAP_MS), "…and released when the floor elapses");
    // THE SINGLE-SLOT RULE. There is one action slot per user on the wire and
    // the receive gate's dedupe watermark is per-SENDER, not per-verb, so a
    // fast verb sharing that mailbox would silently EAT the social ones — on
    // old clients a like would vanish with nothing shown in its place. No other
    // verb needed this rule because no other verb outruns a hand.
    const busy = createStrumBroadcastGate();
    ok(
      !admitStrumBroadcast(busy, { kind: "fling", at: 20_000 }, 20_100),
      "a strum never clobbers a like that is still riding the one action slot",
    );
    ok(
      admitStrumBroadcast(busy, { kind: "fling", at: 20_000 }, 23_000),
      "…and resumes once that like has certainly been delivered to stream AND poll receivers",
    );
    ok(
      admitStrumBroadcast(createStrumBroadcastGate(), { kind: "strum", at: 20_000 }, 20_100),
      "…while a strum freely replaces an older strum: sweeping, the most recent strand wins",
    );
  }
}

// ─────────────────────────────── mock transport: budget + lifecycle ──────

interface FakeFetchLog {
  posts: number;
  gets: number;
  /** Serialized heartbeat bodies, so a test can assert what actually reached
   * the wire — not merely how many requests were spent. */
  bodies: string[];
}

class FakeStream implements EventSourceLike {
  readyState = 0;
  private listeners = new Map<string, Array<(event: MessageEvent) => void>>();
  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  close(): void {
    this.readyState = 2;
  }
  open(): void {
    this.readyState = 1;
    this.emit("ready", "{}");
  }
  emit(type: string, data: string): void {
    for (const fn of this.listeners.get(type) ?? []) {
      fn({ data } as MessageEvent);
    }
  }
}

async function drain(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

interface HarnessOptions {
  streamOpens?: boolean;
  postStatus?: () => number;
  moving?: boolean;
  onPayload?: (payload: unknown) => void;
  /** Override the heartbeat body — lets a test ride the real action slot. */
  buildBody?: () => Record<string, unknown>;
}

function makeHarness(opts: HarnessOptions) {
  let clock = 1_000_000;
  const log: FakeFetchLog = { posts: 0, gets: 0, bodies: [] };
  const streams: FakeStream[] = [];
  let pos = 0;
  const links: string[] = [];
  const client = createPresenceClient({
    getRoom: () => "room-1",
    isVisible: () => true,
    buildBody: opts.buildBody ?? (() => ({ beat: true })),
    getMovement: () => ({ x: pos, y: 0, zoom: 1 }),
    onPayload: opts.onPayload ?? (() => {}),
    onLink: (l) => links.push(l),
    now: () => clock,
    random: () => 0.5,
    fetchFn: (async (_input: unknown, init?: { method?: string; body?: unknown }) => {
      if (init?.method === "POST") {
        log.posts += 1;
        if (init.body != null) log.bodies.push(String(init.body));
        const status = opts.postStatus?.() ?? 200;
        return { ok: status === 200, status, json: async () => ({}) };
      }
      log.gets += 1;
      return { ok: true, status: 200, json: async () => ({ presences: [] }) };
    }) as unknown as typeof fetch,
    openStream: () => {
      const s = new FakeStream();
      streams.push(s);
      if (opts.streamOpens !== false) s.open();
      return s;
    },
  });
  // start() arms a real 250ms interval, but the test body never yields to the
  // macrotask queue (microtask drains only), so ticks are ONLY the manual
  // ones below — deterministic under the fake clock. stop() clears it.
  client.start();
  return {
    client,
    log,
    streams,
    links,
    advance: async (ms: number, step = 50) => {
      let sincePing = 0;
      for (let t = 0; t < ms; t += step) {
        clock += step;
        sincePing += step;
        // A REALISTIC step, in the units real callers actually broadcast.
        // This used to be `pos += 25` — world-scale, which no surface has
        // reported since the canvas was deleted, so the harness was proving
        // the threshold worked in a space nothing uses. 0.01 of the room per
        // 50ms tick is an ordinary walking pace.
        if (opts.moving) pos += 0.01;
        // A live server pings every 15s; mirror it so an open stream reads
        // healthy exactly the way production does.
        if (opts.streamOpens !== false && sincePing >= 10_000) {
          sincePing = 0;
          const s = streams[streams.length - 1];
          if (s && s.readyState === 1) s.emit("ping", "{}");
        }
        client.tick();
        await drain();
      }
    },
    beatSpam: () => client.beat(),
    time: () => clock,
  };
}

// The transport tests await microtask drains, so they run inside main()
// (scripts execute as CommonJS — no top-level await).
async function transportChecks(): Promise<void> {
// Budget: sustained movement for 60s stays at the 500ms floor (~120/min).
{
  const h = makeHarness({ moving: true });
  h.client.tick();
  await drain();
  const baseline = h.log.posts; // the initial keepalive beat
  await h.advance(60_000);
  const perMinute = h.log.posts - baseline;
  ok(perMinute <= 60_000 / HEARTBEAT_MOVE_FLOOR_MS + 2, `sustained movement stays at the moving floor (${perMinute}/min)`);
  // THE UNITS ASSERTION. A walk of 0.01 room-units per 50ms is what the room
  // and the field actually broadcast; if the movement threshold is expressed
  // in some other space (it was once 6 world units, from the deleted canvas),
  // nothing here counts as movement and every update silently falls back to
  // the 2s keepalive — ~30/min instead of ~120. Live walking becomes a
  // flipbook, and no other assertion in this file notices.
  ok(
    perMinute >= 100,
    `a room-scale walk registers as movement (${perMinute}/min ≥ 100) — below this the movement epsilon is in the wrong unit space`,
  );
  // Stream is healthy the whole time → the poll fallback never fires.
  ok(h.log.gets === 0, "no polling while the stream is healthy");
  h.client.stop();
}

// Budget: movement + an action-beat flood still respects the global gap.
{
  const h = makeHarness({ moving: true });
  h.client.tick();
  await drain();
  const baseline = h.log.posts;
  for (let t = 0; t < 60_000; t += 50) {
    h.beatSpam(); // an "instant" action beat requested EVERY 50ms
    await h.advance(50);
  }
  const perMinute = h.log.posts - baseline;
  const ceiling = Math.ceil(60_000 / HEARTBEAT_MIN_GAP_MS) + 2; // ≈171/min + slack
  ok(perMinute <= ceiling, `action flood stays under the rate budget (${perMinute}/min ≤ ${ceiling} < 180)`);
  h.client.stop();
}

// 4b. THE STRUM BUDGET — the claim the whole broadcast design rests on:
// PLAYING THE WEB COSTS EXACTLY WHAT WALKING AROUND IT COSTS.
//
// A sweep is machine-paced. sim/strum admits up to 3 DISTINCT strands per
// frame and its 550ms cooldown is per-strand, so a drag across a fan can
// legitimately produce ~180 strums/second, every one of them wanted locally —
// one broadcast per strum would miss the 180/min presence budget by two orders
// of magnitude. The defence is NOT a smaller number: it is that a strum never
// calls `heartbeatNow`. You cannot strum without moving, so the client is
// already posting at its 500ms moving floor; the strand is left in the single
// action slot and the beat that was leaving anyway carries it.
//
// Two harnesses, differing ONLY in whether anything is being played, and the
// assertion is equality — not a ceiling. A ceiling would have quietly tolerated
// the earlier shape of this file, which forced a beat per admitted strum and
// measured 136 posts + 31 polls = 167/min against a SHARED 180 (POSTs, the 2s
// fallback poll and every SSE reopen draw on one allowance, and a 429 is a
// visible pause, not a graceful degradation). Equality is the property that
// makes the feature free, so equality is what is pinned.
//
// The second half matters as much: the room must actually HEAR it. A gate that
// spent nothing because it sent nothing would sail through an equality check,
// so the delivered strands are counted out of the real POST bodies.
{
  // Baseline — the same walk, playing nothing.
  const walk = makeHarness({ moving: true });
  walk.client.tick();
  await drain();
  await walk.advance(60_000);
  const walkPosts = walk.log.posts;
  walk.client.stop();

  // The same walk, strumming the whole way: 20 strums/second through the real
  // cadence gate, staged into the one action slot exactly as broadcastStrum
  // does it, and read back out of the slot by buildBody at POST time (which is
  // also where the coalescing lives — last strand wins, for free).
  let pending: { kind: string; targetId: string; at: number } | null = null;
  const gate = createStrumBroadcastGate();
  let strand = 0;
  const sweep = makeHarness({
    moving: true,
    buildBody: () => ({
      action: pending
        ? encodeActionEnvelope({ kind: pending.kind, targetId: pending.targetId, at: pending.at })
        : null,
    }),
  });
  sweep.client.tick();
  await drain();
  for (let t = 0; t < 60_000; t += 50) {
    strand += 1;
    if (admitStrumBroadcast(gate, pending, sweep.time())) {
      pending = {
        kind: "strum",
        targetId: encodeStrumTarget(`post:${strand}`, 1),
        at: sweep.time(),
      };
    }
    await sweep.advance(50);
  }
  const sweepPosts = sweep.log.posts;
  sweep.client.stop();

  ok(
    sweepPosts === walkPosts,
    `sweeping 20 strands/second costs EXACTLY what walking costs (${sweepPosts} posts = ${walkPosts})`,
  );
  ok(
    walkPosts <= Math.ceil(60_000 / HEARTBEAT_MOVE_FLOOR_MS) + 2,
    `…and that is the moving floor, not some inflated shared baseline (${walkPosts}/min)`,
  );

  // …and the room heard it. One distinct strand per gate window, no more (the
  // cadence held) and not fewer (the strums reached the wire rather than dying
  // in the slot).
  const delivered = new Set<string>();
  for (const body of sweep.log.bodies) {
    const match = /"targetId":"([^"]+)"/.exec(body);
    if (match) delivered.add(match[1]);
  }
  const expected = Math.floor(60_000 / STRUM_BROADCAST_MIN_GAP_MS);
  ok(
    delivered.size >= expected - 2,
    `every admitted strand reached the wire on a beat that was leaving anyway (${delivered.size} of ~${expected})`,
  );
  ok(
    delivered.size <= expected + 2,
    `…and no more than the cadence allows, however fast the hand moved (${delivered.size} ≤ ~${expected})`,
  );
}

// Lifecycle: stream that never opens → poll fallback carries the room.
{
  const h = makeHarness({ streamOpens: false });
  await h.advance(10_000);
  ok(h.log.gets >= 4, `poll fallback runs while the stream is down (${h.log.gets} polls in 10s)`);
  h.client.stop();
}

// Lifecycle: 429 pauses ALL traffic and surfaces the paused link state.
{
  let status = 429;
  const h = makeHarness({ moving: true, postStatus: () => status });
  await h.advance(1_000);
  ok(h.links.includes("paused"), "a 429 surfaces the paused link state");
  const postsAtPause = h.log.posts;
  const getsAtPause = h.log.gets;
  await h.advance(4_000); // inside the 5s+jitter pause window
  ok(h.log.posts === postsAtPause && h.log.gets === getsAtPause, "no posts or polls during the rate pause");
  status = 200;
  await h.advance(10_000);
  ok(h.log.posts > postsAtPause, "traffic resumes after the pause elapses");
  h.client.stop();
}

// Payload dedupe: identical frames deliver once.
{
  let delivered = 0;
  const h = makeHarness({ onPayload: () => { delivered += 1; } });
  h.client.tick();
  await drain();
  const stream = h.streams[0];
  stream.emit("presence", '{"presences":[]}');
  stream.emit("presence", '{"presences":[]}');
  stream.emit("presence", '{"presences":[{"userId":"ana"}]}');
  await drain();
  ok(delivered === 2, `identical payloads dedupe at the edge (${delivered} delivered of 3)`);
  h.client.stop();
}
}

// ──────────────────────────────────────────────────────────────── roster ──

function entry(userId: string, mood = "happy"): RemotePresence {
  return {
    userId,
    username: userId,
    displayName: userId,
    meshiColor: "blue",
    meshiHat: "none",
    meshiMood: mood,
    viewportPosition: { vx: 0.5, vy: 0.5 },
    position: { x: 10, y: 10 },
    viewingMesh: "room-1",
    surface: "mesh",
    isOnline: true,
  };
}

{
  const roster = createRoster();
  const t0 = 1_000_000;
  // Baseline payload: members appear but emit NO join events.
  const first = applySightings(roster, [entry("ana")], t0);
  ok(first.joined.length === 0, "baseline payload emits no join events");
  ok(first.effective.length === 1 && first.changed, "baseline membership renders once");
  // A newcomer joins.
  const second = applySightings(roster, [entry("ana"), entry("bo")], t0 + 1000);
  ok(second.joined.length === 1 && second.joined[0].userId === "bo", "a newcomer emits one join event");
  // Object identity is stable while appearance is unchanged (memoization).
  const anaBefore = second.effective.find((p) => p.userId === "ana");
  const third = applySightings(roster, [entry("ana"), entry("bo")], t0 + 2000);
  ok(third.effective.find((p) => p.userId === "ana") === anaBefore, "unchanged appearance keeps object identity");
  ok(!third.changed, "identical room does not re-render");
  // A mood change re-renders — with a NEW object for that member only.
  const fourth = applySightings(roster, [entry("ana", "love"), entry("bo")], t0 + 3000);
  ok(fourth.changed, "a mood change re-renders the roster");
  ok(fourth.effective.find((p) => p.userId === "ana") !== anaBefore, "the changed member gets a fresh object");
  ok(fourth.effective.find((p) => p.userId === "bo") === second.effective.find((p) => p.userId === "bo"), "…while the unchanged member keeps identity");
  // Grace: bo vanishes from payloads but survives inside the window.
  const fifth = applySightings(roster, [entry("ana", "love")], t0 + 4000);
  ok(fifth.effective.some((p) => p.userId === "bo"), "a missed payload keeps a Meshi through grace");
  ok(fifth.left.length === 0, "no leave inside the grace window");
  // Sweep past bo's grace window (ana was seen 1s later and stays): bo
  // leaves exactly once.
  const sixth = sweepRoster(roster, t0 + 3000 + PRESENCE_GRACE_MS + 100);
  ok(sixth.left.length === 1 && sixth.left[0].userId === "bo", "sustained absence emits one leave event");
  ok(sixth.effective.length === 1 && sixth.changed, "the room shrinks after grace");
  // A rejoin after grace is a fresh join.
  const seventh = applySightings(roster, [entry("ana", "love"), entry("bo")], t0 + 12_000);
  ok(seventh.joined.length === 1 && seventh.joined[0].userId === "bo", "rejoining after grace is a fresh join");
}

// Payload-evidence gate: a payload-static room (byte-identical frames are
// deduped at both the SSE route and the transport, so ZERO frames arrive
// while everyone is parked reading) must NEVER fade out still-present
// members — silence is not absence. Eviction requires a delivered payload
// that OMITTED the member, then grace.
{
  const roster = createRoster();
  const t0 = 2_000_000;
  applySightings(roster, [entry("ana"), entry("bo")], t0);
  // The room goes payload-static: sweeps tick with NO newer payload
  // (lastPayloadAt stays at t0), far beyond the grace window.
  const quiet = sweepRoster(roster, t0 + PRESENCE_GRACE_MS * 10, t0);
  ok(quiet.left.length === 0, "a payload-static room evicts nobody (no join/leave flap for idle readers)");
  ok(quiet.effective.length === 2 && !quiet.changed, "…and the static room does not re-render");
  // A payload finally arrives WITHOUT bo — that omission is the missing
  // evidence, and with the grace window (from bo's last sighting) long
  // expired, bo leaves on this frame.
  const tDrop = t0 + PRESENCE_GRACE_MS * 10 + 1000;
  const dropped = applySightings(roster, [entry("ana")], tDrop);
  ok(dropped.left.length === 1 && dropped.left[0].userId === "bo", "an omitting payload is the evidence that evicts after grace");
  // …and a subsequent quiet sweep can still fade a leaver dropped INSIDE
  // grace by that last payload (the sweep's whole point).
  const roster2 = createRoster();
  applySightings(roster2, [entry("ana"), entry("bo")], t0);
  applySightings(roster2, [entry("ana")], t0 + 1000); // bo omitted, inside grace
  const later = sweepRoster(roster2, t0 + 1000 + PRESENCE_GRACE_MS + 100, t0 + 1000);
  ok(later.left.length === 1 && later.left[0].userId === "bo", "the sweep still fades a dropped member on time after the transport goes quiet");
}

// ───────────────────────────────────────────────────────── meshi machine ──

{
  const sprite = createSprite(0, { x: 100, y: 100 });
  // First dom-sync frame seeds AT the target — appears where it is.
  const seeded = stepSpriteToward(sprite, 100, 100, 16, 20);
  ok(seeded.x === 100 && seeded.y === 100, "first placement seeds at the target");
  // Mode transition to perch: world persists — NO teleport, by construction.
  applySighting(sprite, { world: null, perchNodeId: "post:9" });
  ok(sprite.mode === "perch" && sprite.world?.x === 100, "perch transition keeps the world position");
  applySighting(sprite, { world: { x: 500, y: 100 }, perchNodeId: null });
  ok(sprite.mode === "roam" && sprite.world?.x === 100, "roam transition keeps the world position too");
  // Speed cap: one 16ms step toward a far target moves at most maxStep.
  const before = { x: sprite.world!.x, y: sprite.world!.y };
  stepSpriteToward(sprite, 5000, 100, 16, 10);
  const stepDist = Math.hypot(sprite.world!.x - before.x, sprite.world!.y - before.y);
  ok(stepDist <= 10 + 1e-9, `the glide honours its speed cap (${stepDist.toFixed(2)} ≤ 10)`);
  // glideStep converges without overshoot.
  const p = { x: 0, y: 0 };
  for (let i = 0; i < 400; i += 1) glideStep(p, 50, 0, 16, 1000);
  ok(Math.abs(p.x - 50) < 1, "the glide converges on its target");
  // Owner behaviour states.
  ok(deriveOwnerMode({ isOwnMesh: true, coarse: true, cursorSeen: false, pointerLive: false, ownerHere: false }) === "centered", "own mesh + touch = centered");
  ok(deriveOwnerMode({ isOwnMesh: true, coarse: false, cursorSeen: true, pointerLive: true, ownerHere: false }) === "cursor", "own mesh + live pointer = cursor");
  ok(deriveOwnerMode({ isOwnMesh: false, coarse: false, cursorSeen: true, pointerLive: true, ownerHere: true }) === "tracking", "visiting + owner here = tracking");
  ok(deriveOwnerMode({ isOwnMesh: false, coarse: false, cursorSeen: true, pointerLive: true, ownerHere: false }) === "resting", "visiting + owner away = resting (Zzz)");
}

// ────────────────────────────────────────────────────────────────── mood ──

{
  const state = createBehaviorMoodState();
  // Warm-up inside the enter band…
  const warm = stepBehaviorMood(state, { now: 1000, nearestMeshiPx: 100, idleForMs: 0 });
  ok(warm !== null, "a close neighbour warms the mood");
  // …the beat HOLDS through repeated samples…
  const held = stepBehaviorMood(state, { now: 1700, nearestMeshiPx: 100, idleForMs: 0 });
  ok(held === warm, "warm beats hold, not flicker");
  // …hysteresis: drifting to 150px (past enter, inside stay) stays warm…
  const staying = stepBehaviorMood(state, { now: 2400, nearestMeshiPx: 150, idleForMs: 0 });
  ok(staying !== null, "hysteresis keeps the warmth between the bands");
  // …and past the stay band it cools.
  const cooled = stepBehaviorMood(state, { now: 3100, nearestMeshiPx: 200, idleForMs: 0 });
  ok(cooled === null, "past the stay band the mood cools");
  // Idle ladder: fidget then doze.
  const fidget = stepBehaviorMood(state, { now: 4000, nearestMeshiPx: Infinity, idleForMs: 8000 });
  ok(fidget === "thinking" || fidget === "searching", "quiet for 7s+ fidgets");
  const dozing = stepBehaviorMood(state, { now: 5000, nearestMeshiPx: Infinity, idleForMs: 23_000 });
  ok(dozing === "sleepy", "quiet for 22s+ dozes");

  // Broadcast ladder priorities.
  const base = { now: 10_000, pendingAction: null, composing: false, hovering: false, nodeOpen: false, behaviorMood: null, idleForMs: 0, restingFace: "happy" };
  ok(deriveBroadcastMood({ ...base, pendingAction: { kind: "heart", at: 9000 } }) === "love", "a fresh heart-throw beams love");
  ok(deriveBroadcastMood({ ...base, pendingAction: { kind: "wave", at: 9000 } }) === "excited", "other actions read excited");
  ok(deriveBroadcastMood({ ...base, composing: true, hovering: true }) === "thinking", "composing outranks hovering");
  ok(deriveBroadcastMood({ ...base, nodeOpen: true }) === "learning", "an open node reads learning");
  ok(deriveBroadcastMood({ ...base, idleForMs: 16_000 }) === "sleepy", "long idle broadcasts sleepy");
  ok(deriveBroadcastMood(base) === "happy", "otherwise the resting face");
}

// ───────────────────────────────────────────────────────── server policy ──

{
  const facts = (over: Partial<PresenceWriteFacts> = {}): PresenceWriteFacts => ({
    viewingMesh: "room-1",
    surface: "mesh",
    activeNodeId: null,
    activePostId: null,
    activeRoute: null,
    lastAction: null,
    ghostMode: false,
    shareWhere: false,
    ...over,
  });
  ok(isSignificantPresenceWrite(undefined, facts()), "a first beat always writes through");
  ok(!isSignificantPresenceWrite(facts(), facts()), "pure position/mood drift coalesces");
  ok(isSignificantPresenceWrite(facts(), facts({ viewingMesh: "room-2" })), "a room change writes through");
  ok(isSignificantPresenceWrite(facts(), facts({ activeNodeId: "post:1" })), "a perch change writes through");
  ok(isSignificantPresenceWrite(facts(), facts({ lastAction: "heart|p|1" })), "a world action writes through");
  ok(isSignificantPresenceWrite(facts(), facts({ ghostMode: true })), "a ghost flip writes through");

  const loc = { viewingMesh: "room-9", activeRoute: "/flow", activeNodeId: "post:2", activePostId: "post:2" };
  const hidden = redactWhere(loc, { inObservedRoom: false, viewingViewerMesh: false, samePost: false, shareWhere: false });
  ok(hidden.viewingMesh === "" && hidden.activeRoute === null && hidden.activeNodeId === null && hidden.activePostId === null, "without opt-in, location never leaves the room");
  const optedIn = redactWhere(loc, { inObservedRoom: false, viewingViewerMesh: false, samePost: false, shareWhere: true });
  ok(optedIn.viewingMesh === "room-9" && optedIn.activeRoute === "/flow", "opt-in reveals the where-chip fields");
  ok(optedIn.activeNodeId === null, "…but perch detail still stays in the room");
  const inRoom = redactWhere(loc, { inObservedRoom: true, viewingViewerMesh: false, samePost: false, shareWhere: false });
  ok(inRoom.viewingMesh === "room-9" && inRoom.activeNodeId === "post:2", "inside the observed room nothing is redacted");
  const samePost = redactWhere(loc, { inObservedRoom: false, viewingViewerMesh: false, samePost: true, shareWhere: false });
  ok(samePost.activePostId === "post:2" && samePost.viewingMesh === "", "same-post co-presence reveals only the shared post");
}

/**
 * THE STREAM MUST RETIRE ITSELF BEFORE THE PLATFORM RETIRES IT.
 *
 * The SSE route had no lifetime of its own, so every healthy connection ran
 * until the serverless ceiling and was killed. Production logged 116 of these
 * across six users:
 *
 *   Vercel Runtime Timeout Error: Task timed out after 300 seconds
 *
 * Note what that means: sitting on the mesh for five minutes is the SUCCESS
 * case for a presence stream, so the feature working generated the errors. And
 * a kill is not a close — the function is torn down mid-frame, so the room goes
 * dark until the browser notices.
 *
 * Asserted by reading the source rather than by running it, because the failure
 * takes four minutes to reproduce and only on the platform. What matters is the
 * RELATIONSHIP between the two numbers, which is exactly the thing a later edit
 * to either one breaks silently.
 */
function streamLifetimeChecks() {
  const src = readFileSync(join(process.cwd(), "src/app/api/mesh/presence/stream/route.ts"), "utf8");

  const maxDuration = /export const maxDuration = (\d+)/.exec(src);
  ok(!!maxDuration, "the stream route states its own maxDuration rather than inheriting a platform default");

  const lifetime = /const STREAM_LIFETIME_MS = ([\d_]+)/.exec(src);
  ok(!!lifetime, "the stream route sets a self-imposed lifetime");

  const ceilingMs = Number(maxDuration![1]) * 1000;
  const lifetimeMs = Number(lifetime![1].replace(/_/g, ""));

  ok(
    lifetimeMs < ceilingMs,
    `the stream must close before the platform kills it (${lifetimeMs}ms lifetime vs ${ceilingMs}ms ceiling)`,
  );
  // Margin, not just order. A lifetime a second under the ceiling loses the
  // race whenever a final push is slow or the runtime is cold, and the failure
  // mode is the timeout error this exists to prevent.
  ok(
    ceilingMs - lifetimeMs >= 30_000,
    `the lifetime needs real margin under the ceiling, not a photo finish (${(ceilingMs - lifetimeMs) / 1000}s)`,
  );
  // Long enough to be worth holding open: reconnecting every few seconds would
  // trade the timeout for a connection storm.
  ok(lifetimeMs >= 60_000, `a stream that retires this fast is a poll in disguise (${lifetimeMs}ms)`);

  // The ending has to be a CLOSE the client can act on.
  ok(/controller\.close\(\)/.test(src), "the lifetime path closes the controller rather than letting it lapse");
  ok(/event: cycle/.test(src), "the planned ending announces itself as a `cycle` event");

  // …and the client has to be listening for it, or the reconnect gap reads as
  // the stream going quiet and drops the room onto the polling fallback.
  const client = readFileSync(join(process.cwd(), "src/components/mesh/live/presence-client.ts"), "utf8");
  ok(
    /addEventListener\("cycle"/.test(client),
    "the client listens for `cycle`, so a scheduled reconnect counts as health rather than a fault",
  );
}

/**
 * FIVE THINGS ABOUT THE SOCIAL STRUM THAT NO PURE FUNCTION CAN PROVE.
 *
 * Each is a WIRING property — an ordering, an absence, a placement — that is
 * invisible to a unit test and silent when broken. Asserted by reading the
 * source, in the same spirit as the stream-lifetime check above: what matters
 * is the RELATIONSHIP between two lines, which is exactly what a later edit
 * breaks without noticing.
 */
function socialStrumWiringChecks() {
  // 1. GHOST MODE IS SERVER-AUTHORITATIVE, AND THE STRUM INHERITS IT WHOLE.
  // A strum rides `lastAction` and gets NO payload field of its own, which is
  // the entire reason it needs no ghost-mode code: a ghosting person's entry is
  // skipped before any field is copied, so their strums cannot leave the
  // server. That is only true while the `continue` stays AHEAD of the field
  // copy — if a refactor ever moved the ghost test below it, a ghosting user
  // would keep broadcasting and nothing else in this repo would notice.
  const store = readFileSync(join(process.cwd(), "src/lib/mesh-presence-store.ts"), "utf8");
  const ghostSkip = store.indexOf("if (entry.ghostMode) continue;");
  const actionCopy = store.indexOf("lastAction: isViewingSameMesh");
  ok(ghostSkip > 0 && actionCopy > 0, "the payload builder still has both a ghost skip and a room-scoped lastAction");
  ok(
    ghostSkip < actionCopy,
    "a ghosting person is dropped BEFORE their lastAction is copied — a ghost broadcasts no strum",
  );

  // 2. THE STRUM BRANCH SITS ABOVE THE TARGETLESS-FLOURISH FALLBACK. The replay
  // loop ends in `else if (at) spawnBurst(...)`, which catches every KNOWN verb
  // without an explicit branch. Ship the verb with its branch below that line
  // (or delete the branch) and a remote strum renders as five reaction glyphs
  // at the sender's Meshi: wrong effect, wrong place, and it would fire even
  // for a strand this viewer does not have.
  const live = readFileSync(join(process.cwd(), "src/components/mesh/live/use-live-presence.ts"), "utf8");
  const strumBranch = live.indexOf('ev.verb === "strum"');
  const burstFallback = live.indexOf("spawnBurst(rt, at.x, at.y - 12, ev.verb");
  ok(strumBranch > 0 && burstFallback > 0, "the replay loop still has a strum branch and the burst fallback");
  ok(
    strumBranch < burstFallback,
    "a strum is handled BEFORE the catch-all, so it never renders as a reaction burst",
  );

  // 3. THE WIRE CLOCK NEVER TOUCHES THE STRUM MAP. `rt.strandStrums` is
  // measured in the scheduler's rAF clock by BOTH the painter (paint/edges) and
  // the stamp collector (live/use-meshi-dom-sync); the bus's `atMs` is
  // Date.now(). Writing one into the other is the quietest bug available here:
  // the shimmer never draws (its progress is a number in the millions), the
  // 900ms collector never fires, and the strand sits in permanent cooldown —
  // "remote strums just don't sparkle", with a slow leak underneath. The
  // structural defence is that the live hook only ever STAGES a strum and the
  // sim phase applies it, so the live hook must not write the map at all.
  ok(
    !/strandStrums\s*\.\s*set\s*\(/.test(live),
    "the live hook never stamps the strum map itself — it stages, and the frame loop applies on the rAF clock",
  );
  ok(
    /stageIncomingStrum\(/.test(live),
    "…via the staging queue, which is what makes that possible",
  );

  // 4. A STRUM NEVER FORCES A HEARTBEAT. This is the single line that makes
  // the budget assertion above come out as EQUALITY rather than a ceiling, and
  // it is one word away from regressing: every other emitter in live/ ends with
  // `rt.heartbeatNow?.()`, so adding it here is the natural-looking edit and
  // costs ~15 requests/min out of the ~28 the presence budget has spare. A
  // strum is the one verb that is guaranteed a beat already — you cannot strum
  // without moving — so it waits for it.
  const wire = readFileSync(join(process.cwd(), "src/components/mesh/live/strum-broadcast.ts"), "utf8");
  // Anchored to a STATEMENT, so the header's discussion of the line it must
  // not contain does not itself trip the check.
  ok(
    !/^\s*rt\.heartbeatNow/m.test(wire),
    "a strum stages and waits for the movement heartbeat — it never buys one of its own",
  );

  // 5. THE RECEIVER'S REDUCED-MOTION FLAG IS THE RECEIVER'S — AND IT IS THE
  // FRAME LOOP THAT HAS TO SAY SO.
  //
  // This one was added because the gate above it did NOT catch its own
  // mutation. `applyStrum` honours whatever boolean it is handed, and the pure
  // check in the strum section proves it: hand it `true` and it stamps, sounds
  // and does not kick. That proof is worth nothing on its own, because it
  // proves a property of a FUNCTION while the promise — "reduced motion is the
  // RECEIVER'S" — is a property of a CALL. Changing the incoming drain's sixth
  // argument to a bare `false` reads like "remote strums should animate", is
  // one word wide, kicks the filament on a viewer whose OS asked for no
  // animation, and passed all 122 checks in this file untouched.
  //
  // So the argument is asserted as text, at BOTH strum call sites. Both,
  // because the claim is not merely "the receive path honours a preference" but
  // that a remote strum is the SAME ACT as a local one; two call sites reading
  // two different flags would break that quietly in whichever direction the
  // edit went.
  const frame = readFileSync(join(process.cwd(), "src/components/mesh/scene/use-mesh-frame.ts"), "utf8");
  // Argument lists only — `[^()]*` cannot span a nested call, so a future edit
  // that wraps an argument fails this check rather than slipping past it.
  const strumCalls = frame.match(/\b(?:applyStrum|stepStrum)\([^()]*\)/g) ?? [];
  ok(
    strumCalls.length === 2,
    "the frame loop rings strands from exactly two call sites — your sweep, and the room's",
  );
  ok(
    strumCalls.every((call) => /\brt\.reducedMotion\b/.test(call)),
    "…and BOTH are governed by THIS viewer's reduced-motion flag — never a literal, never the sender's",
  );
  // The other half of "silences motion, not sound": the painter is handed the
  // strum map only when motion is allowed, so a remote strum cannot shimmer
  // past a preference the kick already respects.
  ok(
    /rt\.reducedMotion\s*\?\s*undefined\s*:\s*rt\.strandStrums/.test(frame),
    "…and the painter only receives the strum map when motion is allowed — no remote shimmer under reduced motion",
  );
}

streamLifetimeChecks();
socialStrumWiringChecks();

transportChecks()
  .then(() => {
    console.log(`mesh-live-contract: ${checks} checks passed`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
