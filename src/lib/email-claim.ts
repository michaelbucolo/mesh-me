import "server-only";
import { prisma } from "./prisma";

/**
 * WHO OWNS AN EMAIL ADDRESS — one answer, for every path that needs it.
 *
 * `UserEmail.email` carries a GLOBAL unique constraint, and three paths write
 * into that namespace: password signup, federated (Google/Apple) sign-in, and
 * "add another email" in Settings. Only the third of those can write a row
 * WITHOUT anybody proving anything — it takes any string containing "@", writes
 * `isVerified: false`, and sends no token.
 *
 * Every reader then treated that row as an authoritative claim on the address.
 * So one request — "add victim@example.com to my account" — permanently locked
 * the real owner out of BOTH ways into the product:
 *
 *   - signUp saw the row and answered "Email already in use", forever.
 *   - signInWithIdentity did not check UserEmail at all, so it fell through to
 *     a nested create that collided with the squatter's row and threw. On
 *     production's remote libSQL that surfaces as a raw DriverAdapterError with
 *     no P2002 code, which the callback route rendered to the victim verbatim.
 *
 * The per-account rate and count caps (5/hour, 10 total) are documented as
 * blunting "namespace-squatting". They do not: attacking one specific person
 * costs exactly one request.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 *
 *   An UNVERIFIED, NON-PRIMARY UserEmail row is a PENDING claim. It reserves
 *   the row so verification has something to promote — and that is all it does.
 *   It must never outrank someone establishing a stronger claim.
 *
 *   A VERIFIED row, or anyone's PRIMARY address, is a real claim and still
 *   blocks everybody.
 *
 * This is deliberately NOT a weakening of the account pre-hijack guard in
 * identity-auth.ts, which refuses when a colliding *primary* User.email is
 * unverified. That guard is about a whole account that might be the victim's,
 * and it stays exactly as it is. This is about a bare secondary row that
 * asserts nothing.
 */

export type EmailClaim =
  | { held: true; reason: "verified" | "primary" }
  | { held: false; cleared: boolean };

/**
 * Just the two calls this needs, so a Prisma interactive-transaction client
 * satisfies it as readily as the root client. The account merge runs inside a
 * transaction and must see its own uncommitted writes — calling out to the root
 * client from in there would read stale rows.
 */
type UserEmailClient = {
  userEmail: {
    findUnique: (args: {
      where: { email: string };
      select: { id: true; userId: true; isVerified: true; isPrimary: true };
    }) => Promise<{ id: string; userId: string; isVerified: boolean; isPrimary: boolean } | null>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
};

/**
 * Resolve who holds `email`, and clear the row if nobody really does.
 *
 * Returns `held: true` when a real claim exists — the caller must refuse.
 * Returns `held: false` when the address is now free to write, with `cleared`
 * saying whether an unproven reservation was removed to get there.
 *
 * Pass `exceptUserId` when the caller already owns the row legitimately, and
 * `client` when running inside a transaction.
 */
export async function claimEmailAddress(
  email: string,
  exceptUserId?: string,
  client: UserEmailClient = prisma,
): Promise<EmailClaim> {
  const normalized = email.trim().toLowerCase();

  const existing = await client.userEmail.findUnique({
    where: { email: normalized },
    select: { id: true, userId: true, isVerified: true, isPrimary: true },
  });
  if (!existing) return { held: false, cleared: false };
  if (exceptUserId && existing.userId === exceptUserId) return { held: false, cleared: false };

  // Verified means somebody clicked a link sent to that mailbox. Primary means
  // it is the address an account signs in with. Either is a real claim.
  if (existing.isVerified) return { held: true, reason: "verified" };
  if (existing.isPrimary) return { held: true, reason: "primary" };

  // Nothing was ever proven. Remove the reservation so the stronger claim can
  // proceed. The displaced account loses only an unverified secondary address
  // it never demonstrated it could receive mail at, and can re-add it.
  await client.userEmail.delete({ where: { id: existing.id } });
  return { held: false, cleared: true };
}

/**
 * Read-only form: does a REAL claim exist? For callers that must not mutate —
 * "add another email" in Settings, where nobody is proving anything either, so
 * displacing someone else's pending row would just make the griefing mutual.
 */
export async function emailClaimHeldBy(email: string, exceptUserId?: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const [row, primary] = await Promise.all([
    prisma.userEmail.findUnique({
      where: { email: normalized },
      select: { userId: true },
    }),
    prisma.user.findUnique({ where: { email: normalized }, select: { id: true } }),
  ]);
  if (primary && primary.id !== exceptUserId) return true;
  return Boolean(row && row.userId !== exceptUserId);
}
