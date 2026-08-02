// TURNING RECOVERED POSTS INTO ROWS THAT CAN BE WRITTEN TWICE.
//
// The archive reader hands back posts. This decides what they look like in the
// database, and the only genuinely hard part is what happens on the SECOND
// import.
//
// ── WHY IDEMPOTENCY IS THE WHOLE PROBLEM ────────────────────────────────────
//
// People will import the same archive more than once. They will re-run it after
// a failure, import a fresh export that overlaps the old one, or simply forget
// they already did it. If each pass inserts rows, their history doubles — and
// unlike a failed import, a doubled one looks like it worked. There is no error
// to see and no obvious moment when it went wrong.
//
// SyncedContent has no unique constraint, so nothing in the database prevents
// that. ContentSource does: @@unique([userId, sourceType, sourceId]). So the
// identity of an imported post lives in ContentSource, one row per post, and the
// database enforces it rather than the application remembering to.
//
// That is also why sourceId is a CONTENT HASH rather than a counter or an index.
// An index would make "the third post in posts_1.json" the identity, so a
// re-export with one more post at the top would renumber everything and import
// the entire history again as new. The hash depends only on what the post
// actually is, so the same post is the same row no matter where it appears or
// what it appears alongside.
//
// ── WHAT GOES INTO THE HASH, AND WHAT DELIBERATELY DOES NOT ─────────────────
//
// Timestamp, text, and media paths. Those are the whole of what parse-export
// recovers, and all three are properties of the post itself.
//
// Not included: the file it came from, its position, the archive's root folder,
// or anything about when the import ran. Every one of those changes between two
// exports of the same account, and folding any of them in would make a
// re-export look like new content.
//
// Two genuinely different posts that share a timestamp AND text AND media list
// collide. That is accepted: at that point they are indistinguishable using
// everything the export gave us, and treating them as one post is a better
// answer than inventing a difference that is not in the data.

import { createHash } from "node:crypto";
import type { ParseResult } from "./parse-export";

/** One post, ready to be written as a ContentSource + SyncedContent pair. */
export type ImportedRow = {
  /** Namespaced so an archive import can never collide with a live sync. */
  sourceType: string;
  /** Stable across re-imports. The database's unique key does the deduping. */
  sourceId: string;
  /** From the post. Never "now" — parse-export refuses to invent a date. */
  sourceCreatedAt: Date;
  /** What kind of thing this is, decided by what the post actually carries. */
  canonicalType: "text" | "photo" | "video";
  /** Empty captions are real, so this is "" rather than null when absent. */
  textContent: string;
  /** In-archive media paths as JSON. Always valid JSON, never a bare string. */
  mediaJson: string;
};

/** Extensions that mean "this is a video" in a Meta export. */
const VIDEO_EXTENSIONS = /\.(mp4|mov|m4v|webm|avi|mkv)$/i;

/**
 * `archive:instagram`, not `instagram`.
 *
 * A live API sync and a downloaded archive are different sources of truth about
 * the same account, and they can disagree — an archive is a snapshot that may
 * predate edits or deletions. Keeping them in separate namespaces means the two
 * can coexist without one silently overwriting the other through the unique key.
 */
export function archiveSourceType(platform: string): string {
  return `archive:${platform}`;
}

/**
 * The identity of a post, as a hex digest.
 *
 * Deliberately not the raw fields concatenated: a caption containing the
 * separator would let one post impersonate another. Each part is length-prefixed
 * so the encoding is unambiguous.
 */
function postIdentity(publishedAtMs: number, text: string, mediaPaths: string[]): string {
  const parts = [String(publishedAtMs), text, ...mediaPaths];
  const framed = parts.map((part) => `${part.length}:${part}`).join("");
  return createHash("sha256").update(framed, "utf8").digest("hex").slice(0, 40);
}

/** Photo, video or neither, from the media the post actually carries. */
function canonicalTypeFor(mediaPaths: string[]): ImportedRow["canonicalType"] {
  if (mediaPaths.length === 0) return "text";
  return mediaPaths.some((path) => VIDEO_EXTENSIONS.test(path)) ? "video" : "photo";
}

/**
 * Map recovered posts to rows.
 *
 * Pure and total: same posts in, same rows out, no clock and no randomness. That
 * matters more here than it looks — an identity that varied between runs would
 * turn every re-import into a duplicate, which is the exact failure this module
 * exists to prevent.
 *
 * Duplicates WITHIN one import are collapsed here too. An archive can list the
 * same post in two split files, and relying on the database to reject the second
 * would mean a failed write in the middle of a transaction rather than a row
 * that was simply never offered.
 */
export function toRows(platform: string, posts: ParseResult["posts"]): ImportedRow[] {
  const sourceType = archiveSourceType(platform);
  const rows: ImportedRow[] = [];
  const seen = new Set<string>();

  for (const post of posts) {
    const sourceId = postIdentity(post.publishedAtMs, post.text, post.mediaPaths);
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    rows.push({
      sourceType,
      sourceId,
      sourceCreatedAt: new Date(post.publishedAtMs),
      canonicalType: canonicalTypeFor(post.mediaPaths),
      textContent: post.text,
      mediaJson: JSON.stringify(post.mediaPaths),
    });
  }

  return rows;
}
