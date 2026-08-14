import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FeedTimelineClient } from "./feed-timeline-client";
import { ReturnBrief } from "@/components/feed/return-brief";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getCombinedFeedPosts,
  getFeedPostById,
  normalizeFeedContentFilter,
  normalizeFeedSource,
} from "@/lib/feed-data";
import { returnBriefCursor } from "@/lib/return-brief";
import { getFlowCandidates, getViewerTasteProfile, rankFlowPosts, resolveStudioWeights } from "@/lib/flow-ranking";

export const metadata: Metadata = {
  title: "Feed",
  description: "A simple account-only feed for Mesh.me native and connected content.",
};

type FeedPageProps = {
  searchParams: Promise<{ source?: string; content?: string; flow?: string }>;
};

const INITIAL_FEED_LIMIT = 20;

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/feed");
  if (!user.onboarded) redirect("/onboarding");

  const { source: rawSource, content: rawContent, flow } = await searchParams;
  const source = normalizeFeedSource(rawSource);
  const contentFilter = normalizeFeedContentFilter(rawContent);
  // Newness is only stamped for the finite following feed — a "caught up"
  // boundary inside the reshuffling ranked order would lie.
  const newSince = source === "following" ? returnBriefCursor(user.caughtUpAt) : undefined;

  // The default view ranks with the same For You algorithm as the Flow; the
  // paginated API mirrors this, so client loads continue the same ordering.
  const rankedDefault = source === "all" && contentFilter === "all";
  const [feedWindow, connectedAccounts] = await Promise.all([
    rankedDefault
      ? Promise.all([getFlowCandidates(user), getViewerTasteProfile(user.id)]).then(
          // The Studio mix belongs here too. This call used to pass `{ limit }`
          // alone while api/flow/route.ts passed `{ mode, studio }`, so a
          // MeshPro member's weights governed the Flow and were ignored on the
          // feed — the surface most people open first.
          ([candidates, profile]) =>
            rankFlowPosts(candidates, profile, {
              limit: INITIAL_FEED_LIMIT + 1,
              studio: resolveStudioWeights(user),
            }),
        )
      : getCombinedFeedPosts({
          user,
          source,
          contentFilter,
          limit: INITIAL_FEED_LIMIT + 1,
          newSince,
        }),
    prisma.connectedAccount
      .findMany({
        where: { userId: user.id, isActive: true },
        select: { platform: true },
      })
      .catch((error) => {
        console.error("[feed] Connected account metadata unavailable", error);
        return [];
      }),
  ]);

  /* A ranked feed that ranks NOTHING is not an empty account — it is a cold
     taste profile. The seeded account follows nine posting users and still got
     the empty state, because rankFlowPosts returning [] fell straight through
     to "no posts". Fall back to the chronological combined feed; the empty
     state remains for accounts that genuinely have nothing to show. */
  const feedPosts = rankedDefault && feedWindow.length === 0
    ? await getCombinedFeedPosts({ user, source, contentFilter, limit: INITIAL_FEED_LIMIT + 1 })
    : feedWindow;

  let posts = feedPosts.slice(0, INITIAL_FEED_LIMIT);
  if (flow && !posts.some((post) => post.id === flow)) {
    const flowPost = await getFeedPostById(user, flow);
    if (flowPost) posts = [flowPost, ...posts];
  }
  const connectedPlatforms = [...new Set(connectedAccounts.map((account) => account.platform.toLowerCase()))];

  return (
    <FeedTimelineClient
      key={source}
      user={{ id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl }}
      initialPosts={posts}
      initialHasMore={feedPosts.length > INITIAL_FEED_LIMIT}
      source={source}
      initialContentFilter={contentFilter}
      connectedPlatforms={connectedPlatforms}
      // Server-rendered slot: the brief's read happens here, where the page
      // already reads, and the client shell just places it in the column.
      returnBrief={<ReturnBrief user={{ id: user.id, caughtUpAt: user.caughtUpAt }} />}
    />
  );
}
