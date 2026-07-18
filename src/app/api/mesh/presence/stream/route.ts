import { getCurrentUser } from "@/lib/auth";
import {
  buildPresencePayload,
  getMutualConnectionIds,
  listPresences,
  subscribePresence,
} from "@/lib/mesh-presence-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  let connectedSet = await getMutualConnectionIds(viewerId);

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      let pending = false;
      let lastPush = 0;
      const MIN_INTERVAL_MS = 180;
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
            meshOwner,
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
      const tickTimer = setInterval(schedulePush, 650);

      // Refresh the viewer's mutual-connection set periodically so newly added
      // connections become visible without reopening the stream.
      const connectionsTimer = setInterval(() => {
        getMutualConnectionIds(viewerId)
          .then((set) => {
            connectedSet = set;
          })
          .catch(() => {});
      }, 20000);

      // Keepalive comment frame so intermediaries don't time out the connection.
      const keepaliveTimer = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          // ignore
        }
      }, 15000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(tickTimer);
        clearInterval(connectionsTimer);
        clearInterval(keepaliveTimer);
        if (coalesceTimer) clearTimeout(coalesceTimer);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", cleanup);

      // Prime the client with the current state immediately on connect.
      send("ready", { ok: true });
      await pushPayload();
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
