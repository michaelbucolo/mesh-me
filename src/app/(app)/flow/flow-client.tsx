"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Heart, Link2, MessageCircle, Music2, Play, Send, VolumeX, Volume2 } from "lucide-react";
import { toggleReaction } from "@/lib/actions";

export type FlowPost = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; username: string; displayName: string; avatarUrl: string | null; isVerified: boolean };
  community?: { id: string; name: string; slug: string } | null;
  media: { id: string; url: string; type: string; posterUrl?: string }[];
  tags: { id: string; tag: string }[];
  _count: { comments: number; reactions: number; reposts: number };
  reactions?: { id: string }[];
  platform?: string;
  url?: string | null;
};

// Text reels rotate through a small set of night-sky moods so a run of
// thoughts doesn't read as copies of one card.
const TEXT_STAGES = [
  "radial-gradient(circle at 30% 20%, #1d2a5e 0%, #0a0f24 55%, #04060f 100%)",
  "radial-gradient(circle at 70% 25%, #33184d 0%, #140b28 55%, #05040f 100%)",
  "radial-gradient(circle at 50% 80%, #0d3b3b 0%, #081d26 55%, #03070d 100%)",
  "radial-gradient(circle at 25% 70%, #46215a 0%, #1c0f2e 50%, #070410 100%)",
];

function textStageFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return TEXT_STAGES[Math.abs(hash) % TEXT_STAGES.length];
}

