import { redirect } from "next/navigation";

import { LandingShell } from "@/features/landing/components/landing-shell";
import { resolveLandingDestination } from "@/core/use-cases/resolve-landing-destination";
import { sessionAuthGateway } from "@/infra/auth/session-auth-gateway";
import { MeshEntry } from "@/components/mesh-entry";

export default async function LandingPage() {
  const destination = await resolveLandingDestination(sessionAuthGateway);

  if (destination) {
    redirect(destination);
  }

  return (
    <LandingShell>
      <MeshEntry />
    </LandingShell>
  );
}
