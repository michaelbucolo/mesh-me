import { getCurrentUser } from "@/lib/auth";
import { getExplorePosts, getDiscoverUsers, getTrendingCommunities, getTrendingTags } from "@/lib/queries";
import { PostCard } from "@/components/feed/post-card";
import { UserCard } from "@/components/shared/user-card";
import { CommunityCard } from "@/components/shared/community-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Compass, TrendingUp, Users, Sparkles, Hash, Star, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function ExplorePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [posts, suggestedUsers, trendingCommunities, trendingTags] = await Promise.all([
    getExplorePosts(1, 10),
    getDiscoverUsers(),
    getTrendingCommunities(),
    getTrendingTags(),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
            <Compass className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Explore</h1>
            <p className="text-sm text-zinc-500">Discover people, communities, and content that resonate with you</p>
          </div>
        </div>
      </div>

      {/* Trending Tags */}
      {trendingTags.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Hash className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Trending tags</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {trendingTags.map((tag: { tag: string; count: number }, i: number) => (
              <Link key={tag.tag} href={`/search?q=${encodeURIComponent(tag.tag)}`}>
                <Badge variant="secondary" className="px-3 py-1.5 text-sm hover:bg-zinc-700 transition-colors cursor-pointer">
                  <Hash className="h-3 w-3 mr-1" />
                  {tag.tag}
                  <span className="ml-2 text-zinc-500 text-xs">{tag.count}</span>
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recommended People */}
      {suggestedUsers.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-400" />
              <h2 className="text-lg font-semibold text-zinc-100">People you might mesh with</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {suggestedUsers.slice(0, 8).map((suggestedUser: { id: string; username: string; displayName: string; avatarUrl: string | null; interests: { id: string; tag: string }[]; _count: { followers: number } }) => (
              <Link key={suggestedUser.id} href={`/profile/${suggestedUser.username}`} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 hover:border-zinc-700 transition-all text-center group">
                <Avatar src={suggestedUser.avatarUrl} alt={suggestedUser.displayName} size="lg" className="mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-indigo-400 transition-colors truncate">{suggestedUser.displayName}</h3>
                <p className="text-xs text-zinc-500 mb-2">@{suggestedUser.username}</p>
                {suggestedUser.interests && suggestedUser.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-center">
                    {suggestedUser.interests.slice(0, 2).map((interest: { id: string; tag: string }) => (
                      <Badge key={interest.id} variant="secondary" className="text-[10px]">{interest.tag}</Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-zinc-500 mt-2">{suggestedUser._count.followers} followers</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main content - Trending Posts */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-indigo-400" />
              <h2 className="text-lg font-semibold text-zinc-100">Trending</h2>
            </div>
            <div className="space-y-4">
              {posts.length > 0 ? (
                                posts.map((post) => (
                                  <PostCard key={post.id} post={post} currentUserId={user.id} />
                ))
              ) : (
                <div className="text-center py-16 text-zinc-500">
                  <Compass className="h-12 w-12 mx-auto mb-4 text-zinc-700" />
                  <p>No trending posts yet. Be the first to create something!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Rising Communities */}
          {trendingCommunities.length > 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-5 w-5 text-indigo-400" />
                <h3 className="font-semibold text-zinc-100">Rising communities</h3>
              </div>
              <div className="space-y-3">
                {trendingCommunities.slice(0, 5).map((community: { id: string; name: string; slug: string; _count: { members: number; posts: number } }) => (
                  <Link key={community.id} href={`/communities/${community.slug}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-800/50 transition-colors">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {community.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-zinc-200 truncate">{community.name}</h4>
                      <p className="text-xs text-zinc-500">{community._count.members} members &middot; {community._count.posts} posts</p>
                    </div>
                  </Link>
                ))}
              </div>
              <Link href="/communities" className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 mt-4 transition-colors">
                View all communities <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
