"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Heart, Info, Link2, Maximize2, MessageCircle, Minimize2, Music2, Play, Send, SlidersHorizontal, Sparkles, VolumeX, Volume2, X } from "lucide-react";
import { toggleFollow, toggleReaction, setFlowLike } from "@/lib/actions";
import { getVideoEmbedUrl } from "@/lib/video-embed";
import { attachNormalizer } from "@/lib/audio-normalize";
import { playSound } from "@/lib/sound";
import { useToast } from "@/components/ui/toast";
import { PlatformLogo } from "@/components/platform/platform-logo";
import { getPlatformCapability, normalizePlatformId } from "@/lib/platform-capabilities";

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

// A double-tap heart bloom: a small cluster of hearts (rose → magenta →
// periwinkle) plus a couple of cyan sparks, each flung outward on its own
// angle from the actual tap point. Reduced motion skips the cluster.
type BurstParticle = { angle: string; dist: string; color: string; size: number; kind: "heart" | "spark" };
type HeartBurst = { id: number; x: number; y: number; particles: BurstParticle[] };

// The warm plastics, not the rejected hot-pink triple (#f43f5e/#ec4899/#6e8bff).
// A heart burst is tomato and crimson — the brand plastic and the one next to
// it — so a like reads as part of the same moulded object family.
const HEART_BURST_COLORS = ["#ee6238", "#b81f3a", "#f2b23c"];
function makeHeartBurst(): BurstParticle[] {
  const parts: BurstParticle[] = [];
  const hearts = 5;
  for (let i = 0; i < hearts; i += 1) {
    const spread = -58 + (116 / (hearts - 1)) * i + (Math.random() * 20 - 10);
    parts.push({
      angle: `${spread}deg`,
      dist: `${46 + Math.random() * 34}px`,
      color: HEART_BURST_COLORS[i % HEART_BURST_COLORS.length],
      size: 9,
      kind: "heart",
    });
  }
  for (let i = 0; i < 2; i += 1) {
    const base = i === 0 ? -30 : 30;
    parts.push({ angle: `${base + (Math.random() * 14 - 7)}deg`, dist: `${58 + Math.random() * 26}px`, color: "#f2b23c", size: 5, kind: "spark" });
  }
  return parts;
}

// Both reels move on a sideways lane swap: the incoming slides in from the
// swipe side starting fully hidden, the outgoing dims and blurs to a soft
// trail. Keyed to the lane step so repeated swipes re-trigger. Framer degrades
// the transforms under reduced motion, leaving a plain crossfade.
const laneStageVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir < 0 ? "-15%" : "15%", scale: 0.99, filter: "blur(3px)" }),
  center: { opacity: 1, x: "0%", scale: 1, filter: "blur(0px)" },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir < 0 ? "17%" : "-17%",
    scale: 0.96,
    filter: "blur(3px)",
    transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};
const laneStageTransition = { type: "spring" as const, stiffness: 360, damping: 34, mass: 0.85 };

