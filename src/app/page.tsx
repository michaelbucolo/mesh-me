import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MeshEntryExperience } from "@/components/auth/mesh-entry-experience";
import { getCurrentUserRedirectState } from "@/lib/auth";
import { getBrandTitle, meshBrand } from "@/lib/brand";

export const metadata: Metadata = {
  title: { absolute: getBrandTitle() },
  description: meshBrand.description,
  alternates: {
    canonical: "/",
  },
};

export default async function HomePage() {
  const user = await getCurrentUserRedirectState();
  if (user?.onboarded) redirect("/mesh");
  if (user && !user.onboarded) redirect("/onboarding");

  return <MeshEntryExperience />;
}
