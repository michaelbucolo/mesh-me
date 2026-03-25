import { getCurrentUser } from "@/lib/auth";
import { getExplorePosts, getDiscoverUsers, getTrendingCommunities } from "@/lib/queries";
import { PostCard } from "@/components/feed/post-card";
import { UserCard } from "@/components/shared/user-card";
import { CommunityCard } from "@/components/shared/community-card";
import { Compass, TrendingUp, Users, Sparkles } from "lucide-react";

export default async function ExplorePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [posts, suggestedUsers, trendingCommunities] = await Promise.all([
    getExplorePosts(1, 10),
    getDiscoverUsers(),
    getTrendingCommunities(),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Compass className="h-6 w-6 text-indigo-400" />
          <h1 className="text-2xl font-bold text-zinc-100">Explore</h1>
        </div>
        <p className="text-zinc-400">Discover people, communities, and content that resonate with you</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Trending Posts */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-indigo-400" />
              <h2 className="text-lg font-semibold text-zinc-100">Trending</h2>
            </div>
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} currentUserId={user.id} />
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Suggested People */}
          {suggestedUsers.length > 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-indigo-400" />
                <h3 className="font-semibold text-zinc-100">People you might mesh with</h3>
              </div>
              <div className="space-y-1">
                {suggestedUsers.slice(0, 5).map((suggestedUser) => (
                  <UserCard key={suggestedUser.id} user={suggestedUser} currentUserId={user.id} compact />
                ))}
              </div>
            </div>
          )}

          {/* Trending Communities */}
          {trendingCommunities.length > 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-indigo-400" />
                <h3 className="font-semibold text-zinc-100">Rising communities</h3>
              </div>
              <div className="space-y-3">
                {trendingCommunities.slice(0, 5).map((community) => (
                  <CommunityCard key={community.id} community={community} currentUserId={user.id} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
