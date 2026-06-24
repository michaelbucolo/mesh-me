"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
} from "lucide-react";

type FeedLayout = "timeline" | "grid" | "reels" | "compact" | "cards";
type FeedSource = "all" | "following" | "discover";
type FeedFilter = "all" | "video" | "photos" | "clean";

const LAYOUT_OPTIONS: { id: FeedLayout; label: string; icon: React.ElementType }[] = [
  { id: "timeline", label: "Timeline", icon: LayoutList },
  { id: "cards", label: "Cards", icon: FileText },
  { id: "grid", label: "Grid", icon: LayoutGrid },
  { id: "compact", label: "Compact", icon: MessageSquare },
  { id: "reels", label: "Reels", icon: Smartphone },
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
  const [layout, setLayout] = useState<FeedLayout>("timeline");
  const [source, setSource] = useState<FeedSource>("all");
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialPosts.length >= 20);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingSource, setLoadingSource] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const trendingTopics = useMemo(
    () =>
      ["Photography", "Web Development", "Privacy Tech", "Music Production", "Digital Art"].map(
        (name) => ({ name, postCount: Math.floor(Math.random() * 200 + 50) }),
      ),
    [],
  );

  const filteredPosts = useMemo(() => {
    if (filter === "all") return posts;
    if (filter === "video") return posts.filter((p) => p.media.some((m) => m.type.startsWith("video")));
    if (filter === "photos") return posts.filter((p) => p.media.some((m) => m.type.startsWith("image")));
    if (filter === "clean") return posts.filter((p) => p.media.length === 0);
    return posts;
  }, [posts, filter]);

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
      // ignore
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Filter tabs */}
      <nav className="mb-5 flex items-center gap-1 border-b border-[var(--mesh-border)] pb-px" aria-label="Feed filters">
        {(["all", "following", "discover"] as FeedSource[]).map((src) => (
          <button
            key={src}
            type="button"
            onClick={() => void handleSourceChange(src)}
            disabled={loadingSource}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              source === src
                ? "border-[var(--mesh-blue)] text-[var(--mesh-text)]"
                : "border-transparent text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text-secondary)]"
            }`}
          >
            {src === "all" ? "For You" : src === "following" ? "Following" : "Discover"}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1.5">
          {(["all", "video", "photos", "clean"] as FeedFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-[var(--mesh-blue)] text-white"
                  : "text-[var(--mesh-text-muted)] hover:bg-[var(--mesh-panel)] hover:text-[var(--mesh-text-secondary)]"
              }`}
            >
              {f === "all" ? "All" : f === "video" ? "Video" : f === "photos" ? "Photos" : "Clean Mode"}
            </button>
          ))}

          <div className="ml-2 flex items-center gap-0.5 rounded-lg border border-[var(--mesh-border)] p-0.5">
            {LAYOUT_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setLayout(option.id)}
                  className={`rounded-md p-1.5 transition-colors ${
                    layout === option.id
                      ? "bg-[var(--mesh-panel)] text-[var(--mesh-blue)]"
                      : "text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text-secondary)]"
                  }`}
                  title={option.label}
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main content */}
        <div className="min-w-0 space-y-4">
          {/* Composer */}
          <div className="rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-4">
            <PostComposer
              user={{
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
              }}
            />
          </div>

          {loadingSource && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--mesh-blue)]" />
            </div>
          )}

          {!loadingSource && filteredPosts.length > 0 ? (
            <>
              {layout === "timeline" && (
                <div className="space-y-3">
                  {filteredPosts.map((post) => (
                    <PostCard key={post.id} post={post} currentUserId={user.id} />
                  ))}
                </div>
              )}

              {layout === "cards" && (
                <div className="space-y-5">
                  {filteredPosts.map((post) => (
                    <PostCard key={post.id} post={post} currentUserId={user.id} />
                  ))}
                </div>
              )}

              {layout === "grid" && (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {filteredPosts.map((post) => (
                    <Link key={post.id} href={`/feed/${post.id}`}>
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)]"
                      >
                        {post.media.length > 0 ? (
                          <Image src={post.media[0].url} alt="" fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center p-4">
                            <p className="line-clamp-6 text-center text-xs leading-relaxed text-[var(--mesh-text-secondary)]">{post.content}</p>
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="flex items-center gap-1 text-xs font-bold text-white"><Heart size={14} />{post._count.reactions}</span>
                          <span className="flex items-center gap-1 text-xs font-bold text-white"><MessageCircle size={14} />{post._count.comments}</span>
                        </div>
                      </motion.div>
                    </Link>
                  ))}
                </div>
              )}

              {layout === "reels" && (
                <div className="scrollbar-hide -mx-4 h-[calc(100vh-10rem)] snap-y snap-mandatory overflow-y-auto sm:-mx-0">
                  {filteredPosts.map((post) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      className="relative mb-2 min-h-[calc(100vh-10rem)] snap-start snap-always overflow-hidden border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] sm:rounded-2xl"
                    >
                      {post.media.length > 0 ? (
                        <Image src={post.media[0].url} alt="" fill sizes="100vw" className="absolute inset-0 object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[var(--mesh-bg)] to-[var(--mesh-bg-deep)] p-8">
                          <p className="text-center text-lg font-medium leading-relaxed text-[var(--mesh-text)]">{post.content}</p>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-4 pt-20">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--mesh-blue)] text-xs font-bold text-white">{post.author.displayName[0]}</div>
                          <div>
                            <p className="text-sm font-bold text-white">{post.author.displayName}</p>
                            <p className="text-xs text-white/65">@{post.author.username}</p>
                          </div>
                        </div>
                        {post.content && <p className="mt-3 max-w-lg text-sm text-white/90">{post.content}</p>}
                      </div>
                      <div className="absolute bottom-16 right-3 flex flex-col items-center gap-4">
                        <Link href={`/feed/${post.id}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/30" aria-label="Open post">
                          <ExternalLink size={16} />
                        </Link>
                        <div className="flex flex-col items-center gap-1 text-white/90">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur"><Heart size={16} /></div>
                          <span className="text-[10px]">{post._count.reactions}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-white/90">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur"><MessageCircle size={16} /></div>
                          <span className="text-[10px]">{post._count.comments}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  <div ref={layout === "reels" ? loadMoreRef : undefined} className="flex justify-center py-8 snap-start">
                    {loadingMore && (
                      <div className="flex items-center gap-2 text-sm text-[var(--mesh-text-muted)]">
                        <Loader2 size={16} className="animate-spin" /> Loading...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {layout === "compact" && (
                <div className="space-y-0.5 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-2">
                  {filteredPosts.map((post) => (
                    <Link key={post.id} href={`/feed/${post.id}`}>
                      <div className="group flex items-start gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-[var(--mesh-panel)]">
                        <div className="flex flex-col items-center gap-0.5 text-[var(--mesh-text-muted)]">
                          <button type="button" className="text-xs transition-colors hover:text-[var(--mesh-blue)]">▲</button>
                          <span className="text-xs font-bold text-[var(--mesh-text-secondary)]">{post._count.reactions}</span>
                          <button type="button" className="text-xs transition-colors hover:text-[var(--mesh-danger)]">▼</button>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm text-[var(--mesh-text)] group-hover:text-[var(--mesh-blue)]">{post.content}</p>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--mesh-text-muted)]">
                            <span>by {post.author.displayName}</span>
                            <span>·</span>
                            <span>{post._count.comments} comments</span>
                            {post.community && (
                              <>
                                <span>·</span>
                                <span className="text-[var(--mesh-blue)]">{post.community.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {post.media.length > 0 && (
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                            <Image src={post.media[0].url} alt="" fill sizes="56px" className="object-cover" />
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              <div ref={layout !== "reels" ? loadMoreRef : undefined} className="flex justify-center py-6">
                {loadingMore && (
                  <div className="flex items-center gap-2 text-sm text-[var(--mesh-text-muted)]">
                    <Loader2 size={16} className="animate-spin" /> Loading more...
                  </div>
                )}
                {!hasMore && filteredPosts.length > 5 && (
                  <p className="text-xs text-[var(--mesh-text-muted)]">You have reached the end.</p>
                )}
              </div>
            </>
          ) : !loadingSource ? (
            <EmptyState
              icon={FileText}
              title="Your feed is empty"
              description="Follow people, join communities, and connect platforms to fill your feed."
            >
              <div className="flex flex-wrap gap-3">
                <Link href="/explore" className="rounded-xl bg-[var(--mesh-blue)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--mesh-blue)]/90">
                  Explore the Mesh
                </Link>
                <Link href="/connected-accounts" className="rounded-xl border border-[var(--mesh-border)] px-5 py-2.5 text-sm font-medium text-[var(--mesh-text)] transition-colors hover:bg-[var(--mesh-panel)]">
                  Connect Platforms
                </Link>
              </div>
            </EmptyState>
          ) : null}
        </div>

        {/* Right sidebar */}
        <aside className="hidden xl:block">
          <div className="sticky top-20 space-y-4">
            {/* Trending / suggestions */}
            <section className="rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5">
              <h3 className="mb-3 text-sm font-bold text-[var(--mesh-text)]">Trending on Mesh</h3>
              <div className="space-y-3">
                {trendingTopics.map((topic) => (
                  <div key={topic.name} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--mesh-text)]">{topic.name}</p>
                      <p className="text-[10px] text-[var(--mesh-text-muted)]">{topic.postCount} posts</p>
                    </div>
                    <span className="text-[10px] text-[var(--mesh-text-muted)]">Trending</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5">
              <h3 className="mb-3 text-sm font-bold text-[var(--mesh-text)]">Who to follow</h3>
              <div className="space-y-3">
                <p className="text-xs text-[var(--mesh-text-muted)]">Suggestions based on your mesh connections will appear here.</p>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
