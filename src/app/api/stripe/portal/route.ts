import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/request-guard";
import { getAppBaseUrl, getStripeClient } from "@/lib/stripe";
import { rateLimit } from "@/lib/security";

export async function POST(req: Request) {
  try {
    if (!isSameOriginRequest(req)) {
      return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = rateLimit(`stripe-portal:${user.id}`, 8, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many billing requests. Please slow down." }, { status: 429 });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return NextResponse.json(
        { error: "Billing management is not configured yet. Please check back soon." },
        { status: 503 },
      );
    }

    if (!user.stripeCustomerId) {
      return NextResponse.json(
        { error: "No MeshPro billing profile found for this account yet." },
        { status: 400 },
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${getAppBaseUrl(req)}/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe portal error:", error);
    return NextResponse.json(
      { error: "Could not open billing management. Please try again." },
      { status: 500 },
    );
  }
}