// One full-screen reel: video autoplays in view, images fill the frame, and
// text-only posts become a typographic card — any content type, same stage.
// Playback state lives in the parent so taps and double-taps can share it.
function ReelMedia({
  post,
  active,
  paused,
  muted,
  onToggleMute,
}: {
  post: FlowPost;
  active: boolean;
  paused: boolean;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const video = videoFailed ? undefined : post.media.find((m) => m.type === "video");
  const image = post.media.find((m) => m.type !== "video") ?? (videoFailed
    ? post.media.map((m) => (m.posterUrl ? { ...m, url: m.posterUrl, type: "image" } : null)).find(Boolean) ?? undefined
    : undefined);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active && !paused) void el.play().catch(() => {});
    else el.pause();
  }, [active, paused]);

  if (video) {
    return (
      <div className="relative h-full w-full">
        <video
          ref={videoRef}
          src={video.url}
          poster={video.posterUrl ?? image?.url}
          loop
          muted={muted}
          playsInline
          preload="metadata"
          onError={() => setVideoFailed(true)}
          onTimeUpdate={(event) => {
            const el = event.currentTarget;
            if (progressRef.current && el.duration > 0) {
              progressRef.current.style.width = `${(el.currentTime / el.duration) * 100}%`;
            }
          }}
          className="h-full w-full object-cover"
        />
        {paused && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Play size={64} className="animate-[fadeIn_.15s_ease] text-white/85 drop-shadow-lg" fill="currentColor" />
          </span>
        )}
        <button
          type="button"
          aria-label={muted ? "Unmute" : "Mute"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          className="absolute right-3 top-3 rounded-full bg-black/55 p-2 text-white/90 backdrop-blur transition active:scale-90"
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        {/* Playback progress — a quiet hairline, not a control */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-white/15">
          <div ref={progressRef} className="h-full w-0 bg-white/85" />
        </div>
      </div>
    );
  }

  if (image) {
    return (
      <div className="relative h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40 blur-2xl scale-110" aria-hidden />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt="" className="relative h-full w-full object-contain" />
      </div>
    );
  }

  // Text-only content gets the full reel stage.
  return (
    <div className="flex h-full w-full items-center justify-center px-8" style={{ background: textStageFor(post.id) }}>
      <p
        className={`max-w-md whitespace-pre-wrap text-center font-semibold leading-snug text-white ${
          post.content.length > 220 ? "text-lg" : post.content.length > 90 ? "text-xl" : "text-2xl"
        }`}
      >
        {post.content}
      </p>
    </div>
  );
}

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 < 100_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 < 100 ? 0 : 1)}K`;
  return String(value);
}

const PLATFORM_CHIP: Record<string, string> = {
  youtube: "bg-red-500/85",
  instagram: "bg-gradient-to-r from-pink-500/85 to-amber-500/85",
  tiktok: "bg-zinc-800/85",
  twitter: "bg-sky-500/85",
  x: "bg-zinc-800/85",
  reddit: "bg-orange-600/85",
  facebook: "bg-blue-600/85",
  snapchat: "bg-yellow-400/90 text-black",
  twitch: "bg-purple-600/85",
};

function RailButton({
  label,
  count,
  onClick,
  href,
  active,
  children,
}: {
  label: string;
  count?: number | string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  const inner = (
    <>
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90 ${
          active ? "text-rose-400" : "text-white"
        }`}
      >
        {children}
      </span>
      {count !== undefined && <span className="text-xs font-semibold text-white">{count}</span>}
    </>
  );
  const cls = "flex flex-col items-center gap-0.5 drop-shadow";
  if (href) {
    return (
      <Link href={href} aria-label={label} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

function Reel({ post, active, muted, onToggleMute }: { post: FlowPost; active: boolean; muted: boolean; onToggleMute: () => void }) {
  const native = !post.platform || post.platform === "mesh" || post.platform === "meshme";
  const hasVideo = post.media.some((m) => m.type === "video");
  const [liked, setLiked] = useState(Boolean(post.reactions && post.reactions.length > 0));
  const [likeCount, setLikeCount] = useState(post._count.reactions);
  const [expanded, setExpanded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [bursts, setBursts] = useState<number[]>([]);
  const [, startLike] = useTransition();
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<number | null>(null);

  const handleLike = (viaDoubleTap = false) => {
    if (!native) return;
    const next = viaDoubleTap ? true : !liked;
    if (next === liked && viaDoubleTap) return;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    startLike(async () => {
      const res = await toggleReaction(post.id);
      if (res && "error" in res) {
        setLiked(!next);
        setLikeCount((c) => c + (next ? -1 : 1));
      }
    });
  };

  // Tap = pause/play (videos). Double-tap = like, with a heart that blooms
  // where everyone expects it. The single-tap waits a beat so a second tap
  // can cancel it — no pause flicker while you're double-tapping.
  const handleStageTap = () => {
    const now = performance.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      if (singleTapTimerRef.current) {
        window.clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      if (native) {
        handleLike(true);
        setBursts((current) => [...current.slice(-3), now]);
        window.setTimeout(() => setBursts((current) => current.filter((t) => t !== now)), 800);
      }
      return;
    }
    lastTapRef.current = now;
    if (hasVideo) {
      singleTapTimerRef.current = window.setTimeout(() => {
        setPaused((p) => !p);
        singleTapTimerRef.current = null;
      }, 280);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/feed/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ url, title: `@${post.author.username} on mesh.me` });
      else await navigator.clipboard.writeText(url);
    } catch {
      // cancelled
    }
  };

  const platformChip = post.platform && !native ? PLATFORM_CHIP[post.platform.toLowerCase()] ?? "bg-white/20" : null;

  return (
    <section className="relative h-full w-full snap-start snap-always" data-flow-reel={post.id}>
      {/* Stage — centered 9:16 column on wide screens, full-bleed on phones */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative h-full w-full cursor-pointer overflow-hidden bg-black sm:h-[calc(100%-1.5rem)] sm:w-auto sm:aspect-[9/16] sm:rounded-2xl"
          onClick={handleStageTap}
        >
          <ReelMedia post={post} active={active} paused={paused} muted={muted} onToggleMute={onToggleMute} />

          {/* Double-tap hearts bloom from the middle of the stage */}
          {bursts.map((t) => (
            <span key={t} className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Heart size={104} fill="currentColor" className="flow-heart-burst text-rose-500" />
            </span>
          ))}

          {platformChip && (
            <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow ${platformChip}`}>
              {post.platform}
            </span>
          )}

          {/* Bottom scrim + author/caption */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pb-4 pt-16" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 pr-16" onClick={(e) => e.stopPropagation()}>
            <div className="pointer-events-auto min-w-0 flex-1 text-white">
              <Link href={`/profile/${post.author.username}`} className="flex items-center gap-2">
                {post.author.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.author.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-white/40" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                    {(post.author.displayName || post.author.username).slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="truncate text-sm font-semibold">@{post.author.username}</span>
              </Link>
              {post.content && post.media.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  className={`mt-2 block max-w-full text-left text-[13px] leading-snug text-white/90 ${expanded ? "" : "line-clamp-2"}`}
                >
                  {post.content}
                </button>
              )}
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/60">
                <Music2 size={11} />
                {post.platform && post.platform !== "mesh" && post.platform !== "meshme" ? `From ${post.platform}` : "Original on mesh.me"}
              </p>
            </div>
          </div>

          {/* Right action rail */}
          <div className="absolute bottom-16 right-2 flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <RailButton label="Like" count={formatCount(likeCount)} onClick={() => handleLike()} active={liked}>
              <span key={liked ? "liked" : "unliked"} className={liked ? "flow-like-pop inline-flex" : "inline-flex"}>
                <Heart size={28} fill={liked ? "currentColor" : "none"} className={liked ? "text-rose-500" : undefined} />
              </span>
            </RailButton>
            <RailButton label="Comments" count={formatCount(post._count.comments)} href={`/feed/${post.id}`}>
              <MessageCircle size={28} />
            </RailButton>
            <RailButton label="Share" onClick={handleShare}>
              <Send size={26} />
            </RailButton>
            {post.platform && post.platform !== "mesh" && post.platform !== "meshme" && post.url && (
              <RailButton label="Open source" href={post.url}>
                <Link2 size={24} />
              </RailButton>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function FlowClient({ initialPosts, initialHasMore }: { initialPosts: FlowPost[]; initialHasMore: boolean }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [posts, setPosts] = useState(initialPosts);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const hasMoreRef = useRef(initialHasMore);
  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const postsRef = useRef(initialPosts);
  postsRef.current = posts;

  // Track which reel owns the screen.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.flowReel;
          const idx = postsRef.current.findIndex((p) => p.id === id);
          if (idx >= 0) setActiveIndex(idx);
        }
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-flow-reel]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [posts.length]);

  // Pull the next page as the viewer nears the end.
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    try {
      const next = pageRef.current + 1;
      const res = await fetch(`/api/feed/paginated?page=${next}&limit=12`, { credentials: "same-origin" });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.posts)) {
        pageRef.current = next;
        hasMoreRef.current = Boolean(data.hasMore);
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...data.posts.filter((p: FlowPost) => !seen.has(p.id))];
        });
      }
    } finally {
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (activeIndex >= posts.length - 3) void loadMore();
  }, [activeIndex, posts.length, loadMore]);

  // Arrow keys page between reels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const root = containerRef.current;
      if (!root) return;
      if (e.key === "ArrowDown") root.scrollBy({ top: root.clientHeight, behavior: "smooth" });
      else if (e.key === "ArrowUp") root.scrollBy({ top: -root.clientHeight, behavior: "smooth" });
      else if (e.key.toLowerCase() === "m") setMuted((m) => !m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (posts.length === 0) {
    return (
      <div className="flex h-full min-h-[60dvh] w-full flex-col items-center justify-center gap-3 bg-black text-center">
        <p className="text-lg font-semibold text-white">The Flow is quiet</p>
        <p className="max-w-xs text-sm text-white/55">Follow people and connect platforms, and their content streams here.</p>
        <Link href="/explore" className="mt-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black">
          Explore mesh.me
        </Link>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full min-w-0 flex-1 bg-black">
      <button
        type="button"
        aria-label="Back"
        onClick={() => router.push("/mesh")}
        className="absolute left-3 top-3 z-20 rounded-full bg-black/55 p-2.5 text-white backdrop-blur transition-colors hover:bg-black/75"
      >
        <ArrowLeft size={18} />
      </button>
      <div
        ref={containerRef}
        className="h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {posts.map((post, i) => (
          <Reel
            key={post.id}
            post={post}
            active={i === activeIndex}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
          />
        ))}
      </div>
    </div>
  );
}
