"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Heart, Info, Link2, MessageCircle, Music2, Play, Send, SlidersHorizontal, Sparkles, VolumeX, Volume2 } from "lucide-react";
import { toggleFollow, toggleReaction } from "@/lib/actions";
import { getVideoEmbedUrl } from "@/lib/video-embed";

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
  externalUrl?: string | null;
  // Honest recommendation reason, computed by the ranker server-side.
  whyThis?: string;
  // Source visibility, preserved verbatim from the platform of origin.
  visibility?: string;
};

// The page URL a platform post lives at — feed data calls it externalUrl,
// older payloads call it url. Embeds and "open source" both need it.
function sourceUrl(post: FlowPost) {
  return post.url ?? post.externalUrl ?? null;
}

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

  // No playable file, but the post links to a video page (YouTube, Vimeo,
  // Twitch): play it natively via its embed player the moment this reel owns
  // the screen. Off-screen reels keep the cheap thumbnail.
  const embedUrl = getVideoEmbedUrl(sourceUrl(post), { autoplay: true, muted, loop: true });
  if (embedUrl && active) {
    return (
      <div className="relative h-full w-full bg-black" onClick={(e) => e.stopPropagation()}>
        <iframe
          src={embedUrl}
          title="Video player"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    );
  }

  if (image) {
    return (
      <div className="relative h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-40 blur-2xl scale-110" aria-hidden />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt="" loading="lazy" decoding="async" className="relative h-full w-full object-contain" />
        {embedUrl && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Play size={64} className="text-white/85 drop-shadow-lg" fill="currentColor" />
          </span>
        )}
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

function Reel({
  post,
  slotId,
  active,
  muted,
  onToggleMute,
  laneIndex,
  laneTotal,
  laneLoading,
  slideDir,
  onLaneSwipe,
}: {
  post: FlowPost;
  slotId: string;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  laneIndex: number;
  laneTotal: number;
  laneLoading: boolean;
  slideDir: 1 | -1 | 0;
  onLaneSwipe: (dir: 1 | -1) => void;
}) {
  const native = !post.platform || post.platform === "mesh" || post.platform === "meshme";
  const hasVideo = post.media.some((m) => m.type === "video");
  const [liked, setLiked] = useState(Boolean(post.reactions && post.reactions.length > 0));
  const [likeCount, setLikeCount] = useState(post._count.reactions);
  const [expanded, setExpanded] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [bursts, setBursts] = useState<number[]>([]);
  const [, startLike] = useTransition();
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<number | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressTapRef = useRef(false);

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
    if (suppressTapRef.current) return;
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
  const postSourceUrl = sourceUrl(post);

  return (
    <section
      className="relative h-full w-full snap-start snap-always"
      data-flow-reel={slotId}
      onTouchStart={(e) => {
        swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        const start = swipeStartRef.current;
        swipeStartRef.current = null;
        if (!start) return;
        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        // A clearly horizontal fling steps through the "more like this" lane.
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) {
          suppressTapRef.current = true;
          window.setTimeout(() => { suppressTapRef.current = false; }, 350);
          onLaneSwipe(dx < 0 ? 1 : -1);
        }
      }}
    >
      {/* Stage — centered 9:16 column on wide screens, full-bleed on phones */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`relative h-full w-full cursor-pointer overflow-hidden bg-black sm:h-[calc(100%-1.5rem)] sm:w-auto sm:aspect-[9/16] sm:rounded-2xl ${
            slideDir === 1 ? "flow-lane-in-left" : slideDir === -1 ? "flow-lane-in-right" : ""
          }`}
          onClick={handleStageTap}
        >
          <ReelMedia post={post} active={active} paused={paused} muted={muted} onToggleMute={onToggleMute} />

          {/* Double-tap hearts bloom from the middle of the stage */}
          {bursts.map((t) => (
            <span key={t} className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Heart size={104} fill="currentColor" className="flow-heart-burst text-rose-500" />
            </span>
          ))}

          <span className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {platformChip && (
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow ${platformChip}`}>
                {post.platform}
              </span>
            )}
            {post.visibility && post.visibility !== "public" && (
              <span className="rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/85 backdrop-blur">
                {post.visibility === "private" ? "Private · only you" : post.visibility}
              </span>
            )}
          </span>

          {/* Related-lane state: finding, or how deep into "similar" you are */}
          {laneLoading && (
            <span className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
              <Sparkles size={12} className="animate-pulse" /> Finding similar…
            </span>
          )}
          {!laneLoading && laneIndex > 0 && (
            <span className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
              <Sparkles size={12} /> Similar {laneIndex}/{laneTotal}
            </span>
          )}

          {/* Desktop affordances for the sideways lane */}
          {active && (
            <>
              {laneIndex > 0 && (
                <button
                  type="button"
                  aria-label="Back to previous"
                  onClick={(e) => { e.stopPropagation(); onLaneSwipe(-1); }}
                  className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white/85 backdrop-blur transition hover:bg-black/70 md:flex"
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              {(laneTotal === 0 || laneIndex < laneTotal) && (
                <button
                  type="button"
                  aria-label="More like this"
                  onClick={(e) => { e.stopPropagation(); onLaneSwipe(1); }}
                  className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white/85 backdrop-blur transition hover:bg-black/70 md:flex"
                >
                  <ChevronRight size={20} />
                </button>
              )}
            </>
          )}

          {/* Why this? — the honest recommendation reason, on demand */}
          {showWhy && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowWhy(false); }}
              className="absolute bottom-28 left-4 right-16 z-10 rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-left backdrop-blur"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-white/50">Why this?</p>
              <p className="mt-1 text-sm font-medium text-white">
                {laneIndex > 0 ? "Similar to what you just watched" : post.whyThis}
              </p>
              <p className="mt-1.5 text-[11px] text-white/45">Nothing on mesh.me is paid placement or an ad.</p>
            </button>
          )}

          {/* Bottom scrim + author/caption */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pb-4 pt-16" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 pr-16" onClick={(e) => e.stopPropagation()}>
            <div className="pointer-events-auto min-w-0 flex-1 text-white">
              <Link href={`/profile/${post.author.username}`} className="flex items-center gap-2">
                {post.author.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.author.avatarUrl} alt="" loading="lazy" decoding="async" className="h-8 w-8 rounded-full object-cover ring-1 ring-white/40" />
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
                  className={`mt-2 block max-w-full text-left text-[13px] leading-snug text-white/90 ${
                    expanded ? "max-h-[32vh] overflow-y-auto pr-1 [scrollbar-width:thin]" : "line-clamp-2"
                  }`}
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
            {(post.whyThis || laneIndex > 0) && (
              <RailButton label="Why this?" onClick={() => setShowWhy((w) => !w)} active={showWhy}>
                <Info size={24} />
              </RailButton>
            )}
            {post.platform && post.platform !== "mesh" && post.platform !== "meshme" && postSourceUrl && (
              <RailButton label="Open source" href={postSourceUrl}>
                <Link2 size={24} />
              </RailButton>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

type LaneState = { posts: FlowPost[]; index: number; loading: boolean };

// Algorithm Studio: the viewer steers the ranking. Persisted locally, sent
// with every ranked fetch, reflected in "Why this?".
const FLOW_MODES = [
  { id: "balanced", name: "Balanced", desc: "Relationships, interests, discovery, and recency." },
  { id: "following", name: "Following", desc: "Only people you follow." },
  { id: "discovery", name: "Discovery", desc: "Broader — new creators and topics." },
  { id: "chronological", name: "Chronological", desc: "Newest first. No algorithm." },
  { id: "calm", name: "Calm", desc: "Gentler pace, fewer viral spikes, more variety." },
] as const;
type FlowMode = (typeof FLOW_MODES)[number]["id"];
const MODE_STORAGE_KEY = "meshFlowMode";

function readStoredMode(): FlowMode {
  if (typeof window === "undefined") return "balanced";
  try {
    const raw = localStorage.getItem(MODE_STORAGE_KEY);
    return FLOW_MODES.some((m) => m.id === raw) ? (raw as FlowMode) : "balanced";
  } catch {
    return "balanced";
  }
}

export type FlowSuggestedPerson = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  followerCount: number;
};

const SEEN_STORAGE_KEY = "mesh-flow-seen";
const SEEN_CAP = 500;

// Cold start: instead of a dead end, an empty Flow offers real people to
// follow — one tap each — and then pulls the feed those follows unlock.
function FlowColdStart({
  people,
  refreshing,
  onLoadFlow,
}: {
  people: FlowSuggestedPerson[];
  refreshing: boolean;
  onLoadFlow: () => void;
}) {
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [, startFollow] = useTransition();

  const toggle = (id: string) => {
    const next = new Set(followed);
    const isFollowing = next.has(id);
    if (isFollowing) next.delete(id);
    else next.add(id);
    setFollowed(next);
    startFollow(async () => {
      const res = await toggleFollow(id);
      if (res && "error" in res) {
        setFollowed((current) => {
          const rollback = new Set(current);
          if (isFollowing) rollback.add(id);
          else rollback.delete(id);
          return rollback;
        });
      }
    });
  };

  return (
    <div className="flex h-full min-h-[60dvh] w-full flex-col items-center justify-center gap-5 overflow-y-auto bg-black px-6 py-10 text-center">
      <div>
        <p className="text-xl font-bold text-white">Your Flow is waiting</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-white/55">
          Follow a few people and their posts, videos, and platform content stream here.
        </p>
      </div>

      {people.length > 0 && (
        <div className="grid w-full max-w-md gap-2.5">
          {people.map((person) => {
            const isFollowing = followed.has(person.id);
            return (
              <div key={person.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left">
                <Link href={`/profile/${person.username}`} className="shrink-0">
                  {person.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={person.avatarUrl} alt="" loading="lazy" decoding="async" className="h-11 w-11 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white">
                      {(person.displayName || person.username).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{person.displayName}</p>
                  <p className="truncate text-xs text-white/50">
                    @{person.username}
                    {person.followerCount > 0 && ` · ${formatCount(person.followerCount)} followers`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(person.id)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                    isFollowing ? "bg-white/10 text-white/70" : "bg-white text-black hover:bg-white/90"
                  }`}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col items-center gap-2">
        {followed.size > 0 && (
          <button
            type="button"
            onClick={onLoadFlow}
            disabled={refreshing}
            className="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black transition hover:bg-white/90 disabled:opacity-60"
          >
            {refreshing ? "Loading your Flow…" : `Load my Flow (${followed.size} followed)`}
          </button>
        )}
        <Link href="/explore" className="text-sm font-semibold text-white/60 underline-offset-4 hover:text-white hover:underline">
          Explore mesh.me instead
        </Link>
      </div>
    </div>
  );
}

export function FlowClient({
  initialPosts,
  initialHasMore,
  suggestedPeople = [],
}: {
  initialPosts: FlowPost[];
  initialHasMore: boolean;
  suggestedPeople?: FlowSuggestedPerson[];
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [posts, setPosts] = useState(initialPosts);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<FlowMode>(readStoredMode);
  const [showModes, setShowModes] = useState(false);
  const modeRef = useRef<FlowMode>(mode);
  modeRef.current = mode;
  // Sideways "more like this" lanes, keyed by the vertical slot's post id.
  const [lanes, setLanes] = useState<Record<string, LaneState>>({});
  const [slideDirs, setSlideDirs] = useState<Record<string, 1 | -1 | 0>>({});
  const hasMoreRef = useRef(initialHasMore);
  const loadingRef = useRef(false);
  const postsRef = useRef(initialPosts);
  postsRef.current = posts;
  const lanesRef = useRef(lanes);
  lanesRef.current = lanes;
  const activeIndexRef = useRef(0);
  activeIndexRef.current = activeIndex;
  const pullStartRef = useRef<number | null>(null);
  const pullDeltaRef = useRef(0);
  const seenRef = useRef<Set<string>>(new Set());

  // Recently-watched reels persist across visits so the ranker can keep the
  // feed fresh instead of replaying yesterday.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEEN_STORAGE_KEY);
      if (raw) seenRef.current = new Set(JSON.parse(raw) as string[]);
    } catch {
      // storage unavailable — session-only memory still works
    }
  }, []);

  const markSeen = useCallback((id: string) => {
    if (seenRef.current.has(id)) return;
    seenRef.current.add(id);
    try {
      const trimmed = [...seenRef.current].slice(-SEEN_CAP);
      seenRef.current = new Set(trimmed);
      localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // best-effort persistence
    }
  }, []);

  const seenParam = useCallback(() => [...seenRef.current].slice(-200).join(","), []);

  // Swipe down at the very top (or just reload) to pull fresh content.
  const refresh = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setRefreshing(true);
    try {
      const res = await fetch(
        `/api/flow?limit=12&seen=${encodeURIComponent(seenParam())}&mode=${modeRef.current}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.posts) && data.posts.length > 0) {
        hasMoreRef.current = Boolean(data.hasMore);
        setPosts(data.posts);
        setLanes({});
        setSlideDirs({});
        setActiveIndex(0);
        containerRef.current?.scrollTo({ top: 0 });
      }
    } finally {
      loadingRef.current = false;
      setRefreshing(false);
    }
  }, [seenParam]);

  // Track which reel owns the screen. Lanes remount reels, so re-arm the
  // observer whenever either the list or a lane changes.
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
  }, [posts.length, lanes]);

  // Whatever is on screen counts as watched — original or lane content.
  useEffect(() => {
    const slot = posts[activeIndex];
    if (!slot) return;
    const lane = lanes[slot.id];
    const displayed = lane && lane.index > 0 ? lane.posts[lane.index - 1] : slot;
    if (displayed) markSeen(displayed.id);
  }, [activeIndex, posts, lanes, markSeen]);

  // Pull the next ranked batch as the viewer nears the end. The server ranks;
  // we just tell it what we already have and what's been watched.
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    try {
      const exclude = postsRef.current.map((p) => p.id).slice(-300).join(",");
      const res = await fetch(
        `/api/flow?limit=12&exclude=${encodeURIComponent(exclude)}&seen=${encodeURIComponent(seenParam())}&mode=${modeRef.current}`,
        { credentials: "same-origin" },
      );
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.posts)) {
        hasMoreRef.current = Boolean(data.hasMore) && data.posts.length > 0;
        setPosts((prev) => {
          const existing = new Set(prev.map((p) => p.id));
          return [...prev, ...data.posts.filter((p: FlowPost) => !existing.has(p.id))];
        });
      }
    } finally {
      loadingRef.current = false;
    }
  }, [seenParam]);

  useEffect(() => {
    if (activeIndex >= posts.length - 3) void loadMore();
  }, [activeIndex, posts.length, loadMore]);

  // The server rendered Balanced; if the viewer's saved mode differs, re-rank
  // immediately on arrival.
  useEffect(() => {
    if (readStoredMode() !== "balanced") void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectMode = useCallback(
    (next: FlowMode) => {
      setShowModes(false);
      if (next === modeRef.current) return;
      modeRef.current = next;
      setMode(next);
      try {
        localStorage.setItem(MODE_STORAGE_KEY, next);
      } catch {
        // session-only preference still works
      }
      hasMoreRef.current = true;
      void refresh();
    },
    [refresh],
  );

  // Step sideways through content similar to this reel. First step fetches
  // the lane; later steps just walk it. Index 0 is the original reel.
  const swipeLane = useCallback(async (slotId: string, dir: 1 | -1) => {
    const lane = lanesRef.current[slotId];
    if (!lane) {
      if (dir !== 1) return;
      setLanes((prev) => ({ ...prev, [slotId]: { posts: [], index: 0, loading: true } }));
      try {
        // Only avoid what's actually been watched — content queued further
        // down the vertical list is fair game for the sideways lane.
        const exclude = seenParam();
        const res = await fetch(
          `/api/flow/related?anchor=${encodeURIComponent(slotId)}&exclude=${encodeURIComponent(exclude)}`,
          { credentials: "same-origin" },
        );
        const data = res.ok ? await res.json().catch(() => null) : null;
        const related: FlowPost[] = data && Array.isArray(data.posts) ? data.posts : [];
        setLanes((prev) => ({
          ...prev,
          [slotId]: { posts: related, index: related.length > 0 ? 1 : 0, loading: false },
        }));
        if (related.length > 0) setSlideDirs((prev) => ({ ...prev, [slotId]: 1 }));
      } catch {
        setLanes((prev) => ({ ...prev, [slotId]: { posts: [], index: 0, loading: false } }));
      }
      return;
    }
    if (lane.loading) return;
    const next = Math.min(Math.max(lane.index + dir, 0), lane.posts.length);
    if (next === lane.index) return;
    setLanes((prev) => ({ ...prev, [slotId]: { ...lane, index: next } }));
    setSlideDirs((prev) => ({ ...prev, [slotId]: dir }));
  }, [seenParam]);

  // Arrow keys: up/down page reels, left/right walk the similar lane, M mutes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const root = containerRef.current;
      if (!root) return;
      if (e.key === "ArrowDown") root.scrollBy({ top: root.clientHeight, behavior: "smooth" });
      else if (e.key === "ArrowUp") root.scrollBy({ top: -root.clientHeight, behavior: "smooth" });
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const slot = postsRef.current[activeIndexRef.current];
        if (slot) void swipeLane(slot.id, e.key === "ArrowRight" ? 1 : -1);
      } else if (e.key.toLowerCase() === "m") setMuted((m) => !m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [swipeLane]);

  if (posts.length === 0) {
    return <FlowColdStart people={suggestedPeople} refreshing={refreshing} onLoadFlow={() => void refresh()} />;
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
      <button
        type="button"
        aria-label="Choose how your Flow is ranked"
        onClick={() => setShowModes(true)}
        className={`absolute left-14 top-3 z-20 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold backdrop-blur transition-colors ${
          mode === "balanced" ? "bg-black/55 text-white hover:bg-black/75" : "bg-white/90 text-black hover:bg-white"
        }`}
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
        {FLOW_MODES.find((m) => m.id === mode)?.name}
      </button>
      {showModes && (
        <div
          className="absolute inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center"
          onClick={() => setShowModes(false)}
        >
          <div
            role="dialog"
            aria-label="Flow ranking modes"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border border-white/12 bg-[#0b0c14] p-5 pb-8 sm:rounded-3xl sm:pb-5"
          >
            <p className="text-base font-bold text-white">How should your Flow rank?</p>
            <p className="mt-0.5 text-xs text-white/50">
              You steer the algorithm. No ads, no paid reach — ever.
            </p>
            <div className="mt-4 grid gap-1.5">
              {FLOW_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectMode(m.id)}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    mode === m.id
                      ? "border-white/25 bg-white/10"
                      : "border-transparent hover:bg-white/5"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{m.name}</p>
                    <p className="text-xs text-white/55">{m.desc}</p>
                  </div>
                  {mode === m.id && <Check size={16} className="shrink-0 text-white" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {refreshing && (
        <div className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur">
          Refreshing your Flow…
        </div>
      )}
      <div
        ref={containerRef}
        onTouchStart={(e) => {
          const root = containerRef.current;
          pullStartRef.current = root && root.scrollTop <= 0 ? e.touches[0].clientY : null;
          pullDeltaRef.current = 0;
        }}
        onTouchMove={(e) => {
          if (pullStartRef.current === null) return;
          pullDeltaRef.current = e.touches[0].clientY - pullStartRef.current;
        }}
        onTouchEnd={() => {
          if (pullStartRef.current !== null && pullDeltaRef.current > 90) void refresh();
          pullStartRef.current = null;
          pullDeltaRef.current = 0;
        }}
        className="h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {posts.map((post, i) => {
          const lane = lanes[post.id];
          const displayed = lane && lane.index > 0 ? lane.posts[lane.index - 1] ?? post : post;
          return (
            <Reel
              key={`${post.id}:${displayed.id}`}
              post={displayed}
              slotId={post.id}
              active={i === activeIndex}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
              laneIndex={lane?.index ?? 0}
              laneTotal={lane?.posts.length ?? 0}
              laneLoading={lane?.loading ?? false}
              slideDir={slideDirs[post.id] ?? 0}
              onLaneSwipe={(dir) => void swipeLane(post.id, dir)}
            />
          );
        })}
      </div>
    </div>
  );
}
