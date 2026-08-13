import Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getStripeClient, isMeshProSubscriptionStatus, stripeObjectId } from "@/lib/stripe";
import { hasMeshPro, isMeshProGiftActive } from "@/lib/mesh-pro";
import { sendPushForNotification } from "@/lib/push";

type SubscriptionWithPeriod = Stripe.Subscription & {
  current_period_end?: number;
  cancel_at_period_end?: boolean;
};

export type MeshProBillingState = {
  isConfigured: boolean;
  isMeshPro: boolean;
  meshProSince: Date | null;
  /** A still-open gifted window, or null. Owner-facing only — the billing pages. */
  giftUntil: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  planInterval: string | null;
  priceId: string | null;
  amount: number | null;
  currency: string | null;
  stripeError: string | null;
};

function billingFallback(user: {
  username: string;
  isMeshPro: boolean;
  meshProSince: Date | null;
  meshProGiftUntil: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}, overrides: Partial<MeshProBillingState> = {}): MeshProBillingState {
  // hasMeshPro(), not the column. A founder's entitlement is derived from the
  // account, so it cannot be read off a field that billing is free to reset:
  // syncMeshProSubscription writes `isMeshPro: isActive`, which means a founder
  // who ever subscribed and then lapsed had their column set back to 0. A
  // gifted window is the same shape of fact — it lives outside the column.
  const isPro = hasMeshPro(user);
  return {
    isConfigured: Boolean(getStripeClient()),
    isMeshPro: isPro,
    meshProSince: user.meshProSince,
    giftUntil: isMeshProGiftActive(user.meshProGiftUntil) ? user.meshProGiftUntil : null,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    status: isPro ? "active" : "free",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    planInterval: null,
    priceId: null,
    amount: null,
    currency: null,
    stripeError: null,
    ...overrides,
  };
}

export async function syncMeshProSubscription(
  subscription: Stripe.Subscription,
  fallbackUserId?: string,
  options: { revalidate?: boolean } = {},
) {
  const subscriptionId = subscription.id;
  const customerId = stripeObjectId(subscription.customer);
  const userId = subscription.metadata?.userId || fallbackUserId;
  const isActive = isMeshProSubscriptionStatus(subscription.status);

  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId } })
    : await prisma.user.findFirst({
        where: {
          OR: [
            { stripeSubscriptionId: subscriptionId },
            ...(customerId ? [{ stripeCustomerId: customerId }] : []),
          ],
        },
      });

  if (!user) return null;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      isMeshPro: isActive,
      meshProSince: isActive ? user.meshProSince ?? new Date() : null,
      stripeSubscriptionId: isActive ? subscriptionId : null,
      ...(customerId ? { stripeCustomerId: customerId } : {}),
    },
  });

  // revalidatePath throws when called during a Server Component render (Next.js
  // error E7), so cache invalidation is opt-in and only requested from route
  // handlers / server actions (the Stripe webhook). Render-time callers
  // (billing/meshpro pages) reconcile the DB but must not revalidate here.
  if (options.revalidate) {
    revalidatePath("/meshpro");
    revalidatePath("/billing");
    revalidatePath("/settings");
    revalidatePath(`/profile/${updated.username}`);
  }

  return updated;
}

/**
 * Apply a completed Gift MeshPro checkout to its RECIPIENT.
 *
 * Never touches `isMeshPro`, `meshProSince` or `stripeSubscriptionId`: the
 * grant is `meshProGiftUntil`, the one column subscription churn cannot reach
 * (syncMeshProSubscription above writes `isMeshPro: isActive` on every Stripe
 * event, which is exactly why a gift stored there would be revoked by someone
 * ELSE's lapsed card).
 *
 * Idempotent against Stripe's webhook redelivery: the MeshProGift receipt row
 * is keyed on the checkout session id, so a second delivery hits the unique
 * constraint and leaves quietly — months stack once, the notification sends
 * once.
 *
 * Gifted months STACK: a second gift extends the open window rather than
 * resetting it, and a window that already lapsed restarts from now.
 */
export async function applyMeshProGiftSession(
  session: Stripe.Checkout.Session,
  options: { revalidate?: boolean } = {},
) {
  const metadata = session.metadata ?? {};
  const recipientId = metadata.recipientUserId;
  const purchaserId = metadata.purchaserUserId || null;
  const months = Number.parseInt(metadata.months ?? "", 10);
  if (!recipientId || !Number.isInteger(months) || months < 1 || months > 24) {
    console.error("Gift session missing/invalid metadata:", { sessionId: session.id });
    return null;
  }

  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true, username: true, meshProGiftUntil: true },
  });
  // Recipient deleted between checkout and webhook — permanent, nothing to grant.
  if (!recipient) return null;

  const message = (metadata.message ?? "").slice(0, 280).trim() || null;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.meshProGift.create({
        data: {
          purchaserId,
          recipientId: recipient.id,
          months,
          message,
          occasion: (metadata.occasion ?? "").slice(0, 64).trim() || null,
          stripeSessionId: session.id,
        },
      });
      const base = isMeshProGiftActive(recipient.meshProGiftUntil)
        ? recipient.meshProGiftUntil!.getTime()
        : Date.now();
      const until = new Date(base);
      until.setUTCMonth(until.getUTCMonth() + months);
      await tx.user.update({
        where: { id: recipient.id },
        data: { meshProGiftUntil: until },
      });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      // Stripe retried a session that already granted — done, and done once.
      return null;
    }
    throw error;
  }

  // The moment between two people, after the grant is safely down. The gift
  // message rides as plain text; the notification center and push path both
  // render it without markup.
  const purchaser = purchaserId
    ? await prisma.user.findUnique({ where: { id: purchaserId }, select: { displayName: true } })
    : null;
  const span = months === 1 ? "a month" : `${months} months`;
  const summary = `${purchaser?.displayName ?? "Someone"} gifted you ${span} of MeshPro${message ? `: "${message}"` : ""}`;
  await prisma.notification
    .create({
      data: {
        type: "meshpro_gift",
        recipientId: recipient.id,
        actorId: purchaserId,
        message: summary,
      },
    })
    .catch((error) => console.error("Gift notification failed:", error));
  sendPushForNotification(recipient.id, { type: "meshpro_gift", message: summary }).catch(() => {});

  if (options.revalidate) {
    revalidatePath(`/profile/${recipient.username}`);
    revalidatePath("/meshpro");
    revalidatePath("/billing");
  }

  return recipient.id;
}

