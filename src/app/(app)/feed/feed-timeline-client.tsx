"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BarChart3, Bell, Camera, GalleryVerticalEnd, Grid3X3, Image as ImageIcon, LayoutList, Link2, Minimize2, MessageCircle, Play, PlusSquare, Rows3, Search, Sparkles, Type, Video } from "lucide-react";
import { FlowReels } from "./flow-reels";
import { PaperWait } from "@/components/loading/paper-wait";
import { PostCard } from "@/components/feed/post-card";
import { PostComposer } from "@/components/feed/post-composer";
import { UserMeshiBadge } from "@/components/meshi/meshi-identity";
import { MeshiMascot, type MeshiColor, type MeshiHat } from "@/components/meshi/meshi-mascot";
import { readGhostMode } from "@/lib/ghost-mode";
import { readWhereShare } from "@/lib/where-share";
import { getPostPresenceKey } from "@/lib/presence-keys";
import type { FeedContentFilter, FeedSource } from "@/lib/feed-data";

type FeedPost = {
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
  platform?: string;
  sourceId?: string;
  externalUrl?: string | null;
  platformPostId?: string;
  crossPostedTo?: string[];
  optimistic?: boolean;
  isNsfw?: boolean;
  contentRating?: string;
  visibility?: string;
};

type FeedUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

type FeedPresence = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  meshiColor: string;
  meshiHat: string;
  activePostId: string | null;
  surface?: "mesh" | "feed";
  viewportPosition: { vx: number; vy: number };
  isOnline: boolean;
};

type FeedLayoutMode = "timeline" | "compact" | "media";
type AdaptiveFeedMode = "classic" | "text" | "photo" | "video" | "creator" | "clean";

const PAGE_SIZE = 20;

const sourceFilters: Array<{ id: FeedSource; label: string; mobileHidden?: boolean }> = [
  { id: "all", label: "For you" },
  { id: "following", label: "Following" },
  { id: "discover", label: "Explore", mobileHidden: true },
];

const contentFilters: Array<{ id: FeedContentFilter; label: string; icon: typeof Sparkles }> = [
  { id: "all", label: "All", icon: Sparkles },
  { id: "mesh", label: "Mesh.me", icon: Grid3X3 },
  { id: "platforms", label: "Platforms", icon: Rows3 },
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "links", label: "Links", icon: Link2 },
];

const layoutModes: Array<{ id: FeedLayoutMode; label: string; icon: typeof LayoutList }> = [
  { id: "timeline", label: "Timeline", icon: LayoutList },
  { id: "compact", label: "Compact", icon: Rows3 },
  { id: "media", label: "Media", icon: GalleryVerticalEnd },
];

const adaptiveModes: Array<{
  id: AdaptiveFeedMode;
  label: string;
  copy: string;
  icon: typeof LayoutList;
  contentFilter: FeedContentFilter;
  layoutMode: FeedLayoutMode;
}> = [
  { id: "classic", label: "Classic", copy: "Balanced social feed", icon: LayoutList, contentFilter: "all", layoutMode: "timeline" },
  { id: "text", label: "Text", copy: "Fast posts and thoughts", icon: Type, contentFilter: "text", layoutMode: "compact" },
  { id: "photo", label: "Photo", copy: "Visual browsing", icon: Camera, contentFilter: "photos", layoutMode: "media" },
  { id: "video", label: "Video", copy: "Watch-first stream", icon: Video, contentFilter: "videos", layoutMode: "media" },
  { id: "creator", label: "Creator", copy: "Performance context", icon: BarChart3, contentFilter: "all", layoutMode: "timeline" },
  { id: "clean", label: "Clean", copy: "Calm, fewer controls", icon: Minimize2, contentFilter: "all", layoutMode: "timeline" },
];

function getFeedPresenceKey(post: Pick<FeedPost, "id" | "platform" | "sourceId"> | null | undefined) {
  if (!post?.id) return null;
  return getPostPresenceKey({
    id: post.id,
    platform: post.platform,
    sourceId: post.sourceId,
    sourceType: post.platform && post.platform !== "meshme" ? "platform" : "mesh",
  });
}

