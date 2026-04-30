import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommunityHub } from "@/components/communities/community-hub";
import { getCommunitiesHubData } from "@/lib/community-hub";

export const metadata: Metadata = {
  title: "Communities",
  description: "Create, discover, post, chat, and moderate Mesh.me communities.",
};

export default async function CommunitiesPage() {
  const data = await getCommunitiesHubData();
  if (!data) redirect("/login?next=/communities");

  return <CommunityHub data={data} />;
}
