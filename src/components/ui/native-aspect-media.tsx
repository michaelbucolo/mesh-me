"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { attachNormalizer } from "@/lib/audio-normalize";
import { AutoplayVideo } from "@/components/feed/autoplay-video";

/**
 * One aspect-ratio policy for every in-card media stage outside the Flow
 * (feed cards, post detail, external detail, MeChat attachments).
 *
 * - The frame reserves space with a CSS aspect-ratio from first paint
 *   (`defaultRatio` until the media is measured), so layout never jumps.
 * - Once the media reports its natural size (img onLoad / video
 *   loadedmetadata), the frame adopts the NATIVE ratio, clamped to sane
 *   bounds (default 4:5 portrait through 16:9 landscape).
 * - In-bounds media fills the frame edge-to-edge — the ratios match, so
 *   nothing is cropped or stretched. Out-of-bounds media (tall screenshots,
 *   panoramas) is shown WHOLE (object-contain) over a blurred fill of
 *   itself — the same treatment the Flow's reel stage uses — instead of
 *   being hard-cropped.
 */

const RATIO_EPSILON = 0.01;

interface NativeAspectMediaProps {
  media: { url: string; type: string; posterUrl?: string | null };
  alt?: string;
  /** Frame classes (width, rounding, max-heights, background). `w-full` by default. */
  className?: string;
  /** Extra classes for image media only (e.g. hover zoom transforms). */
  imageClassName?: string;
  /** next/image sizes hint for image media. */
  sizes?: string;
  /** Eagerly load + prioritize (above-the-fold first card). */
  eager?: boolean;
  /** "autoplay" = muted in-view AutoplayVideo; "controls" = native player. */
  videoMode?: "autoplay" | "controls";
  /** Widest portrait frame allowed (width / height). */
  minRatio?: number;
  /** Widest landscape frame allowed (width / height). */
  maxRatio?: number;
  /** Ratio the frame reserves before the media has been measured. */
  defaultRatio?: number;
}

export function NativeAspectMedia({
  media,
  alt = "",
  className,
  imageClassName,
  sizes = "(max-width: 640px) 100vw, 640px",
  eager,
  videoMode = "autoplay",
  minRatio = 4 / 5,
  maxRatio = 16 / 9,
  defaultRatio = 4 / 5,
}: NativeAspectMediaProps) {
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);

  const captureRatio = (ratio: number) => {
    if (Number.isFinite(ratio) && ratio > 0) setNaturalRatio(ratio);
  };

  const frameRatio =
    naturalRatio === null ? defaultRatio : Math.min(maxRatio, Math.max(minRatio, naturalRatio));
  // Out-of-bounds media letterboxes whole over a blurred self-fill instead of
  // hard-cropping; in-bounds media matches the frame, so cover never crops.
  const contained =
    naturalRatio !== null &&
    (naturalRatio < minRatio - RATIO_EPSILON || naturalRatio > maxRatio + RATIO_EPSILON);
  const isVideo = media.type.toLowerCase() === "video";
  const blurSrc = isVideo ? media.posterUrl : media.url;
  const fitClass = contained ? "object-contain" : "object-cover";

  return (
    <div
      className={cn("relative block w-full overflow-hidden", className)}
      style={{ aspectRatio: String(frameRatio) }}
    >
      {contained && blurSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={blurSrc}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
        />
      )}
      {isVideo ? (
        videoMode === "controls" ? (
          <video
            src={media.url}
            poster={media.posterUrl || undefined}
            controls
            preload="metadata"
            playsInline
            // Level cross-platform loudness once playback starts (never on
            // preload). CORS-unsafe sources keep their native audio path.
            onPlay={(event) => attachNormalizer(event.currentTarget)}
            onLoadedMetadata={(event) => {
              const el = event.currentTarget;
              if (el.videoWidth && el.videoHeight) captureRatio(el.videoWidth / el.videoHeight);
            }}
            className={cn("relative h-full w-full", fitClass)}
          />
        ) : (
          <AutoplayVideo
            src={media.url}
            poster={media.posterUrl || undefined}
            onAspectRatio={captureRatio}
            className={cn("relative h-full w-full", fitClass)}
          />
        )
      ) : media.url.startsWith("data:") || media.url.startsWith("blob:") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.url}
          alt={alt}
          onLoad={(event) => {
            const el = event.currentTarget;
            if (el.naturalWidth && el.naturalHeight) captureRatio(el.naturalWidth / el.naturalHeight);
          }}
          className={cn("relative h-full w-full", fitClass, imageClassName)}
        />
      ) : (
        <Image
          src={media.url}
          alt={alt}
          fill
          sizes={sizes}
          priority={Boolean(eager)}
          loading={eager ? undefined : "lazy"}
          decoding="async"
          onLoad={(event) => {
            const el = event.currentTarget;
            if (el.naturalWidth && el.naturalHeight) captureRatio(el.naturalWidth / el.naturalHeight);
          }}
          className={cn(fitClass, imageClassName)}
        />
      )}
    </div>
  );
}
