// The Content Lens — an immersive reader that opens over the mesh when you
// tap a post or activity. You read the full content and its media, react to
// it, and glide to the next piece of content on your mesh without ever
// leaving the web. Extracted from the old mesh-scene.tsx; share rides the
// ONE useShare() flow, the stream label comes from meshCopy, and Escape is
// handled by the chrome stacking manager (topmost-layer dismissal), so the
// lens itself only listens for the arrow keys. During a Catch-up tour the
// lens grows a progress-dots row with pause/resume, and any interaction
// inside the panel pauses the auto-advance.

"use client";

import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  Maximize2,
  MessageCircle,
  Minimize2,
  Pause,
  Play,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toggleReaction } from "@/lib/actions";
import { openMeshi } from "@/lib/meshi-events";
import { PlatformLogo } from "@/components/platform/platform-logo";
import { getVideoEmbedUrl } from "@/lib/video-embed";
import type { ViewerCaps } from "../core/viewer";
import type { SceneNode } from "../scene/scene-model";
import { impressionIdFor, nativePostId } from "./seen-bridge";
import { useShare } from "./use-share";

/** Catch-up mode riding the lens: where the auto-advancing tour stands. */
export interface LensCatchUp {
  index: number;
  total: number;
  paused: boolean;
  onTogglePause: () => void;
  /** Any interaction inside the lens pauses the auto-advance. */
  onInteract: () => void;
}

