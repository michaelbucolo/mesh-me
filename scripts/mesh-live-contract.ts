// Live-room contract gate for Presence v2 (`npm run mesh:live-contract`).
//
// Runs standalone (no DOM, no DB) against the PURE halves of the live stack:
//
// 1. ACTION BUS — versioned envelope out, legacy pipe parsed at the edge,
//    and the mixed-version rule: UNKNOWN VERBS ARE IGNORED (while still
//    consuming their dedupe slot). Baseline/age/dedupe gates.
// 2. HEARTBEAT BUDGET — a mock-transport presence client under sustained
//    movement stays at the 500ms moving floor (~120/min), and even with an
//    action-beat flood the hard global gap keeps it under the 180/min
//    rate-limit budget.
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
import {
  ACTION_REPLAY_MAX_AGE_MS,
  ACTION_VERBS,
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
  ok(
    ACTION_VERBS.length === 6 && ACTION_VERBS.every((v) => isKnownVerb(v)) && !isKnownVerb("strum"),
    "the verb set is exactly heart/star/spark/wow/wave/fling (fling = PR7's cosmetic heart)",
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
  const unknown = admitRoomAction(gate, "bo", `strum|edge|${t0 - 50}`, t0);
  ok(unknown === null, "unknown verbs are IGNORED on receive");
  // …and it consumed its dedupe slot, so re-delivery stays silent too.
  ok(admitRoomAction(gate, "bo", `strum|edge|${t0 - 50}`, t0 + 100) === null, "ignored verbs still consume their dedupe slot");
  const newer = admitRoomAction(gate, "bo", `wave||${t0 + 200}`, t0 + 300);
  ok(newer?.verb === "wave", "a KNOWN verb from the same sender still replays afterwards");
  // PR7's fun-verb heart: `fling` replays with its target so receivers can fly
  // the NON-COUNTING heart (a `heart` on the wire stays a real like).
  const fling = admitRoomAction(gate, "bo", `fling|p|${t0 + 400}`, t0 + 450);
  ok(fling?.verb === "fling" && fling.targetId === "p", "the cosmetic fling heart replays as its own verb");
  pruneReplayGate(gate, t0 + 120_000);
  ok(gate.seen.size === 0, "dedupe stamps prune by age");
}

// ─────────────────────────────── mock transport: budget + lifecycle ──────

interface FakeFetchLog {
  posts: number;
  gets: number;
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
}

function makeHarness(opts: HarnessOptions) {
  let clock = 1_000_000;
  const log: FakeFetchLog = { posts: 0, gets: 0 };
  const streams: FakeStream[] = [];
  let pos = 0;
  const links: string[] = [];
  const client = createPresenceClient({
    getRoom: () => "room-1",
    isVisible: () => true,
    buildBody: () => ({ beat: true }),
    getMovement: () => ({ x: pos, y: 0, zoom: 1 }),
    onPayload: opts.onPayload ?? (() => {}),
    onLink: (l) => links.push(l),
    now: () => clock,
    random: () => 0.5,
    fetchFn: (async (_input: unknown, init?: { method?: string }) => {
      if (init?.method === "POST") {
        log.posts += 1;
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
        if (opts.moving) pos += 25; // well past the movement epsilon each tick
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
  ok(perMinute >= 100, `the floor still tracks live motion (${perMinute}/min ≥ 100)`);
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

transportChecks()
  .then(() => {
    console.log(`mesh-live-contract: ${checks} checks passed`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
