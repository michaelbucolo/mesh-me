import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMergedForYouFeedPosts, sortFeedPosts, toFeedCardPost, type FeedCardPost } from "@/lib/feed-data";
import { getDiscoverUsers, getExplorePosts, getTrendingCommunities, getTrendingTags } from "@/lib/queries";
import { ExploreDiscovery } from "./explore-discovery";

export const metadata: Metadata = {
  title: "Explore",
  description: "Discover people, communities, and content across the mesh.",
};

export default async function ExplorePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/explore");
  if (!user.onboarded) redirect("/onboarding");

  const [nativePosts, platformPosts, trendingTags, suggestedUsers, communities] = await Promise.all([
    getExplorePosts(1, 30, user),
    getMergedForYouFeedPosts(user, 30),
    getTrendingTags(),
    getDiscoverUsers(),
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
      currentUserId={user.id}
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
