// The ONE presence transport — zero-DOM, fully injectable, mockable.
//
// SSE is the primary lane: one long-lived stream pushes the room's every
// movement (the server tick already carries cross-instance changes, so the
// stream alone is sufficient while healthy). The 2s poll is DEMOTED TO A
// FALLBACK that runs only while the stream is down or stale — halving the
// steady-state read load versus the old always-on dual delivery.
//
// Lifecycle rules, all in one place:
// - Stream reconnects ride a JITTERED EXPONENTIAL BACKOFF (1s ×1.7 → 15s cap,
//   ±25% jitter) instead of the old fixed 1.2s hammer.
// - A 429 from any presence request enters a RATE PAUSE (5s ×2 → 60s cap,
//   +jitter): no posts, no polls, no stream reopens until it elapses, and the
//   "paused" link state surfaces as a visible pip — never a silent freeze.
// - Payloads are DEDUPED by serialized identity at this edge, so overlapping
//   lanes (stream + fallback poll during a handover) can't double-process.
// - Heartbeats keep the adaptive cadence with a 500MS MOVING FLOOR (~120/min
//   sustained) + 2s idle keepalive + a 350ms hard global gap (≤ ~171/min
//   absolute worst case with action beats — under the 180/min budget).
//   Movement is measured in world units normalized by zoom.
// - Instant action beats (`beat()`) jump the queue but never break the
//   global gap: too-soon beats are latched and flushed on the next tick.
//
// The client never touches document/window: visibility, the room id, the
// heartbeat body, and movement are injected as functions, and fetch/
// EventSource/now are injectable for the mock-transport tests in
// scripts/mesh-live-contract.ts.

export type LiveLink = "idle" | "connecting" | "sse" | "poll" | "paused";

/** The slice of EventSource the client needs (mockable). */
export interface EventSourceLike {
  readyState: number;
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
  close(): void;
}

const ES_OPEN = 1;
const ES_CLOSED = 2;

export const HEARTBEAT_MIN_GAP_MS = 350;
export const HEARTBEAT_MOVE_FLOOR_MS = 500;
const HEARTBEAT_KEEPALIVE_MS = 2000;
/** Movement threshold in world units (divided by zoom so it feels the same
 * at every zoom level). */
const MOVE_EPSILON_WORLD = 6;

const POLL_FALLBACK_MS = 2000;
/** Stream with no event for this long is stale (keepalives come every 15s). */
const SSE_STALE_MS = 45000;
const SSE_BACKOFF_BASE_MS = 1000;
const SSE_BACKOFF_FACTOR = 1.7;
const SSE_BACKOFF_MAX_MS = 15000;

const RATE_PAUSE_BASE_MS = 5000;
const RATE_PAUSE_MAX_MS = 60000;

const CLIENT_TICK_MS = 250;

export interface PresenceClientOptions {
  /** The room (mesh owner id) — may resolve late; null = not joined yet. */
  getRoom(): string | null;
  /** Page visibility — beats and polls stand down while hidden. */
  isVisible(): boolean;
  /** The full heartbeat POST body (cosmetics, mood, position, action…). */
  buildBody(): Record<string, unknown>;
  /** Current broadcast position + zoom, for the movement threshold. */
  getMovement(): { x: number; y: number; zoom: number };
  /** A fresh (deduped) room payload arrived. */
  onPayload(payload: unknown): void;
  /** Link state changed (fires only on transitions). */
  onLink(link: LiveLink): void;
  // Injectables (default to the real environment):
  now?(): number;
  fetchFn?: typeof fetch;
  openStream?(url: string): EventSourceLike | null;
  /** Jitter source (default Math.random) — injectable for deterministic tests. */
  random?(): number;
}

export interface PresenceClient {
  start(): void;
  stop(): void;
  /** Request an instant heartbeat (action beats). Latches when too soon. */
  beat(): void;
  /** One supervision pass. Driven by the internal interval in production;
   * exposed so mock-transport tests can drive time by hand. */
  tick(): void;
  link(): LiveLink;
}

