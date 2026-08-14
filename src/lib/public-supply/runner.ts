import { prisma } from "@/lib/prisma";
import { PublicSupplyHttpError, publicGet } from "./fetch";
import { durableRateLimit } from "@/lib/durable-rate-limit";
import { recordRun, storeItems, sweepExpired, sweepOldRuns } from "./store";
import type { LaneContext, LaneRunResult, PublicSupplyLane } from "./types";

/**
 * RUNNING THE LANES, WITHOUT BECOMING A PROBLEM FOR ANYONE.
 *
 * Three properties this has to have, in priority order:
 *
 * 1. IT NEVER LIES. A lane with no credential configured is `not_configured`
 *    and stores nothing. A lane that errors is `error` and stores nothing. In
 *    neither case does it invent an item, reuse a sample, or leave the previous
 *    batch looking freshly fetched. Every outcome is written to
 *    PublicSupplyRun, so the status surface reports what actually happened
 *    rather than what we hoped.
 *
 * 2. IT IS A GOOD CITIZEN. `minIntervalSeconds` is honoured against the real
 *    last-run time in the database, not an in-memory timer — serverless means
 *    memory is per-instance and a dozen cold starts would otherwise become a
 *    dozen simultaneous fetches. A 429 backs that lane off for a full hour
 *    rather than retrying into a rate limit.
 *
 * 3. IT CANNOT TAKE A PAGE DOWN. Lanes are isolated: one throwing does not
 *    stop the others, and the whole run is bounded. Every fetch inside is
 *    already timeout-capped (fetch.ts).
 *
 * ── WHY THIS IS NOT ON THE READ PATH ────────────────────────────────────────
 *
 * Reads come from the database (store.readPublicSupply). Fetching happens on a
 * schedule, out of band. A user opening /flow must never wait on YouTube being
 * slow, and a platform outage must never become a mesh.me outage.
 */

/** After a 429, leave that lane alone for this long regardless of its interval. */
const RATE_LIMIT_BACKOFF_SECONDS = 60 * 60;

/** Ceiling on one lane's contribution per run, so one platform cannot flood. */
const ITEMS_PER_LANE = 40;

function envReader(): (key: string) => string | undefined {
  return (key: string) => {
    const value = process.env[key];
    const trimmed = typeof value === "string" ? value.trim() : "";
    return trimmed.length > 0 ? trimmed : undefined;
  };
}

/** Which required env vars are absent. Empty means the lane can run. */
function missingEnv(lane: PublicSupplyLane, env = envReader()): string[] {
  return lane.envKeys.filter((key) => !env(key));
}

/**
 * Has this lane run recently enough that it should sit this one out?
 *
 * Reads the last run from the database on purpose. The alternative — a module
 * variable — resets on every cold start, which on serverless means the
 * interval is silently not enforced at exactly the moment traffic spikes.
 */
async function tooSoon(lane: PublicSupplyLane, now: Date): Promise<boolean> {
  try {
    const last = await prisma.publicSupplyRun.findFirst({
      where: { lane: lane.id },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true, status: true },
    });
    if (!last) return false;
    const waitSeconds = last.status === "rate_limited" ? RATE_LIMIT_BACKOFF_SECONDS : lane.minIntervalSeconds;
    return now.getTime() - last.startedAt.getTime() < waitSeconds * 1000;
  } catch {
    // If we cannot tell how long it has been, assume it was recent. Erring
    // toward not calling someone else's API is the safe direction.
    return true;
  }
}

