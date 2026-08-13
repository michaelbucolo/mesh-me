import Stripe from "stripe";
import type { MeshProGiftPlan } from "./mesh-pro";
import { PRODUCTION_APP_URL } from "./oauth";

/**
 * The two `label` fields below are the ONLY place in this repo that mirrors the
 * product names configured in the Stripe Dashboard, and they are deliberately
 * still spelled "Mesh Pro" while the rest of the product says "MeshPro".   MESHPRO-NAME-ALLOW
 *
 * They are not rendered anywhere — `MESH_PRO_PLANS` is read for `.envKey` and
 * `.paymentLinkEnvKey` (below) and for `Object.keys` in system-status.ts, never
 * for `.label` — so respelling them here would change nothing a user sees, and
 * would quietly desync the code from what Stripe prints on the invoice. The
 * receipt name lives in the Stripe Dashboard (and, for native iOS, in App Store
 * Connect); renaming it there is the change that matters, and this comment is
 * here so these two lines are updated in the SAME breath rather than drifting.
 *
 * scripts/meshpro-name-check.ts allows exactly these two lines, and only these.
 */
export const MESH_PRO_PLANS = {
  monthly: {
    envKey: "STRIPE_MONTHLY_PRICE_ID",
    paymentLinkEnvKey: "STRIPE_MONTHLY_PAYMENT_LINK",
    label: "Mesh Pro Monthly",
  },
  yearly: {
    envKey: "STRIPE_YEARLY_PRICE_ID",
    paymentLinkEnvKey: "STRIPE_YEARLY_PAYMENT_LINK",
    label: "Mesh Pro Yearly",
  },
} as const;

export type MeshProPlan = keyof typeof MESH_PRO_PLANS;

/**
 * Gift MeshPro price IDs — these MUST be one-time Prices in the Stripe
 * Dashboard, never the recurring STRIPE_MONTHLY/YEARLY prices: a gift checkout
 * runs `mode: "payment"`, and Stripe rejects recurring prices in payment mode
 * outright. Same envKey pattern as MESH_PRO_PLANS above.
 */
export const MESH_PRO_GIFT_PLANS = {
  "1m": { envKey: "STRIPE_GIFT_1M_PRICE_ID" },
  "3m": { envKey: "STRIPE_GIFT_3M_PRICE_ID" },
  "12m": { envKey: "STRIPE_GIFT_12M_PRICE_ID" },
} as const;

export function parseMeshProGiftPlan(value: unknown): MeshProGiftPlan | null {
  return value === "1m" || value === "3m" || value === "12m" ? value : null;
}

export function getMeshProGiftPriceId(plan: MeshProGiftPlan) {
  return process.env[MESH_PRO_GIFT_PLANS[plan].envKey]?.trim() || null;
}

let stripeClient: Stripe | null | undefined;

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) return null;

  if (stripeClient === undefined) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2026-03-25.dahlia",
      maxNetworkRetries: 2,
      timeout: 20_000,
      appInfo: {
        name: "Mesh.me",
        version: "0.1.0",
      },
    });
  }

  return stripeClient;
}

export function parseMeshProPlan(value: unknown): MeshProPlan | null {
  return value === "monthly" || value === "yearly" ? value : null;
}

export function getMeshProPriceId(plan: MeshProPlan) {
  return process.env[MESH_PRO_PLANS[plan].envKey]?.trim() || null;
}

export function getMeshProPaymentLink(plan: MeshProPlan) {
  return process.env[MESH_PRO_PLANS[plan].paymentLinkEnvKey]?.trim() || null;
}

export function getAppBaseUrl(req?: Request) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    (process.env.VERCEL_ENV === "production" ? PRODUCTION_APP_URL : undefined) ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();

  if (configuredUrl) {
    const withProtocol = /^https?:\/\//i.test(configuredUrl) ? configuredUrl : `https://${configuredUrl}`;
    return withProtocol.replace(/\/+$/, "");
  }

  if (req) {
    const host = req.headers.get("host");
    if (host) {
      const proto = req.headers.get("x-forwarded-proto") || "https";
      return `${proto}://${host}`.replace(/\/+$/, "");
    }
  }

  return PRODUCTION_APP_URL;
}

export function stripeObjectId(value: string | { id: string } | null | undefined) {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

export function isMeshProSubscriptionStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}
