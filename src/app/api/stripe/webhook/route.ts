import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

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
