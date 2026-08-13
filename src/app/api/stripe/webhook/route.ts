import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { applyMeshProGiftSession, syncMeshProSubscription } from "@/lib/stripe-billing";
import { getStripeClient, stripeObjectId } from "@/lib/stripe";

// Errors that should NOT trigger Stripe retry (permanent failures)
function isPermanentError(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: string }).code;
    // Prisma "record not found" — user was deleted, retrying won't help
    return code === "P2025";
  }
  return false;
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Gifts branch FIRST, before any userId/subscription logic. A gift is a
        // one-time payment with no subscription, so without this branch it
        // would fall into the `else if (userId)` below — which marks the
        // metadata user Pro permanently — and the PURCHASER would be granted
        // lifetime MeshPro for buying someone else a month.
        if (session.metadata?.product === "meshpro-gift") {
          await applyMeshProGiftSession(session, { revalidate: true });
          break;
        }

        const userId = session.metadata?.userId;
        const subscriptionId = stripeObjectId(session.subscription);

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncMeshProSubscription(subscription, userId, { revalidate: true });
        } else if (userId) {
          const customerId = stripeObjectId(session.customer);
          await prisma.user.update({
            where: { id: userId },
            data: {
              isMeshPro: true,
              meshProSince: new Date(),
              ...(customerId ? { stripeCustomerId: customerId } : {}),
            },
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncMeshProSubscription(subscription, undefined, { revalidate: true });
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncMeshProSubscription(subscription, undefined, { revalidate: true });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = stripeObjectId(invoice.customer);
        console.error("Payment failed for customer:", customerId);
        break;
      }
    }
  } catch (dbError) {
    console.error("Webhook DB operation failed:", {
      eventType: event.type,
      eventId: event.id,
      error: dbError,
    });

    // Permanent errors (e.g. user deleted) — acknowledge so Stripe stops retrying
    if (isPermanentError(dbError)) {
      return NextResponse.json({ received: true, error: "permanent failure" });
    }

    // Transient errors (DB timeout, connection issues) — return 500 so Stripe retries
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
