import "server-only";

import Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getStripeClient, isMeshProSubscriptionStatus, stripeObjectId } from "@/lib/stripe";

/**
 * PATRON — a standing monthly contribution that buys nothing.
 *
 * The recurring counterpart of the one-time Charter seat: $2, $5, or $10 a
 * month, deliberately NO features, and its only renderings are the quiet
 * profile chip and the Meshi pin — both drawn from `User.patronSince`, a
 * set-once record of fact, NEVER from live standing. That one decision is the
 * whole ethics of the feature: lapsing changes nothing visible, so canceling
 * is genuinely costless and the marks can never become a retention lever.
 *
 * THE LANDMINE THIS MODULE EXISTS AROUND: a patron subscription is a Stripe
 * SUBSCRIPTION, and every subscription event in this repo historically flowed
 * into syncMeshProSubscription — which writes `isMeshPro` absolutely and
 * falls back to resolving its user by shared customer id. Unrouted, a $2
 * donation would buy Pro at checkout, and CANCELING it could revoke a
 * separately-purchased Pro. So: the webhook routes product "patron" here
 * first in every subscription-shaped case, syncMeshProSubscription wears a
 * refuse-foreign belt, this module refuses everything that is not positively
 * stamped "patron", never resolves a user by customer id, and never writes
 * `isMeshPro` / `meshProSince` / `meshProGiftUntil` / `stripeSubscriptionId`.
 *
 * No notifications, ever — a recurring self-purchase that pinged monthly
 * would be a nag, and there is no server-assigned fact to deliver.
 */

/** Monthly tiers in cents. Three fixed amounts, monthly only — a custom
 *  amount field is a fundraising thermometer, and that's a different product. */
export const PATRON_TIERS = { "2": 200, "5": 500, "10": 1000 } as const;

export type PatronTier = keyof typeof PATRON_TIERS;

export function parsePatronTier(value: unknown): PatronTier | null {
  return value === "2" || value === "5" || value === "10" ? value : null;
}

type SyncOptions = { revalidate?: boolean };

/**
 * The single writer of patron standing. Strictly product-narrow (there is no
 * legacy metadata-less patron, so unlike the MeshPro belt this one IS strict),
 * resolves its user by `patronUserId` metadata or by the stint the
 * subscription already owns — NEVER by customer id, because one Stripe
 * customer legitimately holds both a Pro subscription and a patron one.
 *
 * Idempotent and order-proof by construction: the stint row is keyed on the
 * subscription id, so a redelivered event converges and a stale `deleted`
 * for an old subscription can only end its OWN stint, never a newer one.
 */
export async function syncPatronSubscription(
  subscription: Stripe.Subscription,
  options: SyncOptions = {},
) {
  if (subscription.metadata?.product !== "patron") return null;

  const stintUserId = subscription.metadata?.patronUserId
    || (await prisma.patronStint.findUnique({
      where: { stripeSubscriptionId: subscription.id },
      select: { userId: true },
    }))?.userId;
  if (!stintUserId) return null;

  const user = await prisma.user.findUnique({
    where: { id: stintUserId },
    select: { id: true, username: true, patronSince: true, stripeCustomerId: true },
  });
  if (!user) return null;

  const isActive = isMeshProSubscriptionStatus(subscription.status);
  const monthlyCents = subscription.items?.data?.[0]?.price?.unit_amount ?? 0;
  const existing = await prisma.patronStint.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    select: { endedAt: true },
  });

  await prisma.patronStint.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: {
      userId: user.id,
      stripeSubscriptionId: subscription.id,
      monthlyCents,
      endedAt: isActive ? null : new Date(),
    },
    update: isActive
      ? { endedAt: null, monthlyCents }
      : { endedAt: existing?.endedAt ?? new Date() },
  });

  if (isActive) {
    const customerId = stripeObjectId(subscription.customer);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        // Set once, never overwritten, never cleared by churn: the record is
        // that this account HAS been a patron, and lapse must cost nothing.
        patronSince: user.patronSince ?? new Date(),
        // A patron-only account still needs the Stripe portal to cancel; only
        // fill the customer id when nothing else has (never clobber Pro's).
        ...(customerId && !user.stripeCustomerId ? { stripeCustomerId: customerId } : {}),
      },
    });
  }

  if (options.revalidate) {
    revalidatePath("/meshpro");
    revalidatePath("/meshpro/patron");
    revalidatePath("/billing");
    revalidatePath(`/profile/${user.username}`);
  }

  return user.id;
}

/** Webhook: a completed patron checkout — fetch the born subscription, delegate. */
export async function applyPatronCheckoutSession(
  session: Stripe.Checkout.Session,
  options: SyncOptions = {},
) {
  const stripe = getStripeClient();
  if (!stripe) return null;
  const subscriptionId = stripeObjectId(session.subscription);
  if (!subscriptionId) return null;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return syncPatronSubscription(subscription, options);
}

