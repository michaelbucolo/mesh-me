/**
 * Classify external/platform media by URL so the UI never points an <img> at
 * a video file or a <video> at a thumbnail or a platform page link.
 *
 * Connected-platform items arrive with loose hints (postType "reel",
 * mediaType "video") and URLs that may be a playable file, a still, or just a
 * link to the post on the platform (e.g. a YouTube watch URL). Rendering was
 * trusting the hints alone, which produced <video src="thumbnail.jpg"> and
 * <img src="clip.mp4"> — the "photos and videos don't show correctly" class
 * of bugs. Everything that maps platform content to renderable media goes
 * through here instead.
 */

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv|3gp)($|[?#])/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|heic|heif|bmp|svg)($|[?#])/i;
const VIDEO_POST_TYPES = new Set(["video", "reel", "short", "shorts", "story", "stream", "clip"]);

export type ExternalMediaEntry = {
  id: string;
  url: string;
  type: "video" | "image";
  /** Still frame for video entries — used as the <video poster>. */
  posterUrl?: string;
};

export function classifyMediaUrl(url: string | null | undefined): "video" | "image" | null {
  if (!url) return null;
  if (VIDEO_EXT.test(url)) return "video";
  if (IMAGE_EXT.test(url)) return "image";
  return null;
}

/**
 * Build the renderable media for one external item. Guarantees:
 * - a "video" entry always points at a playable file URL (with the thumbnail
 *   carried along as its poster);
 * - a video we can't play in-app (page link, no file) degrades to its
 *   thumbnail as an image — visible content instead of a black <video>;
 * - an "image" entry prefers the full-resolution URL over the thumbnail.
 */
export function buildExternalMedia(opts: {
  id: string;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  postType?: string | null;
  mediaType?: string | null;
}): ExternalMediaEntry[] {
  const { id, mediaUrl, thumbnailUrl } = opts;
  const hintVideo =
    VIDEO_POST_TYPES.has((opts.postType || "").toLowerCase()) ||
    (opts.mediaType || "").toLowerCase() === "video";
  const mediaKind = classifyMediaUrl(mediaUrl);
  const thumbKind = classifyMediaUrl(thumbnailUrl);

  const playable = mediaKind === "video" ? mediaUrl : thumbKind === "video" ? thumbnailUrl : null;
  // Full-resolution image beats its thumbnail; a video's still IS the thumbnail.
  const still =
    mediaKind === "image"
      ? mediaUrl
      : thumbKind !== "video" && thumbnailUrl
        ? thumbnailUrl
        : null;

  if (playable) {
    return [{ id: `${id}-video`, url: playable, type: "video", ...(still ? { posterUrl: still } : {}) }];
  }

  // No playable file. Show the best still we have; an unknown-extension
  // mediaUrl only counts as an image when nothing marked the item as video.
  const fallbackStill = still || (!hintVideo && mediaUrl ? mediaUrl : null);
  return fallbackStill ? [{ id: `${id}-image`, url: fallbackStill, type: "image" }] : [];
}

/** Best displayable still for canvas thumbnails and hover cards. */
export function bestStillUrl(opts: {
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
}): string | null {
  const entries = buildExternalMedia({ id: "still", ...opts });
  const first = entries[0];
  if (!first) return null;
  return first.type === "image" ? first.url : first.posterUrl ?? null;
}
