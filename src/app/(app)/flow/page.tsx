import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getFlowCandidates, getViewerTasteProfile, rankFlowPosts } from "@/lib/flow-ranking";
import { FlowClient, type FlowPost } from "./flow-client";

export const metadata: Metadata = {
  title: "Flow",
  description: "Full-screen stream of everything on your mesh — any content, one flow.",
};

const INITIAL_LIMIT = 12;

export default async function FlowPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/flow");
  if (!user.onboarded) redirect("/onboarding");

  const [candidates, profile] = await Promise.all([
    getFlowCandidates(user),
    getViewerTasteProfile(user.id),
  ]);

  const posts = rankFlowPosts(candidates, profile, { limit: INITIAL_LIMIT }).map((post) => ({
    ...post,
    createdAt: String(post.createdAt),
  })) as unknown as FlowPost[];

  return <FlowClient initialPosts={posts} initialHasMore={candidates.length > posts.length} />;
}