/**
 * Success-page reconciler — the fifth member of the equally-narrow family
 * (meshpro, meshpro-gift, charter-seat, meshi-item): patron product, this
 * caller, paid. No revalidatePath (runs during a page render, Next E7).
 */
export async function syncPatronCheckoutSessionForUser(sessionId: string, userId: string) {
  const stripe = getStripeClient();
  if (!stripe) return { ok: false as const, message: "Stripe is not configured." };
  if (!/^cs_(test|live)_[A-Za-z0-9_]+$/.test(sessionId)) {
    return { ok: false as const, message: "Invalid checkout session." };
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  if (session.metadata?.product !== "patron") {
    return { ok: false as const, message: "That checkout session is not a patron contribution." };
  }
  if (session.metadata?.patronUserId !== userId) {
    return { ok: false as const, message: "That checkout session does not belong to this account." };
  }
  if (session.payment_status !== "paid") {
    return { ok: false as const, message: "Checkout has not completed yet." };
  }

  const subscription = typeof session.subscription === "string"
    ? await stripe.subscriptions.retrieve(session.subscription)
    : session.subscription;
  if (!subscription) {
    return { ok: false as const, message: "Could not confirm the contribution yet. The webhook will settle it." };
  }

  const applied = await syncPatronSubscription(subscription);
  return applied != null
    ? { ok: true as const, message: "You're a patron. Thank you — quietly." }
    : { ok: false as const, message: "Could not confirm the contribution yet. The webhook will settle it." };
}

/**
 * Full refund of a patron invoice → the stint is marked refunded, and only
 * when NO un-refunded stint survives for that account does the record erase:
 * `patronSince` nulls and an equipped patron pin resets (the charter refund
 * pattern — money back, record erased; anything less would sell "status kept,
 * money returned"). Partial refunds are logged and ignored. One documented
 * edge, accepted deliberately: a full refund of ONE month's invoice marks the
 * whole stint — refunds here are owner-initiated deliberate acts, and a
 * per-month ledger for a $2 good would be machinery without a customer.
 *
 * Every one-time product's charge exits at the invoice check: only
 * subscriptions bill through invoices.
 */
export async function applyPatronRefund(charge: Stripe.Charge) {
  if (charge.amount_refunded !== charge.amount) {
    console.error("Partial patron refund ignored:", { chargeId: charge.id });
    return;
  }
  // The SDK's pinned types dropped Charge.invoice ahead of the wire format —
  // invoice-backed charges still carry it in webhook payloads. Absence means
  // "not a subscription charge": every one-time product exits here, and a
  // missing pointer fails SAFE (record kept, refund already made — erasure
  // can be finished by hand; nothing grants or revokes wrongly).
  const invoiceId = stripeObjectId(
    (charge as unknown as { invoice?: string | { id: string } | null }).invoice ?? null,
  );
  if (!invoiceId) return;

  const stripe = getStripeClient();
  if (!stripe) return;
  const invoice = await stripe.invoices.retrieve(invoiceId);
  // The invoice→subscription pointer moved between Stripe API generations;
  // read both shapes so a pinned-version bump cannot silently orphan refunds.
  const subscriptionId = stripeObjectId(
    (invoice as unknown as { parent?: { subscription_details?: { subscription?: string | { id: string } } } })
      .parent?.subscription_details?.subscription
      ?? (invoice as unknown as { subscription?: string | { id: string } }).subscription,
  );
  if (!subscriptionId) return;

  await prisma.$transaction(async (tx) => {
    // MeshPro subscription ids never live in PatronStint — mutual refusal by
    // construction, same as the paymentIntentId-narrowed one-time reconcilers.
    const stint = await tx.patronStint.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
      select: { id: true, userId: true, refundedAt: true },
    });
    if (!stint || stint.refundedAt) return;

    await tx.patronStint.update({
      where: { id: stint.id },
      data: { refundedAt: new Date(), endedAt: new Date() },
    });

    const surviving = await tx.patronStint.findFirst({
      where: { userId: stint.userId, refundedAt: null },
      select: { id: true },
    });
    if (surviving) return;

    await tx.user.update({
      where: { id: stint.userId },
      data: { patronSince: null },
    });
    await tx.meshiPreference.updateMany({
      where: { userId: stint.userId, badgeStyle: "patron" },
      data: { badgeStyle: "none" },
    });
  });
}

/** The live stint (standing), for the billing row and the 409 duplicate wall. */
export async function getActivePatronStint(userId: string) {
  return prisma.patronStint.findFirst({
    where: { userId, endedAt: null, refundedAt: null },
    select: { monthlyCents: true, startedAt: true, stripeSubscriptionId: true },
    orderBy: { startedAt: "desc" },
  });
}
