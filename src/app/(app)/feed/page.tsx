import { getCurrentUser } from "@/lib/auth";
import { getFeedPosts, getExplorePosts } from "@/lib/queries";
import { PostComposer } from "@/components/feed/post-composer";
import { PostCard } from "@/components/feed/post-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText } from "lucide-react";
import Link from "next/link";

export default async function FeedPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  let posts = await getFeedPosts();

  // If user has no feed content, show explore posts
  if (posts.length === 0) {
    posts = await getExplorePosts(1, 10);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Home</h1>
      </div>

      {/* Composer */}
      <div className="mb-6">
        <PostComposer
          user={{
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
          }}
        />
      </div>

      {/* Feed */}
      <div className="space-y-4">
        {posts.length > 0 ? (
          posts.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={user.id} />
          ))
        ) : (
          <EmptyState
            icon={FileText}
            title="Your feed is empty"
            description="Follow people and join communities to see posts here, or explore what's happening."
          >
            <Link
              href="/explore"
              className="inline-flex bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:from-indigo-500 hover:to-purple-500 transition-all"
            >
              Explore mesh.me
            </Link>
          </EmptyState>
        )}
      </div>
    </div>
  );
}
