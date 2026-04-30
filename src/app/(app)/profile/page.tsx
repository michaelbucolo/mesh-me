import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { InstagramProfileView } from "./profile-view";

export const metadata: Metadata = {
  title: "Identity",
  description: "Manage your Mesh.me identity, Meshi presence, connected profiles, and public digital footprint.",
};

export default async function ProfileIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");
  return <InstagramProfileView username={user.username} />;
}
