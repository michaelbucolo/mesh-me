import type { AuthGateway, AuthUser } from "@/core/contracts/auth";
import { getCurrentUser } from "@/lib/auth";

export const sessionAuthGateway: AuthGateway = {
  async getCurrentUser(): Promise<AuthUser | null> {
    const user = await getCurrentUser();

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      onboarded: user.onboarded,
    };
  },
};
