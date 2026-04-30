import Stripe from "stripe";

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

  return "https://meshme.vercel.app";
}

export function stripeObjectId(value: string | { id: string } | null | undefined) {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

export function isMeshProSubscriptionStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}
