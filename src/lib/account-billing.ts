import "server-only";
import { prisma } from "./prisma";
import { getStripeClient } from "./stripe";

export async function cancelAccountSubscriptions(user: { id: string; stripeSubscriptionId: string | null }): Promise<boolean> {
  const patrons = await prisma.patronStint.findMany({ where: { userId: user.id, endedAt: null }, select: { stripeSubscriptionId: true } });
  const ids = [...new Set([user.stripeSubscriptionId, ...patrons.map((stint) => stint.stripeSubscriptionId)].filter((id): id is string => Boolean(id)))];
  if (!ids.length) return true;
  const stripe = getStripeClient();
  if (!stripe) return false;
  try {
    for (const id of ids) {
      const subscription = await stripe.subscriptions.retrieve(id);
      if (subscription.status !== "canceled" && subscription.status !== "incomplete_expired") {
        await stripe.subscriptions.cancel(id);
      }
    }
    return true;
  } catch (error) {
    console.error("Account subscription cancellation failed", error);
    return false;
  }
}
