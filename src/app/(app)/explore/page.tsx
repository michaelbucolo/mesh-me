import { getCurrentUser } from "@/lib/auth";
import { getExplorePosts, getDiscoverUsers, getTrendingCommunities, getTrendingTags } from "@/lib/queries";
import { PostCard } from "@/components/feed/post-card";
import { Compass, TrendingUp, Sparkles, Hash, Star, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ExploreUsersGrid } from "./explore-users";

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
    <div data-meshi-zone="explore" className="max-w-6xl mx-auto px-4 py-6 animate-page-enter">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Explore</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Find your people, communities, and corners of the mesh</p>
      </div>

      {/* Trending Tags */}
      {trendingTags.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Hash className="h-5 w-5" style={{ color: "var(--accent)" }} />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Trending tags</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {trendingTags.map((tag: { tag: string; count: number }) => (
              <Link key={tag.tag} href={`/search?q=${encodeURIComponent(tag.tag)}`}>
                <Badge variant="secondary" className="px-3 py-1.5 text-sm hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                  <Hash className="h-3 w-3 mr-1" />
                  {tag.tag}
                  <span className="ml-2 text-[var(--text-muted)] text-xs">{tag.count}</span>
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
              <Sparkles className="h-5 w-5" style={{ color: "var(--accent)" }} />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">People you might vibe with</h2>
            </div>
          </div>
          <ExploreUsersGrid users={suggestedUsers} currentUserId={user.id} />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main content - Trending Posts */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5" style={{ color: "var(--accent)" }} />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Trending</h2>
            </div>
            <div className="space-y-4">
              {posts.length > 0 ? (
                                posts.map((post) => (
                                  <PostCard key={post.id} post={post} currentUserId={user.id} />
                ))
              ) : (
                <div className="text-center py-16 text-[var(--text-muted)]">
                  <Compass className="h-12 w-12 mx-auto mb-4 text-[var(--text-muted)]" />
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
            <div className="rounded-2xl glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-5 w-5" style={{ color: "var(--accent)" }} />
                <h3 className="font-semibold text-[var(--text-primary)]">Rising communities</h3>
              </div>
              <div className="space-y-3">
                {trendingCommunities.slice(0, 5).map((community: { id: string; name: string; slug: string; _count: { members: number; posts: number } }) => (
                  <Link key={community.id} href={`/communities/${community.slug}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: "var(--brand-gradient)" }}>
                      {community.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-[var(--text-primary)] truncate">{community.name}</h4>
                      <p className="text-xs text-[var(--text-muted)]">{community._count.members} members &middot; {community._count.posts} posts</p>
                    </div>
                  </Link>
                ))}
              </div>
              <Link href="/communities" className="flex items-center gap-1 text-sm mt-4 transition-colors" style={{ color: "var(--accent)" }}>
                View all communities <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
