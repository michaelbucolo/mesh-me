import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdvancedSocialWorkspace } from "@/components/social/advanced-social-workspace";
import { getCurrentUserRedirectState } from "@/lib/auth";
import { getSerializedAdvancedSocialData } from "@/lib/advanced-social";

export const metadata: Metadata = {
  title: "Collaborative Spaces",
  description: "Create shared Mesh spaces for friends, families, creator teams, and communities.",
};

export default async function SpacesPage() {
  const user = await getCurrentUserRedirectState();
  if (!user) redirect("/login?next=/spaces");
  if (!user.onboarded) redirect("/onboarding");

  const data = await getSerializedAdvancedSocialData();
  if (!data) redirect("/login?next=/spaces");

  return <AdvancedSocialWorkspace mode="spaces" data={data} />;
}
