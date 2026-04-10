"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PostComposer } from "@/components/feed/post-composer";
import { PostCard } from "@/components/feed/post-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FileText, LayoutGrid, LayoutList, Smartphone, MessageSquare, Loader2, Heart, MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { WelcomeBanner } from "@/components/ui/welcome-banner";
import { Sparkles } from "lucide-react";

// Feed layout modes inspired by popular platforms
type FeedLayout = "timeline" | "grid" | "reels" | "compact" | "cards";
type FeedSource = "all" | "following" | "discover";

const LAYOUT_OPTIONS: { id: FeedLayout; label: string; icon: React.ElementType; description: string; inspired: string }[] = [
  { id: "timeline", label: "Timeline", icon: LayoutList, description: "Classic scrolling feed", inspired: "X / Twitter" },
  { id: "grid", label: "Grid", icon: LayoutGrid, description: "Visual grid layout", inspired: "Instagram" },
  { id: "reels", label: "Reels", icon: Smartphone, description: "Full-screen vertical scroll", inspired: "Instagram Reels / TikTok" },
  { id: "compact", label: "Compact", icon: MessageSquare, description: "Dense thread view", inspired: "Reddit" },
  { id: "cards", label: "Cards", icon: FileText, description: "Large card format", inspired: "Facebook" },
];


interface FeedClientProps {
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  initialPosts: Array<{
    id: string;
    content: string;
    createdAt: Date | string;
    author: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      isVerified: boolean;
    };
    community?: { id: string; name: string; slug: string } | null;
    media: { id: string; url: string; type: string }[];
    tags: { id: string; tag: string }[];
    _count: { comments: number; reactions: number; reposts: number };
    reactions?: { id: string }[];
    savedBy?: { id: string }[];
    isPinned?: boolean;
  }>;
}

