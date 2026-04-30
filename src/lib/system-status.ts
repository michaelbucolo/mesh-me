import { prisma } from "@/lib/prisma";
import { getMeshProPaymentLink, getMeshProPriceId, getStripeClient, MESH_PRO_PLANS } from "@/lib/stripe";
import { getOAuthClientId, getOAuthClientSecret, OAUTH_CONFIGS } from "@/lib/oauth";

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
      await prisma.$queryRawUnsafe("SELECT 1");
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

      return {
        status: configuredOauth > 0 ? "operational" : "setup_needed",
        summary: configuredOauth > 0 ? "Operational" : "Setup needed",
        detail:
          configuredOauth > 0
            ? `${configuredOauth} of ${supportedOauth} OAuth adapters have credentials available; connected-account storage is reachable.`
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

      return {
        status: availablePlans.length > 0 ? "operational" : "setup_needed",
        summary: availablePlans.length > 0 ? "Operational" : "Setup needed",
        detail:
          availablePlans.length > 0
            ? `${availablePlans.length} Mesh Pro checkout option${availablePlans.length === 1 ? "" : "s"} can route to Stripe. Mesh.me does not store card numbers.`
            : "Stripe checkout needs a secret key plus price IDs or payment links before Mesh Pro purchases can run.",
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
