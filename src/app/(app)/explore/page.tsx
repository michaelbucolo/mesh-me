import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ANONYMOUS_VIEWER, getMergedForYouFeedPosts, sortFeedPosts, toFeedCardPost, type FeedCardPost } from "@/lib/feed-data";
import { getDiscoverUsers, getExplorePosts, getTrendingCommunities, getTrendingTags } from "@/lib/queries";
import { ExploreDiscovery } from "./explore-discovery";

export const metadata: Metadata = {
  title: "Explore",
  description: "Discover people, communities, and content across the mesh.",
};

export default async function ExplorePage() {
  // Explore is open to everyone — guests browse the public supply; acting on
  // anything (follow, react, join) is what asks for an account.
  const user = await getCurrentUser();
  if (user && !user.onboarded) redirect("/onboarding");
  const viewer = user ?? ANONYMOUS_VIEWER;

  const [nativePosts, platformPosts, trendingTags, suggestedUsers, communities] = await Promise.all([
    // getExplorePosts has its own anonymous filter (public, discoverable,
    // never NSFW) — hand it the real user or nothing at all.
    getExplorePosts(1, 30, user ?? null),
    getMergedForYouFeedPosts(viewer, 30),
    getTrendingTags(),
    user ? getDiscoverUsers(user) : Promise.resolve([]),
    getTrendingCommunities(),
  ]);

  const seen = new Set<string>();
  const posts: FeedCardPost[] = [];
  for (const post of sortFeedPosts([...nativePosts.map(toFeedCardPost), ...platformPosts])) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    posts.push(post);
  }

  return (
    <ExploreDiscovery
      currentUserId={user?.id ?? ""}
      signedOut={!user}
      posts={posts}
      trendingTags={trendingTags.slice(0, 16)}
      suggestedUsers={suggestedUsers.slice(0, 20).map((suggested) => ({
        id: suggested.id,
        username: suggested.username,
        displayName: suggested.displayName,
        avatarUrl: suggested.avatarUrl,
        isVerified: suggested.isVerified,
        interests: suggested.interests.map((interest) => ({ id: interest.id, tag: interest.tag })),
        followerCount: suggested._count.followers,
      }))}
      communities={communities.slice(0, 12).map((community) => ({
        id: community.id,
        name: community.name,
        slug: community.slug,
        description: community.description,
        iconUrl: community.iconUrl,
        memberCount: community._count.members,
        postCount: community._count.posts,
      }))}
    />
  );
}