// The platform's loading motif: a sparkle with a brand mote orbiting it —
// on-brand where a spinner or pulse used to be. Framer degrades it to a calm
// static sparkle under reduced motion.
function OrbitSparkle({ size = 12 }: { size?: number }) {
  const box = size + 8;
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: box, height: box }} aria-hidden>
      <motion.span className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 2.2, ease: "linear", repeat: Infinity }}>
        <span className="absolute left-1/2 top-0 h-1 w-1 -translate-x-1/2 rounded-full" style={{ background: "var(--mesh-cyan)", boxShadow: "0 0 6px var(--mesh-cyan)" }} />
      </motion.span>
      <Sparkles size={size} className="text-[var(--accent)]" style={{ filter: "drop-shadow(0 0 3px var(--accent))" }} />
    </span>
  );
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
  nearActive = false,
  onProgress,
}: {
  post: FlowPost;
  active: boolean;
  paused: boolean;
  muted: boolean;
  onToggleMute: () => void;
  /** This reel is the active one or one of the next couple — fetch its video
   * ahead of time so it plays instantly the moment you scroll onto it. */
  nearActive?: boolean;
  /** Fraction of the video reached (0..1) — the watch-completion signal the
   * ranker feeds on. Only fired while this reel owns the screen. */
  onProgress?: (completion: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Portrait / near-square media fills the reel (object-cover); clearly
  // landscape media is shown whole (object-contain) over a blurred fill of its
  // own poster, so the real aspect ratio is preserved instead of hard-cropped.
  const [videoFit, setVideoFit] = useState<"cover" | "contain">("cover");
  // Type-aware media selection — any media type gets a stage that fits it:
  // video plays, audio gets a player, every image in a gallery shows (not just
  // the first), links/documents get the caption card with a way out. GIFs are
  // images to an <img>.
  const typeOf = (m: { type: string }) => m.type.toLowerCase();
  const video = videoFailed ? undefined : post.media.find((m) => typeOf(m) === "video");
  const audio = post.media.find((m) => typeOf(m) === "audio");
  const images = post.media.filter((m) => ["image", "photo", "gif"].includes(typeOf(m)));
  const linkMedia = post.media.find((m) => ["link", "document"].includes(typeOf(m)));
  const [imageIndex, setImageIndex] = useState(0);
  const image = images[0] ?? (videoFailed
    ? post.media.map((m) => (m.posterUrl ? { ...m, url: m.posterUrl, type: "image" } : null)).find(Boolean) ?? undefined
    : undefined);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    // React only sets the muted ATTRIBUTE, but the browser's autoplay policy
    // gates on the muted PROPERTY — so a JSX `muted={…}` alone leaves play()
    // blocked as "unmuted" and the reel silently never starts. Set it here.
    el.muted = muted;
    if (active && !paused) void el.play().catch(() => {});
    else el.pause();
  }, [active, paused, muted]);

  // Fullscreen happens INSIDE mesh.me — we request it on our own wrapper, never
  // navigate to the source. Keep a local flag in sync so the icon can flip.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (typeof document === "undefined" || !el) return;
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void el.requestFullscreen?.().catch(() => {});
  };

  if (video) {
    const contain = videoFit === "contain";
    return (
      <div ref={wrapRef} className="relative flex h-full w-full items-center justify-center bg-black">
        {contain && video.posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.posterUrl} alt="" aria-hidden loading="lazy" decoding="async" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40 blur-2xl scale-110" />
        )}
        <video
          ref={videoRef}
          src={video.url}
          poster={video.posterUrl ?? image?.url}
          loop
          muted={muted}
          playsInline
          preload={nearActive ? "auto" : "metadata"}
          // Level cross-platform loudness the moment playback starts (never on
          // preload). CORS-unsafe sources are left on their native audio path.
          onPlay={(event) => attachNormalizer(event.currentTarget)}
          onLoadedMetadata={(event) => {
            const el = event.currentTarget;
            if (el.videoWidth > 0 && el.videoHeight > 0) {
              setVideoFit(el.videoWidth / el.videoHeight > 1.05 ? "contain" : "cover");
            }
          }}
          onError={() => setVideoFailed(true)}
          onTimeUpdate={(event) => {
            const el = event.currentTarget;
            if (el.duration > 0) {
              if (progressRef.current) {
                progressRef.current.style.width = `${(el.currentTime / el.duration) * 100}%`;
              }
              if (active) onProgress?.(el.currentTime / el.duration);
            }
          }}
          className={`relative h-full w-full ${contain ? "object-contain" : "object-cover"}`}
        />
        {paused && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Play size={64} className="animate-[fadeIn_.15s_ease] text-white/85 drop-shadow-lg" fill="currentColor" />
          </span>
        )}
        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <button
            type="button"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            className="rounded-full bg-black/55 p-2 text-white/90 backdrop-blur transition active:scale-90"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button
            type="button"
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            className="rounded-full bg-black/55 p-2 text-white/90 backdrop-blur transition active:scale-90"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
        {/* Playback progress — a quiet periwinkle→cyan hairline with a soft
            leading glow, easing between frames instead of snapping. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-white/15">
          <div
            ref={progressRef}
            className="h-full w-0"
            style={{
              background: "linear-gradient(90deg, var(--accent), var(--mesh-cyan))",
              boxShadow: "2px 0 8px 0 rgba(52, 228, 234, 0.7)",
              transition: "width 0.15s linear",
            }}
          />
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
      <div ref={wrapRef} className="relative flex h-full w-full items-center justify-center bg-black" onClick={(e) => e.stopPropagation()}>
        {/* A 16:9 player is centered at its true aspect (letterboxed) rather
            than stretched to fill the 9:16 reel. */}
        <iframe
          src={embedUrl}
          title="Video player"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          // The site sends no Referer by default; YouTube's player needs the
          // embedding origin to authorize playback (otherwise it fails with a
          // "153"-class error as each reel mounts). Override just this frame to
          // send the origin only — enough to authorize, nothing more.
          referrerPolicy="strict-origin-when-cross-origin"
          className="aspect-video max-h-full w-full border-0"
        />
        <button
          type="button"
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          className="absolute right-3 top-3 rounded-full bg-black/55 p-2 text-white/90 backdrop-blur transition active:scale-90"
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
    );
  }

  // Audio (podcasts, tracks): a real player over its art — never an <img>
  // pointed at an audio file.
  if (audio) {
    return (
      <div ref={wrapRef} className="relative flex h-full w-full items-center justify-center bg-black" onClick={(e) => e.stopPropagation()}>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt="" aria-hidden loading="lazy" decoding="async" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40 blur-2xl scale-110" />
        )}
        <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-5 px-8">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.url} alt="" loading="lazy" decoding="async" className="h-44 w-44 rounded-2xl object-cover shadow-2xl" />
          ) : (
            <span className="flex h-44 w-44 items-center justify-center rounded-2xl bg-white/10">
              <Music2 size={56} className="text-white/80" />
            </span>
          )}
          <audio src={audio.url} controls preload="metadata" onPlay={(event) => attachNormalizer(event.currentTarget)} className="w-full" />
        </div>
      </div>
    );
  }

  if (image) {
    const shown = images.length > 1 ? images[Math.min(imageIndex, images.length - 1)] : image;
    const shownIndex = Math.min(imageIndex, Math.max(images.length - 1, 0));
    return (
      <div className="relative h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shown.url} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-40 blur-2xl scale-110" aria-hidden />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shown.url} alt="" loading="lazy" decoding="async" className="relative h-full w-full object-contain" />
        {embedUrl && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Play size={64} className="text-white/85 drop-shadow-lg" fill="currentColor" />
          </span>
        )}
        {/* Galleries: every image reachable, IG-style dots + step arrows. The
            arrows stop propagation so stepping never pauses or double-likes. */}
        {images.length > 1 && (
          <>
            <span className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center gap-1.5">
              {images.map((m, i) => (
                <span key={m.id ?? i} className={`h-1 rounded-full transition-all duration-200 ${i === shownIndex ? "w-5 bg-white/90" : "w-2.5 bg-white/35"}`} />
              ))}
            </span>
            {shownIndex > 0 && (
              <button
                type="button"
                aria-label="Previous image"
                onClick={(e) => {
                  e.stopPropagation();
                  setImageIndex(Math.max(0, shownIndex - 1));
                }}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white/90 backdrop-blur transition active:scale-90"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            {shownIndex < images.length - 1 && (
              <button
                type="button"
                aria-label="Next image"
                onClick={(e) => {
                  e.stopPropagation();
                  setImageIndex(Math.min(images.length - 1, shownIndex + 1));
                }}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white/90 backdrop-blur transition active:scale-90"
              >
                <ChevronRight size={18} />
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  // Text, link, and article posts get the full reel stage — with an explicit
  // way out when the post IS a link (previously a link rendered as a broken
  // <img> because "media" was non-empty).
  const linkHost = (() => {
    if (!linkMedia) return null;
    try {
      return new URL(linkMedia.url).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  })();
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-8" style={{ background: textStageFor(post.id) }}>
      <p
        className={`max-w-md whitespace-pre-wrap text-center font-semibold leading-snug text-white ${
          post.content.length > 220 ? "text-lg" : post.content.length > 90 ? "text-xl" : "text-2xl"
        }`}
      >
        {post.content}
      </p>
      {linkMedia && linkHost && (
        <a
          href={linkMedia.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur transition hover:bg-black/55"
        >
          <Link2 size={15} />
          {linkHost}
        </a>
      )}
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
      {count !== undefined && (
        <span className="text-xs font-semibold text-white">
          {/* The value rolls up on change instead of snapping. */}
          <span key={String(count)} className="mesh-roll-in inline-block">{count}</span>
        </span>
      )}
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

// The slot shell: the scroll-snap target, the observer's stable identity, and
// the horizontal-swipe gesture. It stays mounted across lane swaps so the
// observer never loses this slot; the content within animates on each swap.
function Reel({
  post,
  slotIndex,
  active,
  nearActive = false,
  muted,
  onToggleMute,
  laneIndex,
  laneTotal,
  laneLoading,
  slideDir,
  onLaneSwipe,
  signedOut = false,
  connectedSet,
  onNeedsConnect,
  onWatchProgress,
}: {
  post: FlowPost;
  /** Position in the vertical list — the observer's identity for this slot,
   * stable even when the Flow wraps and a post id appears twice. */
  slotIndex: number;
  active: boolean;
  nearActive?: boolean;
  muted: boolean;
  onToggleMute: () => void;
  laneIndex: number;
  laneTotal: number;
  laneLoading: boolean;
  slideDir: 1 | -1 | 0;
  onLaneSwipe: (dir: 1 | -1) => void;
  signedOut?: boolean;
  connectedSet: Set<string>;
  onNeedsConnect: (platformId: string) => void;
  onWatchProgress: (postId: string, completion: number) => void;
}) {
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  // Shared with the tapped stage: a horizontal fling sets this so the trailing
  // click doesn't also pause/like. Lives here so it survives the content swap.
  const suppressTapRef = useRef(false);

  // GROUNDED CONTEXT — the same attribute contract the mesh's ContentLens and
  // the feed's PostCard emit, so Meshi can see what you are watching here too.
  // /flow had none of these, which is why asking Meshi about the reel on
  // screen produced an answer about nothing: getVisibleFocusedContent matched
  // no element and focusedContent was always null on this surface.
  //
  // Only the ACTIVE reel is announced. Marking every mounted slide would hand
  // Meshi three cards at once and let it answer about one already scrolled past.
  //
  // data-meshi-content-id carries the NATIVE post id only. The egress gate in
  // /api/meshi/chat resolves the author by this id to check THEIR Meshi memory
  // rule before any of their text reaches the provider; a platform-prefixed id
  // finds no Post row and the gate fails open. That is exactly the hole that
  // had to be fixed in ContentLens.
  const isNativePost = !post.platform || post.platform.toLowerCase() === "meshme";

  return (
    <section
      className="relative h-full w-full snap-start snap-always"
      data-flow-reel={String(slotIndex)}
      {...(active
        ? {
            "data-meshi-content-card": "true",
            "data-meshi-content-id": isNativePost ? post.id : "",
            "data-meshi-content-platform": (post.platform || "meshme").toLowerCase(),
            "data-meshi-content-author": post.author?.displayName ?? "",
            "data-meshi-content-text": (post.content || "").slice(0, 900),
            "data-meshi-content-url": post.externalUrl ?? "",
            "data-meshi-content-media": "video",
          }
        : {})}
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
      {/* Stage — centered 9:16 column on wide screens, full-bleed on phones.
          A single grid cell stacks the outgoing + incoming reels so both can
          animate the lane swap without shifting layout. */}
      <div className="absolute inset-0 grid place-items-center overflow-hidden">
        <AnimatePresence initial={false} custom={slideDir}>
          <ReelContent
            key={`${laneIndex}:${post.id}`}
            post={post}
            active={active}
            nearActive={nearActive}
            muted={muted}
            onToggleMute={onToggleMute}
            laneIndex={laneIndex}
            laneTotal={laneTotal}
            laneLoading={laneLoading}
            dir={slideDir}
            onLaneSwipe={onLaneSwipe}
            signedOut={signedOut}
            connectedSet={connectedSet}
            onNeedsConnect={onNeedsConnect}
            onWatchProgress={onWatchProgress}
            suppressTapRef={suppressTapRef}
          />
        </AnimatePresence>
      </div>
    </section>
  );
}

// One rendered reel's content — remounts per lane step (so like/caption state
// is always fresh for the shown post) and slides in/out via framer.
function ReelContent({
  post,
  active,
  nearActive = false,
  muted,
  onToggleMute,
  laneIndex,
  laneTotal,
  laneLoading,
  dir,
  onLaneSwipe,
  signedOut,
  connectedSet,
  onNeedsConnect,
  onWatchProgress,
  suppressTapRef,
}: {
  post: FlowPost;
  active: boolean;
  nearActive?: boolean;
  muted: boolean;
  onToggleMute: () => void;
  laneIndex: number;
  laneTotal: number;
  laneLoading: boolean;
  dir: 1 | -1 | 0;
  onLaneSwipe: (dir: 1 | -1) => void;
  signedOut: boolean;
  connectedSet: Set<string>;
  onNeedsConnect: (platformId: string) => void;
  onWatchProgress: (postId: string, completion: number) => void;
  suppressTapRef: React.MutableRefObject<boolean>;
}) {
  const router = useRouter();
  const native = !post.platform || post.platform === "mesh" || post.platform === "meshme";
  // The source platform of an external reel, and whether this viewer has it
  // connected/merged. Viewing is always open; this only gates the offer to
  // interact ON the source platform.
  const sourcePlatformId = native ? "" : normalizePlatformId(post.platform);
  const hasSourceAccount = !sourcePlatformId || connectedSet.has(sourcePlatformId);
  const hasVideo = post.media.some((m) => m.type === "video");
  const { addToast } = useToast();
  const [liked, setLiked] = useState(Boolean(post.reactions && post.reactions.length > 0));
  const [likeCount, setLikeCount] = useState(post._count.reactions);
  const [expanded, setExpanded] = useState(false);
  const captionRef = useRef<HTMLParagraphElement | null>(null);
  const [captionOverflows, setCaptionOverflows] = useState(false);
  // Measure once, while the caption is still clamped, whether it actually spills
  // past 2 lines — so the "more" toggle only appears when there's hidden text.
  useEffect(() => {
    const el = captionRef.current;
    if (el) setCaptionOverflows(el.scrollHeight > el.clientHeight + 2);
  }, [post.content]);
  const [showWhy, setShowWhy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [bursts, setBursts] = useState<HeartBurst[]>([]);
  // Bumps on every like so the rail heart flashes a radial glow ring.
  const [likePulse, setLikePulse] = useState(0);
  const [, startLike] = useTransition();
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<number | null>(null);

  const handleLike = (viaDoubleTap = false) => {
    // Guests can watch everything; interacting is the moment that asks for
    // an account.
    if (signedOut) {
      router.push("/login?next=/flow");
      return;
    }
    // Connect-to-interact: watching ANY platform's content is always free, but
    // liking an external platform's post requires that platform's account
    // connected or merged — the heart doesn't land until it is. (The server
    // enforces the same rule, so this gate can't be skipped.)
    if (!native && !hasSourceAccount) {
      onNeedsConnect(sourcePlatformId);
      return;
    }
    const next = viaDoubleTap ? true : !liked;
    if (next === liked && viaDoubleTap) return;
    setLiked(next);
    if (next) {
      playSound("heart");
      setLikePulse((n) => n + 1);
    }
    // External content shows the source platform's own like count — never move
    // it. Only a native mesh like changes our own count.
    if (native) setLikeCount((c) => c + (next ? 1 : -1));
    startLike(async () => {
      const res = native ? await toggleReaction(post.id) : await setFlowLike(post.id, next);
      if (res && "error" in res) {
        setLiked(!next);
        if (native) setLikeCount((c) => c + (next ? -1 : 1));
      }
    });
  };

  // Tap = pause/play (videos). Double-tap = like, with a heart cluster that
  // blooms from the exact tap point. The single-tap waits a beat so a second
  // tap can cancel it — no pause flicker while you're double-tapping.
  const handleStageTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressTapRef.current) return;
    const now = performance.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      if (singleTapTimerRef.current) {
        window.clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      // Double-tap likes native AND external content, blooming a heart cluster
      // from wherever the finger landed.
      handleLike(true);
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const reduce =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const id = now;
      setBursts((current) => [...current.slice(-3), { id, x, y, particles: reduce ? [] : makeHeartBurst() }]);
      window.setTimeout(() => setBursts((current) => current.filter((b) => b.id !== id)), 850);
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
      if (navigator.share) {
        await navigator.share({ url, title: `@${post.author.username} on mesh.me` });
      } else {
        // No Web Share API (most desktops): copy + confirm, so Share isn't inert.
        await navigator.clipboard.writeText(url);
        addToast("Link copied", "success");
      }
    } catch {
      // cancelled
    }
  };

  const platformChip = post.platform && !native ? PLATFORM_CHIP[post.platform.toLowerCase()] ?? "bg-white/20" : null;
  const postSourceUrl = sourceUrl(post);

  return (
    <motion.div
      className="relative h-full w-full cursor-pointer overflow-hidden bg-black sm:h-[calc(100%-1.5rem)] sm:w-auto sm:aspect-[9/16] sm:rounded-2xl"
      style={{ gridArea: "1 / 1" }}
      custom={dir}
      variants={laneStageVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={laneStageTransition}
      onClick={handleStageTap}
    >
          <ReelMedia post={post} active={active} nearActive={nearActive} paused={paused} muted={muted} onToggleMute={onToggleMute} onProgress={(c) => onWatchProgress(post.id, c)} />

          {/* Double-tap hearts bloom from the exact tap point — a cluster of
              hearts and a couple of cyan sparks flung outward, plus a ring. */}
          {bursts.map((b) => (
            <span key={b.id} className="pointer-events-none absolute z-20" style={{ left: b.x, top: b.y }}>
              <span className="absolute -translate-x-1/2 -translate-y-1/2">
                <Heart size={92} fill="currentColor" className="flow-heart-burst text-rose-500" />
              </span>
              <span className="mesh-burst-ring" style={{ borderColor: "rgba(244, 63, 94, 0.8)" }} aria-hidden />
              {b.particles.map((p, idx) => (
                <span
                  key={idx}
                  className="mesh-burst-particle"
                  style={{
                    ["--angle"]: p.angle,
                    ["--dist"]: p.dist,
                    width: p.size,
                    height: p.size,
                    margin: `${-p.size / 2}px 0 0 ${-p.size / 2}px`,
                    background: p.color,
                    // No boxShadow. Both of these were glows — `0 0 6px` of the
                    // particle's own colour — and nothing in this system emits
                    // light. A burst is bits of plastic flying off, and plastic
                    // is lit by the room, not from inside.
                  } as React.CSSProperties}
                  aria-hidden
                />
              ))}
            </span>
          ))}

          <span className="absolute left-3 top-3 z-10 flex flex-col items-start gap-1.5">
            {platformChip && (
              postSourceUrl ? (
                // The ONLY way out to the source platform: tapping the source
                // chip in the top-left. Nothing else (tap, fullscreen) leaves
                // mesh.me. Opens in a new tab; stops the stage tap underneath.
                <a
                  href={postSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Open on ${post.platform}`}
                  title={`Open on ${post.platform}`}
                  className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-micro font-semibold mesh-eyebrow text-white shadow transition active:scale-95 ${platformChip}`}
                >
                  <PlatformLogo platform={post.platform || ""} size={13} className="rounded" />
                  {post.platform}
                  <Link2 size={11} className="opacity-80" aria-hidden="true" />
                </a>
              ) : (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-micro font-semibold mesh-eyebrow text-white shadow ${platformChip}`}>
                  <PlatformLogo platform={post.platform || ""} size={13} className="rounded" />
                  {post.platform}
                </span>
              )
            )}
            {post.visibility && post.visibility !== "public" && (
              <span className="rounded-full bg-black/65 px-2.5 py-1 text-micro font-semibold mesh-eyebrow text-white/85 backdrop-blur">
                {post.visibility === "private" ? "Private · only you" : post.visibility}
              </span>
            )}
          </span>

          {/* Related-lane state: finding, or how deep into "similar" you are */}
          {laneLoading && (
            <span className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-micro font-semibold text-white backdrop-blur">
              <OrbitSparkle size={12} /> Finding similar…
            </span>
          )}
          {!laneLoading && laneIndex > 0 && (
            <span className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-micro font-semibold text-white backdrop-blur">
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
              <p className="text-xs font-semibold mesh-eyebrow text-white/50">Why this?</p>
              <p className="mt-1 text-sm font-medium text-white">
                {laneIndex > 0 ? "Similar to what you just watched" : post.whyThis}
              </p>
              <p className="mt-1.5 text-micro text-white/45">Nothing on mesh.me is paid placement or an ad.</p>
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
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
                    {(post.author.displayName || post.author.username).slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="truncate text-sm font-semibold">@{post.author.username}</span>
              </Link>
              {post.content && post.media.length > 0 && (
                <div className="mt-2 max-w-full text-[0.78125rem] leading-snug text-white/90">
                  {/* Captions default to 2 lines; a `<p>` (not a `block` button)
                      so the line-clamp's own display isn't overridden. */}
                  <p
                    ref={captionRef}
                    className={
                      expanded
                        ? "max-h-[32vh] overflow-y-auto whitespace-pre-wrap pr-1 [scrollbar-width:thin]"
                        : "line-clamp-2"
                    }
                  >
                    {post.content}
                  </p>
                  {captionOverflows && (
                    <button
                      type="button"
                      onClick={() => setExpanded((e) => !e)}
                      className="mt-0.5 text-micro font-semibold text-white/70 transition-colors hover:text-white"
                      aria-expanded={expanded}
                    >
                      {expanded ? "less" : "more"}
                    </button>
                  )}
                </div>
              )}
              <p className="mt-1.5 flex items-center gap-1.5 text-micro text-white/60">
                <Music2 size={11} />
                {post.platform && post.platform !== "mesh" && post.platform !== "meshme" ? `From ${post.platform}` : "Original on mesh.me"}
              </p>
            </div>
          </div>

          {/* Right action rail */}
          <div className="absolute bottom-16 right-2 flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <RailButton label="Like" count={formatCount(likeCount)} onClick={() => handleLike()} active={liked}>
              <span className="relative inline-flex items-center justify-center">
                {/* A radial glow ring flares out on every like. */}
                {likePulse > 0 && (
                  <span
                    key={likePulse}
                    className="mesh-burst-ring"
                    style={{ width: 26, height: 26, borderColor: "rgba(244, 63, 94, 0.7)" }}
                    aria-hidden
                  />
                )}
                {/* Springy overshoot with a quick hue flash toward magenta,
                    replayed only on an actual like (keyed to likePulse) so
                    unrelated re-renders don't retrigger it. */}
                <motion.span
                  key={likePulse}
                  className="inline-flex"
                  initial={likePulse === 0 ? false : { scale: 1.5, filter: "hue-rotate(-26deg) brightness(1.5)" }}
                  animate={{ scale: 1, filter: "hue-rotate(0deg) brightness(1)" }}
                  transition={{ type: "spring", stiffness: 360, damping: 12, mass: 0.7 }}
                >
                  <Heart size={28} fill={liked ? "currentColor" : "none"} className={liked ? "text-rose-500" : undefined} />
                </motion.span>
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
          </div>
    </motion.div>
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

// Algorithm Studio (MeshPro): the viewer's own ranking mix. Five sliders,
// 50 = neutral; validated again server-side, where Pro is enforced.
type StudioMix = {
  enabled: boolean;
  weights: { relationships: number; recency: number; discovery: number; interests: number; variety: number };
};
const STUDIO_STORAGE_KEY = "meshFlowStudio";
const STUDIO_DEFAULT: StudioMix = {
  enabled: false,
  weights: { relationships: 50, recency: 50, discovery: 50, interests: 50, variety: 50 },
};
const STUDIO_SLIDERS: Array<{ key: keyof StudioMix["weights"]; label: string; hint: string }> = [
  { key: "relationships", label: "Relationships", hint: "People you actually talk to" },
  { key: "recency", label: "Recency", hint: "How fresh things must be" },
  { key: "discovery", label: "Discovery", hint: "New creators and topics" },
  { key: "interests", label: "Interests", hint: "Formats and tags you enjoy" },
  { key: "variety", label: "Variety", hint: "No one voice dominates" },
];

function readStoredStudio(): StudioMix {
  if (typeof window === "undefined") return STUDIO_DEFAULT;
  try {
    const raw = localStorage.getItem(STUDIO_STORAGE_KEY);
    if (!raw) return STUDIO_DEFAULT;
    const parsed = JSON.parse(raw) as StudioMix;
    if (!parsed || typeof parsed !== "object" || !parsed.weights) return STUDIO_DEFAULT;
    const clamp = (v: unknown) => (Number.isFinite(Number(v)) ? Math.min(100, Math.max(0, Math.round(Number(v)))) : 50);
    return {
      enabled: parsed.enabled === true,
      weights: {
        relationships: clamp(parsed.weights.relationships),
        recency: clamp(parsed.weights.recency),
        discovery: clamp(parsed.weights.discovery),
        interests: clamp(parsed.weights.interests),
        variety: clamp(parsed.weights.variety),
      },
    };
  } catch {
    return STUDIO_DEFAULT;
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
  formStats,
}: {
  people: FlowSuggestedPerson[];
  refreshing: boolean;
  onLoadFlow: () => void;
  formStats?: { kept: number; long: number; unknown: number };
}) {
  // The Flow is shorts and reels only. When the pool was NOT empty but nothing
  // in it was short-form, saying "follow a few people" is simply wrong advice —
  // the viewer already has sources. Say what actually happened.
  const filtered = (formStats?.long ?? 0) + (formStats?.unknown ?? 0);
  const filteredOnly = filtered > 0 && (formStats?.kept ?? 0) === 0;
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
        <p className="text-xl font-semibold text-white">
          {filteredOnly ? "No shorts to play" : "Your Flow is waiting"}
        </p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-white/55">
          {filteredOnly
            ? `Flow plays shorts and reels only. ${filtered} recent ${filtered === 1 ? "item" : "items"} from your sources ${filtered === 1 ? "was" : "were"} long-form or did not report a length, so ${filtered === 1 ? "it is" : "they are"} not shown here — you will still find ${filtered === 1 ? "it" : "them"} in your feed.`
            : "Follow a few people and their posts, videos, and platform content stream here."}
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
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white">
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
                  className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
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
            className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
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
  formStats,
  suggestedPeople = [],
  signedOut = false,
  isPro = false,
  connectedPlatforms = [],
}: {
  initialPosts: FlowPost[];
  initialHasMore: boolean;
  /** What the shorts-only rule removed from the candidate pool. Lets an empty
   *  Flow say WHY instead of implying the viewer has no content at all. */
  formStats?: { kept: number; long: number; unknown: number };
  suggestedPeople?: FlowSuggestedPerson[];
  signedOut?: boolean;
  isPro?: boolean;
  /** Source platforms this viewer has connected/merged. Viewing every platform
   * stays open; this only decides when to offer "connect to interact there". */
  connectedPlatforms?: string[];
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
  const [studio, setStudio] = useState<StudioMix>(readStoredStudio);
  const studioRef = useRef(studio);
  studioRef.current = studio;
  const studioActive = isPro && studio.enabled;
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
  // Normalized set of the platforms this viewer has connected/merged. Used only
  // to decide when interacting with an external reel should offer to connect it.
  const connectedSet = useMemo(
    () => new Set(connectedPlatforms.map((p) => normalizePlatformId(p)).filter(Boolean)),
    [connectedPlatforms],
  );
  // A gentle, dismissible "connect <platform> to interact there" prompt, raised
  // the first time this session that a signed-in viewer engages with an external
  // reel from a platform they haven't merged. Viewing and the private mesh-side
  // taste like both stay open — this only surfaces the path to full interaction.
  const [connectPrompt, setConnectPrompt] = useState<{ id: string; name: string } | null>(null);
  const promptedPlatformsRef = useRef<Set<string>>(new Set());
  const connectPromptTimerRef = useRef<number | null>(null);
  const handleNeedsConnect = useCallback((platformId: string) => {
    if (!platformId || connectedSet.has(platformId)) return;
    if (promptedPlatformsRef.current.has(platformId)) return;
    promptedPlatformsRef.current.add(platformId);
    const name = getPlatformCapability(platformId)?.name ?? "this platform";
    setConnectPrompt({ id: platformId, name });
    if (connectPromptTimerRef.current) window.clearTimeout(connectPromptTimerRef.current);
    connectPromptTimerRef.current = window.setTimeout(() => setConnectPrompt(null), 7000);
  }, [connectedSet]);
  useEffect(() => () => {
    if (connectPromptTimerRef.current) window.clearTimeout(connectPromptTimerRef.current);
  }, []);
  const seenRef = useRef<Set<string>>(new Set());
  // Server-persisted "seen" beacon: reels the ranker should suppress on EVERY
  // device. Batched (every few reels / on tab-hide) and deduped so a reel is
  // reported at most once. The local `seen` param stays too — it still covers
  // the same session, the not-yet-flushed reel, and guests.
  const pendingSeenRef = useRef<Set<string>>(new Set());
  const reportedRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<number | null>(null);
  // Watch-time capture — Reels' primary ranking signal. Dwell milliseconds
  // accumulate for whichever reel currently owns the screen, and videos also
  // report the furthest fraction reached. Flushed with the seen beacon; only
  // ever shapes THIS viewer's own feed.
  const watchAccumRef = useRef<Map<string, { w: number; c: number }>>(new Map());
  const activeWatchRef = useRef<{ id: string | null; startedAt: number }>({ id: null, startedAt: 0 });
  // The reel on screen, tracked separately from the dwell clock so the clock
  // can fully SUSPEND while the tab is hidden and resume for the right reel.
  const displayedIdRef = useRef<string | null>(null);

  // Bank the elapsed dwell for the reel currently on screen and restart its
  // clock — called on reel change, on flush, and around tab-hide gaps.
  const foldActiveWatch = useCallback(() => {
    const cur = activeWatchRef.current;
    if (!cur.id) return;
    const now = Date.now();
    const delta = now - cur.startedAt;
    cur.startedAt = now;
    if (delta <= 0) return;
    const entry = watchAccumRef.current.get(cur.id) ?? { w: 0, c: 0 };
    entry.w = Math.min(120_000, entry.w + delta);
    watchAccumRef.current.set(cur.id, entry);
  }, []);

  const beginWatch = useCallback((id: string | null) => {
    foldActiveWatch();
    displayedIdRef.current = signedOut ? null : id;
    // The dwell clock only ever runs while the tab is visible — a reel that
    // becomes active under a hidden tab (a fetch resolving in the background)
    // starts its clock on the next visibilitychange back.
    const hidden = typeof document !== "undefined" && document.hidden;
    activeWatchRef.current = { id: hidden ? null : displayedIdRef.current, startedAt: Date.now() };
  }, [foldActiveWatch, signedOut]);

  // A failed non-beacon flush puts the watch quantities back, so a dropped
  // request can't freeze a genuinely-watched reel at a fast-skip reading.
  const restoreWatch = useCallback((entries: { i: string; w: number; c: number }[]) => {
    for (const e of entries) {
      const cur = watchAccumRef.current.get(e.i) ?? { w: 0, c: 0 };
      cur.w = Math.min(120_000, cur.w + e.w);
      cur.c = Math.max(cur.c, e.c);
      watchAccumRef.current.set(e.i, cur);
    }
  }, []);

  const reportWatchProgress = useCallback((id: string, completion: number) => {
    if (signedOut || !(completion > 0)) return;
    const entry = watchAccumRef.current.get(id) ?? { w: 0, c: 0 };
    const c = Math.min(1, completion);
    if (c > entry.c) {
      entry.c = c;
      watchAccumRef.current.set(id, entry);
    }
  }, [signedOut]);

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

  // Flush the pending seen-ids to the server. Best-effort: on tab-hide we use
  // sendBeacon (survives the page going away); otherwise a keepalive fetch.
  const flushSeen = useCallback((useBeacon = false) => {
    if (signedOut) return;
    foldActiveWatch();
    const pending = [...pendingSeenRef.current].filter((id) => !reportedRef.current.has(id));
    // Watch stats ride along with the seen ids. Sub-250ms dwell with no real
    // completion is scroll-past noise — leave it accumulating for next time.
    const watch = [...watchAccumRef.current.entries()]
      .filter(([, v]) => v.w >= 250 || v.c > 0)
      .slice(0, 60)
      .map(([i, v]) => ({ i, w: Math.round(v.w), c: Math.round(v.c * 1000) / 1000 }));
    if (pending.length === 0 && watch.length === 0) return;
    pendingSeenRef.current = new Set();
    pending.forEach((id) => reportedRef.current.add(id));
    for (const w of watch) watchAccumRef.current.delete(w.i);
    const bodyStr = JSON.stringify({ ids: pending, watch });
    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/flow/impression", new Blob([bodyStr], { type: "application/json" }));
      return;
    }
    void fetch("/api/flow/impression", {
      method: "POST",
      body: bodyStr,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
    })
      .then((res) => {
        if (!res.ok) restoreWatch(watch);
      })
      .catch(() => restoreWatch(watch));
  }, [signedOut, foldActiveWatch, restoreWatch]);

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
    // Accumulate for the server beacon — the guard above means this only fires
    // on a reel's first sighting. Flush in small batches, or after a short lull.
    if (!signedOut) {
      pendingSeenRef.current.add(id);
      if (pendingSeenRef.current.size >= 6) {
        flushSeen();
      } else {
        if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = window.setTimeout(() => flushSeen(), 4000);
      }
    }
  }, [signedOut, flushSeen]);

  // Make sure the last few watched reels reach the server even if the batch
  // never fills — flush when the tab is backgrounded or the page is unloading,
  // and once more on unmount.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        // Fold dwell up to the hide moment and ship it, then SUSPEND the
        // clock entirely — otherwise a later fold while still hidden (a
        // pagehide from the tab strip, a throttled timer) would book the
        // whole hidden stretch as watch time.
        flushSeen(true);
        activeWatchRef.current = { id: null, startedAt: 0 };
        if (flushTimerRef.current) {
          window.clearTimeout(flushTimerRef.current);
          flushTimerRef.current = null;
        }
      } else {
        // Resume the clock for whatever reel is on screen.
        activeWatchRef.current = { id: displayedIdRef.current, startedAt: Date.now() };
      }
    };
    const onPageHide = () => flushSeen(true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
      flushSeen(true);
    };
  }, [flushSeen]);

  const seenParam = useCallback(() => [...seenRef.current].slice(-200).join(","), []);

  // Studio mix rides along on ranked fetches (server re-validates Pro).
  const studioParam = useCallback(() => {
    const s = studioRef.current;
    if (!isPro || !s.enabled) return "";
    return `&studio=${encodeURIComponent(JSON.stringify(s.weights))}`;
  }, [isPro]);

  const persistStudio = useCallback((next: StudioMix) => {
    setStudio(next);
    studioRef.current = next;
    try {
      localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable — session-only is fine
    }
  }, []);

  // Swipe down at the very top (or just reload) to pull fresh content.
  const refresh = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setRefreshing(true);
    try {
      const res = await fetch(
        `/api/flow?limit=12&seen=${encodeURIComponent(seenParam())}&mode=${modeRef.current}${studioParam()}`,
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
  }, [seenParam, studioParam]);

  // Track which reel owns the screen. Lanes remount reels, so re-arm the
  // observer whenever either the list or a lane changes.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = Number((entry.target as HTMLElement).dataset.flowReel);
          if (Number.isFinite(idx) && idx >= 0) setActiveIndex(idx);
        }
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-flow-reel]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [posts.length, lanes]);

  // Whatever is on screen counts as watched — original or lane content. The
  // same moment starts its dwell clock (folding the previous reel's time).
  useEffect(() => {
    const slot = posts[activeIndex];
    if (!slot) return;
    const lane = lanes[slot.id];
    const displayed = lane && lane.index > 0 ? lane.posts[lane.index - 1] : slot;
    if (displayed) {
      markSeen(displayed.id);
      beginWatch(displayed.id);
    }
  }, [activeIndex, posts, lanes, markSeen, beginWatch]);

  // Pull the next ranked batch as the viewer nears the end. The server ranks;
  // we just tell it what we already have and what's been watched.
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    try {
      const exclude = postsRef.current.map((p) => p.id).slice(-300).join(",");
      const res = await fetch(
        `/api/flow?limit=12&exclude=${encodeURIComponent(exclude)}&seen=${encodeURIComponent(seenParam())}&mode=${modeRef.current}${studioParam()}`,
        { credentials: "same-origin" },
      );
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.posts)) {
        hasMoreRef.current = Boolean(data.hasMore) && data.posts.length > 0;
        setPosts((prev) => {
          // Recycled batches deliberately repeat ids — the Flow loops rather
          // than ends, so duplicates are welcome once supply wraps around.
          if (data.recycled) return [...prev, ...data.posts];
          const existing = new Set(prev.map((p) => p.id));
          return [...prev, ...data.posts.filter((p: FlowPost) => !existing.has(p.id))];
        });
      }
    } finally {
      loadingRef.current = false;
    }
  }, [seenParam, studioParam]);

  useEffect(() => {
    if (activeIndex >= posts.length - 3) void loadMore();
  }, [activeIndex, posts.length, loadMore]);

  // The server rendered Balanced; if the viewer's saved mode differs, re-rank
  // immediately on arrival.
  useEffect(() => {
    if (readStoredMode() !== "balanced" || (isPro && readStoredStudio().enabled)) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectMode = useCallback(
    (next: FlowMode) => {
      setShowModes(false);
      // Picking a preset hands control back to it — the Studio mix rests.
      if (studioRef.current.enabled) {
        persistStudio({ ...studioRef.current, enabled: false });
      } else if (next === modeRef.current) {
        return;
      }
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
    [refresh, persistStudio],
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

  // Escape closes the modes dialog — it's an explicit role="dialog", so a
  // keyboard user expects it to dismiss.
  useEffect(() => {
    if (!showModes) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModes(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showModes]);

  if (posts.length === 0) {
    return <FlowColdStart people={suggestedPeople} refreshing={refreshing} onLoadFlow={() => void refresh()} formStats={formStats} />;
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
          mode === "balanced" && !studioActive ? "bg-black/55 text-white hover:bg-black/75" : "bg-white/90 text-black hover:bg-white"
        }`}
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
        {studioActive ? "Studio" : FLOW_MODES.find((m) => m.id === mode)?.name}
      </button>
      <AnimatePresence>
        {showModes && (
        <motion.div
          key="flow-modes"
          className="absolute inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center"
          onClick={() => setShowModes(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            role="dialog"
            aria-label="Flow ranking modes"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border border-white/12 bg-[#0b0c14] p-5 pb-8 sm:rounded-3xl sm:pb-5"
            initial={{ y: 48, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.9 }}
          >
            <p className="text-base font-semibold text-white">How should your Flow rank?</p>
            <p className="mt-0.5 text-xs text-white/50">
              You steer the algorithm. No ads, no paid reach — ever.
            </p>
            <div className="mt-4 grid gap-1.5 mesh-cascade">
              {FLOW_MODES.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectMode(m.id)}
                  style={{ ["--i"]: idx } as React.CSSProperties}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    mode === m.id && !studioActive
                      ? "border-white/25 bg-white/10"
                      : "border-transparent hover:bg-white/5"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{m.name}</p>
                    <p className="text-xs text-white/55">{m.desc}</p>
                  </div>
                  {mode === m.id && !studioActive && <Check size={16} className="shrink-0 text-white" aria-hidden="true" />}
                </button>
              ))}
            </div>

            {/* Algorithm Studio — the MeshPro layer: your own mix, five
                sliders, applied server-side. Not a preset; a possession. */}
            <div className={`mt-5 rounded-2xl border px-4 py-4 ${studioActive ? "border-white/25 bg-white/10" : "border-white/10"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Your mix</p>
                  <p className="text-xs text-white/55">
                    {isPro ? "Tune the exact weights your Flow ranks by." : "A MeshPro control — tune the exact weights your Flow ranks by."}
                  </p>
                </div>
                {isPro ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={studio.enabled}
                    aria-label="Use my Studio mix"
                    onClick={() => {
                      persistStudio({ ...studio, enabled: !studio.enabled });
                      hasMoreRef.current = true;
                      void refresh();
                    }}
                    className={`relative shrink-0 rounded-full p-0 transition-colors ${studio.enabled ? "bg-white" : "bg-white/20"}`}
                    style={{ height: 24, width: 44, minHeight: 0, minWidth: 0 }}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${studio.enabled ? "left-[1.4rem] bg-black" : "left-0.5 bg-white"}`}
                    />
                  </button>
                ) : (
                  <Link href="/meshpro" className="shrink-0 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10">
                    MeshPro
                  </Link>
                )}
              </div>
              {isPro && (
                <div className="mt-3 grid gap-2.5">
                  {STUDIO_SLIDERS.map((s) => (
                    <label key={s.key} className="grid gap-1">
                      <span className="flex items-baseline justify-between text-xs text-white/70">
                        <span className="font-semibold text-white/90">{s.label}</span>
                        <span>{s.hint}</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={studio.weights[s.key]}
                        disabled={!studio.enabled}
                        onChange={(e) => {
                          const next = {
                            ...studio,
                            weights: { ...studio.weights, [s.key]: Number(e.target.value) },
                          };
                          persistStudio(next);
                        }}
                        onPointerUp={() => {
                          if (!studio.enabled) return;
                          hasMoreRef.current = true;
                          void refresh();
                        }}
                        className="h-1.5 w-full cursor-pointer accent-white disabled:opacity-40"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>
      {refreshing && (
        <div className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur">
          Refreshing your Flow…
        </div>
      )}
      {signedOut && (
        <div className="absolute inset-x-3 bottom-3 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-white/15 bg-black/75 px-4 py-3 backdrop-blur">
          <p className="min-w-0 text-xs leading-5 text-white/85">
            You&apos;re watching as a guest. Sign in to like, comment, and follow.
          </p>
          <Link
            href="/login?next=/flow"
            className="shrink-0 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-black transition hover:bg-white/90"
          >
            Sign in
          </Link>
        </div>
      )}
      {!signedOut && connectPrompt && (
        <div className="mesh-toast-in absolute inset-x-3 bottom-3 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-white/15 bg-black/80 px-4 py-3 backdrop-blur">
          <p className="min-w-0 text-xs leading-5 text-white/85">
            Watching is always free — liking a {connectPrompt.name} post needs your {connectPrompt.name} account. Connect it once and hearts land everywhere.
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href={`/connected-accounts?platform=${encodeURIComponent(connectPrompt.id)}&next=/flow&reason=like`}
              className="rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-black transition hover:bg-white/90"
            >
              Connect
            </Link>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setConnectPrompt(null)}
              className="rounded-full p-1.5 text-white/60 transition hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
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
              // Slot-stable so the shell (observer target, scroll-snap slot)
              // persists across lane swaps; the content inside re-keys instead.
              key={`${i}:${post.id}`}
              post={displayed}
              slotIndex={i}
              active={i === activeIndex}
              // The active reel and the next two preload their video in full so
              // playback starts instantly the moment you scroll onto them.
              nearActive={i >= activeIndex && i <= activeIndex + 2}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
              laneIndex={lane?.index ?? 0}
              laneTotal={lane?.posts.length ?? 0}
              laneLoading={lane?.loading ?? false}
              slideDir={slideDirs[post.id] ?? 0}
              onLaneSwipe={(dir) => void swipeLane(post.id, dir)}
              signedOut={signedOut}
              connectedSet={connectedSet}
              onNeedsConnect={handleNeedsConnect}
              onWatchProgress={reportWatchProgress}
            />
          );
        })}
      </div>
    </div>
  );
}
