import Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getStripeClient, isMeshProSubscriptionStatus, stripeObjectId } from "@/lib/stripe";

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
  isMeshPro: boolean;
  meshProSince: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}, overrides: Partial<MeshProBillingState> = {}): MeshProBillingState {
  return {
    isConfigured: Boolean(getStripeClient()),
    isMeshPro: user.isMeshPro,
    meshProSince: user.meshProSince,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    status: user.isMeshPro ? "active" : "free",
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

export async function syncMeshProSubscription(subscription: Stripe.Subscription, fallbackUserId?: string) {
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

  revalidatePath("/meshpro");
  revalidatePath("/billing");
  revalidatePath("/settings");
  revalidatePath(`/profile/${updated.username}`);

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
    revalidatePath("/meshpro");
    revalidatePath("/billing");
    revalidatePath("/settings");
    return { ok: true, message: "Mesh Pro is active." };
  }

  return { ok: false, message: "Checkout has not completed yet." };
}

export async function getMeshProBillingState(userId: string): Promise<MeshProBillingState | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
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

    const price = subscription.items.data[0]?.price;
    const currentPeriodEnd = typeof subscription.current_period_end === "number"
      ? new Date(subscription.current_period_end * 1000)
      : null;

    return billingFallback(user, {
      isConfigured: true,
      isMeshPro: isMeshProSubscriptionStatus(subscription.status),
      status: subscription.status,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      currentPeriodEnd,
      planInterval: price?.recurring?.interval ?? null,
      priceId: price?.id ?? null,
      amount: price?.unit_amount ?? null,
      currency: price?.currency ?? null,
    });
  } catch (error) {
    return billingFallback(user, {
      isConfigured: true,
      stripeError: error instanceof Error ? error.message : "Could not load Stripe subscription.",
    });
  }
}
