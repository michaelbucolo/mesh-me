import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdvancedSocialWorkspace } from "@/components/social/advanced-social-workspace";
import { getCurrentUserRedirectState } from "@/lib/auth";
import { getSerializedAdvancedSocialData } from "@/lib/advanced-social";

export const metadata: Metadata = {
  title: "Mesh Vault",
  description: "Save important content, memories, messages, and moments into a private Mesh.me archive.",
};

export default async function VaultPage() {
  const user = await getCurrentUserRedirectState();
  if (!user) redirect("/login?next=/vault");
  if (!user.onboarded) redirect("/onboarding");

  const data = await getSerializedAdvancedSocialData();
  if (!data) redirect("/login?next=/vault");

  return <AdvancedSocialWorkspace mode="vault" data={data} />;
}
