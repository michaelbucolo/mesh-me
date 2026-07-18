import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ANONYMOUS_VIEWER } from "@/lib/feed-data";
import { explainFlowPost, getFlowCandidates, getViewerTasteProfile, rankFlowPosts } from "@/lib/flow-ranking";
import { getDiscoverUsers } from "@/lib/queries";
import { FlowClient, type FlowPost, type FlowSuggestedPerson } from "./flow-client";

export const metadata: Metadata = {
  title: "Flow",
  description: "Full-screen stream of everything on your mesh — any content, one flow.",
};

const INITIAL_LIMIT = 12;

export default async function FlowPage() {
  // The Flow is open to everyone: guests get the public discover supply and
  // can watch freely — interacting is what asks for an account.
  const user = await getCurrentUser();
  if (user && !user.onboarded) redirect("/onboarding");
  const viewer = user ?? ANONYMOUS_VIEWER;

  const [candidates, profile] = await Promise.all([
    getFlowCandidates(viewer),
    getViewerTasteProfile(viewer.id),
  ]);

  const posts = rankFlowPosts(candidates, profile, { limit: INITIAL_LIMIT }).map((post) => ({
    ...post,
    createdAt: String(post.createdAt),
    whyThis: explainFlowPost(post, profile),
  })) as unknown as FlowPost[];

  // Cold start: an empty Flow becomes a people-discovery moment instead of a
  // dead end — suggest real accounts to follow, then the feed fills itself.
  let suggestedPeople: FlowSuggestedPerson[] = [];
  if (posts.length === 0 && user) {
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
      signedOut={!user}
      isPro={Boolean(user?.isMeshPro)}
    />
  );
}
