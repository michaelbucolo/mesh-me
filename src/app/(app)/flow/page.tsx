import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCombinedFeedPosts } from "@/lib/feed-data";
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

  const window = await getCombinedFeedPosts({
    user,
    source: "all",
    contentFilter: "all",
    limit: INITIAL_LIMIT + 1,
  });

  const posts = window.slice(0, INITIAL_LIMIT).map((post) => ({
    ...post,
    createdAt: String(post.createdAt),
  })) as unknown as FlowPost[];

  return <FlowClient initialPosts={posts} initialHasMore={window.length > INITIAL_LIMIT} />;
}
