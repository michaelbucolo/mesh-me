import "server-only";
import { prisma } from "./prisma";

/**
 * Cross-instance rate limiting + account lockout backed by the RateLimitHit
 * table. The in-memory limiters in security.ts are per-serverless-instance and
 * reset on every cold start, so an attacker spreading requests across instances
 * effectively multiplies every limit. These durable variants share one counter
 * across all instances.
 *
 * Every path FAILS OPEN: if the database is unreachable the request is allowed
 * rather than blocked, so a DB hiccup degrades to "no limiting" and can never
 * lock the whole site out of login. That's the right trade-off for auth — the
 * durable limiter is defense-in-depth on top of the in-memory one, not the sole
 * gate.
 */

export type DurableRateLimitResult = {
  allowed: boolean;
  remainingAttempts: number;
  resetInMs: number;
};

export async function durableRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): Promise<DurableRateLimitResult> {
  const now = Date.now();
  try {
    const existing = await prisma.rateLimitHit.findUnique({ where: { key } });

    if (!existing || existing.resetAt.getTime() <= now) {
      await prisma.rateLimitHit.upsert({
        where: { key },
        create: { key, count: 1, resetAt: new Date(now + windowMs) },
        update: { count: 1, resetAt: new Date(now + windowMs) },
      });
      return { allowed: true, remainingAttempts: maxAttempts - 1, resetInMs: windowMs };
    }

    if (existing.count >= maxAttempts) {
      return { allowed: false, remainingAttempts: 0, resetInMs: existing.resetAt.getTime() - now };
    }

    const updated = await prisma.rateLimitHit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
    return {
      allowed: true,
      remainingAttempts: Math.max(0, maxAttempts - updated.count),
      resetInMs: existing.resetAt.getTime() - now,
    };
  } catch {
    // Fail open — never block auth because the counter store is unavailable.
    return { allowed: true, remainingAttempts: maxAttempts - 1, resetInMs: windowMs };
  }
}

// Escalating lockout durations: 15min, 30min, 1hr, 24hr.
const LOCKOUT_DURATIONS = [
  15 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];
const LOCKOUT_THRESHOLD = 5;
// Lockout counters live under a namespaced key so they never collide with a
// windowed rate-limit bucket for the same identifier.
const lockKey = (id: string) => `lock:${id}`;

export async function checkDurableLockout(id: string): Promise<{ locked: boolean; lockedUntilMs: number }> {
  try {
    const entry = await prisma.rateLimitHit.findUnique({ where: { key: lockKey(id) } });
    if (!entry?.lockedUntil) return { locked: false, lockedUntilMs: 0 };

    const remaining = entry.lockedUntil.getTime() - Date.now();
    if (remaining > 0) return { locked: true, lockedUntilMs: remaining };

    // Lockout expired: clear the active window but keep lockCount so the next
    // lockout escalates. Best-effort; ignore write failures.
    await prisma.rateLimitHit
      .update({ where: { key: lockKey(id) }, data: { lockedUntil: null, count: 0 } })
      .catch(() => {});
    return { locked: false, lockedUntilMs: 0 };
  } catch {
    return { locked: false, lockedUntilMs: 0 };
  }
}

export async function recordDurableFailedLogin(id: string): Promise<void> {
  const key = lockKey(id);
  try {
    // Increment atomically. A read-then-write (findUnique → count+1 → update:
    // {count}) let concurrent failed logins all read the same stale count and
    // write back the same value, pinning the counter low so the escalating
    // lockout never engaged under a burst of parallel attempts.
    const entry = await prisma.rateLimitHit.upsert({
      where: { key },
      create: { key, count: 1, resetAt: new Date(Date.now() + LOCKOUT_DURATIONS[0]) },
      update: { count: { increment: 1 } },
    });

    if (entry.count >= LOCKOUT_THRESHOLD) {
      const lockCount = entry.lockCount ?? 0;
      const duration = LOCKOUT_DURATIONS[Math.min(lockCount, LOCKOUT_DURATIONS.length - 1)];
      await prisma.rateLimitHit.update({
        where: { key },
        data: {
          lockedUntil: new Date(Date.now() + duration),
          lockCount: lockCount + 1,
          resetAt: new Date(Date.now() + duration),
        },
      });
    }
  } catch {
    // Fail open — a failed write just means no lockout escalation this round.
  }
}

export async function clearDurableFailedLogins(id: string): Promise<void> {
  try {
    await prisma.rateLimitHit.deleteMany({ where: { key: lockKey(id) } });
  } catch {
    // Ignore — nothing to clear if the store is unavailable.
  }
}
