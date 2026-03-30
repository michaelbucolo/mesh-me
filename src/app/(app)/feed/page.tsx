import { getCurrentUser } from "@/lib/auth";
import { getFeedPosts, getExplorePosts } from "@/lib/queries";
import { FeedClient } from "./feed-client";

export default async function FeedPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  let posts = await getFeedPosts();

  // If user has no feed content, show explore posts
  if (posts.length === 0) {
    posts = await getExplorePosts(1, 10);
  }

  return (
    <FeedClient
      user={{
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      }}
      initialPosts={posts}
    />
  );
}
