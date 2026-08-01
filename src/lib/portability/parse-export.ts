// READING A FILE FORMAT YOU DO NOT CONTROL AND CANNOT VERSION.
//
// This parses the consumer data export the six no-API platforms are obliged to
// hand you — Instagram, Facebook, Threads, Snapchat, LinkedIn, Pinterest. It is
// the only route into half the roster, so it matters that it works. It is also
// a format nobody publishes a schema for, that changes without notice, and that
// arrives in whatever shape the platform felt like this quarter.
//
// ── THE RULE THAT SHAPES EVERYTHING BELOW ───────────────────────────────────
//
// A PARSER FOR SOMEBODY ELSE'S FORMAT MAY SKIP, BUT IT MAY NEVER INVENT.
//
// The tempting failure is a parser that "handles" a shape it does not
// understand by filling in a plausible default — a timestamp of now, a caption
// of "", an empty media list. Every one of those produces a post in your
// history that YOU NEVER WROTE, silently, and you would have no way to tell it
// apart from a real one. Losing a post is recoverable: re-export and try again.
// Fabricating one is not, because nothing downstream can distinguish it.
//
// So every field is either read from the file or the entry is dropped with a
// reason. There is no third branch. `skipped` is a first-class output, not an
// error path, and the caller is expected to show the count.
//
// ── WHY SHAPE-TOLERANT AND NOT SCHEMA-STRICT ────────────────────────────────
//
// Meta has shipped posts as a bare array, as {posts: [...]}, with timestamps in
// seconds and in milliseconds, with the caption on the entry and on the first
// media child. A strict schema breaks on the next variation and the whole
// import fails for everyone. So each field has a small ordered list of places
// it has been seen, and the entry survives if ANY of them yields a usable
// value — while still refusing to guess when none does.

/** One post recovered from an export. Every field came from the file. */
type ImportedPost = {
  /** Seconds since epoch, normalised. Never defaulted to "now". */
  publishedAtMs: number;
  /** Caption text. May be empty — an empty caption is a real thing. */
  text: string;
  /** Paths as they appear INSIDE the archive, not URLs. Resolved later. */
  mediaPaths: string[];
};

type SkippedEntry = {
  /** Index within the source array, so a person can find it in their file. */
  index: number;
  /** Which requirement failed, in words a human can act on. */
  reason: string;
};

export type ParseResult = {
  posts: ImportedPost[];
  skipped: SkippedEntry[];
};

/** Anything at all — this is untrusted input from a file we did not write. */
type Unknown = unknown;

function isRecord(value: Unknown): value is Record<string, Unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Timestamps arrive in seconds (Meta) and in milliseconds (some LinkedIn
 * exports), and both are plain numbers, so the units cannot be read off the
 * type. The discriminator is magnitude: seconds-since-epoch for any real post
 * is ~1e9, milliseconds ~1e12. Anything below 1e9 is not a plausible social
 * post timestamp at all — it would be 2001 or earlier — and anything above 1e13
 * is not a date either. Both are refused rather than coerced.
 */
function normaliseTimestamp(value: Unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  if (value >= 1e9 && value < 1e11) return Math.round(value * 1000); // seconds
  if (value >= 1e11 && value < 1e13) return Math.round(value); // already ms
  return null;
}

/** The places a creation time has actually been observed, in order. */
function readTimestamp(entry: Record<string, Unknown>): number | null {
  const direct = ["creation_timestamp", "timestamp", "created_at", "date"];
  for (const key of direct) {
    const ms = normaliseTimestamp(entry[key]);
    if (ms !== null) return ms;
  }
  // Meta often carries no timestamp on the post and one on each media child.
  const media = entry.media;
  if (Array.isArray(media)) {
    for (const child of media) {
      if (!isRecord(child)) continue;
      for (const key of direct) {
        const ms = normaliseTimestamp(child[key]);
        if (ms !== null) return ms;
      }
    }
  }
  return null;
}

