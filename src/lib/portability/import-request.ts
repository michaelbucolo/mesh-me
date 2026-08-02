// VALIDATING A REQUEST THAT CARRIES SOMEBODY'S HISTORY.
//
// The archive is read in the browser and never uploaded. What reaches the server
// is the small part the person chose to import: posts, already parsed. That is
// the honest reading of a feature whose whole premise is that this is THEIR
// data — and it also means this endpoint receives a JSON array assembled by
// client-side code, which is to say, by anything at all.
//
// So the body is untrusted in the ordinary way, and the same rule the parser
// works under applies here: SKIP, NEVER INVENT. A post missing a timestamp is
// dropped with a reason, not given one.
//
// ── WHY THIS IS A SEPARATE MODULE FROM THE ROUTE ────────────────────────────
//
// The route cannot be exercised by the check chain — it needs a server and a
// seeded database, and the chain runs before either exists. Validation is where
// the decisions are, so it lives here where a gate can drive it directly, and
// the route is left holding auth, rate limiting and a function call.

/** The shape parse-export produces, as it arrives over the wire. */
type IncomingPost = {
  publishedAtMs: number;
  text: string;
  mediaPaths: string[];
};

export type ValidatedImport =
  | { ok: true; platform: string; posts: IncomingPost[]; dropped: number }
  | { ok: false; status: 400 | 413; reason: string };

/**
 * Only the platforms that actually ship a downloadable archive.
 *
 * Not a cosmetic list. Accepting anything here would let a caller mint
 * ContentSource rows under a sourceType that no importer produces and no reader
 * expects, which is a slow way to corrupt a namespace that other code will
 * later trust.
 */
const ARCHIVE_PLATFORMS = new Set(["instagram", "facebook", "threads", "snapchat", "linkedin", "pinterest"]);

/**
 * One request may carry this many posts.
 *
 * A real history runs to tens of thousands, so the client sends batches. The cap
 * exists because a single request has to fit in memory and in a serverless
 * function's body limit, and because a bounded batch means a failure costs one
 * batch rather than an entire import.
 */
export const MAX_POSTS_PER_REQUEST = 500;

/** Bounds on one post. Generous — these exist to stop abuse, not to edit history. */
const MAX_TEXT_LENGTH = 100_000;
const MAX_MEDIA_PATHS = 100;
const MAX_PATH_LENGTH = 1024;

/** Roughly 2001 to 2286. Outside this, it is not a social post's timestamp. */
const EARLIEST_MS = 1e12;
const LATEST_MS = 1e13;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A path that escapes, exactly as parse-export and zip-limits already refuse. */
function escapes(path: string): boolean {
  return path.includes("..") || path.startsWith("/") || /^[a-z]+:\/\//i.test(path);
}

/**
 * Read one request body.
 *
 * Returns the posts worth writing and how many were dropped. `dropped` is not
 * decoration: a caller that reports "imported 400" when 40 were silently
 * discarded has told the person something false about their own history.
 */
export function validateImportRequest(body: unknown): ValidatedImport {
  if (!isRecord(body)) {
    return { ok: false, status: 400, reason: "This request did not carry anything we could read." };
  }

  const platform = typeof body.platform === "string" ? body.platform.trim().toLowerCase() : "";
  if (!ARCHIVE_PLATFORMS.has(platform)) {
    return {
      ok: false,
      status: 400,
      reason: "That is not a platform mesh.me can import an archive from.",
    };
  }

  if (!Array.isArray(body.posts)) {
    return { ok: false, status: 400, reason: "This request carried no posts." };
  }

  if (body.posts.length > MAX_POSTS_PER_REQUEST) {
    return {
      ok: false,
      status: 413,
      reason: `Send at most ${MAX_POSTS_PER_REQUEST} posts at a time. Nothing was saved from this batch — send it again in smaller pieces.`,
    };
  }

  const posts: IncomingPost[] = [];
  let dropped = 0;

  for (const raw of body.posts) {
    if (!isRecord(raw)) {
      dropped += 1;
      continue;
    }

    // THE ONE REQUIRED FIELD, and the reason is the same as in the parser: a
    // post cannot be placed in a history by guessing when it happened, and
    // defaulting to now would put something written years ago at the top of
    // somebody's timeline as though it were today.
    const publishedAtMs = raw.publishedAtMs;
    if (
      typeof publishedAtMs !== "number" ||
      !Number.isFinite(publishedAtMs) ||
      publishedAtMs < EARLIEST_MS ||
      publishedAtMs > LATEST_MS
    ) {
      dropped += 1;
      continue;
    }

    const text = typeof raw.text === "string" ? raw.text.slice(0, MAX_TEXT_LENGTH) : "";

    const mediaPaths: string[] = [];
    if (Array.isArray(raw.mediaPaths)) {
      for (const path of raw.mediaPaths.slice(0, MAX_MEDIA_PATHS)) {
        if (typeof path !== "string") continue;
        const trimmed = path.trim().slice(0, MAX_PATH_LENGTH);
        if (!trimmed || escapes(trimmed)) continue;
        mediaPaths.push(trimmed);
      }
    }

    // Neither words nor media is not a post — it is a fragment of some other
    // structure that happened to carry a plausible number.
    if (!text && mediaPaths.length === 0) {
      dropped += 1;
      continue;
    }

    posts.push({ publishedAtMs: Math.round(publishedAtMs), text, mediaPaths });
  }

  return { ok: true, platform, posts, dropped };
}
