import { getCurrentUser } from "@/lib/auth";
import {
  buildPresencePayload,
  canViewMeshRoom,
  getBlockedUserIds,
  getMutualConnectionIds,
  listPresences,
  subscribePresence,
} from "@/lib/mesh-presence-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── A STREAM MUST END BEFORE THE PLATFORM ENDS IT ──────────────────────────
//
// This route had no lifetime of its own. It held the connection open until the
// serverless function hit its ceiling and was killed, which production recorded
// as an ERROR, not a disconnect:
//
//   Vercel Runtime Timeout Error: Task timed out after 300 seconds
//   count=116  users=6  routes=/api/mesh/presence/stream
//
// 116 of them, from six people, still arriving. Every one is somebody sitting
// on the mesh for five minutes — which is the SUCCESS case for a presence
// stream, so the feature working as intended was the thing generating the
// errors. It also means the room went dark at the kill: the function is torn
// down mid-frame, so the last thing the client gets is a severed socket rather
// than a close, and everyone in that room stops updating until the browser
// notices and retries.
//
// The fix is to own the ending. `maxDuration` is stated here rather than left
// to the platform default so the two numbers below are visibly related, and
// the stream closes itself with margin to spare. EventSource reconnects on a
// clean close by itself, so what used to be a 300-second crash is now a
// sub-second reconnect the room never sees.
export const maxDuration = 300;

/** How long one connection lives before retiring itself, well inside
 * `maxDuration`. The margin absorbs a slow final push and cold-start drift —
 * being early costs one reconnect, being late costs the error above. */
const STREAM_LIFETIME_MS = 240_000;

/** Sent just before a lifetime close so the browser comes straight back
 * instead of waiting out its default (~3s) reconnect delay. Only emitted on
 * THIS path: a stream that died for any other reason should still get the
 * browser's own backoff rather than being told to retry hard. */
const RECONNECT_HINT_MS = 250;

