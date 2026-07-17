import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { RouteLoadingPersonality } from "@/components/loading/route-loading-personality";
import { getCurrentUser } from "@/lib/auth";
import { InstagramProfileView } from "./profile-view";

export const metadata: Metadata = {
  title: "Identity",
  description: "Manage your Mesh.me identity, Meshi presence, connected profiles, and public digital footprint.",
};

export default async function ProfileIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");
  const { tab } = await searchParams;
  // Stream the profile: the shell paints instantly and the data-heavy view
  // arrives as it resolves, instead of blocking the whole response.
  return (
    <Suspense fallback={<RouteLoadingPersonality personality="profile" />}>
      <InstagramProfileView username={user.username} tab={tab} />
    </Suspense>
  );
}
