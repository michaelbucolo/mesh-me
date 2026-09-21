"use client";

import Image from "next/image";
import { Expand, ImageOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { mediaFrameRatio, type MediaDimensions } from "@/lib/media-layout";
import { attachNormalizer } from "@/lib/audio-normalize";
import { AutoplayVideo } from "@/components/feed/autoplay-video";
import { Modal } from "@/components/ui/modal";

type MediaAsset = MediaDimensions & { url: string; type: string; posterUrl?: string | null };

interface NativeAspectMediaProps {
  media: MediaAsset;
  alt?: string;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  eager?: boolean;
  videoMode?: "autoplay" | "controls";
  minRatio?: number;
  maxRatio?: number;
  defaultRatio?: number;
  /** Use the parent's fixed height, for gallery cells and the full-size viewer. */
  fillFrame?: boolean;
  /** Full view stays in Mesh and uses the same authorized media URL. */
  expandable?: boolean;
}

/**
 * Every shape is shown whole. Stored dimensions reserve a native, bounded frame
 * at first paint; older media keeps its fallback frame after decoding. This
 * avoids feed/thread reflow and max-height cropping, without a duplicate blur image.
 */
export function NativeAspectMedia(props: NativeAspectMediaProps) {
  // A reused carousel slot must not inherit another URL's failed/expanded state.
  return <MediaFrame key={`${props.media.url}:${props.media.type}`} {...props} />;
}

function MediaFrame({
  media,
  alt = "",
  className,
  imageClassName,
  sizes = "(max-width: 640px) 100vw, 640px",
  eager = false,
  videoMode = "autoplay",
  minRatio = 4 / 5,
  maxRatio = 16 / 9,
  defaultRatio = 4 / 5,
  fillFrame = false,
  expandable = false,
}: NativeAspectMediaProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const mediaType = media.type.toLowerCase();
  const isVideo = ["video", "reel", "short", "stream"].includes(mediaType) || mediaType.startsWith("video/");
  const ratio = mediaFrameRatio(media, defaultRatio, minRatio, maxRatio);
  const imageClasses = cn("object-contain", imageClassName);
  useEffect(() => {
    if (!isVideo || videoMode !== "controls") return;
    const video = frameRef.current?.querySelector("video");
    if (!video) return;
    const pauseHidden = () => { if (document.hidden) video.pause(); };
    document.addEventListener("visibilitychange", pauseHidden);
    return () => { document.removeEventListener("visibilitychange", pauseHidden); video.pause(); };
  }, [isVideo, videoMode, failed]);


  return (
    <>
      <div
        ref={frameRef}
        className={cn("relative block w-full overflow-hidden bg-[var(--paper-2)]", fillFrame && "h-full", className)}
        style={fillFrame ? undefined : { aspectRatio: String(ratio) }}
      >
        <div className="absolute inset-0">
          {failed ? (
            <div className="flex h-full min-h-24 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-[var(--text-secondary)]">
              <ImageOff size={24} aria-hidden="true" />
              <span>{isVideo ? "Video unavailable" : "Image unavailable"}</span>
            </div>
          ) : isVideo ? (
            videoMode === "controls" ? (
              <video
                src={media.url}
                poster={media.posterUrl || undefined}
                controls
                preload={eager ? "metadata" : "none"}
                playsInline
                aria-label={alt || "Shared video"}
                onPlay={(event) => attachNormalizer(event.currentTarget)}
                onError={() => setFailed(true)}
                className="h-full w-full object-contain"
              />
            ) : (
              <AutoplayVideo
                src={media.url}
                poster={media.posterUrl || undefined}
                suspended={expanded}
                className="h-full w-full object-contain"
              />
            )
          ) : media.url.startsWith("data:") || media.url.startsWith("blob:") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.url} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailed(true)} className={cn("h-full w-full", imageClasses)} />
          ) : (
            <Image
              src={media.url}
              alt={alt}
              fill
              sizes={sizes}
              priority={eager}
              loading={eager ? undefined : "lazy"}
              decoding="async"
              // Private media is fetched by the viewer's browser with its session,
              // never through a shared image optimizer without those credentials.
              unoptimized={media.url.startsWith("/api/")}
              onError={() => setFailed(true)}
              className={imageClasses}
            />
          )}
        </div>
        {expandable && !failed && (
          <button
            ref={expandRef}
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              frameRef.current?.querySelector("video")?.pause();
              setExpanded(true);
            }}
            className="absolute right-2 top-2 z-10 grid h-11 w-11 place-items-center rounded-full bg-[var(--media-chip)] text-[var(--media-ink)] shadow-sm"
            aria-label={isVideo ? "View full video" : "View full image"}
          >
            <Expand size={17} aria-hidden="true" />
          </button>
        )}
      </div>
      {expandable && (
        <Modal open={expanded} onClose={() => setExpanded(false)} returnFocusRef={expandRef} title={isVideo ? "Video" : "Image"} className="max-h-[92dvh] max-w-5xl">
          <div className="h-[min(65dvh,48rem)] w-full overflow-hidden rounded-xl bg-[var(--paper-2)]">
            <NativeAspectMedia media={media} alt={alt} videoMode="controls" sizes="(max-width: 1024px) 100vw, 1024px" eager fillFrame />
          </div>
        </Modal>
      )}
    </>
  );
}
