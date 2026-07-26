import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { PUBLIC_SUPPLY_LANES } from "@/lib/public-supply/registry";
import { runAllLanes } from "@/lib/public-supply/runner";

/**
 * REFRESH THE PUBLIC SUPPLY. Scheduled, or triggered by an admin.
 *
 * ── WHY THIS IS NOT ON THE READ PATH ────────────────────────────────────────
 *
 * Someone opening /flow reads the database. This route is what fills it. If
 * fetching happened during a page render, a slow platform would become a slow
 * mesh.me, and a platform outage would become a mesh.me outage. It also would
 * not be usable: the ranker needs a pool to rank, not one API call's worth.
 *
 * ── IT FAILS CLOSED ─────────────────────────────────────────────────────────
 *
 * With PUBLIC_SUPPLY_CRON_SECRET unset, the secret path is DISABLED rather
 * than open. An unset secret compared against a missing header is two empty
 * strings, and "" === "" would leave a public endpoint that hammers third-party
 * APIs on demand — a free denial-of-service amplifier pointed at other people's
 * infrastructure. Absent config means no access, never universal access.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function secretMatches(header: string | null): boolean {
  const expected = process.env.PUBLIC_SUPPLY_CRON_SECRET?.trim();
  // Not configured -> this path does not exist. See the header comment.
  if (!expected) return false;
  if (!header) return false;

  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length, so the lengths are compared first and the result folded in.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function authorize(request: NextRequest): Promise<{ ok: true; via: string } | { ok: false }> {
  // Vercel Cron sends its own header; the shared secret covers every other
  // scheduler and lets this be triggered from outside Vercel too.
  if (secretMatches(request.headers.get("authorization"))) return { ok: true, via: "cron-secret" };

  // A signed-in admin can force a refresh — the difference between "the Flow
  // is thin" and "the Flow is thin AND I can do something about it right now".
  const user = await getCurrentUser().catch(() => null);
  if (user?.isAdmin) return { ok: true, via: `admin:${user.username}` };

  return { ok: false };
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (!auth.ok) {
    // 404, not 403: an unauthenticated caller learns nothing about whether
    // this endpoint exists or whether a secret is configured.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
  const started = Date.now();
  const results = await runAllLanes(PUBLIC_SUPPLY_LANES, { force });

  return NextResponse.json({
    ok: true,
    via: auth.via,
    durationMs: Date.now() - started,
    lanes: results.map((r) => ({
      lane: r.laneId,
      platform: r.platform,
      status: r.status,
      fetched: r.itemsFetched,
      stored: r.itemsStored,
      detail: r.detail,
    })),
    // The totals a human actually wants: did anything land, and is anything
    // simply unconfigured rather than broken?
    stored: results.reduce((total, r) => total + r.itemsStored, 0),
    notConfigured: results.filter((r) => r.status === "not_configured").length,
    failing: results.filter((r) => r.status === "error" || r.status === "rate_limited").length,
  });
}

/** GET is the same operation; Vercel Cron issues GET. */
export async function GET(request: NextRequest) {
  return POST(request);
}
