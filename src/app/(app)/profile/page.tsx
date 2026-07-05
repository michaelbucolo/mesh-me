import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
  return <InstagramProfileView username={user.username} tab={tab} />;
}
