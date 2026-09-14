// Keep multipart requests below Vercel's 4.5 MB request limit, including fields
// and boundaries. Large media should use an external video link until an
// object-storage provider is configured.
export const MAX_POST_MEDIA_FILES = 4;
export const MAX_POST_MEDIA_TOTAL_BYTES = 4 * 1024 * 1024;
export const POST_MEDIA_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime";
const ALLOWED_TYPES = new Set(POST_MEDIA_ACCEPT.split(","));

export function postMediaSelectionError(files: { size: number; type: string }[]): string | null {
  if (files.length > MAX_POST_MEDIA_FILES) return "Attach up to 4 images or videos.";
  if (files.some((file) => file.size === 0)) return "That file is empty. Choose another file.";
  if (files.some((file) => file.type && !ALLOWED_TYPES.has(file.type))) {
    return "Use JPEG, PNG, WebP, GIF, AVIF, MP4, MOV, or WebM media.";
  }
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_POST_MEDIA_TOTAL_BYTES) {
    return "Attachments can total up to 4 MB. For a larger video, add a link.";
  }
  return null;
}

export function detectPostMediaType(bytes: Uint8Array): { type: "image" | "video"; mime: string } | null {
  const starts = (signature: number[]) => signature.every((value, i) => bytes[i] === value);
  const ascii = (offset: number, size: number) => String.fromCharCode(...bytes.slice(offset, offset + size));
  if (starts([0xff, 0xd8, 0xff])) return { type: "image", mime: "image/jpeg" };
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { type: "image", mime: "image/png" };
  if (["GIF87a", "GIF89a"].includes(ascii(0, 6))) return { type: "image", mime: "image/gif" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return { type: "image", mime: "image/webp" };
  if (starts([0x1a, 0x45, 0xdf, 0xa3])) return { type: "video", mime: "video/webm" };
  if (bytes.length >= 16 && ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4);
    if (brand === "avif" || brand === "avis") return { type: "image", mime: "image/avif" };
    if (brand === "qt  ") return { type: "video", mime: "video/quicktime" };
    if (/^(isom|iso[2-9]|mp4[12]|avc1|M4V |dash)$/.test(brand)) return { type: "video", mime: "video/mp4" };
  }
  return null;
}

/** Single RFC 9110 byte range, including suffix and open-ended requests. */
export function parseMediaRange(value: string | null, size: number): { start: number; end: number } | null | "invalid" {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2]) || size <= 0) return "invalid";
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last))) return "invalid";
  if (first === null && last === 0) return "invalid";
  const start = first ?? Math.max(0, size - (last ?? 0));
  const end = first === null ? size - 1 : Math.min(last ?? size - 1, size - 1);
  return start >= size || start > end ? "invalid" : { start, end };
}
