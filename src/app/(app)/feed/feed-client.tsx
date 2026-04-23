"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { PostComposer } from "@/components/feed/post-composer";
import { PostCard } from "@/components/feed/post-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FileText,
  LayoutGrid,
  LayoutList,
  Smartphone,
  MessageSquare,
  Loader2,
  Heart,
  MessageCircle,
  ExternalLink,
  Sparkles,
  Waypoints,
  RadioTower,
} from "lucide-react";

type FeedLayout = "timeline" | "grid" | "reels" | "compact" | "cards";
type FeedSource = "all" | "following" | "discover";

const LAYOUT_OPTIONS: { id: FeedLayout; label: string; icon: React.ElementType; description: string; inspired: string }[] = [
  { id: "timeline", label: "Timeline", icon: LayoutList, description: "Classic flowing updates", inspired: "X style" },
  { id: "cards", label: "Cards", icon: FileText, description: "Large social cards", inspired: "Facebook style" },
  { id: "grid", label: "Grid", icon: LayoutGrid, description: "Visual collection view", inspired: "Instagram style" },
  { id: "compact", label: "Compact", icon: MessageSquare, description: "Dense discussion view", inspired: "Forum style" },
  { id: "reels", label: "Reels", icon: Smartphone, description: "Vertical immersive view", inspired: "Short video style" },
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

const sourceMeta: Record<FeedSource, { label: string; copy: string }> = {
  all: {
    label: "For You",
    copy: "A blended view of your Mesh, connected platforms, and discovery signals.",
  },
  following: {
    label: "Following",
    copy: "People, communities, and creators you already chose to keep close.",
  },
  discover: {
    label: "Discover",
    copy: "Find new branches of the internet without leaving your unified home base.",
  },
};

export function FeedClient({ user, initialPosts }: FeedClientProps) {
  const [layout, setLayout] = useState<FeedLayout>("cards");
  const [source, setSource] = useState<FeedSource>("all");
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialPosts.length >= 20);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingSource, setLoadingSource] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("meshFeedLayout");
      if (saved && LAYOUT_OPTIONS.some((item) => item.id === saved)) {
        setLayout(saved as FeedLayout);
      }
    } catch {
      // ignore localStorage failures
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("meshFeedLayout", layout);
  }, [layout]);

  const lastLoadTime = useRef(0);

  const fetchFeedPage = useCallback(async (nextPage: number, nextSource: FeedSource) => {
    const res = await fetch(`/api/feed/paginated?page=${nextPage}&limit=20&source=${nextSource}`);
    if (!res.ok) return null;
    return res.json() as Promise<{ posts: FeedClientProps["initialPosts"]; hasMore: boolean }>;
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

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
    } catch {
      // ignore fetch failures
    } finally {
      setLoadingMore(false);
    }
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

  useEffect(() => {
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
          void loadMore();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore, layout]);

  const activeLayout = LAYOUT_OPTIONS.find((item) => item.id === layout) || LAYOUT_OPTIONS[0];

  return (
    <div data-meshi-zone="feed" className="mx-auto max-w-6xl px-4 py-6 animate-page-enter">
      <section className="mb-6 rounded-[1.75rem] border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5 shadow-[var(--shadow-md)]">
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--accent-muted)] bg-[var(--accent-subtle)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              <RadioTower className="h-3.5 w-3.5" />
              Unified content layer
            </div>
            <h1 className="text-3xl font-black text-[var(--text-primary)] md:text-4xl">Feed</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              The Feed makes Mesh.me instantly familiar without losing the bigger product vision underneath.
              Scroll the internet your way while staying connected to the same world as the Mesh.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/60 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Current source</p>
              <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">{sourceMeta[source].label}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/60 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Layout</p>
              <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">{activeLayout.label}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/60 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Visible posts</p>
              <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">{posts.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <div className="rounded-[1.5rem] border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4">
            <PostComposer
              user={{
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
              }}
            />
          </div>

          {posts.length > 0 ? (
            <>
              <div className="sticky top-4 z-20 rounded-[1.5rem] border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4 shadow-[var(--shadow-md)] backdrop-blur-xl">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {sourceMeta[source].label}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                      {sourceMeta[source].copy}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(["all", "following", "discover"] as FeedSource[]).map((src) => (
                      <button
                        key={src}
                        onClick={() => void handleSourceChange(src)}
                        disabled={loadingSource && source === src}
                        className={
                          "rounded-full px-3 py-1.5 text-xs font-semibold transition-all " +
                          (
                            src === source
                              ? "bg-[var(--accent)] text-white"
                              : "border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          )
                        }
                      >
                        {src === "all" ? "For You" : src === "following" ? "Following" : "Discover"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {LAYOUT_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = layout === option.id;

                    return (
                      <button
                        key={option.id}
                        onClick={() => setLayout(option.id)}
                        className={
                          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all " +
                          (
                            active
                              ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                              : "border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          )
                        }
                        title={`${option.label} • ${option.description}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {option.label}
                      </button>
                    );
                  })}

                  {loadingSource && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Refreshing
                    </span>
                  )}
                </div>
              </div>

              {layout === "timeline" && (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} currentUserId={user.id} />
                  ))}
                </div>
              )}

              {layout === "cards" && (
                <div className="space-y-6">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} currentUserId={user.id} />
                  ))}
                </div>
              )}

              {layout === "grid" && (
                <div className="grid grid-cols-2 gap-2 overflow-hidden rounded-[1.5rem] md:grid-cols-3">
                  {posts.map((post) => (
                    <Link key={post.id} href={`/feed/${post.id}`}>
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl bg-[var(--bg-secondary)]"
                      >
                        {post.media.length > 0 ? (
                          <Image
                            src={post.media[0].url}
                            alt=""
                            fill
                            sizes="(max-width: 768px) 50vw, 33vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center p-4">
                            <p className="line-clamp-6 text-center text-[12px] leading-5 text-[var(--text-secondary)]">
                              {post.content}
                            </p>
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="flex items-center gap-1 text-xs font-semibold text-white">
                            <Heart className="h-3.5 w-3.5" />
                            {post._count.reactions}
                          </span>
                          <span className="flex items-center gap-1 text-xs font-semibold text-white">
                            <MessageCircle className="h-3.5 w-3.5" />
                            {post._count.comments}
                          </span>
                        </div>
                      </motion.div>
                    </Link>
                  ))}
                </div>
              )}

              {layout === "reels" && (
                <div className="scrollbar-hide -mx-4 h-[calc(100vh-10rem)] snap-y snap-mandatory overflow-y-auto sm:-mx-0">
                  {posts.map((post) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      className="relative mb-2 min-h-[calc(100vh-10rem)] snap-start snap-always overflow-hidden border border-[var(--border-primary)] bg-[var(--bg-secondary)] sm:rounded-[1.5rem]"
                    >
                      {post.media.length > 0 ? (
                        <Image src={post.media[0].url} alt="" fill sizes="100vw" className="absolute inset-0 object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[var(--bg-secondary)] to-[var(--bg-tertiary)] p-8">
                          <p className="text-center text-lg font-medium leading-relaxed text-[var(--text-primary)]">
                            {post.content}
                          </p>
                        </div>
                      )}

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-4 pt-20">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
                            {post.author.displayName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{post.author.displayName}</p>
                            <p className="text-xs text-white/65">@{post.author.username}</p>
                          </div>
                        </div>
                        {post.content && (
                          <p className="mt-3 max-w-lg text-sm text-white/90">{post.content}</p>
                        )}
                      </div>

                      <div className="absolute bottom-16 right-3 flex flex-col items-center gap-4">
                        <Link
                          href={`/feed/${post.id}`}
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/30"
                          aria-label="Open post"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                        <div className="flex flex-col items-center gap-1 text-white/90">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                            <Heart className="h-4 w-4" />
                          </div>
                          <span className="text-[10px]">{post._count.reactions}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-white/90">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                            <MessageCircle className="h-4 w-4" />
                          </div>
                          <span className="text-[10px]">{post._count.comments}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  <div ref={layout === "reels" ? loadMoreRef : undefined} className="flex justify-center py-8 snap-start">
                    {loadingMore && (
                      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading more...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {layout === "compact" && (
                <div className="space-y-1 rounded-[1.5rem] border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-2">
                  {posts.map((post) => (
                    <Link key={post.id} href={`/feed/${post.id}`}>
                      <div className="group flex items-start gap-3 rounded-2xl px-4 py-3 transition hover:bg-[var(--bg-tertiary)]">
                        <div className="flex flex-col items-center gap-0.5 text-[var(--text-muted)]">
                          <button className="text-xs transition-colors hover:text-[var(--accent)]">▲</button>
                          <span className="text-xs font-bold text-[var(--text-secondary)]">{post._count.reactions}</span>
                          <button className="text-xs transition-colors hover:text-red-400">▼</button>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent)]">
                            {post.content}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
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

                        {post.media.length > 0 && (
                          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl">
                            <Image src={post.media[0].url} alt="" fill sizes="64px" className="object-cover" />
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              <div ref={layout !== "reels" ? loadMoreRef : undefined} className="flex justify-center py-8">
                {loadingMore && (
                  <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading more posts...
                  </div>
                )}
                {!hasMore && posts.length > 5 && (
                  <p className="text-xs text-[var(--text-muted)]">You have reached the end of this surface.</p>
                )}
              </div>
            </>
          ) : (
            <EmptyState
              icon={FileText}
              title="Your feed is empty"
              description="Follow people, join communities, and connect platforms to fill your feed with content from across the internet."
            >
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/explore"
                  className="brand-button inline-flex rounded-xl px-6 py-2.5 text-sm font-medium text-white transition-all"
                >
                  Explore the Mesh
                </Link>
                <Link
                  href="/connected-accounts"
                  className="glass-surface inline-flex rounded-xl px-6 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-all hover:text-[var(--text-primary)]"
                >
                  Connect Platforms
                </Link>
              </div>
            </EmptyState>
          )}
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-4 space-y-4">
            <div className="rounded-[1.5rem] border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
              <div className="mb-3 flex items-center gap-2">
                <Waypoints className="h-4 w-4 text-[var(--accent)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Why the Feed exists
                </p>
              </div>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                The Feed lowers the barrier to entry. It makes Mesh.me feel instantly usable while the Mesh remains the
                deeper signature experience.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Layout freedom
                </p>
              </div>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                Your world should adapt to how you naturally consume content. That is the entire point of
                “Your World, Your Way.”
              </p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