export function FeedClient({ user, initialPosts }: FeedClientProps) {
  const [layout, setLayout] = useState<FeedLayout>("reels");
  const [source, setSource] = useState<FeedSource>("all");
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialPosts.length >= 20);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingSource, setLoadingSource] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const activeLayoutOption = LAYOUT_OPTIONS.find((opt) => opt.id === layout) ?? LAYOUT_OPTIONS[0];

  // Load saved layout preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem("meshFeedLayout");
      if (saved && LAYOUT_OPTIONS.some((l) => l.id === saved)) {
        setLayout(saved as FeedLayout);
      }
    } catch { /* ignore */ }
  }, []);

  // Save layout preference
  useEffect(() => {
    localStorage.setItem("meshFeedLayout", layout);
  }, [layout]);

  // Cooldown ref to prevent rapid-fire loading (especially in reels layout)
  const lastLoadTime = useRef(0);

  const fetchFeedPage = useCallback(async (nextPage: number, nextSource: FeedSource) => {
    const res = await fetch(`/api/feed/paginated?page=${nextPage}&limit=20&source=${nextSource}`);
    if (!res.ok) return null;
    return res.json() as Promise<{ posts: FeedClientProps["initialPosts"]; hasMore: boolean }>;
  }, []);

  // Infinite scroll — load more posts
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    // Enforce 1s cooldown between loads
    const now = Date.now();
    if (now - lastLoadTime.current < 1000) return;
    lastLoadTime.current = now;

    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await fetchFeedPage(nextPage, source);
      if (data?.posts && data.posts.length > 0) {
        setPosts((prev) => [...prev, ...data.posts]);
        setPage(nextPage);
        setHasMore(data.hasMore);
      } else {
        setHasMore(false);
      }
    } catch { /* ignore */ }
    setLoadingMore(false);
  }, [page, hasMore, loadingMore, fetchFeedPage, source]);

  const handleSourceChange = useCallback(async (nextSource: FeedSource) => {
    if (loadingSource || nextSource === source) return;
    setSource(nextSource);
    setLoadingSource(true);
    setPage(1);
    setHasMore(true);
    lastLoadTime.current = 0;

    try {
      const data = await fetchFeedPage(1, nextSource);
      setPosts(data?.posts ?? []);
      setHasMore(data?.hasMore ?? false);
    } catch {
      setPosts([]);
      setHasMore(false);
    } finally {
      setLoadingSource(false);
    }
  }, [fetchFeedPage, loadingSource, source]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore, layout]);

  return (
    <div data-meshi-zone="feed" className="max-w-3xl mx-auto px-4 py-6 animate-page-enter">
      {/* Clean header with inline layout toggle */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Feed</h1>
        <div className="text-right">
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "var(--bg-secondary)" }}>
            {LAYOUT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => setLayout(opt.id)}
                  className={"p-2 rounded-lg transition-all " + (
                    layout === opt.id
                      ? "bg-[var(--accent)] text-white shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                  title={opt.label + " — " + opt.description}
                  aria-label={`${opt.label} layout`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            {activeLayoutOption.label}: {activeLayoutOption.description}
          </p>
        </div>
      </div>

      {/* First-time welcome banner */}
      <WelcomeBanner
        storageKey="feed"
        icon={Sparkles}
        title="Welcome to your Feed"
        description="This is where posts from people you follow and communities you've joined appear. You can switch between 5 different layout styles!"
        tips={[
          "Use the layout icons (top-right) to switch between Timeline, Grid, Reels, Compact, and Cards views",
          "Create your first post using the composer below",
          "Explore the mesh to find people and communities to follow",
        ]}
        action={{ label: "Explore the mesh \u2192", onClick: () => window.location.href = "/explore" }}
      />

      {/* Composer */}
      <div className="mb-6">
        <PostComposer
          user={{
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
          }}
        />
      </div>

      {/* Feed source tabs */}
      <div className="flex items-center gap-2 mb-4">
        {(["all", "following", "discover"] as FeedSource[]).map((src) => (
          <button
            key={src}
            onClick={() => handleSourceChange(src)}
            disabled={loadingSource}
            className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-all " + (
              src === source
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
            )}
            aria-pressed={src === source}
          >
            {src === "all" ? "For You" : src === "following" ? "Following" : "Discover"}
          </button>
        ))}
        {loadingSource && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Refreshing
          </span>
        )}
      </div>

      {/* Feed content — layout-dependent rendering */}
      {posts.length > 0 ? (
        <>
          {/* Timeline layout (X/Twitter style) */}
          {layout === "timeline" && (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} currentUserId={user.id} />
              ))}
            </div>
          )}

          {/* Grid layout (Instagram style) */}
          {layout === "grid" && (
            <div className="grid grid-cols-3 gap-1 rounded-xl overflow-hidden">
              {posts.map((post) => (
                <Link key={post.id} href={`/feed/${post.id}`}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="aspect-square bg-[var(--bg-secondary)] relative group cursor-pointer overflow-hidden"
                  >
                    {post.media.length > 0 ? (
                      <img src={post.media[0].url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-3">
                        <p className="text-[11px] text-[var(--text-secondary)] text-center line-clamp-5 leading-relaxed">{post.content}</p>
                      </div>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <span className="text-white text-xs font-medium flex items-center gap-1">❤️ {post._count.reactions}</span>
                      <span className="text-white text-xs font-medium flex items-center gap-1">💬 {post._count.comments}</span>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          )}

          {/* Reels layout (TikTok/IG Reels style - full width snap-scroll cards) */}
          {layout === "reels" && (
            <div className="snap-y snap-mandatory overflow-y-auto h-[calc(100vh-10rem)] scrollbar-hide -mx-4 sm:-mx-0">
              {posts.map((post) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  className="relative bg-[var(--bg-secondary)] snap-start snap-always overflow-hidden border-b border-[var(--border-primary)] sm:rounded-2xl sm:border sm:mb-2"
                  style={{ minHeight: "calc(100vh - 10rem)" }}
                >
                  {post.media.length > 0 ? (
                    <img src={post.media[0].url} alt="" className="w-full h-full object-cover absolute inset-0" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-secondary)] to-[var(--bg-tertiary)] flex items-center justify-center p-8">
                      <p className="text-lg text-[var(--text-primary)] text-center leading-relaxed font-medium">{post.content}</p>
                    </div>
                  )}
                  {/* Bottom overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-16">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">
                        {post.author.displayName[0]}
                      </div>
                      <div>
                        <p className="text-white text-sm font-semibold">{post.author.displayName}</p>
                        <p className="text-white/60 text-xs">@{post.author.username}</p>
                      </div>
                    </div>
                    {post.content && <p className="text-white/90 text-sm line-clamp-2">{post.content}</p>}
                  </div>
                  {/* Side action bar */}
                  <div className="absolute right-3 bottom-20 flex flex-col items-center gap-4">
                    <Link href={`/feed/${post.id}`} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-all">
                      <Heart className="h-4 w-4" />
                    </Link>
                    <span className="text-white text-[10px]">{post._count.reactions}</span>
                    <Link href={`/feed/${post.id}`} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-all">
                      <MessageCircle className="h-4 w-4" />
                    </Link>
                    <span className="text-white text-[10px]">{post._count.comments}</span>
                  </div>
                </motion.div>
              ))}
              {/* Reels-specific infinite scroll trigger (inside the scroll container) */}
              <div ref={layout === "reels" ? loadMoreRef : undefined} className="py-8 flex justify-center snap-start">
                {loadingMore && (
                  <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading more...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compact layout (Reddit style) */}
          {layout === "compact" && (
            <div className="space-y-1">
              {posts.map((post) => (
                <Link key={post.id} href={`/feed/${post.id}`}>
                  <div className="flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-[var(--bg-tertiary)] transition-all cursor-pointer group">
                    {/* Vote column */}
                    <div className="flex flex-col items-center gap-0.5 text-[var(--text-muted)]">
                      <button className="hover:text-[var(--accent)] text-xs transition-colors">▲</button>
                      <span className="text-xs font-bold text-[var(--text-secondary)]">{post._count.reactions}</span>
                      <button className="hover:text-red-400 text-xs transition-colors">▼</button>
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-primary)] line-clamp-2 group-hover:text-[var(--accent)] transition-colors">{post.content}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--text-muted)]">
                        <span>by {post.author.displayName}</span>
                        <span>·</span>
                        <span>{post._count.comments} comments</span>
                        {post.community && (
                          <>
                            <span>·</span>
                            <span className="text-[var(--accent)]">{post.community.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Thumbnail */}
                    {post.media.length > 0 && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                        <img src={post.media[0].url} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Cards layout (Facebook style) */}
          {layout === "cards" && (
            <div className="space-y-6">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} currentUserId={user.id} />
              ))}
            </div>
          )}

          {/* Infinite scroll trigger (non-reels layouts) */}
          <div ref={layout !== "reels" ? loadMoreRef : undefined} className="py-8 flex justify-center">
            {loadingMore && (
              <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading more posts...
              </div>
            )}
            {!hasMore && posts.length > 5 && (
              <p className="text-xs text-[var(--text-muted)]">You&apos;ve reached the end</p>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          icon={FileText}
          title="Your feed is empty"
          description="Follow people, join communities, and connect platforms to fill your feed with content from across the internet."
        >
          <div className="flex gap-3">
            <Link
              href="/explore"
              className="inline-flex brand-button text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all"
            >
              Explore the Mesh
            </Link>
            <Link
              href="/connected-accounts"
              className="inline-flex glass-surface text-[var(--text-secondary)] px-6 py-2.5 rounded-xl text-sm font-medium transition-all hover:text-[var(--text-primary)]"
            >
              Connect Platforms
            </Link>
          </div>
        </EmptyState>
      )}
    </div>
  );
}
