import "server-only";

import Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendPushForNotification } from "@/lib/push";
import { getStripeClient, stripeObjectId } from "@/lib/stripe";
import { hasMeshPro } from "@/lib/mesh-pro";
import {
  DEFAULT_MESHI_PREFERENCE,
  isGiftableMeshiItem,
  MESHI_FIELD_OF_GROUP,
  meshiItemLabel,
} from "@/lib/meshi-wardrobe";

/**
 * MESHI WARDROBE ITEMS — one $1.99 receipt, one piece, owned forever.
 *
 * The OwnedMeshiItem row IS the entitlement: the wardrobe gate honors live
 * rows (revokedAt null) exactly like free options. This module writes those
 * rows and nothing else — never `isMeshPro`, never `meshProGiftUntil`, and
 * never `MeshiPreference` on a grant: a webhook must not rewrite anyone's
 * self-presentation, so nothing auto-equips. The one MeshiPreference write
 * lives in the REFUND path, where it is load-bearing: without it, the gate's
 * held-value forgiveness would let accomplice-gift → equip → chargeback keep
 * the piece on forever.
 */

/**
 * Grant a paid wardrobe-item session. Idempotent against webhook redelivery
 * (`stripeSessionId @unique` + P2002 swallow). If a live row for the same
 * (owner, category, value) already exists from a DIFFERENT session — two
 * checkouts raced past the pre-payment refusal — the later payment delivered
 * nothing, so it is refunded in full rather than kept (charter precedent).
 */
export async function applyMeshiItemSession(
  session: Stripe.Checkout.Session,
  options: { revalidate?: boolean } = {},
) {
  const metadata = session.metadata ?? {};
  const ownerId = metadata.recipientUserId;
  const purchaserId = metadata.purchaserUserId || null;
  const category = metadata.category ?? "";
  const value = (metadata.value ?? "").trim().toLowerCase();
  // Catalog membership is re-checked at grant time: metadata is written by our
  // checkout, but the catalog may have narrowed between payment and delivery,
  // and a non-giftable value must never become owned.
  if (!ownerId || !isGiftableMeshiItem(category, value)) {
    console.error("Meshi item session missing/invalid metadata:", { sessionId: session.id });
    return null;
  }

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, username: true },
  });
  // Recipient deleted between checkout and webhook — permanent, nothing to grant.
  if (!owner) return null;

  const paymentIntentId = stripeObjectId(session.payment_intent);
  const message = (metadata.message ?? "").slice(0, 280).trim() || null;

  let outcome: "created" | "race-lost" | "already";
  try {
    outcome = await prisma.$transaction(async (tx) => {
      const live = await tx.ownedMeshiItem.findFirst({
        where: { ownerId: owner.id, category, value, revokedAt: null },
        select: { stripeSessionId: true },
      });
      // Same session seen again = redelivery (granted, never re-notify);
      // a different session's live row = this payment delivered nothing.
      if (live) return live.stripeSessionId === session.id ? "already" : "race-lost";
      await tx.ownedMeshiItem.create({
        data: {
          ownerId: owner.id,
          purchaserId,
          category,
          value,
          message,
          stripeSessionId: session.id,
          paymentIntentId,
        },
      });
      return "created";
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      // Stripe retried a session that already granted (including one whose row
      // was since revoked by a refund — that must stay revoked) — done once.
      return null;
    }
    throw error;
  }

  if (outcome === "race-lost") {
    // Money taken for nothing delivered: the piece is already owned via
    // another session, so this payment goes straight back.
    const stripe = getStripeClient();
    if (stripe && paymentIntentId) {
      await stripe.refunds.create({ payment_intent: paymentIntentId }).catch((error) =>
        console.error("Meshi item auto-refund failed — REQUIRES MANUAL REFUND:", { sessionId: session.id, error }),
      );
    }
    return null;
  }

  // The moment between two people — recipient-only, and only when it IS two
  // people. A receipt notification about your own purchase is noise.
  if (outcome === "created" && purchaserId && purchaserId !== owner.id) {
    const purchaser = await prisma.user.findUnique({
      where: { id: purchaserId },
      select: { displayName: true },
    });
    const label = meshiItemLabel(category, value);
    const summary = `${purchaser?.displayName ?? "Someone"} gave your Meshi the ${label}${message ? `: "${message}"` : ""}`;
    await prisma.notification
      .create({
        data: {
          type: "meshi_gift",
          recipientId: owner.id,
          actorId: purchaserId,
          message: summary,
        },
      })
      .catch((error) => console.error("Meshi gift notification failed:", error));
    sendPushForNotification(owner.id, { type: "meshi_gift", message: summary }).catch(() => {});
  }

  if (options.revalidate) {
    revalidatePath("/settings");
    revalidatePath(`/profile/${owner.username}`);
  }

  return owner.id;
}

