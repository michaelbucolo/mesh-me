import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getTrustedClientIp } from "@/lib/client-ip";
import { ANONYMOUS_VIEWER } from "@/lib/feed-data";
import { getGlobalMeshSupply } from "@/lib/global-mesh";
import { rateLimit } from "@/lib/security";

/**
 * The Global Mesh supply — /mesh?view=global.
 *
 * Unlike /api/mesh (owner-only, 401 for guests), this is open to everyone:
 * viewing the Global Mesh needs no account. The supply only ever contains
 * already-public content of opted-in members (see src/lib/global-mesh.ts),
 * gated by the viewer's own block + NSFW settings.
 *
 * ── WHY THIS FILE CAME BACK ────────────────────────────────────────────────
 *
 * This endpoint was not retired on its merits. It was deleted as collateral
 * when the canvas scene was replaced by the ring field: the field read the
 * supply directly inside the server component, so nothing was left calling the
 * route and it went with the rest of the tree. The canvas is back, the canvas
 * fetches (see components/mesh/scene/mesh-prefetch.ts — meshApiUrl maps the
 * "global" view mode to this exact path), and without this handler
 * /mesh?view=global answers 404 on every load and the scene renders its error
 * gate. So the route is restored — but adapted to the surroundings it woke up
 * in rather than pasted back verbatim; see the two guards below, neither of
 * which existed in the original.
 *
 * ── THE PRIVACY POSTURE WAS RE-CHECKED, NOT ASSUMED ────────────────────────
 *
 * The obvious risk in restoring a guest-viewable endpoint from a ten-day-old
 * commit is silently reverting a privacy fix made while it was gone. It was
 * checked rather than trusted: the replacement's own read
 * (src/lib/mesh/read-global-mesh.ts) calls `getGlobalMeshSupply` with the same
 * `viewer ?? ANONYMOUS_VIEWER` fallback this handler uses, and states in its
 * header that the consent rule is deliberately NOT re-derived there. Both
 * paths are therefore the same gate, and `src/lib/global-mesh.ts` — which
 * never left the tree and so carries every change made in the interval — is
 * the single place that decides who appears. The strictness this endpoint
 * inherits from it:
 *
 *   opt-in       GlobalMeshMember.isActive, plus `sharedBranches`, which can
 *                only ever SUBTRACT from all-public, never add;
 *   suspended    user.isSuspended: false on the member, and again on the
 *                connected account behind every platform post;
 *   blocking     filtered in BOTH directions (blocks / blockedBy) against the
 *                viewer — no-ops for a guest, whose id matches no Block rows;
 *   discovery    isPublic + showInDiscovery + the privacy centre's profile
 *                rule + an explicitly public meshVisibility (defaults private).
 *
 * GHOST MODE deserves naming explicitly, because it is the one privacy control
 * that has nothing to enforce here and that absence could otherwise read as an
 * oversight. Ghost Mode hides you from LIVE presence — it is a property of the
 * presence store and the heartbeat, not of your posts. This payload carries no
 * presence at all: the supply stamps every member `status: "offline"`, there
 * is no lastSeenAt on the wire, and the scene deliberately refuses to seed a
 * presence room from the synthetic "global" hub (use-mesh-world.ts sets
 * meshOwnerId to null in Global). A ghosting member is therefore no more
 * visible here than a non-ghosting one, which is the correct outcome: ghosting
 * conceals where you ARE, and Global answers who has opted IN.
 */

// A viewer-scoped body behind a route a signed-out request can also fetch is
// exactly the shape that gets poisoned by a shared cache: two people on the
// same edge node have different blocks and different NSFW settings, so one
// cached copy is a cross-viewer leak rather than a stale render. `private`
// keeps it out of every shared cache, `no-store` out of the disk cache on a
// borrowed machine. `force-dynamic` says the same thing to the framework —
// reading cookies already makes this handler dynamic today, but that is a
// consequence of how auth happens to be written, and this route should not
// become cacheable because someone later short-circuits before `cookies()`.
export const dynamic = "force-dynamic";
const CACHE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" } as const;

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const viewer = user ?? ANONYMOUS_VIEWER;

    // The supply is four batched queries reaching up to ~960 rows each, and —
    // so guests can look — it sits behind no auth wall to slow a caller down.
    // That combination is a cheap request→work amplifier if left uncapped, so
    // cap it in-handler the way /api/flow does for the same reason: keyed per
    // account when there is one, per trusted client IP when there is not (the
    // raw X-Forwarded-For is client-controlled, which is what getTrustedClientIp
    // exists to not believe). The ceiling is generous on purpose — the live
    // scene polls itself every 25s, ~2.4 requests a minute per open tab, so 120
    // leaves room for many tabs behind one NAT before anyone legitimate is
    // throttled.
    const rateKey = user
      ? `mesh-global:${user.id}`
      : `mesh-global:ip:${getTrustedClientIp(request.headers)}`;
    if (!rateLimit(rateKey, 120, 60_000).allowed) {
      return NextResponse.json({ error: "Slow down" }, { status: 429, headers: CACHE_HEADERS });
    }

    const data = await getGlobalMeshSupply(viewer);
    return NextResponse.json(data, { headers: CACHE_HEADERS });
  } catch (error) {
    // Same shape /api/mesh answers with: log the cause, tell the client only
    // that the read failed. The scene turns any non-2xx into its error gate.
    console.error("Global mesh API error:", error);
    return NextResponse.json(
      { error: "Failed to load the Global Mesh" },
      { status: 500, headers: CACHE_HEADERS },
    );
  }
}
