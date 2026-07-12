import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCombinedFeedPosts } from "@/lib/feed-data";
import { FlowPageClient } from "./flow-page-client";

export const metadata: Metadata = {
  title: "Flow",
  description: "A full-screen stream across your Mesh.me feeds.",
};

export default async function FlowPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/flow");
  if (!user.onboarded) redirect("/onboarding");

  const [posts, connectedAccounts] = await Promise.all([
    getCombinedFeedPosts({
      user,
      source: "all",
      contentFilter: "all",
      limit: 80,
    }),
    prisma.connectedAccount.findMany({
      where: { userId: user.id, isActive: true },
      select: { platform: true },
    }),
  ]);

  return (
    <FlowPageClient
      posts={posts}
      currentUserId={user.id}
      connectedPlatforms={[...new Set(connectedAccounts.map((account) => account.platform.toLowerCase()))]}
    />
  );
}
