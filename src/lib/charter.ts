import "server-only";

import Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendPushForNotification } from "@/lib/push";
import { getStripeClient, stripeObjectId } from "@/lib/stripe";
import { memoizeWithTtl } from "@/lib/ttl-memo";

/**
 * CHARTER SEATS — one hundred numbered places in the platform's history.
 *
 * $79, once, status only: the number, a quiet profile chip, a Meshi pin, a
 * receipt line. Deliberately NO features — a seat that included Pro time would
 * eventually be a discount, and a discount can be repriced; a number can't.
 * "charter" must therefore never appear in a feature gate (charter-check
 * enforces this), which is also what keeps the terms' "nothing free becomes
 * scarce" promise true by construction.
 *
 * THE ROW IS THE LOCK. Seats are seeded 1..100 (migration + ensure-schema.sql)
 * and no application code creates one — the cap is a fixed universe of rows,
 * not a config value. Every transition below is a single guarded `updateMany`
 * whose `count === 1` is the mutual exclusion: two writers cannot both see it.
 *
 *   open ──reserve──▶ held ──claim──▶ claimed ──full refund──▶ retired
 *                      │
 *                      └──release──▶ open   (only when no Stripe session was
 *                                            ever attached, or Stripe attests
 *                                            the session expired — never on
 *                                            wall clock alone)
 *
 * Ordering proof, in one breath: reservation precedes session creation, so
 * every Stripe session references an already-held number (no orphan); release
 * requires no-session-ever or Stripe-attested expiry, and an expired session
 * can never subsequently pay (no claim-after-release, no double-assign); the
 * hold (45m) strictly outlives the session (30m), so a live session's seat is
 * never sweepable; a refunded number retires forever — never resold.
 */

export const CHARTER_SEAT_CAP = 100;
export const CHARTER_PRICE_CENTS = 7900;
/** How long a reservation holds its number. MUST outlive the Stripe session. */
const CHARTER_HOLD_MS = 45 * 60_000;
/** Stripe checkout session lifetime — strictly shorter than the hold. */
export const CHARTER_SESSION_TTL_S = 30 * 60;

type ReserveResult =
  | { ok: true; number: number }
  | { ok: false; reason: "already-holder" | "sold-out" };

/**
 * Reserve the lowest open seat for a user, BEFORE any Stripe call.
 * Reuses the user's own live hold (abandon + retry must not burn seats).
 */
export async function reserveCharterSeat(userId: string): Promise<ReserveResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { charterNumber: true },
  });
  if (user?.charterNumber != null) return { ok: false, reason: "already-holder" };

  const existingHold = await prisma.charterSeat.findFirst({
    where: { userId, status: "held", holdExpiresAt: { gt: new Date() } },
    select: { number: true },
  });
  if (existingHold) return { ok: true, number: existingHold.number };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = await prisma.charterSeat.findFirst({
      where: { status: "open" },
      orderBy: { number: "asc" },
      select: { number: true },
    });
    if (!candidate) break;

    const took = await prisma.charterSeat.updateMany({
      where: { number: candidate.number, status: "open" },
      data: {
        status: "held",
        userId,
        holdExpiresAt: new Date(Date.now() + CHARTER_HOLD_MS),
      },
    });
    if (took.count === 1) return { ok: true, number: candidate.number };
    // Someone else took this number between the read and the guarded write —
    // loop to the next lowest open seat.
  }

  // Nothing open: expired holds may be recoverable. Sweep once, retry once.
  await sweepCharterHolds();
  const candidate = await prisma.charterSeat.findFirst({
    where: { status: "open" },
    orderBy: { number: "asc" },
    select: { number: true },
  });
  if (candidate) {
    const took = await prisma.charterSeat.updateMany({
      where: { number: candidate.number, status: "open" },
      data: {
        status: "held",
        userId,
        holdExpiresAt: new Date(Date.now() + CHARTER_HOLD_MS),
      },
    });
    if (took.count === 1) return { ok: true, number: candidate.number };
  }
  return { ok: false, reason: "sold-out" };
}

/** Attach the created Stripe session to the held seat (checkout step 2). */
export async function attachCharterSession(number: number, userId: string, sessionId: string) {
  await prisma.charterSeat.updateMany({
    where: { number, userId, status: "held" },
    data: { stripeSessionId: sessionId },
  });
}

/** Release a hold that never got a session (sessions.create threw). */
export async function releaseCharterHold(number: number, userId: string) {
  await prisma.charterSeat.updateMany({
    where: { number, userId, status: "held", stripeSessionId: null },
    data: { status: "open", userId: null, holdExpiresAt: null },
  });
}

