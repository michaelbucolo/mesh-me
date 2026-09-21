export type MediaDimensions = { width?: number | null; height?: number | null };

/** Reserve the final frame before decoding. Unknown dimensions keep a stable fallback. */
export function mediaFrameRatio(media: MediaDimensions, fallback = 4 / 5, minimum = 4 / 5, maximum = 16 / 9): number {
  const min = Number.isFinite(minimum) && minimum > 0 ? minimum : 4 / 5;
  const max = Number.isFinite(maximum) && maximum >= min ? maximum : Math.max(min, 16 / 9);
  const known = Number.isFinite(media.width) && Number.isFinite(media.height) && (media.width ?? 0) > 0 && (media.height ?? 0) > 0;
  const preferred = known ? media.width! / media.height! : Number.isFinite(fallback) && fallback > 0 ? fallback : 4 / 5;
  return Math.min(max, Math.max(min, preferred));
}
