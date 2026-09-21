"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { attachNormalizer, detachSafe } from "@/lib/audio-normalize";

/** Muted in-view playback; hidden, distant, reduced-motion and data-saving views stay quiet. */
export function AutoplayVideo({ src, poster, className, suspended = false }: {
  src: string;
  poster?: string;
  className?: string;
  suspended?: boolean;
}) {
  return <VideoPlayer key={src} src={src} poster={poster} className={className} suspended={suspended} />;
}

function VideoPlayer({ src, poster, className, suspended }: {
  src: string;
  poster?: string;
  className?: string;
  suspended: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const manualPause = useRef(false);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || failed) return;
    let visible = false;
    let disposed = false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    const syncPlayback = () => {
      if (disposed) return;
      if (visible && !document.hidden && !suspended && !reduce.matches && !connection?.saveData && !manualPause.current) {
        void video.play().then(() => {
          if (disposed || document.hidden || suspended || !visible || reduce.matches || connection?.saveData || manualPause.current) video.pause();
        }).catch(() => {});
      } else video.pause();
    };
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5);
      syncPlayback();
    }, { threshold: [0, 0.5] });
    const prepare = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        if (!connection?.saveData) video.preload = "metadata";
        prepare.disconnect();
      }
    }, { rootMargin: "300px" });
    observer.observe(video);
    prepare.observe(video);
    document.addEventListener("visibilitychange", syncPlayback);
    reduce.addEventListener("change", syncPlayback);
    connection?.addEventListener("change", syncPlayback);
    return () => {
      disposed = true;
      observer.disconnect();
      prepare.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
      reduce.removeEventListener("change", syncPlayback);
      connection?.removeEventListener("change", syncPlayback);
      video.pause();
      detachSafe(video);
    };
  }, [suspended, failed]);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      manualPause.current = false;
      void video.play().catch(() => {});
    } else {
      manualPause.current = true;
      video.pause();
    }
  };

  if (failed) {
    return poster ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={poster} alt="Video preview; playback unavailable" loading="lazy" decoding="async" className={className} />
    ) : <span className="flex h-full items-center justify-center px-4 text-center text-sm text-[var(--text-secondary)]">Video unavailable</span>;
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
        preload="none"
        onPlay={(event) => { attachNormalizer(event.currentTarget); setPlaying(true); }}
        onPause={() => setPlaying(false)}
        onError={() => setFailed(true)}
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); togglePlayback(); }}
        className={className}
      />
      <button type="button" aria-label={playing ? "Pause video" : "Play video"} onClick={(event) => { event.preventDefault(); event.stopPropagation(); togglePlayback(); }} className="absolute bottom-2 left-2 grid h-11 w-11 place-items-center rounded-full bg-[var(--media-chip)] text-[var(--media-ink)]">
        {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
      </button>
      <button type="button" aria-label={muted ? "Unmute" : "Mute"} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setMuted((value) => !value); }} className="absolute bottom-2 right-2 grid h-11 w-11 place-items-center rounded-full bg-[var(--media-chip)] text-[var(--media-ink)]">
        {muted ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
      </button>
    </span>
  );
}