async function runLane(lane: PublicSupplyLane, opts?: { force?: boolean; now?: Date }): Promise<LaneRunResult> {
  const now = opts?.now ?? new Date();
  const started = Date.now();
  const base = { laneId: lane.id, platform: lane.platform, itemsFetched: 0, itemsStored: 0 };

  const missing = missingEnv(lane);
  if (missing.length > 0) {
    // Not an error. Nobody has given mesh.me a key for this platform yet, and
    // the honest thing is to say exactly that — naming the variables, so the
    // status surface can tell an operator what to do instead of "unavailable".
    const result: LaneRunResult = {
      ...base,
      status: "not_configured",
      detail: `needs ${missing.join(", ")}`,
      durationMs: Date.now() - started,
    };
    await recordRun(result);
    return result;
  }

  if (!opts?.force && (await tooSoon(lane, now))) {
    // Silent: this is the normal, healthy case on a frequent schedule, and
    // writing a run row for it would drown the real history in noise.
    return { ...base, status: "ok", detail: "skipped — within its interval", durationMs: Date.now() - started };
  }

  const ctx: LaneContext = {
    get: publicGet,
    env: envReader(),
    limit: ITEMS_PER_LANE,
  };

  try {
    const items = await lane.fetch(ctx);
    const stored = await storeItems(lane, items);
    const result: LaneRunResult = {
      ...base,
      status: "ok",
      itemsFetched: items.length,
      itemsStored: stored,
      // Worth surfacing: fetching 40 and storing 3 means the lane is producing
      // items this layer rejects (no url, no id), which is a bug in the lane.
      detail: items.length !== stored ? `${items.length - stored} item(s) rejected before storage` : undefined,
      durationMs: Date.now() - started,
    };
    await recordRun(result);
    return result;
  } catch (error) {
    const isHttp = error instanceof PublicSupplyHttpError;
    const rateLimited = isHttp && error.status === 429;
    const result: LaneRunResult = {
      ...base,
      status: rateLimited ? "rate_limited" : "error",
      // PublicSupplyHttpError already redacts the URL it carries; a raw
      // message could otherwise put an API key into the database.
      detail: isHttp ? `${error.message} (${error.url})` : "fetch failed",
      durationMs: Date.now() - started,
    };
    await recordRun(result);
    return result;
  }
}

/**
 * Run every lane. Sequential by design: these are third-party APIs and the
 * total work is small, so politeness beats parallelism. Nothing here is on a
 * user's critical path.
 */
export async function runAllLanes(lanes: PublicSupplyLane[], opts?: { force?: boolean }): Promise<LaneRunResult[]> {
  const results: LaneRunResult[] = [];
  for (const lane of lanes) {
    // runLane already contains its own failures; this catch is for the
    // genuinely unexpected, so one bad lane cannot end the sweep.
    try {
      results.push(await runLane(lane, opts));
    } catch {
      results.push({
        laneId: lane.id,
        platform: lane.platform,
        status: "error",
        itemsFetched: 0,
        itemsStored: 0,
        detail: "lane threw outside its own handler",
        durationMs: 0,
      });
    }
  }

  // Retention is enforced on every run, not on a separate schedule somebody
  // has to remember to create.
  const [expired, oldRuns] = await Promise.all([sweepExpired(), sweepOldRuns()]);
  if (expired > 0 || oldRuns > 0) {
    console.log(`[public-supply] swept ${expired} expired item(s), ${oldRuns} old run row(s)`);
  }
  return results;
}

/**
 * SELF-HEALING SUPPLY — the claim half.
 *
 * An audit found the Flow completely empty for every user: all supply rows
 * had passed their terms-mandated expiry and nothing but the hourly cron
 * would ever refill them — a missed or failing cron meant an empty product
 * until a human noticed. Retention cannot be stretched (it is a compliance
 * clause, store.ts), but FETCHING fresh content is always allowed, so the
 * Flow heals itself: when a read comes up empty, the route claims one
 * refresh attempt here and runs the lanes after the response
 * (next/server `after`).
 *
 * The claim is durable and global — one attempt per 15 minutes across every
 * instance — so a burst of visitors to an empty Flow cannot stampede the
 * platform APIs. Rows existing means no claim: emptiness is the only
 * trigger, never freshness preferences.
 */
export async function claimSupplyAutoRefresh(): Promise<boolean> {
  try {
    const unexpired = await prisma.publicPost.count({
      where: { expiresAt: { gt: new Date() } },
    });
    if (unexpired > 0) return false;
    const claim = await durableRateLimit("public-supply:auto-refresh", 1, 15 * 60 * 1000);
    return claim.allowed;
  } catch {
    return false;
  }
}