function mergeUniquePosts(current: FeedPost[], incoming: FeedPost[]) {
  const byId = new Map<string, FeedPost>();
  for (const post of current) byId.set(post.id, post);
  for (const post of incoming) byId.set(post.id, post);
  return [...byId.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function sourceHref(source: FeedSource, contentFilter: FeedContentFilter) {
  const params = new URLSearchParams({ source });
  if (contentFilter !== "all") params.set("content", contentFilter);
  return `/feed?${params.toString()}`;
}

export function FeedTimelineClient({
  user,
  initialPosts,
  initialHasMore,
  source,
  initialContentFilter,
  connectedPlatforms,
}: {
  user: FeedUser;
  initialPosts: FeedPost[];
  initialHasMore: boolean;
  source: FeedSource;
  initialContentFilter: FeedContentFilter;
  connectedPlatforms: string[];
}) {
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [contentFilter, setContentFilter] = useState<FeedContentFilter>(initialContentFilter);
  const [layoutMode, setLayoutMode] = useState<FeedLayoutMode>("timeline");
  const [adaptiveMode, setAdaptiveMode] = useState<AdaptiveFeedMode>("classic");
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingFilter, setLoadingFilter] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [activeFeedItemId, setActiveFeedItemId] = useState<string | null>(initialPosts[0]?.id ?? null);
  const [reelsOpen, setReelsOpen] = useState(false);
  const [samePostPresences, setSamePostPresences] = useState<FeedPresence[]>([]);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const lastLoadTime = useRef(0);
  const activePost = useMemo(
    () => posts.find((post) => post.id === activeFeedItemId) || null,
    [activeFeedItemId, posts],
  );
  const isComposing = searchParams.get("compose") === "true";
  const flowPostId = searchParams.get("flow");
  useEffect(() => {
    if (!flowPostId) {
      setReelsOpen(false);
      return;
    }
    if (posts.some((post) => post.id === flowPostId)) {
      setActiveFeedItemId(flowPostId);
      setReelsOpen(true);
    } else {
      setReelsOpen(false);
    }
  }, [flowPostId, posts]);
  const closeReels = useCallback(() => {
    setReelsOpen(false);
    if (flowPostId) {
      const params = new URLSearchParams(window.location.search);
      params.delete("flow");
      const query = params.toString();
      window.history.replaceState(null, "", query ? `/feed?${query}` : "/feed");
    }
  }, [flowPostId]);
  const activePresencePostId = getFeedPresenceKey(activePost);
  const activeModeConfig = adaptiveModes.find((mode) => mode.id === adaptiveMode) || adaptiveModes[0];
  const ActiveModeIcon = activeModeConfig.icon;
  const feedStats = useMemo(() => {
    const nativePosts = posts.filter((post) => (post.platform?.toLowerCase() || "meshme") === "meshme").length;
    const platformPosts = posts.length - nativePosts;
    const mediaPosts = posts.filter((post) => post.media.some((item) => {
      const type = item.type.toLowerCase();
      return type === "image" || type === "photo" || type === "video" || type === "reel" || type === "short";
    })).length;
    const engagement = posts.reduce((total, post) => total + post._count.reactions + post._count.comments + post._count.reposts, 0);
    const comments = posts.reduce((total, post) => total + post._count.comments, 0);

    return { nativePosts, platformPosts, mediaPosts, engagement, comments };
  }, [posts]);

  useEffect(() => {
    setPosts(initialPosts);
    setPage(1);
    setHasMore(initialHasMore);
    setContentFilter(initialContentFilter);
    setFeedError("");
    setActiveFeedItemId(flowPostId ?? initialPosts[0]?.id ?? null);
  }, [initialContentFilter, initialHasMore, initialPosts, flowPostId]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mesh.feed.layout");
      if (saved === "timeline" || saved === "compact" || saved === "media") {
        setLayoutMode(saved);
      }
    } catch {
      /* ignore storage failures */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("mesh.feed.layout", layoutMode);
    } catch {
      /* ignore storage failures */
    }
  }, [layoutMode]);

  const fetchFeedPage = useCallback(async (nextPage: number, nextContentFilter: FeedContentFilter) => {
    const params = new URLSearchParams({
      page: String(nextPage),
      limit: String(PAGE_SIZE),
      source,
      content: nextContentFilter,
    });
    const response = await fetch(`/api/feed/paginated?${params.toString()}`, {
      cache: "no-store",
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error("Could not load the feed.");
    }

    return response.json() as Promise<{ posts: FeedPost[]; hasMore: boolean; nextPage: number | null }>;
  }, [source]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loadingFilter || !hasMore) return;
    const now = Date.now();
    if (now - lastLoadTime.current < 600) return;
    lastLoadTime.current = now;
    setLoadingMore(true);
    setFeedError("");

    try {
      const nextPage = page + 1;
      const data = await fetchFeedPage(nextPage, contentFilter);
      setPosts((current) => mergeUniquePosts(current, data.posts || []));
      setPage(nextPage);
      setHasMore(Boolean(data.hasMore));
    } catch {
      setFeedError("Feed could not load more posts. Try again.");
    } finally {
      setLoadingMore(false);
    }
  }, [contentFilter, fetchFeedPage, hasMore, loadingFilter, loadingMore, page]);

  const applyContentFilter = useCallback(async (nextContentFilter: FeedContentFilter) => {
    if (nextContentFilter === contentFilter || loadingFilter) return;
    setContentFilter(nextContentFilter);
    setLoadingFilter(true);
    setFeedError("");
    setPage(1);
    lastLoadTime.current = 0;

    try {
      const data = await fetchFeedPage(1, nextContentFilter);
      setPosts(data.posts || []);
      setHasMore(Boolean(data.hasMore));
      setActiveFeedItemId(data.posts?.[0]?.id ?? null);
      window.requestAnimationFrame(() => {
        timelineRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    } catch {
      setPosts([]);
      setHasMore(false);
      setFeedError("That feed filter could not load. Try another filter.");
    } finally {
      setLoadingFilter(false);
    }
  }, [contentFilter, fetchFeedPage, loadingFilter]);

  const applyAdaptiveMode = useCallback(async (nextMode: AdaptiveFeedMode) => {
    const config = adaptiveModes.find((mode) => mode.id === nextMode) || adaptiveModes[0];
    setAdaptiveMode(config.id);
    setLayoutMode(config.layoutMode);
    try {
      localStorage.setItem("mesh.feed.layout", config.layoutMode);
    } catch {
      /* ignore storage failures */
    }
    if (config.contentFilter !== contentFilter) {
      await applyContentFilter(config.contentFilter);
    }
  }, [applyContentFilter, contentFilter]);

  useEffect(() => {
    const root = timelineRef.current;
    if (!root) return;
    const visibleRatios = new Map<string, number>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.feedPostId;
        if (!id) continue;
        if (entry.isIntersecting) visibleRatios.set(id, entry.intersectionRatio);
        else visibleRatios.delete(id);
      }
      const [bestId] = [...visibleRatios.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
      if (bestId) setActiveFeedItemId(bestId);
    }, { threshold: [0.35, 0.55, 0.75], rootMargin: "-12% 0px -38% 0px" });

    const nodes = root.querySelectorAll<HTMLElement>("[data-feed-post-id]");
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [posts, layoutMode]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore();
    }, { rootMargin: "800px 0px 800px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    if (!activeFeedItemId || !activePresencePostId) return;
    let cancelled = false;

    const sendPresence = async () => {
      if (document.hidden) return;
      const activeNode = document.querySelector<HTMLElement>(`[data-feed-post-id="${CSS.escape(activeFeedItemId)}"]`);
      const rect = activeNode?.getBoundingClientRect();
      const focusX = window.innerWidth / 2;
      const focusY = window.innerHeight * 0.42;
      const vx = rect ? Math.max(0, Math.min(1, (focusX - rect.left) / Math.max(1, rect.width))) : 0.5;
      const vy = rect ? Math.max(0, Math.min(1, (focusY - rect.top) / Math.max(1, rect.height))) : 0.5;
      await fetch("/api/mesh/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          surface: "feed",
          activePostId: activePresencePostId,
          activeNodeId: activeFeedItemId,
          activeRoute: "/feed",
          position: { x: vx * 1000, y: vy * 1000 },
          viewportPosition: { vx, vy },
          activity: "exploring",
          // Must send ghostMode so the server's last-seen touch stays frozen
          // while ghosting — every other heartbeat caller sends it too.
          ghostMode: readGhostMode(),
          // EVERY heartbeat caller must stamp the where-share opt-in: the
          // server treats an absent flag as false, so omitting it here would
          // flip-flop an opted-in user's entry against the app-shell beat
          // (where-chip blinking + every flip forcing a write-through).
          shareWhere: readWhereShare(),
        }),
      }).catch(() => {});
    };

    const loadPresence = async () => {
      if (document.hidden) return;
      const params = new URLSearchParams({ surface: "feed", activePostId: activePresencePostId });
      const response = await fetch(`/api/mesh/presence?${params.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
      }).catch(() => null);
      if (!response?.ok || cancelled) return;
      const payload = await response.json().catch(() => ({}));
      if (cancelled) return;
      setSamePostPresences((payload.presences || []).filter((presence: FeedPresence) => presence.isOnline && presence.activePostId === activePresencePostId).slice(0, 5));
    };

    void sendPresence();
    void loadPresence();
    const heartbeat = window.setInterval(() => {
      void sendPresence();
      void loadPresence();
    }, 5500);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
    };
  }, [activeFeedItemId, activePresencePostId]);

  const presenceByPost = useMemo(() => {
    const map = new Map<string, FeedPresence[]>();
    for (const presence of samePostPresences) {
      if (!presence.activePostId) continue;
      const current = map.get(presence.activePostId) || [];
      current.push(presence);
      map.set(presence.activePostId, current);
    }
    return map;
  }, [samePostPresences]);

  const addOptimisticPost = (draft: { content: string; tags: string; crossPostTo: string[]; visibility: string; media: { id: string; url: string; type: string }[] }) => {
    const optimisticId = `optimistic-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
    const optimisticPost: FeedPost = {
      id: optimisticId,
      content: draft.content,
      createdAt: new Date().toISOString(),
      author: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isVerified: false,
      },
      community: null,
      media: draft.media,
      tags: draft.tags
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean)
        .slice(0, 8)
        .map((tag) => ({ id: `${optimisticId}-${tag}`, tag })),
      _count: { comments: 0, reactions: 0, reposts: 0 },
      reactions: [],
      savedBy: [],
      isPinned: false,
      platform: "meshme",
      crossPostedTo: draft.crossPostTo,
      optimistic: true,
      isNsfw: false,
      contentRating: "general",
      visibility: draft.visibility,
    };
    setPosts((current) => [optimisticPost, ...current.filter((item) => item.id !== optimisticId)]);
    setActiveFeedItemId(optimisticId);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-feed-post-id="${CSS.escape(optimisticId)}"]`)?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    });
    return optimisticId;
  };

  const replaceOptimisticPost = (post: FeedPost, optimisticId?: string) => {
    setPosts((current) => [
      post,
      ...current.filter((item) => item.id !== post.id && (!optimisticId || item.id !== optimisticId)),
    ]);
    setActiveFeedItemId(post.id);
  };

  const removeOptimisticPost = (optimisticId?: string) => {
    if (!optimisticId) return;
    setPosts((current) => current.filter((item) => item.id !== optimisticId));
    setActiveFeedItemId((activeId) => (activeId === optimisticId ? null : activeId));
  };

  return (
    <main className={`insta-feed-layout feed-x-layout feed-layout-mode-${layoutMode} feed-adaptive-${adaptiveMode} animate-page-enter`} data-meshi-zone="feed">
      <section className="min-w-0">
        <div className="insta-feed-topbar feed-x-topbar">
          <div className="inline-flex min-w-0 items-center gap-2">
            <UserMeshiBadge displayName={user.displayName} username={user.username} compact size={28} />
            <h1 className="truncate text-lg font-semibold text-[var(--text-primary)]">Home</h1>
          </div>
          <div className="feed-topbar-actions flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReelsOpen(true)}
            aria-label="Open immersive Flow"
            title="Immersive Flow"
            className="insta-icon-button"
            >
              <Play size={20} aria-hidden="true" />
            </button>
            <Link href="/search" aria-label="Search" title="Search" className="insta-icon-button">
              <Search size={20} aria-hidden="true" />
            </Link>
            <Link href="/feed?compose=true" aria-label="Create post" title="Create post" className="insta-icon-button">
              <PlusSquare size={20} aria-hidden="true" />
            </Link>
            <Link href="/messages" aria-label="Open MeChat" title="MeChat" className="insta-icon-button">
              <MessageCircle size={20} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <nav className="insta-feed-tabs feed-x-tabs" aria-label="Feed filters">
          {sourceFilters.map((filter) => (
            <Link
              key={filter.id}
              href={sourceHref(filter.id, contentFilter)}
              className={`${source === filter.id ? "insta-feed-tab-active" : "insta-feed-tab"} ${filter.mobileHidden ? "feed-filter-mobile-hidden" : ""}`}
              aria-current={source === filter.id ? "page" : undefined}
            >
              {filter.label}
            </Link>
          ))}
        </nav>

        <div className="feed-control-strip" aria-label="Feed view controls">
          <div className="feed-mode-strip" role="list" aria-label="Adaptive feed modes">
            {adaptiveModes.map((mode) => {
              const Icon = mode.icon;
              const active = adaptiveMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => void applyAdaptiveMode(mode.id)}
                  disabled={loadingFilter}
                  className={`feed-mode-button ${active ? "feed-mode-button-active" : ""}`}
                  aria-pressed={active}
                  title={mode.copy}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>

          <div className="feed-control-scroll" role="list" aria-label="Content filters">
            {contentFilters.map((filter) => {
              const Icon = filter.icon;
              const active = contentFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => {
                    setAdaptiveMode("classic");
                    void applyContentFilter(filter.id);
                  }}
                  disabled={loadingFilter}
                  className={`feed-control-chip ${active ? "feed-control-chip-active" : ""}`}
                  aria-pressed={active}
                >
                  <Icon size={14} aria-hidden="true" />
                  {filter.label}
                </button>
              );
            })}
          </div>

          <div className="feed-layout-toggle" aria-label="Layout mode">
            {layoutModes.map((mode) => {
              const Icon = mode.icon;
              const active = layoutMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setLayoutMode(mode.id)}
                  className={`feed-layout-button ${active ? "feed-layout-button-active" : ""}`}
                  aria-label={`${mode.label} layout`}
                  aria-pressed={active}
                  title={`${mode.label} layout`}
                >
                  <Icon size={15} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="feed-consumption-stack">
          <div className="feed-mode-summary">
            <span className="feed-mode-summary-icon">
              <ActiveModeIcon size={15} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{activeModeConfig.label} feed</span>
              <span className="block truncate text-xs font-semibold text-[var(--text-muted)]">{activeModeConfig.copy}</span>
            </span>
          </div>

          {adaptiveMode === "creator" && (
            <div className="feed-creator-dashboard" aria-label="Creator feed snapshot">
              {[
                { label: "Visible posts", value: posts.length },
                { label: "Engagement", value: feedStats.engagement },
                { label: "Comments", value: feedStats.comments },
                { label: "Media posts", value: feedStats.mediaPosts },
              ].map((item) => (
                <div key={item.label} className="feed-creator-stat">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          )}

          <div className={`feed-inline-composer ${isComposing ? "feed-inline-composer-active" : ""}`}>
            <PostComposer
              user={{ displayName: user.displayName, avatarUrl: user.avatarUrl }}
              onPostPending={addOptimisticPost}
              onPostCreated={replaceOptimisticPost}
              onPostFailed={removeOptimisticPost}
            />
          </div>

          {loadingFilter && (
            <div className="feed-loading-row" role="status">
              <PaperWait size="sm" />
              Updating feed
            </div>
          )}

          {posts.length > 0 ? (
            <div ref={timelineRef} className={`feed-post-list feed-post-list-${layoutMode} feed-posts-stagger`}>
              {posts.map((post, index) => (
                <div key={post.id} data-feed-post-id={post.id} className="feed-card-shell relative">
                  <FeedPostPresence presences={presenceByPost.get(getFeedPresenceKey(post) || post.id) || []} />
                  <PostCard
                    post={post}
                    currentUserId={user.id}
                    connectedPlatforms={connectedPlatforms}
                    compact={layoutMode === "compact" || adaptiveMode === "text" || adaptiveMode === "clean"}
                    eager={index < 2}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="mesh-surface feed-empty-state rounded-lg p-8 text-center">
              <h2 className="text-xl font-semibold">Nothing here yet.</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
                Try a broader filter, post to Mesh.me, follow people, join communities, or connect a platform to fill this feed.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {contentFilter !== "all" && (
                  <button type="button" onClick={() => void applyContentFilter("all")} className="mesh-action mesh-action-secondary px-4 text-sm">
                    Show all posts
                  </button>
                )}
                <Link href="/connected-accounts" className="mesh-action mesh-action-primary px-4 text-sm">
                  Connect platforms
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}

          <div ref={loadMoreRef} className="feed-load-sentinel" aria-live="polite">
            {feedError ? (
              <button type="button" onClick={() => void loadMore()} className="feed-load-button">
                {feedError}
              </button>
            ) : loadingMore ? (
              <span className="feed-loading-row">
                <PaperWait size="sm" />
                Loading more posts
              </span>
            ) : hasMore ? (
              <button type="button" onClick={() => void loadMore()} className="feed-load-button">
                Load more
              </button>
            ) : posts.length > 0 ? (
              <span className="text-xs font-semibold text-[var(--text-muted)]">You are caught up.</span>
            ) : null}
          </div>
        </div>
      </section>

      <aside className="insta-right-rail">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/profile/${user.username}`} className="flex min-w-0 items-center gap-3">
            <UserMeshiBadge displayName={user.displayName} username={user.username} compact size={42} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">@{user.username}</span>
              <span className="block truncate text-xs text-[var(--text-muted)]">{user.displayName}</span>
            </span>
          </Link>
          <Link href="/settings" className="text-xs font-semibold text-[var(--accent)]">Edit</Link>
        </div>

        <div className="mt-6 grid gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-[var(--text-muted)]">Everything</span>
            <Link href="/mesh" className="text-xs font-semibold text-[var(--text-primary)]">Open Mesh</Link>
          </div>
          {[
            { href: "/mesh", label: "The Mesh", icon: Grid3X3 },
            { href: "/connected-accounts", label: "Connect platforms", icon: ArrowRight },
            { href: "/notifications", label: "Notifications", icon: Bell },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="insta-rail-link">
                <Icon size={15} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </aside>

      {reelsOpen && (
        <FlowReels
          posts={posts}
          startId={flowPostId ?? activeFeedItemId}
          currentUserId={user.id}
          connectedPlatforms={connectedPlatforms}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onClose={closeReels}
          onLoadMore={() => void loadMore()}
        />
      )}
    </main>
  );
}

