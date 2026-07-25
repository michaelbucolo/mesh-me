"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { attachNormalizer, detachSafe } from "@/lib/audio-normalize";

/**
 * Native video everywhere: plays automatically (muted) the moment it scrolls
 * into view and pauses when it leaves, exactly like the big feeds — no matter
 * which platform the file originally came from. Tap the badge for sound.
 */
export function AutoplayVideo({
  src,
  poster,
  className,
  onAspectRatio,
}: {
  src: string;
  poster?: string;
  className?: string;
  /** Reports the natural width/height ratio once metadata (or the poster fallback) loads. */
  onAspectRatio?: (ratio: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Honor reduced-motion: don't autoplay for motion-sensitive users (the
        // <video> has no autoPlay attr, so this JS path is the only gate). Tap
        // to play still works below.
        const reduce =
          typeof window !== "undefined" &&
          window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && !reduce) {
            void el.play().catch(() => {});
          } else {
            el.pause();
          }
        }
      },
      { threshold: [0, 0.5] },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      // Normalizer graphs are element-lifetime — this is the documented no-op
      // that says so; the element and its nodes are GC'd together.
      detachSafe(el);
    };
  }, []);

  if (failed && poster) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={poster}
        alt=""
        onLoad={(e) => {
          const el = e.currentTarget;
          if (el.naturalWidth && el.naturalHeight) onAspectRatio?.(el.naturalWidth / el.naturalHeight);
        }}
        className={className}
      />
    );
  }

  return (
    <span className="relative block h-full w-full">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        loop
        muted={muted}
        playsInline
        preload="metadata"
        // Level cross-platform loudness once playback starts (never on
        // preload) so unmuting lands at one considered level. CORS-unsafe
        // sources keep their native audio path.
        onPlay={(e) => attachNormalizer(e.currentTarget)}
        onError={() => setFailed(true)}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          if (el.videoWidth && el.videoHeight) onAspectRatio?.(el.videoWidth / el.videoHeight);
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const el = videoRef.current;
          if (!el) return;
          if (el.paused) void el.play().catch(() => {});
          else el.pause();
        }}
        className={className}
      />
      <button
        type="button"
        aria-label={muted ? "Unmute" : "Mute"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMuted((m) => !m);
        }}
        // Was `bg-black/60 … text-white/90 backdrop-blur … active:scale-90`:
        // translucent, blurred, and shrinking away from the finger. The chip is
        // opaque now (--media-chip, with --media-ink pinned at 16.76:1 on it)
        // and the press conserves height — wall to zero, face down by exactly
        // that wall — so the bottom edge does not move.
        className="absolute bottom-2 right-2 grid h-11 w-11 place-items-center rounded-full bg-[var(--media-chip)] text-[var(--media-ink)] shadow-[0_var(--plinth-h-chip)_0_0_var(--media-chip-plinth)] transition-[translate,box-shadow] duration-[var(--dur-press)] ease-[var(--ease-give)] active:translate-y-[var(--plinth-h-chip)] active:shadow-[0_0_0_0_var(--media-chip-plinth)]"
      >
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
    </span>
  );
}