function metaCount(node: SceneNode, label: string): number {
  const v = node.meta?.find((m) => m.label === label)?.value;
  const n = v ? parseInt(v, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function ContentLens({
  node,
  list,
  viewer,
  streamLabel = "on your mesh",
  catchup = null,
  onHearted,
  onClose,
  onNavigate,
}: {
  node: SceneNode;
  list: SceneNode[];
  /** The Global view is READ-ONLY: no like/reaction writes and no impression
   * tracking. Read actions (share, comment link, Ask Meshi) stay available. */
  viewer: ViewerCaps;
  streamLabel?: string;
  /** Present while this lens is a Catch-up stream (progress dots + pause). */
  catchup?: LensCatchUp | null;
  /** Called on a like so the scene can throw a visible heart at the node. */
  onHearted?: (node: SceneNode) => void;
  onClose: () => void;
  onNavigate: (dir: 1 | -1) => void;
}) {
  const readOnly = viewer.isGlobalReadOnly;
  const index = list.findIndex((n) => n.id === node.id);
  const total = list.length;
  const postId = nativePostId(node);
  const isExternal = Boolean(node.href && node.href.startsWith("http"));
  // Page-link videos (YouTube/Vimeo/Twitch) play in the lens via their embed
  // player whenever there's no playable file.
  const lensEmbedUrl = !node.videoUrl ? getVideoEmbedUrl(node.href, { autoplay: true, muted: true }) : null;

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(metaCount(node, "Likes"));
  const [likePending, startLike] = useTransition();

  // Same autoplay fix as the flow reels: a JSX `muted` sets only the attribute,
  // but the browser's autoplay policy gates on the muted PROPERTY — set it
  // imperatively and kick playback so a lens video file actually starts.
  const lensVideoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = lensVideoRef.current;
    if (!el) return;
    el.muted = true;
    void el.play().catch(() => {});
  }, [node.videoUrl]);

  // Fullscreen happens INSIDE mesh.me — like the Flow, we request it on OUR
  // media wrapper (which keeps mesh.me's chrome and just fills the screen),
  // never on the embedded iframe/source. The source only opens if you tap the
  // provenance link. Mirrors the Flow's in-app fullscreen so the two match.
  const mediaWrapRef = useRef<HTMLDivElement>(null);
  const [isLensFullscreen, setIsLensFullscreen] = useState(false);
  const hasMedia = Boolean(node.videoUrl || lensEmbedUrl || node.imageUrl);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => setIsLensFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleLensFullscreen = () => {
    const el = mediaWrapRef.current;
    if (typeof document === "undefined" || !el) return;
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void el.requestFullscreen?.().catch(() => {});
  };

  // A native post you OPEN on the mesh counts as "seen" — record it in the same
  // Flow impression store so the Flow's ranker never replays something you
  // already encountered on the mesh. The FROZEN contract lives in
  // seen-bridge.ts (native ids only, never Global — impressionIdFor returns
  // null otherwise; the endpoint itself writes nothing for guests) and is
  // pinned by scripts/mesh-seen-bridge-contract.ts. Best-effort; the endpoint
  // self-dedupes, so re-opening is harmless.
  const seenId = impressionIdFor(node, viewer);
  useEffect(() => {
    if (!seenId) return;
    void fetch("/api/flow/impression", {
      method: "POST",
      body: JSON.stringify({ ids: [seenId] }),
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => {});
  }, [seenId]);

  // Keyboard: arrows browse. (Escape is the chrome stacking manager's — it
  // closes the topmost layer, which is this lens whenever it's on top.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Typing elsewhere — like the Meshi chat opened from this lens — must
      // not browse the lens under the caret.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "ArrowRight") onNavigate(1);
      else if (e.key === "ArrowLeft") onNavigate(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNavigate]);

  const handleLike = () => {
    if (!postId || readOnly) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    // Liking is a physical act in the world: your Meshi throws the heart.
    if (next) onHearted?.(node);
    startLike(async () => {
      const res = await toggleReaction(postId);
      if (res && "error" in res) {
        setLiked(!next);
        setLikeCount((c) => c + (next ? -1 : 1));
      }
    });
  };

  const commentCount = metaCount(node, "Comments");

  // Share a post straight from the mesh — the source URL for external items,
  // otherwise an absolute mesh.me link to the post. Falls back to copying the
  // link (with a brief "Copied" tick) when no native/Web share sheet exists.
  const { copied: shareCopied, share } = useShare();
  const handleShare = () => {
    const url = isExternal
      ? node.href!
      : node.href
        ? `${window.location.origin}${node.href}`
        : typeof window !== "undefined"
          ? window.location.href
          : "";
    share({
      title: node.label || "mesh.me",
      text: node.content ? node.content.slice(0, 160) : node.label,
      url,
      dialogTitle: "Share post",
    });
  };

  return (
    <div
      className="absolute inset-0 z-50 flex animate-[fadeIn_.18s_ease] items-end justify-center bg-black/65 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom)+var(--mobile-nav-h,0px))] backdrop-blur-md sm:items-center sm:pb-3"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="mesh-panel relative flex w-full max-w-lg animate-[bubbleIn_.36s_cubic-bezier(0.22,1,0.36,1)] flex-col overflow-hidden rounded-3xl shadow-2xl"
        onPointerDown={(e) => {
          e.stopPropagation();
          // Touching the reader is a "wait, I'm reading" — pause catch-up.
          catchup?.onInteract();
        }}
        // The lens speaks Meshi's focused-content contract, so asking Meshi
        // about "this post" works on the mesh exactly like it does on the feed.
        data-meshi-content-card="true"
        // The NATIVE post id, not the scene id. Scene ids are prefixed
        // (`post:abc`, `friend-post:person:abc`) and the server resolves this
        // field against the Post table to check the author's Meshi consent
        // before their handle and post body go to a model. A prefixed id finds
        // no row, and a gate that finds no row lets everything through — so the
        // lens speaks the same id the feed card does, through the one helper
        // that knows the prefix format.
        data-meshi-content-id={nativePostId(node) ?? node.id}
        data-meshi-content-platform={isExternal ? node.sublabel || "external" : "meshme"}
        data-meshi-content-author={node.label}
        data-meshi-content-text={(node.content || node.label).slice(0, 900)}
        data-meshi-content-url={node.href}
        data-meshi-content-media={node.videoUrl || lensEmbedUrl ? "video" : node.imageUrl ? "image" : ""}
      >
        {/* Media stage — everything plays right here on the mesh: video files
            natively, platform pages through their embed players, stills as
            images. Leaving mesh.me is never required to watch. */}
        {hasMedia && (
          <div
            ref={mediaWrapRef}
            className={`relative bg-black${isLensFullscreen ? " flex h-full w-full items-center justify-center" : ""}`}
          >
            {node.videoUrl ? (
              <video
                ref={lensVideoRef}
                src={node.videoUrl}
                poster={node.imageUrl ?? undefined}
                controls
                autoPlay
                muted
                playsInline
                className={`w-full bg-black object-contain ${isLensFullscreen ? "h-full max-h-full" : "max-h-[46vh]"}`}
              />
            ) : lensEmbedUrl ? (
              <div className={`w-full bg-black ${isLensFullscreen ? "flex h-full items-center justify-center" : "aspect-video"}`}>
                <iframe
                  src={lensEmbedUrl}
                  title="Player"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className={isLensFullscreen ? "aspect-video max-h-full w-full border-0" : "h-full w-full border-0"}
                />
              </div>
            ) : node.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={node.imageUrl}
                alt=""
                className={`w-full ${isLensFullscreen ? "h-full max-h-full object-contain" : "max-h-[46vh] object-cover"}`}
              />
            ) : null}
            {/* In-app fullscreen (video/embed): fills the screen with the player
                still inside mesh.me. The source only opens via the provenance
                link below — fullscreen never leaves for the native site. */}
            {(node.videoUrl || lensEmbedUrl) && (
              <button
                type="button"
                aria-label={isLensFullscreen ? "Exit fullscreen" : "Fullscreen"}
                onClick={toggleLensFullscreen}
                className="mesh-glass mesh-ctl ds-focus-ring absolute right-3 top-3 z-10 rounded-full p-2 text-[var(--text-secondary)] transition active:scale-90"
              >
                {isLensFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 p-5">
          {/* Source */}
          <div className="flex items-center gap-3">
            {node.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={node.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : node.sublabel && !node.sublabel.startsWith("@") ? (
              <PlatformLogo platform={node.sublabel} size={36} className="shrink-0 rounded-xl" />
            ) : (
              <span
                className="h-9 w-9 shrink-0 rounded-full"
                style={{ background: `radial-gradient(circle at 34% 30%, #ffffff55, ${node.color})` }}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{node.label}</p>
              {node.sublabel && <p className="truncate text-xs text-[var(--text-tertiary)]">{node.sublabel}</p>}
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--paper-2)] px-2.5 py-1 text-micro font-medium mesh-eyebrow text-[var(--text-tertiary)]">
              <Sparkles size={11} />
              {node.kind === "activity" ? "Activity" : "Post"}
            </span>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded-md p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--paper-hover)] hover:text-[var(--text-primary)]"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          {node.content ? (
            <p className="max-h-[28vh] overflow-y-auto whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-[var(--text-secondary)]">
              {node.content}
            </p>
          ) : (
            <p className="text-sm text-[var(--text-tertiary)]">{node.label}</p>
          )}

          {/* Engagement */}
          <div className="flex items-center gap-2 border-t border-[var(--rule)] pt-3">
            {/* Read-only (Global): no interactive Like — it's a write that
                notifies the author. Share/Comment/Ask-Meshi (reads) remain. */}
            {readOnly ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-tertiary)]">
                <Heart size={14} />
                {likeCount}
              </span>
            ) : (
              <button
                type="button"
                aria-label={liked ? "Unlike" : "Like"}
                onClick={handleLike}
                disabled={!postId || likePending}
                className={`mesh-bubble-btn inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  // Rose is the liked-heart INK, exactly as the Flow draws it
                  // (flow-client.tsx:965). The `bg-rose-500/15` wash it used to
                  // ride with was the outlier: pigment here is ink, and the face
                  // under a liked heart is the same face as under an unliked
                  // one — the heart changes, not the button.
                  liked ? "bg-[var(--paper-2)] text-rose-500" : "bg-[var(--paper-2)] text-[var(--text-secondary)] hover:bg-[var(--paper-hover)]"
                } ${!postId ? "cursor-default opacity-70" : ""}`}
              >
                <span
                  key={likeCount}
                  className="inline-flex"
                  style={liked ? { animation: "meshHeartPop .45s ease" } : undefined}
                >
                  <Heart size={14} fill={liked ? "currentColor" : "none"} />
                </span>
                {likeCount}
              </button>
            )}

            {node.href && !isExternal ? (
              <Link
                href={node.href}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--paper-hover)]"
              >
                <MessageCircle size={14} />
                {commentCount > 0 ? commentCount : "Comment"}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-tertiary)]">
                <MessageCircle size={14} />
                {commentCount}
              </span>
            )}

            <button
              type="button"
              onClick={() => openMeshi("chat")}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--paper-hover)]"
            >
              <Sparkles size={14} />
              Ask Meshi
            </button>

            <button
              type="button"
              aria-label="Share post"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--paper-hover)]"
            >
              {shareCopied ? <Check size={14} /> : <Share2 size={14} />}
              {shareCopied ? "Copied" : "Share"}
            </button>

            {isExternal && node.href && (
              // Secondary by design: everything plays here; the source link is
              // provenance, not a requirement.
              <Link
                href={node.href}
                target="_blank"
                className="ml-auto inline-flex items-center gap-1 text-micro font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
              >
                <ExternalLink size={11} />
                {node.sublabel || "source"}
              </Link>
            )}
          </div>
        </div>

        {/* Catch-up progress — dots for every unseen stop, pause/resume for
            the auto-advance. Reading (any touch in the panel) pauses too.

            The cyan tint band, the cyan pause glyph and the two cyan dot states
            are gone. A progress row is position — where am I, how far is left —
            and position is legible in ink. The hue carried no information:
            there is nothing else in this row it could contrast with. */}
        {catchup && (
          <div className="flex items-center justify-center gap-2.5 border-t border-[var(--rule)] bg-[var(--paper-2)] px-4 py-2">
            <button
              type="button"
              aria-label={catchup.paused ? "Resume catch-up" : "Pause catch-up"}
              onClick={catchup.onTogglePause}
              className="rounded-full bg-[var(--paper-3)] p-1.5 text-[var(--text-primary)] transition-colors hover:bg-[var(--paper-hover)]"
            >
              {catchup.paused ? <Play size={12} /> : <Pause size={12} />}
            </button>
            {catchup.total <= 14 ? (
              <div className="flex items-center gap-1.5" aria-label={`Catch-up: ${catchup.index + 1} of ${catchup.total}`}>
                {Array.from({ length: catchup.total }, (_, i) => (
                  <span
                    key={i}
                    className={`rounded-full transition-all ${
                      i === catchup.index
                        ? "h-2 w-2 bg-[var(--text-primary)]"
                        : i < catchup.index
                          ? "h-1.5 w-1.5 bg-[var(--text-tertiary)]"
                          : "h-1.5 w-1.5 bg-[var(--paper-3)]"
                    }`}
                  />
                ))}
              </div>
            ) : (
              <span className="text-micro font-semibold text-cyan-100/80">
                {catchup.index + 1} / {catchup.total}
              </span>
            )}
            <span className="text-micro font-medium mesh-eyebrow text-cyan-100/50">
              {catchup.paused ? "Paused" : "Catch-up"}
            </span>
          </div>
        )}

        {/* Stream controls — browse content across the mesh */}
        {total > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--rule)] bg-black/30 px-4 py-2.5">
            <button
              type="button"
              onClick={() => onNavigate(-1)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--paper-hover)] hover:text-[var(--text-primary)]"
            >
              <ChevronLeft size={15} />
              Prev
            </button>
            <span className="text-micro font-medium text-[var(--text-tertiary)]">
              {index >= 0 ? index + 1 : 1} / {total} {streamLabel}
            </span>
            <button
              type="button"
              onClick={() => onNavigate(1)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--paper-hover)] hover:text-[var(--text-primary)]"
            >
              Next
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