// Server-Sent Events stream of presence updates. The client opens one long-lived
// connection per mesh view; the server pushes a fresh payload the instant any
// Meshi moves (coalesced to a short interval) plus a periodic keepalive so the
// connection survives proxies. This replaces fixed-interval polling so remote
// Meshis appear and move live rather than snapping every few seconds.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const meshOwner = searchParams.get("meshOwner");
  const surface = searchParams.get("surface");
  const activePostId = searchParams.get("activePostId");

  const viewerId = user.id;
  const [initialConnected, initialBlocked, roomAllowed] = await Promise.all([
    getMutualConnectionIds(viewerId),
    getBlockedUserIds(viewerId),
    canViewMeshRoom(viewerId, meshOwner, user.isAdmin),
  ]);
  // Reassigned by the periodic refresh below, so these stay `let`.
  let connectedSet = initialConnected;
  let blockedSet = initialBlocked;
  // Only report the requested room if the viewer could actually open that mesh —
  // otherwise it collapses to their own room, so the stream can't spy either.
  // Re-evaluated periodically below so a tightened meshVisibility takes effect
  // on a long-lived stream without requiring a reconnect.
  let allowedMeshOwner = roomAllowed ? meshOwner : null;

  const encoder = new TextEncoder();
  let closed = false;
  // Hoisted so the ReadableStream's cancel() (client disconnect / GC) can tear
  // down the timers and listener even when no abort event fires.
  let cleanup = () => {};

  const stream = new ReadableStream({
    async start(controller) {
      let pending = false;
      let lastPush = 0;
      const MIN_INTERVAL_MS = 140;
      let coalesceTimer: ReturnType<typeof setTimeout> | null = null;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // Controller already closed.
        }
      };

      let lastSerialized = "";
      const pushPayload = async () => {
        pending = false;
        lastPush = Date.now();
        try {
          const all = await listPresences();
          const payload = buildPresencePayload(all, {
            viewerId,
            connectedSet,
            blockedSet,
            meshOwner: allowedMeshOwner,
            surface,
            activePostId,
          });
          // Only push when something actually changed, so the cross-instance
          // tick below doesn't spam identical frames.
          const serialized = JSON.stringify(payload);
          if (serialized !== lastSerialized) {
            lastSerialized = serialized;
            send("presence", payload);
          }
        } catch {
          // Best-effort; keep the stream open for the next change.
        }
      };

      // Coalesce bursts of change events into at most one push per interval so a
      // room full of active Meshis can't overwhelm the connection, while a lone
      // movement still pushes almost immediately.
      const schedulePush = () => {
        if (closed || pending) return;
        pending = true;
        const elapsed = Date.now() - lastPush;
        const delay = Math.max(0, MIN_INTERVAL_MS - elapsed);
        coalesceTimer = setTimeout(() => {
          void pushPayload();
        }, delay);
      };

      const unsubscribe = subscribePresence(schedulePush);

      // Cross-instance liveness: heartbeats usually land on OTHER serverless
      // instances, whose in-process emitters this stream can't hear. Tick the
      // shared store on a short interval — the change-dedupe above means only
      // real movement is pushed, and it crosses instances in <1s.
      const tickTimer = setInterval(schedulePush, 400);

      // Refresh the viewer's mutual-connection and block sets periodically so
      // newly added connections appear — and a fresh block takes effect — without
      // reopening the stream.
      const connectionsTimer = setInterval(() => {
        Promise.all([
          getMutualConnectionIds(viewerId),
          getBlockedUserIds(viewerId),
          canViewMeshRoom(viewerId, meshOwner, user.isAdmin),
        ])
          .then(([connections, blocks, stillAllowed]) => {
            connectedSet = connections;
            blockedSet = blocks;
            allowedMeshOwner = stillAllowed ? meshOwner : null;
          })
          .catch(() => {});
      }, 20000);

      // Keepalive as a real `ping` EVENT (not a comment): it keeps
      // intermediaries from timing the connection out AND — because comments
      // are invisible to EventSource — lets the client's health monitor see
      // that a quiet room's stream is genuinely alive, so the poll fallback
      // stays down while the stream is healthy.
      const keepaliveTimer = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
        } catch {
          // ignore
        }
      }, 15000);

      // Retire the connection before the platform kills it. Declared before
      // `cleanup` so cleanup can clear it, and armed immediately after.
      let lifetimeTimer: ReturnType<typeof setTimeout> | null = null;

      cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(tickTimer);
        clearInterval(connectionsTimer);
        clearInterval(keepaliveTimer);
        if (coalesceTimer) clearTimeout(coalesceTimer);
        if (lifetimeTimer) clearTimeout(lifetimeTimer);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      lifetimeTimer = setTimeout(() => {
        if (closed) return;
        // `retry:` first, then a named event, then the close. The retry field
        // is a directive to EventSource itself rather than data, so it goes as
        // its own frame; the `cycle` event is for the client's own health
        // monitor, so a scheduled reconnect is not mistaken for the stream
        // failing and does not push it onto the polling fallback.
        try {
          controller.enqueue(encoder.encode(`retry: ${RECONNECT_HINT_MS}\n\n`));
          controller.enqueue(encoder.encode(`event: cycle\ndata: {"reason":"lifetime"}\n\n`));
        } catch {
          // Already gone; cleanup below is still the right move.
        }
        cleanup();
      }, STREAM_LIFETIME_MS);

      request.signal.addEventListener("abort", cleanup);
      // If the request was already aborted before start() ran, tear down now —
      // the abort event has already fired and won't fire again.
      if (request.signal.aborted) {
        cleanup();
        return;
      }

      // Prime the client with the current state immediately on connect.
      send("ready", { ok: true });
      await pushPayload();
    },
    // The client disconnecting (tab close, navigation) surfaces here rather than
    // as an abort on some runtimes — tear down the timers and listener so they
    // don't leak for the life of the process.
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
