// THE SCHEDULER'S PURE HALF — decisions with no database and no network.
//
// The cron route holds the prisma calls; everything it must DECIDE lives
// here, where the gate can truth-table it: whether a due row fires or goes
// missed, whether a report settles to done or retrying, whether a `firing`
// row's lease has expired, and — the one that carries the no-double-post
// theorem — how a retry hands deliverers out so that a leg that already
// POSTED is replayed from its recorded URL and never sent again.

import type { Deliverer, PublishReport } from "./publish";
import type { ScheduleLaw } from "./schedule-law";

/** A due row either fires, went past the grace (missed), or is not due yet. */
export function decideFire(now: Date, scheduledFor: Date, law: ScheduleLaw): "fire" | "missed" | "wait" {
  const lateBy = now.getTime() - scheduledFor.getTime();
  if (lateBy < 0) return "wait";
  if (lateBy > law.lateFireGraceMs) return "missed";
  return "fire";
}

/** A `firing` row whose claim is older than the lease was orphaned by a
 *  crashed invocation — settle it, never re-fire it. */
export function leaseExpired(now: Date, claimedAt: Date | null, law: ScheduleLaw): boolean {
  if (!claimedAt) return true;
  return now.getTime() - claimedAt.getTime() > law.firingLeaseMs;
}

export type SettleDecision =
  | { status: "done" }
  | { status: "retrying"; nextAttemptAt: Date };

/** After a fire: retry only when a leg failed RETRYABLY and attempts remain.
 *  Everything else is terminal — the report already tells the whole truth. */
export function settleReport(report: PublishReport, attempts: number, now: Date, law: ScheduleLaw): SettleDecision {
  const wantsRetry = report.outcomes.some((o) => o.state === "failed" && o.retryable);
  if (wantsRetry && attempts < law.maxAttempts) {
    const backoff = law.retryBackoffMs[Math.min(attempts - 1, law.retryBackoffMs.length - 1)] ?? law.retryBackoffMs[0];
    return { status: "retrying", nextAttemptAt: new Date(now.getTime() + backoff) };
  }
  return { status: "done" };
}

/**
 * THE NO-DOUBLE-POST THEOREM, as a deliverer map. A retry re-runs the REAL
 * publishToTargets — same summary, same buckets, same honesty, single
 * definition — but with each leg's deliverer chosen by what already happened:
 *
 *   posted            → a replay that returns the recorded URL. No network.
 *                       The live deliverer is never handed to a posted leg,
 *                       so a duplicate on someone's timeline cannot happen.
 *   failed, retryable → the live deliverer (this is what the retry is FOR).
 *   failed, permanent → a replay of the recorded failure. Retrying a
 *                       malformed post forever is how you get rate-limited
 *                       off a platform; the report keeps telling the truth.
 *   skipped           → the live map decides. A platform skipped for "not
 *                       connected" that has since been reconnected goes out;
 *                       still absent, it skips honestly again.
 */
export function buildRetryDeliverers(
  stored: PublishReport | null,
  live: Record<string, Deliverer>,
): Record<string, Deliverer> {
  if (!stored) return live;

  const map: Record<string, Deliverer> = { ...live };
  for (const outcome of stored.outcomes) {
    if (outcome.state === "posted") {
      const url = outcome.url;
      map[outcome.platform] = async () => ({ ok: true, url });
    } else if (outcome.state === "failed" && !outcome.retryable) {
      const message = outcome.message;
      map[outcome.platform] = async () => ({ ok: false, retryable: false, message });
    }
    // failed+retryable and skipped keep whatever the live map says.
  }
  return map;
}

/**
 * Settling an INTERRUPTED row (lease expired mid-fan-out): posted legs are
 * preserved verbatim from the stored report; every other leg becomes a
 * permanent failure that says so. Never auto-refired — an unconfirmed leg may
 * have landed, and a duplicate is the one lie the vocabulary cannot confess.
 */
export function settleInterrupted(stored: PublishReport | null, targets: readonly string[]): PublishReport {
  const prior = new Map((stored?.outcomes ?? []).map((o) => [o.platform, o]));
  const outcomes = targets.map((platform) => {
    const seen = prior.get(platform);
    if (seen && seen.state === "posted") return seen;
    return {
      platform,
      state: "failed" as const,
      retryable: false,
      message: "The send was interrupted partway — check this platform before sending again.",
    };
  });
  const posted = outcomes.filter((o) => o.state === "posted").map((o) => o.platform);
  const failed = outcomes.filter((o) => o.state === "failed").map((o) => o.platform);
  return {
    outcomes,
    posted,
    skipped: [],
    failed,
    complete: outcomes.length > 0 && posted.length === outcomes.length,
    summary: posted.length > 0
      ? `Posted to ${posted.length} · ${failed.length} interrupted.`
      : "The send was interrupted — nothing is confirmed posted.",
  };
}

/** The all-skipped report a row gets when its time passed while mesh.me
 *  couldn't send. Missed is cron-terminal; only the owner re-arms. */
export function missedReport(targets: readonly string[]): PublishReport {
  const outcomes = targets.map((platform) => ({
    platform,
    state: "skipped" as const,
    reason: "Missed its time while mesh.me couldn't send — it was not posted.",
  }));
  return {
    outcomes,
    posted: [],
    skipped: targets.slice(),
    failed: [],
    complete: false,
    summary: "Missed its time — nothing was posted.",
  };
}

/** Parse a stored targetsJson defensively: strings only, deduped, bounded. */
export function parseStoredTargets(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean))].slice(0, 12);
  } catch {
    return [];
  }
}

/** Parse a stored reportJson defensively — a corrupt report reads as absent. */
export function parseStoredReport(raw: string | null): PublishReport | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PublishReport;
    if (!parsed || !Array.isArray(parsed.outcomes)) return null;
    return parsed;
  } catch {
    return null;
  }
}
