import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/request-guard";
import { getAppBaseUrl, getMeshProPaymentLink, getMeshProPriceId, getStripeClient, parseMeshProPlan } from "@/lib/stripe";
import { rateLimit } from "@/lib/security";
import Stripe from "stripe";

export async function POST(req: Request) {
  try {
    if (!isSameOriginRequest(req)) {
      return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Per-user cap on outbound Stripe session creation, complementing the
    // proxy's per-IP limit, so one account can't spin up orphan sessions.
    const rl = rateLimit(`stripe-checkout:${user.id}`, 8, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many checkout attempts. Please slow down." }, { status: 429 });
    }

    const payload = await req.json().catch(() => ({}));
    const plan = parseMeshProPlan(payload?.plan);

    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const priceId = getMeshProPriceId(plan);
    const paymentLink = getMeshProPaymentLink(plan);
    const stripe = getStripeClient();

    if (!stripe) {
      if (paymentLink) {
        return NextResponse.json({ url: paymentLink, mode: "payment_link" });
      }

      return NextResponse.json(
        { error: "Payment is not configured yet. Please check back soon." },
        { status: 503 },
      );
    }

    if (!priceId) {
      if (paymentLink) {
        return NextResponse.json({ url: paymentLink, mode: "payment_link" });
      }

      return NextResponse.json(
        { error: "Payment is not configured yet. Please check back soon." },
        { status: 503 },
      );
    }

    const baseUrl = getAppBaseUrl(req);

    // Prevent duplicate subscriptions
    if (user.isMeshPro && user.stripeSubscriptionId) {
      return NextResponse.json(
        {
          error: "Mesh Pro is already active. Manage your billing instead.",
          alreadyActive: true,
        },
        { status: 409 },
      );
    }

    const metadata = {
      userId: user.id,
      plan,
      product: "meshpro",
    };

    const checkoutParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/meshpro?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/meshpro?payment=cancelled`,
      client_reference_id: user.id,
      metadata,
      subscription_data: { metadata },
      allow_promotion_codes: true,
    };

    // Reuse existing Stripe customer if available, otherwise create via email
    if (user.stripeCustomerId) {
      checkoutParams.customer = user.stripeCustomerId;
    } else {
      checkoutParams.customer_email = user.email;
    }

    const checkoutSession = await stripe.checkout.sessions.create(checkoutParams);

    if (!checkoutSession.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