/**
 * Claim a paid charter session for its holder — from the webhook and from the
 * success-page sync. Idempotent: redelivery finds the row already claimed on
 * this session id and no-ops (the MeshProGift contract).
 */
export async function applyCharterSession(
  session: Stripe.Checkout.Session,
  options: { revalidate?: boolean } = {},
) {
  const metadata = session.metadata ?? {};
  const userId = metadata.charterUserId;
  const seatNumber = Number.parseInt(metadata.seatNumber ?? "", 10);
  if (!userId || !Number.isInteger(seatNumber)) {
    console.error("Charter session missing metadata:", { sessionId: session.id });
    return null;
  }

  const paymentIntentId = stripeObjectId(session.payment_intent);
  const claimed = await prisma.$transaction(async (tx) => {
    const take = await tx.charterSeat.updateMany({
      where: { stripeSessionId: session.id, status: "held" },
      data: {
        status: "claimed",
        claimedAt: new Date(),
        paymentIntentId,
        holdExpiresAt: null,
      },
    });
    if (take.count !== 1) return null;
    await tx.user.update({
      where: { id: userId },
      data: { charterNumber: seatNumber },
    });
    return seatNumber;
  });

  if (claimed == null) {
    const existing = await prisma.charterSeat.findUnique({
      where: { stripeSessionId: session.id },
      select: { status: true, number: true, userId: true },
    });
    if (existing?.status === "claimed") return existing.number; // Stripe redelivery
    // Money-never-kept backstop. Unreachable given the TTL inequality and the
    // sweep's paid-session self-heal, but if a paid session's hold was somehow
    // lost: claim the metadata seat if it's still open, else the lowest open
    // seat, else refund in full.
    const fallback = await prisma.$transaction(async (tx) => {
      for (const number of [seatNumber, null] as const) {
        const candidate =
          number != null
            ? await tx.charterSeat.findFirst({ where: { number, status: "open" }, select: { number: true } })
            : await tx.charterSeat.findFirst({ where: { status: "open" }, orderBy: { number: "asc" }, select: { number: true } });
        if (!candidate) continue;
        const take = await tx.charterSeat.updateMany({
          where: { number: candidate.number, status: "open" },
          data: {
            status: "claimed",
            userId,
            stripeSessionId: session.id,
            claimedAt: new Date(),
            paymentIntentId,
          },
        });
        if (take.count === 1) {
          await tx.user.update({ where: { id: userId }, data: { charterNumber: candidate.number } });
          return candidate.number;
        }
      }
      return null;
    });
    if (fallback == null) {
      const stripe = getStripeClient();
      if (stripe && paymentIntentId) {
        await stripe.refunds.create({ payment_intent: paymentIntentId }).catch((error) =>
          console.error("Charter auto-refund failed — REQUIRES MANUAL REFUND:", { sessionId: session.id, error }),
        );
      }
      return null;
    }
    return finishClaim(userId, fallback, options);
  }

  return finishClaim(userId, claimed, options);
}

async function finishClaim(userId: string, number: number, options: { revalidate?: boolean }) {
  // Recipient-only; no social surface ever hears about a purchase.
  const summary = `You hold Charter seat №${number} of ${CHARTER_SEAT_CAP}.`;
  await prisma.notification
    .create({ data: { type: "charter", recipientId: userId, message: summary } })
    .catch((error) => console.error("Charter notification failed:", error));
  sendPushForNotification(userId, { type: "charter", message: summary }).catch(() => {});

  if (options.revalidate) {
    revalidatePath("/meshpro");
    revalidatePath("/billing");
    revalidatePath("/settings");
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
    if (user) revalidatePath(`/profile/${user.username}`);
  }
  return number;
}

/** Webhook: a charter checkout session expired — Stripe attests it can never pay. */
export async function releaseExpiredCharterSession(session: Stripe.Checkout.Session) {
  await prisma.charterSeat.updateMany({
    where: { stripeSessionId: session.id, status: "held" },
    data: { status: "open", userId: null, stripeSessionId: null, holdExpiresAt: null },
  });
}

/**
 * Lazy sweep — no cron. Runs when RESERVE finds nothing open and behind the
 * memoized remaining() count. Never releases on wall clock alone while Stripe
 * holds a live session; a PAID session found here is claimed, not released
 * (self-healing a missed completed-webhook instead of burning a paid seat).
 */