export function createPresenceClient(options: PresenceClientOptions): PresenceClient {
  const now = options.now ?? (() => Date.now());
  const fetchFn =
    options.fetchFn ?? (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  const openStream =
    options.openStream ??
    ((url: string): EventSourceLike | null =>
      typeof EventSource !== "undefined" ? new EventSource(url) : null);
  const random = options.random ?? Math.random;

  let stopped = true;
  let interval: ReturnType<typeof setInterval> | null = null;

  // Heartbeat state.
  let lastPostAt = 0;
  let lastBeatAt = 0;
  let lastSent = { x: Number.NaN, y: Number.NaN };
  let instantPending = false;
  let posting = false;

  // Stream state.
  let es: EventSourceLike | null = null;
  let lastEventAt = 0;
  let sseFails = 0;
  let nextStreamAttemptAt = 0;

  // Poll state.
  let lastPollAt = 0;
  let polling = false;

  // Rate-limit pause state.
  let pausedUntil = 0;
  let rateFails = 0;

  // Dedupe + link reporting.
  let lastSerialized = "";
  let link: LiveLink = "idle";

  const report = (next: LiveLink) => {
    if (link === next) return;
    link = next;
    options.onLink(next);
  };

  const deliver = (serialized: string, parsed?: unknown) => {
    if (serialized === lastSerialized) return;
    lastSerialized = serialized;
    try {
      options.onPayload(parsed !== undefined ? parsed : JSON.parse(serialized));
    } catch {
      // Malformed frame — the next push or poll corrects it.
    }
  };

  const enterRatePause = () => {
    rateFails += 1;
    const backoff = Math.min(RATE_PAUSE_BASE_MS * 2 ** (rateFails - 1), RATE_PAUSE_MAX_MS);
    pausedUntil = now() + backoff * (1 + 0.25 * random());
    closeStream();
    report("paused");
  };

  const closeStream = () => {
    if (!es) return;
    try {
      es.close();
    } catch {
      // already closed
    }
    es = null;
  };

  const streamHealthy = () =>
    es !== null && es.readyState === ES_OPEN && now() - lastEventAt < SSE_STALE_MS;

  const openStreamNow = (room: string) => {
    const stream = openStream(
      `/api/mesh/presence/stream?meshOwner=${encodeURIComponent(room)}`,
    );
    if (!stream) return;
    es = stream;
    lastEventAt = now();
    const mine = stream;
    stream.addEventListener("ready", () => {
      if (es !== mine) return;
      lastEventAt = now();
      sseFails = 0;
    });
    // The server keepalive is a real event (comments are invisible to
    // EventSource), so a quiet-but-alive room keeps the stream healthy.
    stream.addEventListener("ping", () => {
      if (es !== mine) return;
      lastEventAt = now();
      sseFails = 0;
    });
    stream.addEventListener("presence", (event) => {
      if (es !== mine) return;
      lastEventAt = now();
      sseFails = 0;
      deliver(String(event.data));
    });
    stream.addEventListener("error", () => {
      if (es !== mine) return;
      // EventSource retries transient drops itself; a FATAL close (auth
      // expiry, proxy giving up) parks it at CLOSED forever — release the
      // slot so supervision reopens it, with backoff.
      if (mine.readyState === ES_CLOSED) {
        closeStream();
        scheduleStreamRetry();
      }
    });
  };

  const scheduleStreamRetry = () => {
    sseFails += 1;
    const backoff = Math.min(
      SSE_BACKOFF_BASE_MS * SSE_BACKOFF_FACTOR ** (sseFails - 1),
      SSE_BACKOFF_MAX_MS,
    );
    nextStreamAttemptAt = now() + backoff * (0.75 + 0.5 * random());
  };

  const sendBeat = async () => {
    if (!fetchFn || posting) return;
    posting = true;
    try {
      const res = await fetchFn("/api/mesh/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options.buildBody()),
      });
      if (res.status === 429) enterRatePause();
      else if (res.ok) rateFails = 0;
    } catch {
      // Presence is best-effort.
    } finally {
      posting = false;
    }
  };

  const poll = async (room: string) => {
    if (!fetchFn || polling) return;
    polling = true;
    try {
      const res = await fetchFn(
        `/api/mesh/presence?meshOwner=${encodeURIComponent(room)}`,
        { cache: "no-store" },
      );
      if (res.status === 429) {
        enterRatePause();
        return;
      }
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data && !stopped) deliver(JSON.stringify(data), data);
    } catch {
      // Best-effort; the next tick retries.
    } finally {
      polling = false;
    }
  };

  const maybeBeat = (t: number, force: boolean) => {
    // The hard global gap bounds EVERY post — action beats included.
    if (t - lastPostAt < HEARTBEAT_MIN_GAP_MS) return;
    const m = options.getMovement();
    const moved =
      Math.hypot(m.x - lastSent.x, m.y - lastSent.y) >
      MOVE_EPSILON_WORLD / Math.max(m.zoom, 0.2);
    const moveDue = moved && t - lastBeatAt >= HEARTBEAT_MOVE_FLOOR_MS;
    const keepaliveDue = t - lastBeatAt >= HEARTBEAT_KEEPALIVE_MS;
    if (!force && !moveDue && !keepaliveDue) return;
    lastSent = { x: m.x, y: m.y };
    lastPostAt = t;
    lastBeatAt = t;
    instantPending = false;
    void sendBeat();
  };

  const tick = () => {
    if (stopped) return;
    const t = now();
    const room = options.getRoom();
    if (!room) {
      report("idle");
      return;
    }
    // Rate pause: full stop until it elapses (a successful request later
    // resets the escalation).
    if (t < pausedUntil) {
      report("paused");
      return;
    }

    // Stream supervision. Only a FATAL close reconnects (with backoff); a
    // stream that has merely gone quiet past the stale window is left open —
    // the poll fallback runs ALONGSIDE it (covering zombie connections), and
    // the first event to arrive silences the polls again.
    if (!es && t >= nextStreamAttemptAt) openStreamNow(room);

    const healthy = streamHealthy();
    const visible = options.isVisible();

    // Poll ONLY while the stream can't carry the room.
    if (!healthy && visible && t - lastPollAt >= POLL_FALLBACK_MS) {
      lastPollAt = t;
      void poll(room);
    }

    if (visible) maybeBeat(t, instantPending);

    report(healthy ? "sse" : es ? "connecting" : "poll");
  };

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      tick();
      interval = setInterval(tick, CLIENT_TICK_MS);
    },
    stop() {
      stopped = true;
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      closeStream();
      report("idle");
    },
    beat() {
      if (stopped) return;
      const t = now();
      if (!options.getRoom() || !options.isVisible()) return;
      if (t >= pausedUntil && t - lastPostAt >= HEARTBEAT_MIN_GAP_MS) {
        maybeBeat(t, true);
      } else {
        // Too soon (or paused) — latch it; the next tick flushes it, so an
        // action never waits for the 2s keepalive the way it used to.
        instantPending = true;
      }
    },
    tick,
    link: () => link,
  };
}
