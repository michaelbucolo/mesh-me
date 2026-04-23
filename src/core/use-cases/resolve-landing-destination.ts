import type { AuthGateway } from "@/core/contracts/auth";

export async function resolveLandingDestination(authGateway: AuthGateway): Promise<string | null> {
  const user = await authGateway.getCurrentUser();
  return user?.onboarded ? "/mesh" : null;
}
