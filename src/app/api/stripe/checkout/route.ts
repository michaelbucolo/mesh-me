import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isFounderUsername, isMeshProGiftActive, MESH_PRO_GIFT_MESSAGE_MAX, MESH_PRO_GIFT_PRICING } from "@/lib/mesh-pro";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";
import { getAppBaseUrl, getMeshProGiftPriceId, getMeshProPaymentLink, getMeshProPriceId, getStripeClient, parseMeshProGiftPlan, parseMeshProPlan } from "@/lib/stripe";
import { rateLimit } from "@/lib/security";
import Stripe from "stripe";

/**
 * A gift is a contact vector, not just a payment: it lands on someone's
 * account with a message attached. So checkout — the earliest edge — refuses
 * the pairs that must never happen. Errors are deliberately identical for
 * "you blocked them" and "they blocked you": a 403 here must not become a way
 * to probe who has blocked whom.
 */
async function validateGiftRecipient(purchaser: { id: string }, recipientUsername: string) {
  const recipient = await prisma.user.findUnique({
    where: { username: recipientUsername },
    select: { id: true, username: true, isSuspended: true },
  });
  if (!recipient || recipient.isSuspended) {
    return { error: "No one on Mesh.me has that username.", status: 404 as const };
  }
  if (recipient.id === purchaser.id) {
    return { error: "MeshPro can't be gifted to yourself — the plans below are the same prices.", status: 400 as const };
  }
  if (isFounderUsername(recipient.username)) {
    return { error: "That account already has MeshPro for life.", status: 400 as const };
  }
  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: purchaser.id, blockedId: recipient.id },
        { blockerId: recipient.id, blockedId: purchaser.id },
      ],
    },
    select: { id: true },
  });
  if (blocked) {
    return { error: "You can't gift MeshPro to this account.", status: 403 as const };
  }
  return { recipient };
}

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

    // ── Gift MeshPro: one-time payment FOR someone else ─────────────────────
    if (payload?.giftPlan !== undefined) {
      const giftPlan = parseMeshProGiftPlan(payload.giftPlan);
      if (!giftPlan) {
        return NextResponse.json({ error: "Invalid gift plan" }, { status: 400 });
      }

      const recipientUsername = String(payload?.recipientUsername || "").trim().toLowerCase();
      if (!recipientUsername) {
        return NextResponse.json({ error: "Choose who the gift is for." }, { status: 400 });
      }
      const message = typeof payload?.message === "string" ? payload.message.trim() : "";
      if (message.length > MESH_PRO_GIFT_MESSAGE_MAX) {
        return NextResponse.json(
          { error: `Keep the gift message under ${MESH_PRO_GIFT_MESSAGE_MAX} characters.` },
          { status: 400 },
        );
      }
      const occasion = typeof payload?.occasion === "string" ? payload.occasion.trim().slice(0, 64) : "";

      const checked = await validateGiftRecipient(user, recipientUsername);
      if ("error" in checked) {
        return NextResponse.json({ error: checked.error }, { status: checked.status });
      }
      const recipient = checked.recipient;

      const stripe = getStripeClient();
      const giftPriceId = getMeshProGiftPriceId(giftPlan);
      // No payment-link fallback for gifts: a static link cannot carry the
      // recipient in metadata, and a gift the webhook cannot route is money
      // taken for nothing delivered.
      if (!stripe || !giftPriceId) {
        return NextResponse.json(
          { error: "Gifting isn't configured yet. Please check back soon." },
          { status: 503 },
        );
      }

      const baseUrl = getAppBaseUrl(req);
      const months = MESH_PRO_GIFT_PRICING[giftPlan].months;
      const giftSession = await stripe.checkout.sessions.create({
        // NEVER "subscription": the recipient must inherit days, not a billing
        // relationship — and payment mode is also what rejects a recurring
        // price being wired here by mistake.
        mode: "payment",
        line_items: [{ price: giftPriceId, quantity: 1 }],
        success_url: `${baseUrl}/profile/${recipient.username}?gift=sent`,
        cancel_url: `${baseUrl}/meshpro/gift?to=${recipient.username}&payment=cancelled`,
        client_reference_id: user.id,
        metadata: {
          product: "meshpro-gift",
          purchaserUserId: user.id,
          recipientUserId: recipient.id,
          months: String(months),
          ...(message ? { message } : {}),
          ...(occasion ? { occasion } : {}),
        },
        ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_email: user.email }),
      });

      if (!giftSession.url) {
        return NextResponse.json(
          { error: "Stripe did not return a checkout URL. Please try again." },
          { status: 502 },
        );
      }
      return NextResponse.json({ url: giftSession.url });
    }

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
          error: "MeshPro is already active. Manage your billing instead.",
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

    // Someone holding gifted days who subscribes anyway must not pay for time
    // they already own: the subscription trials until the gift ends, and paid
    // billing starts the day after. `trialing` already counts as active
    // (isMeshProSubscriptionStatus), so nothing else changes. Stripe Checkout
    // requires trial_end ≥ 48h out; a gift with less left than that just
    // starts paid billing now.
    if (
      isMeshProGiftActive(user.meshProGiftUntil) &&
      user.meshProGiftUntil!.getTime() > Date.now() + 48 * 60 * 60 * 1000
    ) {
      checkoutParams.subscription_data = {
        metadata,
        trial_end: Math.floor(user.meshProGiftUntil!.getTime() / 1000),
      };
    }

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
