// THE SCHEDULER'S LAW — every number the fire path obeys, in one place.
//
// These are trust constants, not tuning knobs. The one that carries the most
// weight is lateFireGraceMs: a "good morning" post fired at 2:50 PM is
// mesh.me putting words in someone's mouth, so past the grace the post goes
// MISSED — announced, never auto-fired — and only its owner re-arms it.

export const SCHEDULE_LAW = Object.freeze({
  /** A schedule must be at least this far out — "now" is what Post now is for. */
  minLeadMs: 60_000,
  /** Fires this late are still honest (and disclosed); later goes missed. */
  lateFireGraceMs: 60 * 60 * 1000,
  /** A `firing` row older than this belongs to a crashed invocation. */
  firingLeaseMs: 10 * 60 * 1000,
  /** 1 fire + 2 retries, retryable legs only. */
  maxAttempts: 3,
  retryBackoffMs: [5 * 60 * 1000, 15 * 60 * 1000] as readonly number[],
  /** Rows per tick — bounds work under the route's maxDuration. */
  tickBatch: 25,
  /** Terminal rows older than this are pruned. ScheduledPost only — this
   *  slice never writes or deletes RateLimitHit. */
  historyRetentionDays: 180,
} as const);

export type ScheduleLaw = typeof SCHEDULE_LAW;
