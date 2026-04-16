import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import Stripe from "stripe";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan } = await req.json();

    if (!plan || !["monthly", "yearly"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "Payment is not configured yet. Please check back soon." },
        { status: 503 },
      );
    }

    const priceId =
      plan === "monthly"
        ? process.env.STRIPE_MONTHLY_PRICE_ID
        : process.env.STRIPE_YEARLY_PRICE_ID;

    if (!priceId) {
      return NextResponse.json(
        { error: "Payment is not configured yet. Please check back soon." },
        { status: 503 },
      );
    }

    const baseUrl = process.env.NEXTAUTH_URL || "https://meshme.vercel.app";

    // Prevent duplicate subscriptions
    if (user.isMeshPro && user.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "You already have an active MeshPro subscription." },
        { status: 400 },
      );
    }

    const checkoutParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/settings?tab=meshpro&payment=success`,
      cancel_url: `${baseUrl}/settings?tab=meshpro&payment=cancelled`,
      metadata: {
        userId: user.id,
        plan,
      },
      allow_promotion_codes: true,
    };

    // Reuse existing Stripe customer if available, otherwise create via email
    if (user.stripeCustomerId) {
      checkoutParams.customer = user.stripeCustomerId;
    } else {
      checkoutParams.customer_email = user.email;
    }

    const checkoutSession = await stripe.checkout.sessions.create(checkoutParams);

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
