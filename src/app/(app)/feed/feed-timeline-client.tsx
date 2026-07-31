"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Bell, Camera, Grid3X3, Image as ImageIcon, LayoutList, Link2, MessageCircle, Play, PlusSquare, Rows3, Search, Sparkles, Type, Video } from "lucide-react";
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

const PAGE_SIZE = 20;

const sourceFilters: Array<{ id: FeedSource; label: string; mobileHidden?: boolean }> = [
  { id: "all", label: "For you" },
  { id: "following", label: "Following" },
  { id: "discover", label: "Explore", mobileHidden: true },
];

/**
 * ONE ROW, ONE FACT.
 *
 * This was three rows — six "adaptive modes", five "content filters" and three
 * "layout" buttons — fourteen controls above a feed, and two of the rows wrote
 * the SAME state with different vocabularies.
 *
 * `FeedContentFilter` has eight values. The filter row offered five of them
 * (all/mesh/platforms/media/links) and the mode presets set three it had no
 * button for (text/photos/videos). Reproduced in a browser: pressing Photo,
 * Video or Text left ALL FIVE filter chips at aria-pressed="false" — the row
 * claimed nothing was selected while a filter was actively narrowing the feed,
 * which is also a radio-group with no selected member for a screen reader.
 *
 * Two of the six modes were duplicates outright. `creator` set the identical
 * contentFilter and layoutMode as `classic` and only added a stats panel that
 * /profile?tab=analytics already renders in full. `clean` was `classic` plus
 * compact cards — exactly the "Compact" layout button sitting next to it —
 * while its description promised "calm, fewer controls", which it did not do.
 *
 * So: one row that owns the whole vocabulary, each value reachable in ONE click,
 * and the layout implied by the choice rather than set separately. With a single
 * control writing the state, the desync is not fixed — it is unrepresentable.
 */
const feedViews: Array<{
  id: FeedContentFilter;
  label: string;
  copy: string;
  icon: typeof LayoutList;
  layoutMode: FeedLayoutMode;
}> = [
  { id: "all", label: "All", copy: "Balanced social feed", icon: Sparkles, layoutMode: "timeline" },
  { id: "text", label: "Text", copy: "Fast posts and thoughts", icon: Type, layoutMode: "compact" },
  { id: "photos", label: "Photos", copy: "Visual browsing", icon: Camera, layoutMode: "media" },
  { id: "videos", label: "Video", copy: "Watch-first stream", icon: Video, layoutMode: "media" },
  { id: "media", label: "Media", copy: "Everything with a picture or a clip", icon: ImageIcon, layoutMode: "media" },
  { id: "mesh", label: "Mesh.me", copy: "Only what was posted here", icon: Grid3X3, layoutMode: "timeline" },
  { id: "platforms", label: "Platforms", copy: "Only what came from a connected account", icon: Rows3, layoutMode: "timeline" },
  { id: "links", label: "Links", copy: "Shared links", icon: Link2, layoutMode: "compact" },
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
  const activeModeConfig = feedViews.find((view) => view.id === contentFilter) || feedViews[0];
  const ActiveModeIcon = activeModeConfig.icon;

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
    <main className={`insta-feed-layout feed-x-layout feed-layout-mode-${layoutMode} feed-view-${contentFilter} animate-page-enter`} data-meshi-zone="feed">
      <section className="min-w-0">
        {/* No identity cluster here: the app topbar states "Home" once — this
            bar (hidden under 768px) is only the desktop action strip. It also
            kept a second <h1> on the page. */}
        <div className="insta-feed-topbar feed-x-topbar">
          <div className="feed-topbar-actions ml-auto flex items-center gap-2">
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

        {/* One row. Each view is one click, and the layout comes with it —
            see feedViews for why there used to be three rows and why two of
            them fought over the same state. */}
        <div className="feed-control-strip" aria-label="Feed view">
          <div className="feed-mode-strip" role="list" aria-label="Feed view">
            {feedViews.map((view) => {
              const Icon = view.icon;
              const active = contentFilter === view.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => {
                    setLayoutMode(view.layoutMode);
                    void applyContentFilter(view.id);
                  }}
                  disabled={loadingFilter}
                  className={`feed-mode-button ${active ? "feed-mode-button-active" : ""}`}
                  aria-pressed={active}
                  title={view.copy}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span>{view.label}</span>
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
                    compact={layoutMode === "compact"}
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
                  <button type="button" onClick={() => void applyContentFilter("all")} className="key inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold text-[var(--text-primary)]">
                    Show all posts
                  </button>
                )}
                {/* Was `.mesh-action mesh-action-primary`: a hardcoded three-stop
                    gradient on hardcoded ink, with an emitting coloured shadow and
                    a hover lift. These are the classes ui/button.tsx:26 emits. */}
                <Link
                  href="/connected-accounts"
                  className="key key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)] inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold"
                >
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
          <Link href="/settings" className="text-xs font-semibold text-[var(--accent-text)]">Edit</Link>
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

  // Both chips below float over whatever the post happens to be — a photo, a
  // video, or plain text — so they use the media-chip contract from tokens.css:
  // OPAQUE, never translucent, never blurred. --media-ink-2 is pinned at 9.20:1
  // on --media-chip, which `text-secondary` over a 90%-alpha backdrop-blur could
  // not promise on any frame. The blur was also a Law 5 violation: the only
  // backdrop-filter this system permits is the modal scrim.
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
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--media-chip)] px-1.5 py-1 shadow-[0_var(--plinth-h-chip)_0_0_var(--media-chip-plinth)]"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <MeshiMascot size={18} color={presence.meshiColor as MeshiColor} hat={presence.meshiHat as MeshiHat} animate={false} />
              <span className="max-w-[5.25rem] truncate text-micro font-semibold text-[var(--media-ink-2)]">
                {label}
              </span>
            </span>
          );
        })}
      </div>
      <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--media-chip)] px-2 py-1 shadow-[0_var(--plinth-h-chip)_0_0_var(--media-chip-plinth)]">
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
        <Sparkles size={11} aria-hidden="true" className="text-[var(--media-ink-2)]" />
        <span className="max-w-[9rem] truncate text-micro font-semibold text-[var(--media-ink-2)]">
          {presences.length === 1 ? `${names} is here` : `${presences.length} Meshis here`}
        </span>
      </div>
    </>
  );
}
