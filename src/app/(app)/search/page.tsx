"use client";

import { useState, useTransition } from "react";
import { searchAll } from "@/lib/queries";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Search as SearchIcon, Users, FileText, Hash } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";

type SearchResults = {
  users: Array<{ id: string; username: string; displayName: string; avatarUrl: string | null; bio: string | null; isVerified: boolean; _count: { followers: number } }>;
  posts: Array<{ id: string; content: string; createdAt: Date; author: { id: string; username: string; displayName: string; avatarUrl: string | null }; _count: { comments: number; reactions: number } }>;
  communities: Array<{ id: string; name: string; slug: string; description: string | null; _count: { members: number } }>;
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults(null);
      return;
    }
    startTransition(async () => {
      const data = await searchAll(value);
      setResults(data as SearchResults);
    });
  };

  const hasResults = results && (results.users.length > 0 || results.posts.length > 0 || results.communities.length > 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100 mb-4">Search</h1>
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search people, posts, communities..."
            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl pl-12 pr-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
            autoFocus
          />
        </div>
      </div>

      {isPending && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isPending && results && hasResults && (
        <div className="space-y-8">
          {/* People */}
          {results.users.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">People</h2>
              </div>
              <div className="space-y-1">
                {results.users.map((user) => (
                  <Link
                    key={user.id}
                    href={`/profile/${user.username}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-800/50 transition-colors"
                  >
                    <Avatar src={user.avatarUrl} alt={user.displayName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-zinc-100">{user.displayName}</h3>
                      <p className="text-xs text-zinc-500">@{user.username}</p>
                    </div>
                    <span className="text-xs text-zinc-500">{user._count.followers} followers</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Communities */}
          {results.communities.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Hash className="h-4 w-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Communities</h2>
              </div>
              <div className="space-y-1">
                {results.communities.map((community) => (
                  <Link
                    key={community.id}
                    href={`/communities/${community.slug}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                      {community.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-zinc-100">{community.name}</h3>
                      {community.description && (
                        <p className="text-xs text-zinc-500 truncate">{community.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-zinc-500">{community._count.members} members</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Posts */}
          {results.posts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Posts</h2>
              </div>
              <div className="space-y-1">
                {results.posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/feed/${post.id}`}
                    className="block p-3 rounded-xl hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Avatar src={post.author.avatarUrl} alt={post.author.displayName} size="xs" />
                      <span className="text-xs font-medium text-zinc-300">{post.author.displayName}</span>
                      <span className="text-xs text-zinc-600">{formatRelativeTime(post.createdAt)}</span>
                    </div>
                    <p className="text-sm text-zinc-400 line-clamp-2">{post.content}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!isPending && results && !hasResults && (
        <EmptyState
          icon={SearchIcon}
          title="No results found"
          description={`Nothing matched "${query}". Try a different search.`}
        />
      )}

      {!results && !isPending && (
        <div className="text-center py-16">
          <SearchIcon className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-500">Search for people, posts, and communities</p>
        </div>
      )}
    </div>
  );
}
