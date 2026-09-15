import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MeshEntryExperience } from "@/components/auth/mesh-entry-experience";
import { getCurrentUserRedirectState } from "@/lib/auth";
import { getConfiguredIdentityProviders } from "@/lib/identity-auth";
import { meshBrand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Create your Mesh",
  description: `Create your ${meshBrand.name} account and shape your digital world with ${meshBrand.meshi.name}.`,
};

export default async function SignupPage() {
  const user = await getCurrentUserRedirectState();
  if (user?.onboarded) redirect("/mesh");
  if (user && !user.onboarded) redirect("/onboarding");

  const oauthProviders = getConfiguredIdentityProviders();

  return <MeshEntryExperience initialStage="signup" oauthProviders={oauthProviders} />;
}