export async function syncMeshProCheckoutSessionForUser(sessionId: string, userId: string) {
  const stripe = getStripeClient();
  if (!stripe) {
    return { ok: false, message: "Stripe is not configured." };
  }

  if (!/^cs_(test|live)_[A-Za-z0-9_]+$/.test(sessionId)) {
    return { ok: false, message: "Invalid checkout session." };
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  // ONLY MeshPro-subscription sessions may reconcile here. This function ends
  // in a permanent `isMeshPro: true` for any PAID session the caller owns —
  // which is exactly the wrong grant for every OTHER product that ever runs
  // through checkout. Concretely: a Gift MeshPro session is a one-time payment
  // owned by the PURCHASER, so without this guard a gift buyer who landed on
  // /meshpro?payment=success&session_id=<their gift session> (the id is right
  // in Stripe's checkout URL) bought themselves lifetime Pro for $4.99. The
  // webhook routes each product by the same metadata key; the render-time
  // reconciler must be exactly as narrow.
  if (session.metadata?.product !== "meshpro") {
    return { ok: false, message: "That checkout session is not a MeshPro purchase." };
  }

  const sessionUserId = session.metadata?.userId || session.client_reference_id;
  if (sessionUserId !== userId) {
    return { ok: false, message: "That checkout session does not belong to this account." };
  }

  const subscription =
    typeof session.subscription === "string"
      ? await stripe.subscriptions.retrieve(session.subscription)
      : session.subscription;

  if (subscription) {
    await syncMeshProSubscription(subscription, userId);
    return { ok: true, message: "MeshPro is active." };
  }

  const customerId = stripeObjectId(session.customer);
  if (customerId && session.payment_status === "paid") {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isMeshPro: true,
        meshProSince: new Date(),
        stripeCustomerId: customerId,
      },
    });
    // No revalidatePath here: this runs during the meshpro page render (E7).
    // The checkout.session.completed webhook revalidates authoritatively.
    return { ok: true, message: "MeshPro is active." };
  }

  return { ok: false, message: "Checkout has not completed yet." };
}

export async function getMeshProBillingState(userId: string): Promise<MeshProBillingState | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      // `username` is not decoration here: without it `hasMeshPro()` cannot be
      // CALLED on this row, and the two pages about a person's entitlement fall
      // back to the raw column. A founder — who has MeshPro for life but whose
      // column is 0 — was shown the pricing grid and a checkout button on
      // /meshpro and /billing while every other surface treated them as Pro.
      username: true,
      isMeshPro: true,
      meshProSince: true,
      meshProGiftUntil: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });

  if (!user) return null;

  const stripe = getStripeClient();
  if (!stripe || !user.stripeSubscriptionId) {
    return billingFallback(user, { isConfigured: Boolean(stripe) });
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: ["items.data.price"],
    }) as SubscriptionWithPeriod;
    await syncMeshProSubscription(subscription, userId);

    const firstItem = subscription.items.data[0];
    const price = firstItem?.price;
    // As of the pinned Stripe API version, current_period_end lives on the
    // subscription item, not the subscription root. Fall back to the root for
    // older API versions.
    const periodEndSeconds =
      typeof firstItem?.current_period_end === "number"
        ? firstItem.current_period_end
        : typeof subscription.current_period_end === "number"
          ? subscription.current_period_end
          : null;
    const currentPeriodEnd = periodEndSeconds !== null ? new Date(periodEndSeconds * 1000) : null;

    return billingFallback(user, {
      isConfigured: true,
      // Entitlement, not subscription state: a founder keeps MeshPro whatever
      // Stripe says. `status` below still reports the SUBSCRIPTION honestly —
      // that field is about the billing relationship, this one is about access.
      isMeshPro: hasMeshPro(user) || isMeshProSubscriptionStatus(subscription.status),
      status: subscription.status,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      currentPeriodEnd,
      planInterval: price?.recurring?.interval ?? null,
      priceId: price?.id ?? null,
      amount: price?.unit_amount ?? null,
      currency: price?.currency ?? null,
    });
  } catch (error) {
    // Don't surface raw upstream (Stripe SDK) error text to the client — log it
    // server-side and return a generic message.
    console.error("Failed to load Stripe subscription:", error);
    return billingFallback(user, {
      isConfigured: true,
      stripeError: "Could not load your subscription right now. Please try again shortly.",
    });
  }
}