/** Caption text. Empty string is a valid answer; missing is not the same thing. */
function readText(entry: Record<string, Unknown>): string {
  const direct = ["title", "caption", "text", "description"];
  for (const key of direct) {
    const value = entry[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  const media = entry.media;
  if (Array.isArray(media)) {
    for (const child of media) {
      if (!isRecord(child)) continue;
      for (const key of direct) {
        const value = child[key];
        if (typeof value === "string" && value.trim().length > 0) return value;
      }
    }
  }
  return "";
}

/** In-archive paths. Never a URL — these resolve against the extracted files. */
function readMediaPaths(entry: Record<string, Unknown>): string[] {
  const paths: string[] = [];
  const push = (value: Unknown) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (!trimmed) return;
    // A path escaping the archive root is either a broken export or an attack.
    // Either way it is not something to resolve later, so it never enters the
    // list — the media is dropped, the post is kept.
    if (trimmed.includes("..") || trimmed.startsWith("/") || /^[a-z]+:\/\//i.test(trimmed)) return;
    paths.push(trimmed);
  };

  push(entry.uri);
  const media = entry.media;
  if (Array.isArray(media)) {
    for (const child of media) {
      if (isRecord(child)) push(child.uri);
      else push(child);
    }
  }
  return paths;
}

/**
 * Find the array of posts inside whatever the file's top level turned out to
 * be. Observed: a bare array, {posts: [...]}, and a single-key object wrapping
 * the array under a name that varies by platform.
 */
function findEntries(root: Unknown): Unknown[] | null {
  if (Array.isArray(root)) return root;
  if (!isRecord(root)) return null;
  for (const key of ["posts", "media", "items", "entries", "data"]) {
    const value = root[key];
    if (Array.isArray(value)) return value;
  }
  // A single-key wrapper whose value is the array — covers the case where the
  // key is named after the platform and we have not seen it before.
  const keys = Object.keys(root);
  if (keys.length === 1 && Array.isArray(root[keys[0]])) return root[keys[0]] as Unknown[];
  return null;
}

/**
 * Parse one JSON document from an export.
 *
 * Never throws on shape. A document that is not recognisable as a post list
 * returns zero posts and one skip explaining that, which is a result the caller
 * can show — not an exception that loses the whole import.
 */
export function parseExportDocument(root: Unknown): ParseResult {
  const entries = findEntries(root);
  if (!entries) {
    return {
      posts: [],
      skipped: [{ index: 0, reason: "This file is not a list of posts, so nothing was read from it." }],
    };
  }

  const posts: ImportedPost[] = [];
  const skipped: SkippedEntry[] = [];

  entries.forEach((entry, index) => {
    if (!isRecord(entry)) {
      skipped.push({ index, reason: "Entry is not an object." });
      return;
    }

    // THE ONE REQUIRED FIELD. A post without a date cannot be placed in a
    // history, and defaulting it to now would put something you wrote in 2014
    // at the top of your timeline as if it were today.
    const publishedAtMs = readTimestamp(entry);
    if (publishedAtMs === null) {
      skipped.push({ index, reason: "No usable date on this entry, and a post cannot be dated by guessing." });
      return;
    }

    const text = readText(entry);
    const mediaPaths = readMediaPaths(entry);

    // An entry with neither words nor media is not a post — it is a fragment of
    // some other structure that happened to carry a timestamp.
    if (!text && mediaPaths.length === 0) {
      skipped.push({ index, reason: "Entry has no caption and no media, so there is nothing to import." });
      return;
    }

    posts.push({ publishedAtMs, text, mediaPaths });
  });

  return { posts, skipped };
}

/** Parse raw file text. Invalid JSON is a skip with a reason, never a throw. */
export function parseExportText(text: string): ParseResult {
  let root: Unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return {
      posts: [],
      skipped: [{ index: 0, reason: "This file is not valid JSON, so nothing could be read from it." }],
    };
  }
  return parseExportDocument(root);
}
