import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FeedTimelineClient } from "./feed-timeline-client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getCombinedFeedPosts,
  getFeedPostById,
  normalizeFeedContentFilter,
  normalizeFeedSource,
} from "@/lib/feed-data";

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

  const [feedWindow, connectedAccounts] = await Promise.all([
    getCombinedFeedPosts({
      user,
      source,
      contentFilter,
      limit: INITIAL_FEED_LIMIT + 1,
    }),
    prisma.connectedAccount.findMany({
      where: { userId: user.id, isActive: true },
      select: { platform: true },
    }),
  ]);

  let posts = feedWindow.slice(0, INITIAL_FEED_LIMIT);
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
      initialHasMore={feedWindow.length > INITIAL_FEED_LIMIT}
      source={source}
      initialContentFilter={contentFilter}
      connectedPlatforms={connectedPlatforms}
    />
  );
}
