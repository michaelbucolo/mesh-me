import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { explainFlowPost, getFlowCandidates, getViewerTasteProfile, rankFlowPosts } from "@/lib/flow-ranking";
import { getDiscoverUsers } from "@/lib/queries";
import { FlowClient, type FlowPost, type FlowSuggestedPerson } from "./flow-client";

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
    whyThis: explainFlowPost(post, profile),
  })) as unknown as FlowPost[];

  // Cold start: an empty Flow becomes a people-discovery moment instead of a
  // dead end — suggest real accounts to follow, then the feed fills itself.
  let suggestedPeople: FlowSuggestedPerson[] = [];
  if (posts.length === 0) {
    const discover = await getDiscoverUsers(user).catch(() => []);
    suggestedPeople = discover.slice(0, 6).map((person) => ({
      id: person.id,
      username: person.username,
      displayName: person.displayName,
      avatarUrl: person.avatarUrl,
      isVerified: person.isVerified,
      followerCount: person._count.followers,
    }));
  }

  return (
    <FlowClient
      initialPosts={posts}
      initialHasMore={candidates.length > posts.length}
      suggestedPeople={suggestedPeople}
    />
  );
}
