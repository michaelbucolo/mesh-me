"use client";

import { useState, useTransition, useCallback } from "react";
import { searchAll } from "@/lib/queries";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Search as SearchIcon, Users, FileText, Hash, Clock, X, TrendingUp } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";

type SearchResults = {
  users: Array<{ id: string; username: string; displayName: string; avatarUrl: string | null; bio: string | null; isVerified: boolean; _count: { followers: number } }>;
  posts: Array<{ id: string; content: string; createdAt: Date; author: { id: string; username: string; displayName: string; avatarUrl: string | null }; _count: { comments: number; reactions: number } }>;
  communities: Array<{ id: string; name: string; slug: string; description: string | null; _count: { members: number } }>;
};

const SUGGESTED_SEARCHES = ["music", "gaming", "art", "tech", "photography", "design", "fitness", "travel"];

function getInitialRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem("mesh_recent_searches");
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isPending, startTransition] = useTransition();
  const [recentSearches, setRecentSearches] = useState<string[]>(getInitialRecentSearches);
  const [activeTab, setActiveTab] = useState<"all" | "people" | "posts" | "communities">("all");

  const saveSearch = useCallback((q: string) => {
    const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 8);
    setRecentSearches(updated);
    try { localStorage.setItem("mesh_recent_searches", JSON.stringify(updated)); } catch {}
  }, [recentSearches]);

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try { localStorage.removeItem("mesh_recent_searches"); } catch {}
  };

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) { setResults(null); return; }
    startTransition(async () => {
      const data = await searchAll(value);
      setResults(data as SearchResults);
      saveSearch(value.trim());
    });
  };

  const hasResults = results && (results.users.length > 0 || results.posts.length > 0 || results.communities.length > 0);
  const totalResults = results ? results.users.length + results.posts.length + results.communities.length : 0;

  const filteredResults = results ? {
    users: activeTab === "all" || activeTab === "people" ? results.users : [],
    posts: activeTab === "all" || activeTab === "posts" ? results.posts : [],
    communities: activeTab === "all" || activeTab === "communities" ? results.communities : [],
  } : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Search</h1>
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search people, posts, communities, tags..."
            className="w-full glass-surface rounded-xl pl-12 pr-10 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            autoFocus
          />
          {query && (
            <button onClick={() => { setQuery(""); setResults(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      {results && hasResults && (
        <div className="flex items-center gap-1 mb-6 p-1 rounded-xl glass-surface">
          {([
            { id: "all" as const, label: "All", count: totalResults },
            { id: "people" as const, label: "People", count: results.users.length },
            { id: "posts" as const, label: "Posts", count: results.posts.length },
            { id: "communities" as const, label: "Communities", count: results.communities.length },
          ]).map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? "bg-[var(--bg-hover)] text-[var(--text-primary)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"}`}>
              {tab.label} {tab.count > 0 && <span className="ml-1 text-xs text-[var(--text-muted)]">({tab.count})</span>}
            </button>
          ))}
        </div>
      )}

      {isPending && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isPending && filteredResults && hasResults && (
        <div className="space-y-8">
          {filteredResults.users.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">People</h2>
              </div>
              <div className="space-y-1">
                {filteredResults.users.map((user) => (
                  <Link key={user.id} href={`/profile/${user.username}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors">
                    <Avatar src={user.avatarUrl} alt={user.displayName} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{user.displayName}</h3>
                        {user.isVerified && <svg className="h-3.5 w-3.5 text-blue-400" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">@{user.username}</p>
                      {user.bio && <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">{user.bio}</p>}
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">{user._count.followers} followers</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {filteredResults.communities.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Hash className="h-4 w-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Communities</h2>
              </div>
              <div className="space-y-1">
                {filteredResults.communities.map((community) => (
                  <Link key={community.id} href={`/communities/${community.slug}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{community.name[0]}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{community.name}</h3>
                      {community.description && <p className="text-xs text-[var(--text-muted)] truncate">{community.description}</p>}
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">{community._count.members} members</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {filteredResults.posts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Posts</h2>
              </div>
              <div className="space-y-1">
                {filteredResults.posts.map((post) => (
                  <Link key={post.id} href={`/feed/${post.id}`} className="block p-3 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <Avatar src={post.author.avatarUrl} alt={post.author.displayName} size="xs" />
                      <span className="text-xs font-medium text-[var(--text-secondary)]">{post.author.displayName}</span>
                      <span className="text-xs text-[var(--text-muted)]">{formatRelativeTime(post.createdAt)}</span>
                    </div>
                    <p className="text-sm text-[var(--text-tertiary)] line-clamp-2">{post.content}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                      <span>{post._count.reactions} likes</span>
                      <span>{post._count.comments} comments</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!isPending && results && !hasResults && (
        <EmptyState icon={SearchIcon} title="No results found" description="Nothing matched your search. Try a different term." />
      )}

      {/* Initial state */}
      {!results && !isPending && (
        <div className="space-y-8">
          {recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[var(--text-muted)]" />
                  <h2 className="text-sm font-medium text-[var(--text-tertiary)]">Recent searches</h2>
                </div>
                <button onClick={clearRecentSearches} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">Clear all</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search) => (
                  <button key={search} onClick={() => handleSearch(search)} className="px-3 py-1.5 rounded-lg glass-surface text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-secondary)] transition-colors">{search}</button>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              <h2 className="text-sm font-medium text-[var(--text-tertiary)]">Suggested searches</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_SEARCHES.map((tag) => (
                <button key={tag} onClick={() => handleSearch(tag)} className="px-3 py-1.5 rounded-lg glass-surface text-sm text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-primary)] transition-colors">
                  <Hash className="h-3 w-3 inline mr-1" />{tag}
                </button>
              ))}
            </div>
          </div>
          <div className="text-center pt-8">
            <SearchIcon className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-4" />
            <p className="text-[var(--text-muted)] text-sm">Search for people, posts, communities, and tags</p>
          </div>
        </div>
      )}
    </div>
  );
}