async function sweepCharterHolds() {
  const stale = await prisma.charterSeat.findMany({
    where: { status: "held", holdExpiresAt: { lt: new Date() } },
    select: { number: true, userId: true, stripeSessionId: true },
  });
  if (stale.length === 0) return;

  const stripe = getStripeClient();
  for (const seat of stale) {
    if (!seat.stripeSessionId) {
      // Crash between reserve and sessions.create — nothing can ever pay this.
      await prisma.charterSeat.updateMany({
        where: { number: seat.number, status: "held", stripeSessionId: null },
        data: { status: "open", userId: null, holdExpiresAt: null },
      });
      continue;
    }
    if (!stripe) continue; // cannot attest — leave held rather than risk a paid seat
    try {
      const session = await stripe.checkout.sessions.retrieve(seat.stripeSessionId);
      if (session.status === "expired") {
        await releaseExpiredCharterSession(session);
      } else if (session.status === "complete" && session.payment_status === "paid") {
        await applyCharterSession(session);
      }
      // Still open past the TTL inequality is impossible, but if seen: leave held.
    } catch (error) {
      console.error("Charter sweep could not attest session:", { number: seat.number, error });
    }
  }
}

/**
 * Full refund → the seat retires and the number is never resold. Quiet:
 * reversing a reversed purchase is bookkeeping, not theater. Partial refunds
 * are logged and ignored — the seat stands until the money fully goes back.
 */
export async function applyCharterRefund(charge: Stripe.Charge) {
  if (charge.amount_refunded !== charge.amount) {
    console.error("Partial charter refund ignored:", { chargeId: charge.id });
    return;
  }
  const paymentIntentId = stripeObjectId(charge.payment_intent);
  if (!paymentIntentId) return;

  await prisma.$transaction(async (tx) => {
    const seat = await tx.charterSeat.findUnique({
      where: { paymentIntentId },
      select: { number: true, userId: true, status: true },
    });
    if (!seat || seat.status !== "claimed") return; // not charter, or redelivery
    await tx.charterSeat.updateMany({
      where: { paymentIntentId, status: "claimed" },
      data: { status: "retired", retiredAt: new Date() },
    });
    if (seat.userId) {
      await tx.user.update({ where: { id: seat.userId }, data: { charterNumber: null } });
      await tx.meshiPreference.updateMany({
        where: { userId: seat.userId, badgeStyle: "charter" },
        data: { badgeStyle: "none" },
      });
    }
  });
}

/**
 * How many seats can still be bought. Drives the /meshpro card's existence:
 * zero means the card renders null — no tombstone, no counter, the section is
 * simply gone. Memoized ~hourly per instance; the sweep inside keeps a stray
 * expired hold from reading as a sold seat forever.
 */
export const charterSeatsRemaining = memoizeWithTtl(
  async () => {
    await sweepCharterHolds();
    const unavailable = await prisma.charterSeat.count({
      where: { status: { in: ["claimed", "retired", "held"] } },
    });
    return Math.max(0, CHARTER_SEAT_CAP - unavailable);
  },
  { ttlMs: 60 * 60_000, key: () => "charter-remaining" },
);

/**
 * Success-page reconciler, exactly as narrow as the webhook: charter product,
 * this caller, paid. Mirrors syncMeshProCheckoutSessionForUser's shape (and
 * the product-refusal rule that function enforces for MeshPro sessions).
 */
export async function syncCharterCheckoutSessionForUser(sessionId: string, userId: string) {
  const stripe = getStripeClient();
  if (!stripe) return { ok: false as const, message: "Stripe is not configured." };
  if (!/^cs_(test|live)_[A-Za-z0-9_]+$/.test(sessionId)) {
    return { ok: false as const, message: "Invalid checkout session." };
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.product !== "charter-seat") {
    return { ok: false as const, message: "That checkout session is not a charter seat." };
  }
  if (session.metadata?.charterUserId !== userId) {
    return { ok: false as const, message: "That checkout session does not belong to this account." };
  }
  if (session.payment_status !== "paid") {
    return { ok: false as const, message: "Checkout has not completed yet." };
  }

  // No revalidatePath: this runs during the charter page render (Next E7);
  // the checkout.session.completed webhook revalidates authoritatively.
  const number = await applyCharterSession(session);
  return number != null
    ? { ok: true as const, message: `Charter seat №${number} is yours.` }
    : { ok: false as const, message: "Could not confirm the seat yet. The webhook will settle it." };
}
