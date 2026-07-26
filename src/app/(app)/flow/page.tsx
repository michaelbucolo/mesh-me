import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ANONYMOUS_VIEWER } from "@/lib/feed-data";
import { parseAcceptLanguage } from "@/lib/language";
import { applyWatchSignal, explainFlowPost, flowFormStats, getFlowCandidates, getViewerTasteProfile, rankFlowPosts, resolveStudioWeights, type WatchStats } from "@/lib/flow-ranking";
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

  const [candidates, profile, requestHeaders] = await Promise.all([
    getFlowCandidates(viewer),
    getViewerTasteProfile(viewer.id),
    headers(),
  ]);
  // Cater the Flow to the language the viewer's browser actually asks for.
  const viewerLangs = new Set(parseAcceptLanguage(requestHeaders.get("accept-language")));

  // Which source platforms this viewer has connected/merged — the Flow uses this
  // to know when interacting with an external post should offer "connect or merge
  // <platform>" rather than silently keeping it a private, mesh-only taste signal.
  // Viewing every platform's public content stays open regardless of this list.
  const connectedPlatforms = user
    ? (
        await prisma.connectedAccount.findMany({
          where: { userId: user.id, isActive: true },
          select: { platform: true },
        })
      ).map((account) => account.platform)
    : [];

  // Persisted seen/liked state for the first paint (the Flow's highest-visibility
  // slot), scoped to this batch's candidates. Guests have none.
  const impressions = user
    ? await prisma.flowImpression.findMany({
        where: { userId: user.id, postId: { in: candidates.map((p) => p.id) } },
        select: { postId: true, liked: true, watchMs: true, completion: true },
      })
    : [];
  const persistedSeen = new Set(impressions.map((i) => i.postId));
  const likedSet = new Set(impressions.filter((i) => i.liked).map((i) => i.postId));

  // Implicit watch behavior (completions up, fast skips down) folds into the
  // same taste profile explicit likes feed — Reels' primary ranking input.
  const watchStats = new Map<string, WatchStats>(
    impressions
      .filter((i) => i.watchMs > 0 || i.completion > 0 || i.liked)
      .map((i) => [i.postId, { watchMs: i.watchMs, completion: i.completion, liked: i.liked }]),
  );
  applyWatchSignal(profile, candidates, watchStats);

  // The member's Algorithm Studio mix governs the FIRST paint too. /meshpro
  // sells these sliders and links here; ranking this page without them meant a
  // paying member's own Flow opened ignoring their algorithm and only obeyed it
  // once the client fetched page two.
  const studio = resolveStudioWeights(user);

  const posts = rankFlowPosts(candidates, profile, { limit: INITIAL_LIMIT, seen: persistedSeen, viewerLangs, watch: watchStats, studio }).map((post) => ({
    ...post,
    createdAt: String(post.createdAt),
    reactions: likedSet.has(post.id) ? [{ id: "self" }] : post.reactions,
    whyThis: explainFlowPost(post, profile),
  })) as unknown as FlowPost[];

  // WHY the Flow is empty, when it is. The surface is shorts-and-reels only and
  // excludes anything it cannot positively classify as short — so "no posts"
  // has two very different causes: the viewer genuinely has no sources, or
  // their sources have plenty of content and none of it is short-form (or none
  // of it reports a duration yet). Rendering the same empty screen for both is
  // the silent-truncation failure: it reads as "there is nothing" when the
  // truth is "we filtered it and here is how much".
  const formStats = flowFormStats(candidates);

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
      formStats={formStats}
      suggestedPeople={suggestedPeople}
      signedOut={!user}
      isPro={Boolean(user?.isMeshPro)}
      connectedPlatforms={connectedPlatforms}
    />
  );
}
