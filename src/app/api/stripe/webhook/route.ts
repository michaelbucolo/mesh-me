import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  const stripe = getStripe();
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
        const userId = session.metadata?.userId;
        if (userId) {
          // Idempotency: skip if already activated
          const existing = await prisma.user.findUnique({ where: { id: userId } });
          if (existing && !existing.isMeshPro) {
            await prisma.user.update({
              where: { id: userId },
              data: {
                isMeshPro: true,
                meshProSince: new Date(),
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: session.subscription as string,
              },
            });
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { isMeshPro: false, stripeSubscriptionId: null },
          });
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        console.error("Payment failed for customer:", customerId);
        break;
      }
    }
  } catch (dbError) {
    // Log error with context for manual resolution, but acknowledge receipt
    // so Stripe doesn't keep retrying a permanently failing webhook
    console.error("Webhook DB operation failed:", {
      eventType: event.type,
      eventId: event.id,
      error: dbError,
    });
  }

  // Always return 200 to acknowledge receipt — even if DB fails,
  // we don't want Stripe retrying indefinitely
  return NextResponse.json({ received: true });
}
