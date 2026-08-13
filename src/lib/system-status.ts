import { prisma } from "@/lib/prisma";
import { getMeshProGiftPriceId, getMeshProPaymentLink, getMeshProPriceId, getStripeClient, MESH_PRO_GIFT_PLANS, MESH_PRO_PLANS } from "@/lib/stripe";
import { getOAuthClientId, getOAuthClientSecret, OAUTH_CONFIGS } from "@/lib/oauth";
import { hasSecretEncryptionKey } from "@/lib/secret-store";

export type SystemServiceStatus = "operational" | "degraded" | "setup_needed";

export type SystemStatusCheck = {
  id: "website" | "database" | "messaging" | "integrations" | "uploads" | "payments";
  label: string;
  status: SystemServiceStatus;
  summary: string;
  detail: string;
  latencyMs: number;
};

export type PublicSystemStatus = {
  generatedAt: string;
  overallStatus: SystemServiceStatus;
  summary: string;
  checks: SystemStatusCheck[];
};

function elapsedSince(startedAt: number) {
  return Math.max(1, Date.now() - startedAt);
}

async function runStatusCheck(
  id: SystemStatusCheck["id"],
  label: string,
  check: () => Promise<Omit<SystemStatusCheck, "id" | "label" | "latencyMs">>,
): Promise<SystemStatusCheck> {
  const startedAt = Date.now();

  try {
    return {
      id,
      label,
      ...(await check()),
      latencyMs: elapsedSince(startedAt),
    };
  } catch {
    return {
      id,
      label,
      status: "degraded",
      summary: `${label} needs attention`,
      detail: "The health check could not complete from this server instance.",
      latencyMs: elapsedSince(startedAt),
    };
  }
}

function getOverallStatus(checks: SystemStatusCheck[]): SystemServiceStatus {
  if (checks.some((check) => check.status === "degraded")) return "degraded";
  if (checks.some((check) => check.status === "setup_needed")) return "setup_needed";
  return "operational";
}

function getOverallSummary(status: SystemServiceStatus) {
  if (status === "operational") return "All monitored Mesh.me systems are operational.";
  if (status === "setup_needed") return "Core systems are online, with some launch services waiting on configuration.";
  return "Some Mesh.me systems need attention.";
}

export async function getPublicSystemStatus(): Promise<PublicSystemStatus> {
  const checks = await Promise.all([
    runStatusCheck("website", "Website", async () => ({
      status: "operational",
      summary: "Operational",
      detail: "The public app shell rendered successfully from this deployment.",
    })),

    runStatusCheck("database", "Database", async () => {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: "operational",
        summary: "Operational",
        detail: "The primary application database accepted a read check.",
      };
    }),

    runStatusCheck("messaging", "Messaging", async () => {
      await prisma.messageThread.count();
      await prisma.message.count();
      return {
        status: "operational",
        summary: "Operational",
        detail: "MeChat threads and message storage are reachable.",
      };
    }),

    runStatusCheck("integrations", "Integrations", async () => {
      await prisma.connectedAccount.count();
      const configuredOauth = Object.values(OAUTH_CONFIGS).filter((config) => getOAuthClientId(config) && getOAuthClientSecret(config)).length;
      const supportedOauth = Object.keys(OAUTH_CONFIGS).length;

      // THE ENCRYPTION KEY IS CHECKED FIRST, BECAUSE IT GATES ALL OF THEM.
      //
      // This check used to report "operational" off two facts: that some OAuth
      // client credentials exist, and that the connected-account table answers
      // a count. Neither is the thing that decides whether a connection can be
      // made. A provider token has to be encrypted before it is stored, so with
      // no key `hasSecretEncryptionKey()` is false, `/api/auth/[platform]`
      // refuses to start the flow, and ZERO of the adapters can complete —
      // however many have credentials.
      //
      // That is not hypothetical. Production ran with the key unset while this
      // endpoint served `"overallStatus": "operational"` and "All monitored
      // Mesh.me systems are operational", on the same deployment whose Connect
      // page was telling people in a red panel that connecting was switched
      // off. A status page that disagrees with the product is worse than no
      // status page: it sends the operator looking anywhere except at the cause.
      if (!hasSecretEncryptionKey()) {
        return {
          status: "setup_needed",
          summary: "Setup needed",
          detail:
            `Connecting is switched off: this deployment has no data encryption key, so provider tokens cannot be stored securely. ` +
            `${configuredOauth} of ${supportedOauth} OAuth adapters have credentials, but none can complete a connection until ` +
            `APP_DATA_ENCRYPTION_KEY is set to a 32-byte key and the app is redeployed.`,
        };
      }

      return {
        status: configuredOauth > 0 ? "operational" : "setup_needed",
        summary: configuredOauth > 0 ? "Operational" : "Setup needed",
        detail:
          configuredOauth > 0
            ? `${configuredOauth} of ${supportedOauth} OAuth adapters have credentials available; connected-account storage is reachable and tokens can be encrypted at rest.`
            : `${supportedOauth} OAuth adapters are registered, but no provider credentials are configured on this deployment.`,
      };
    }),

    runStatusCheck("uploads", "Uploads", async () => {
      await prisma.postMedia.count();
      return {
        status: "operational",
        summary: "Operational",
        detail: "Native post media records are reachable for image and video uploads.",
      };
    }),

    runStatusCheck("payments", "Payments", async () => {
      const stripeConfigured = Boolean(getStripeClient());
      const availablePlans = Object.keys(MESH_PRO_PLANS).filter((plan) => {
        const meshProPlan = plan as keyof typeof MESH_PRO_PLANS;
        return (stripeConfigured && getMeshProPriceId(meshProPlan)) || getMeshProPaymentLink(meshProPlan);
      });
      // Gift checkouts have no payment-link fallback (a static link cannot
      // carry the recipient), so they count only when Stripe + a price exist.
      const availableGiftPlans = stripeConfigured
        ? Object.keys(MESH_PRO_GIFT_PLANS).filter((plan) =>
            getMeshProGiftPriceId(plan as keyof typeof MESH_PRO_GIFT_PLANS),
          )
        : [];

      return {
        status: availablePlans.length > 0 ? "operational" : "setup_needed",
        summary: availablePlans.length > 0 ? "Operational" : "Setup needed",
        detail:
          availablePlans.length > 0
            ? `${availablePlans.length} MeshPro checkout option${availablePlans.length === 1 ? "" : "s"} and ${availableGiftPlans.length} gift option${availableGiftPlans.length === 1 ? "" : "s"} can route to Stripe. Mesh.me does not store card numbers.`
            : "Stripe checkout needs a secret key plus price IDs or payment links before MeshPro purchases can run.",
      };
    }),
  ]);

  const overallStatus = getOverallStatus(checks);

  return {
    generatedAt: new Date().toISOString(),
    overallStatus,
    summary: getOverallSummary(overallStatus),
    checks,
  };
}
