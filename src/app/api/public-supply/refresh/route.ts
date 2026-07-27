import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { PUBLIC_SUPPLY_LANES } from "@/lib/public-supply/registry";
import { runAllLanes } from "@/lib/public-supply/runner";
import { isSameOriginRequest } from "@/lib/request-guard";

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
 *
 * ── THE TWO CALLERS NEED DIFFERENT PROOF ────────────────────────────────────
 *
 * The cron secret is an out-of-band credential: a scheduler sends it
 * deliberately, and no browser will ever attach it to a request the user did
 * not intend. The admin session is the opposite — a cookie the browser attaches
 * to ANY request to this origin, including one an attacker's page caused.
 *
 * So the session path was a CSRF hole, and GET made it a one-tag hole:
 *
 *     <img src="https://mesh.me/api/public-supply/refresh">
 *
 * on any page an admin visits, and every lane fires against every third-party
 * API. `api-route-contracts` flagged the missing guard as a P0 and was right.
 *
 * The fix is not one guard over both paths — same-origin proof would break the
 * scheduler, which sends no Origin at all. Each path gets the proof that suits
 * how it is carried:
 *
 *   cron secret   GET or POST, no origin proof     (credential is out-of-band)
 *   admin session POST only, same-origin required  (credential is ambient)
 *
 * GET can no longer reach the session path at all, so the img/script/iframe
 * shape is dead, and a cross-site form POST fails the origin check.
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

type Authorization = { ok: true; via: string } | { ok: false };

/**
 * The scheduler's proof. Vercel Cron sends its own header; the shared secret
 * covers every other scheduler and lets this be triggered from outside Vercel.
 *
 * No same-origin check, and none is possible: a scheduler sends no Origin or
 * Referer at all. None is needed either — a secret is not something a browser
 * will attach to a request on an attacker's behalf.
 */
function authorizeSecret(request: NextRequest): Authorization {
  if (secretMatches(request.headers.get("authorization"))) return { ok: true, via: "cron-secret" };
  return { ok: false };
}

/**
 * The admin's proof — the difference between "the Flow is thin" and "the Flow
 * is thin AND I can do something about it right now".
 *
 * A session cookie IS attached on an attacker's behalf, so this demands
 * same-origin evidence before it will even look the user up.
 *
 * THIS IS A SEPARATE FUNCTION ON PURPOSE. It was one `authorize()` taking an
 * `allowSession` boolean, and a boolean is one character away from being wrong:
 * flipping GET's argument to `true` restored the whole `<img src=…>` vector and
 * nothing failed. GET does not call this, so on GET there is no session path to
 * re-enable — only to re-introduce.
 */
async function authorizeAdminSession(request: NextRequest): Promise<Authorization> {
  if (!isSameOriginRequest(request)) return { ok: false };
  const user = await getCurrentUser().catch(() => null);
  if (user?.isAdmin) return { ok: true, via: `admin:${user.username}` };
  return { ok: false };
}

/** The work itself. Both verbs run this, and only after authorizing. */
async function runRefresh(request: NextRequest, via: string) {
  const force = new URL(request.url).searchParams.get("force") === "1";
  const started = Date.now();
  const results = await runAllLanes(PUBLIC_SUPPLY_LANES, { force });

  return NextResponse.json({
    ok: true,
    via,
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

/** Either proof is enough on POST — a verb a cross-site form can issue, which
 *  is why the session half of it demands same-origin evidence. */
export async function POST(request: NextRequest) {
  const secret = authorizeSecret(request);
  const auth = secret.ok ? secret : await authorizeAdminSession(request);
  if (!auth.ok) {
    // 404, not 403: an unauthenticated caller learns nothing about whether
    // this endpoint exists or whether a secret is configured.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return runRefresh(request, auth.via);
}

/**
 * GET exists ONLY for Vercel Cron, which issues GET and carries the secret.
 *
 * It does not delegate to POST and does not touch `authorizeAdminSession`.
 * Any tag on any page can issue a GET with the user's cookies attached —
 * `<img src="https://mesh.me/api/public-supply/refresh">` on a page an admin
 * visits was a full third-party refresh — so the session is simply not reachable
 * from this verb.
 */
export async function GET(request: NextRequest) {
  const auth = authorizeSecret(request);
  if (!auth.ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return runRefresh(request, auth.via);
}
