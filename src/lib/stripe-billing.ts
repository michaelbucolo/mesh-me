import Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getStripeClient, isMeshProSubscriptionStatus, stripeObjectId } from "@/lib/stripe";
import { hasMeshPro } from "@/lib/mesh-pro";

type SubscriptionWithPeriod = Stripe.Subscription & {
  current_period_end?: number;
  cancel_at_period_end?: boolean;
};

export type MeshProBillingState = {
  isConfigured: boolean;
  isMeshPro: boolean;
  meshProSince: Date | null;
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
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}, overrides: Partial<MeshProBillingState> = {}): MeshProBillingState {
  // hasMeshPro(), not the column. A founder's entitlement is derived from the
  // account, so it cannot be read off a field that billing is free to reset:
  // syncMeshProSubscription writes `isMeshPro: isActive`, which means a founder
  // who ever subscribed and then lapsed had their column set back to 0.
  const isPro = hasMeshPro(user);
  return {
    isConfigured: Boolean(getStripeClient()),
    isMeshPro: isPro,
    meshProSince: user.meshProSince,
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
    return { ok: true, message: "Mesh Pro is active." };
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
    return { ok: true, message: "Mesh Pro is active." };
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