function FeedPostPresence({ presences }: { presences: FeedPresence[] }) {
  if (presences.length === 0) return null;
  const names = presences.map((presence) => presence.displayName || presence.username).join(", ");
  const clamp = (value: number, min = 12, max = 88) => Math.max(min, Math.min(max, value));

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[1.5rem]" aria-hidden="true">
        {presences.slice(0, 4).map((presence, index) => {
          const left = clamp(((presence.surface === "mesh" ? 0.5 : presence.viewportPosition?.vx ?? 0.5) * 100) + (index % 2 === 0 ? -3 : 3));
          const top = clamp(((presence.surface === "mesh" ? 0.18 : presence.viewportPosition?.vy ?? 0.5) * 100) + index * 3, 16, 82);
          const label = presence.displayName || presence.username;

          return (
            <span
              key={presence.userId}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)]/90 px-1.5 py-1 shadow-[var(--shadow-sm)] backdrop-blur"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <MeshiMascot size={18} color={presence.meshiColor as MeshiColor} hat={presence.meshiHat as MeshiHat} animate={false} />
              <span className="max-w-[5.25rem] truncate text-[9px] font-semibold text-[var(--text-secondary)]">
                {label}
              </span>
            </span>
          );
        })}
      </div>
      <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)]/88 px-2 py-1 shadow-[var(--shadow-sm)] backdrop-blur">
        <div className="flex -space-x-1">
          {presences.slice(0, 3).map((presence) => (
            <MeshiMascot
              key={presence.userId}
              size={20}
              color={presence.meshiColor as MeshiColor}
              hat={presence.meshiHat as MeshiHat}
              animate={false}
              className="shadow-sm"
            />
          ))}
        </div>
        <Sparkles size={11} aria-hidden="true" className="text-[var(--accent)]" />
        <span className="max-w-[9rem] truncate text-[10px] font-semibold text-[var(--text-secondary)]">
          {presences.length === 1 ? `${names} is here` : `${presences.length} Meshis here`}
        </span>
      </div>
    </>
  );
}