/**
 * Full refund → the receipt is revoked (never deleted — a receipt is history,
 * and hard-deleting would let the next honest purchase collide with nothing
 * while this one silently vanishes from support's view). If the refunded piece
 * is the one currently worn and nothing else still entitles the owner to it,
 * the equipped axis quietly resets to its free default — the same bookkeeping
 * `applyCharterRefund` does for the charter pin. Partial refunds are logged
 * and ignored. Nothing but this path ever writes `revokedAt`.
 */
export async function applyMeshiItemRefund(charge: Stripe.Charge) {
  if (charge.amount_refunded !== charge.amount) {
    console.error("Partial meshi item refund ignored:", { chargeId: charge.id });
    return;
  }
  const paymentIntentId = stripeObjectId(charge.payment_intent);
  if (!paymentIntentId) return;

  await prisma.$transaction(async (tx) => {
    const item = await tx.ownedMeshiItem.findUnique({
      where: { paymentIntentId },
      select: { id: true, ownerId: true, category: true, value: true, revokedAt: true },
    });
    if (!item || item.revokedAt) return; // not a wardrobe item, or redelivery

    await tx.ownedMeshiItem.update({
      where: { id: item.id },
      data: { revokedAt: new Date() },
    });

    // Another live receipt for the same piece keeps it owned; a Pro owner
    // wears the whole wardrobe anyway (unequipping would be theater).
    const stillOwned = await tx.ownedMeshiItem.findFirst({
      where: { ownerId: item.ownerId, category: item.category, value: item.value, revokedAt: null },
      select: { id: true },
    });
    if (stillOwned) return;
    const owner = await tx.user.findUnique({
      where: { id: item.ownerId },
      select: { username: true, isMeshPro: true, meshProGiftUntil: true },
    });
    if (!owner || hasMeshPro(owner)) return;

    const field = MESHI_FIELD_OF_GROUP[item.category as keyof typeof MESHI_FIELD_OF_GROUP];
    if (!field) return;
    await tx.meshiPreference.updateMany({
      where: { userId: item.ownerId, [field]: item.value },
      data: { [field]: DEFAULT_MESHI_PREFERENCE[field] },
    });
  });
}

/**
 * Success-page reconciler, exactly as narrow as the webhook: meshi-item
 * product, this caller as PURCHASER, paid. The fourth member of the
 * equally-narrow family (meshpro, meshpro-gift, charter-seat) — each refuses
 * every other product by construction.
 */
export async function syncMeshiItemSessionForUser(sessionId: string, userId: string) {
  const stripe = getStripeClient();
  if (!stripe) return { ok: false as const, message: "Stripe is not configured." };
  if (!/^cs_(test|live)_[A-Za-z0-9_]+$/.test(sessionId)) {
    return { ok: false as const, message: "Invalid checkout session." };
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.product !== "meshi-item") {
    return { ok: false as const, message: "That checkout session is not a wardrobe piece." };
  }
  if (session.metadata?.purchaserUserId !== userId) {
    return { ok: false as const, message: "That checkout session does not belong to this account." };
  }
  if (session.payment_status !== "paid") {
    return { ok: false as const, message: "Checkout has not completed yet." };
  }

  // No revalidatePath: this runs during the gift page render (Next E7); the
  // checkout.session.completed webhook revalidates authoritatively.
  const ownerId = await applyMeshiItemSession(session);
  const label = meshiItemLabel(session.metadata?.category ?? "", session.metadata?.value ?? "");
  if (ownerId == null) {
    // Redelivery of an already-granted session also lands here — check
    // whether the piece is in fact owned before calling it unsettled.
    const owned = await prisma.ownedMeshiItem.findFirst({
      where: {
        ownerId: session.metadata?.recipientUserId ?? "",
        category: session.metadata?.category ?? "",
        value: session.metadata?.value ?? "",
        revokedAt: null,
      },
      select: { id: true },
    });
    if (owned) {
      return {
        ok: true as const,
        message: session.metadata?.recipientUserId === userId
          ? `The ${label} is in your wardrobe.`
          : `The ${label} is in their wardrobe.`,
      };
    }
    return { ok: false as const, message: "Could not confirm the purchase yet. The webhook will settle it." };
  }
  return {
    ok: true as const,
    message: ownerId === userId
      ? `The ${label} is in your wardrobe.`
      : `The ${label} is in their wardrobe.`,
  };
}
