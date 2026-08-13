import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * THE one cron-secret comparison. A scheduled job's route has no session and
 * no user — the Authorization header is its entire identity, so the compare
 * is the entire wall:
 *
 *   - Unset/empty env DISABLES the route rather than opening it. The classic
 *     failure is `"" === ""`: secret never configured, empty header, door
 *     wide open. Refusing on a missing secret makes misconfiguration loud
 *     (posts go missed, the heartbeat shows it) instead of exploitable.
 *   - Length is pre-checked because timingSafeEqual THROWS on a mismatch,
 *     which would itself leak length through the error path.
 *   - `Bearer ` is accepted and stripped — Vercel's cron invocations attach
 *     `Authorization: Bearer <CRON_SECRET>` automatically.
 *
 * Constant-time on the equal-length path; the length check reveals only
 * length, which the secret's generator already made 32+ random bytes.
 */
export function cronSecretMatches(header: string | null, expected: string | undefined): boolean {
  const secret = (expected ?? "").trim();
  if (!secret) return false;

  const presented = (header ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!presented) return false;

  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
