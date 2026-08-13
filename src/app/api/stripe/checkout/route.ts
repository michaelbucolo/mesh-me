import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { attachCharterSession, CHARTER_PRICE_CENTS, CHARTER_SESSION_TTL_S, releaseCharterHold, reserveCharterSeat } from "@/lib/charter";
import { isFounderUsername, isMeshProGiftActive, MESH_PRO_GIFT_MESSAGE_MAX, MESH_PRO_GIFT_PRICING } from "@/lib/mesh-pro";
import { isGiftableMeshiItem, MESHI_ITEM_PRICE_CENTS, meshiItemLabel } from "@/lib/meshi-wardrobe";
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
async function validateGiftRecipient(
  purchaser: { id: string },
  recipientUsername: string,
  // Wardrobe pieces may be bought for your own Meshi (refusing that is theater
  // — two accounts gifting each other defeats it, and the refusal itself is
  // the obnoxious part). Months of MeshPro keep the self-block: gifting
  // yourself a subscription is just subscribing with extra steps.
  { allowSelf = false }: { allowSelf?: boolean } = {},
) {
  const recipient = await prisma.user.findUnique({
    where: { username: recipientUsername },
    select: { id: true, username: true, isSuspended: true },
  });
  if (!recipient || recipient.isSuspended) {
    return { error: "No one on Mesh.me has that username.", status: 404 as const };
  }
  if (!allowSelf && recipient.id === purchaser.id) {
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
        // Deliberately NO client_reference_id and no `userId` metadata key: the
        // reconciler in syncMeshProCheckoutSessionForUser treats those as "this
        // session's owner may claim MeshPro from it", and a gift must never be
        // claimable as the purchaser's own entitlement. The webhook routes
        // gifts purely by product + purchaserUserId/recipientUserId.
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

    // ── Meshi wardrobe piece: $1.99 once, owned forever (gift or self) ──────
    if (payload?.meshiItem !== undefined) {
      const item = payload.meshiItem ?? {};
      const category = String(item?.category || "").trim();
      const value = String(item?.value || "").trim().toLowerCase();
      if (!isGiftableMeshiItem(category, value)) {
        return NextResponse.json({ error: "That isn't a giftable wardrobe piece." }, { status: 400 });
      }

      const recipientUsername = String(item?.recipientUsername || "").trim().toLowerCase();
      if (!recipientUsername) {
        return NextResponse.json({ error: "Choose whose Meshi this is for." }, { status: 400 });
      }
      const message = typeof item?.message === "string" ? item.message.trim() : "";
      if (message.length > MESH_PRO_GIFT_MESSAGE_MAX) {
        return NextResponse.json(
          { error: `Keep the gift message under ${MESH_PRO_GIFT_MESSAGE_MAX} characters.` },
          { status: 400 },
        );
      }

      const checked = await validateGiftRecipient(user, recipientUsername, { allowSelf: true });
      if ("error" in checked) {
        return NextResponse.json({ error: checked.error }, { status: checked.status });
      }
      const recipient = checked.recipient;
      const isSelf = recipient.id === user.id;

      // Ownership is forever, so a second purchase of the same piece delivers
      // nothing — refuse before any money moves. (Two sessions racing past
      // this check are settled at grant time, where the loser is refunded.)
      const alreadyOwned = await prisma.ownedMeshiItem.findFirst({
        where: { ownerId: recipient.id, category, value, revokedAt: null },
        select: { id: true },
      });
      if (alreadyOwned) {
        return NextResponse.json(
          { error: isSelf ? "Your Meshi already owns that." : "Their Meshi already owns that." },
          { status: 409 },
        );
      }

      const stripe = getStripeClient();
      if (!stripe) {
        return NextResponse.json(
          { error: "Wardrobe gifting isn't configured yet. Please check back soon." },
          { status: 503 },
        );
      }

      const baseUrl = getAppBaseUrl(req);
      const itemSession = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: MESHI_ITEM_PRICE_CENTS,
              product_data: { name: `Meshi ${meshiItemLabel(category, value)}` },
            },
            quantity: 1,
          },
        ],
        // Self-purchase returns to the gift page, which runs the narrow
        // reconciler — self is exactly the case that needs webhook-latency
        // insurance ("it's in your wardrobe" must survive a slow webhook).
        success_url: isSelf
          ? `${baseUrl}/meshpro/gift?payment=success&session_id={CHECKOUT_SESSION_ID}`
          : `${baseUrl}/profile/${recipient.username}?gift=sent`,
        cancel_url: `${baseUrl}/meshpro/gift?mode=piece&to=${recipient.username}&payment=cancelled`,
        // Deliberately NO client_reference_id and no `userId` metadata key: the
        // MeshPro reconciler treats those as "this session's owner may claim
        // MeshPro from it", and a $1.99 hat must never cross-grant Pro.
        metadata: {
          product: "meshi-item",
          purchaserUserId: user.id,
          recipientUserId: recipient.id,
          category,
          value,
          ...(message ? { message } : {}),
        },
        ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_email: user.email }),
      });

      if (!itemSession.url) {
        return NextResponse.json(
          { error: "Stripe did not return a checkout URL. Please try again." },
          { status: 502 },
        );
      }
      return NextResponse.json({ url: itemSession.url });
    }

    // ── Charter seat: $79 once, status only ─────────────────────────────────
    if (payload?.charter === true) {
      const stripe = getStripeClient();
      if (!stripe) {
        return NextResponse.json(
          { error: "Payment is not configured yet. Please check back soon." },
          { status: 503 },
        );
      }

      // The number is RESERVED before Stripe is ever called, so every session
      // references an already-held seat and an abandoned checkout can never
      // orphan or double-assign a number.
      const reserved = await reserveCharterSeat(user.id);
      if (!reserved.ok) {
        return NextResponse.json(
          reserved.reason === "already-holder"
            ? { error: "You already hold a charter seat.", alreadyActive: true }
            : { error: "All one hundred seats are claimed." },
          { status: reserved.reason === "already-holder" ? 409 : 410 },
        );
      }

      const baseUrl = getAppBaseUrl(req);
      let charterSession: Stripe.Checkout.Session;
      try {
        charterSession = await stripe.checkout.sessions.create({
          mode: "payment",
          expires_at: Math.floor(Date.now() / 1000) + CHARTER_SESSION_TTL_S,
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: CHARTER_PRICE_CENTS,
                product_data: { name: `Mesh.me Charter seat №${reserved.number}` },
              },
              quantity: 1,
            },
          ],
          // No `userId` metadata key and no client_reference_id — the MeshPro
          // reconciler treats those as "this session's owner may claim MeshPro
          // from it", and a charter seat must never cross-grant Pro.
          metadata: {
            product: "charter-seat",
            charterUserId: user.id,
            seatNumber: String(reserved.number),
          },
          success_url: `${baseUrl}/meshpro/charter?payment=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/meshpro/charter?payment=cancelled`,
          ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_email: user.email }),
        });
      } catch (error) {
        // The hold must not outlive a session that never existed.
        await releaseCharterHold(reserved.number, user.id);
        throw error;
      }

      await attachCharterSession(reserved.number, user.id, charterSession.id);

      if (!charterSession.url) {
        return NextResponse.json(
          { error: "Stripe did not return a checkout URL. Please try again." },
          { status: 502 },
        );
      }
      return NextResponse.json({ url: charterSession.url });
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
