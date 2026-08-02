// FINDING THE POSTS FILE WITHOUT GUESSING WHERE IT LIVES.
//
// parse-export.ts can read a Meta posts document once it has one. Getting it one
// is this module's job, and it is where the export format is at its worst: the
// same platform ships at least three different layouts depending on when the
// archive was generated, and the folder everything sits inside is named after
// the account and the date.
//
// ── THE FAILURE THAT LOOKS LIKE SUCCESS ─────────────────────────────────────
//
// A reader keyed to one vintage finds nothing on the others and reports a clean,
// confident zero. The user sees "0 posts found", believes their history is
// empty, and has no reason to suspect the tool simply did not know where to
// look. Nothing errors. Nothing is logged. It is the same class of failure as a
// parser inventing a timestamp, arriving from the opposite direction.
//
// So this module cannot return an empty list. There is no "recognised, and
// nothing was there" branch, because that sentence is indistinguishable from
// "did not recognise" and only one of them is ever true. The result is a
// discriminated union, and a caller physically cannot read `found` without
// having narrowed past `recognised: false` first. The type does the enforcing;
// a convention would not survive the first person in a hurry.
//
// ── NEVER DERIVE ANYTHING FROM THE ROOT FOLDER NAME ─────────────────────────
//
// The root is named things like "instagram-janedoe-2024-01-15-A1b2C3". It is an
// independent axis from the vintage and from the JSON/HTML choice, it changes
// format without notice, and matching on it is how a reader breaks for one
// person and nobody else.
//
// Instead the ANCHOR IS THE POSTS FILE ITSELF. Match on the path's tail — the
// part Meta actually controls — and compute the prefix by subtraction. One
// mechanism handles every root name and every vintage, and there is nothing to
// update when Meta changes the folder naming again.
//
// ── WHY FACEBOOK MATCHES A WILDCARD DIRECTORY AND NOT THREE NAMES ───────────
//
// Facebook ships its posts under three different parent directories, the same
// way Instagram ships three vintages. The audit that established this recorded
// the COUNT but not the three names, and enumerating names nobody verified would
// produce exactly the confident zero described above for whichever one was
// guessed wrong.
//
// So the parent is matched as a wildcard: one directory level, any name. That is
// right for all three whatever they are called, and right for a fourth.
//
// It has to be one LEVEL rather than no level, and that is not cosmetic. The
// prefix is computed by subtracting the matched tail, so a pattern matching only
// the filename would leave the parent directory inside the prefix — an archive
// at "fb-jsmith-2024/posts/your_posts_1.json" would report its root as
// "fb-jsmith-2024/posts/", and every media path later resolved against it would
// point at a file that does not exist. The gate caught this on its first run.
//
// The residual ambiguity is real and worth stating: a bare
// "something/your_posts.json" cannot be told apart from a root folder with the
// document directly inside it. Real Facebook archives always have both a root
// and a parent, so the assumption holds for actual input, and this comment is
// here so the next person meets the assumption rather than discovering it.

/** Platforms whose posts can appear inside a Meta archive. */
type ExportPlatform = "instagram" | "facebook" | "threads";

/** One platform's post documents found in one archive. */
type LocatedDocuments = {
  platform: ExportPlatform;
  /** Which layout matched, in words, so a support conversation can be specific. */
  vintage: string;
  /** Paths exactly as listed, ordered by their split number. */
  paths: string[];
};

/**
 * Deliberately a union. `found` is unreachable until the caller has handled the
 * case where the layout was not understood, which is the whole point — reporting
 * zero posts for an archive we could not read is the bug this module exists to
 * prevent.
 */
export type LocateResult =
  | {
      recognised: true;
      /** Archive-internal prefix, derived from the anchor. "" when files sit at the root. */
      prefix: string;
      /** Never empty: a prefix is only ever derived from a document that matched. */
      found: LocatedDocuments[];
      /**
       * Other prefixes that also had matches and were not used. Required rather
       * than optional so a caller counting posts cannot quietly omit the fact
       * that part of the archive was ignored.
       */
      otherPrefixes: string[];
    }
  | {
      recognised: false;
      /** Words a person can act on — never a count, and never the number zero. */
      reason: string;
      /**
       * How many entries were listed. This is what separates "your archive is
       * empty" from "we did not understand your archive", and the caller needs
       * both sentences because they ask the user to do different things.
       */
      filesSeen: number;
    };

type Shape = {
  platform: ExportPlatform;
  vintage: string;
  /**
   * Anchored at the end and preceded by a boundary, so it matches the tail of a
   * path under any root. Group 1 is the boundary (used to compute the prefix);
   * group 2, where present, is the split number.
   */
  tail: RegExp;
};

/**
 * ORDER IS LOAD-BEARING. The 2023+ Instagram path ENDS WITH the 2022 path —
 * "your_instagram_activity/content/posts_1.json" also satisfies a bare
 * "content/posts_1.json" match. Testing the general shape first would label
 * every modern export as the old vintage and, worse, compute a prefix that
 * wrongly includes "your_instagram_activity/", breaking every media path
 * resolved against it. First match wins, so the most specific comes first.
 */
const SHAPES: readonly Shape[] = Object.freeze([
  {
    platform: "threads",
    vintage: "carried inside an Instagram export",
    tail: /(^|\/)your_instagram_activity\/threads\/threads_and_replies\.json$/i,
  },
  {
    platform: "instagram",
    vintage: "2023 and later",
    tail: /(^|\/)your_instagram_activity\/content\/posts_(\d+)\.json$/i,
  },
  {
    platform: "instagram",
    vintage: "2022 and earlier",
    tail: /(^|\/)content\/posts_(\d+)\.json$/i,
  },
  {
    platform: "instagram",
    vintage: "before December 2020",
    tail: /(^|\/)media\.json$/i,
  },
  {
    platform: "facebook",
    // One directory level, any name — see the header. Matching the bare filename
    // instead would fold the parent into the computed prefix.
    vintage: "any parent directory",
    tail: /(^|\/)[^/]+\/your_posts(?:_(\d+))?\.json$/i,
  },
]);

type Match = {
  path: string;
  prefix: string;
  shape: Shape;
  /** Split number, or 0 for a document that carries none. */
  part: number;
};

/** Zip entries are stored with forward slashes, but not every producer obeys. */
function normalise(path: string): string {
  return path.replace(/\\/g, "/");
}

function matchOne(path: string): Match | null {
  const candidate = normalise(path).trim();

  // No guard here for directory entries or empty names, deliberately. Every
  // shape is anchored with `$` on a ".json" filename, so a name ending in "/"
  // cannot match one and neither can "". A guard would be unreachable code that
  // reads as a safeguard — mutation testing cannot kill it, so it would sit here
  // looking tested forever. The `$` anchors are what enforce this, and the gate
  // tests the behaviour rather than the redundant branch.
  for (const shape of SHAPES) {
    const hit = shape.tail.exec(candidate);
    if (!hit) continue;
    const boundary = hit[1] ?? "";
    const prefix = candidate.slice(0, (hit.index ?? 0) + boundary.length);
    const part = hit[2] ? Number.parseInt(hit[2], 10) : 0;
    return { path, prefix, shape, part: Number.isFinite(part) ? part : 0 };
  }
  return null;
}

/**
 * Find every post document in an archive listing.
 *
 * Pure: takes the list of entry names, returns a verdict. No I/O, nothing read,
 * nothing inflated — this runs against the central directory alone.
 */
export function locatePostDocuments(entryNames: readonly string[]): LocateResult {
  const matches: Match[] = [];
  const seen = new Set<string>();

  for (const name of entryNames) {
    if (typeof name !== "string" || seen.has(name)) continue;
    seen.add(name);
    const match = matchOne(name);
    if (match) matches.push(match);
  }

  if (matches.length === 0) {
    return {
      recognised: false,
      reason:
        entryNames.length === 0
          ? "This archive has no files in it at all, so there was nothing to look through."
          : "Nothing in this archive matched a posts file we know how to read. That may mean the export has no posts, or it may mean it uses a layout we have not seen — and we cannot tell which from here, so we are not going to claim your history is empty.",
      filesSeen: entryNames.length,
    };
  }

  // Group by prefix. More than one means two archives were concatenated, or a
  // stray copy is nested inside; either way we read one and say so.
  const byPrefix = new Map<string, Match[]>();
  for (const match of matches) {
    const bucket = byPrefix.get(match.prefix);
    if (bucket) bucket.push(match);
    else byPrefix.set(match.prefix, [match]);
  }

  let prefix = "";
  let chosen: Match[] = [];
  for (const [candidate, group] of byPrefix) {
    if (group.length > chosen.length) {
      prefix = candidate;
      chosen = group;
    }
  }

  const otherPrefixes = Array.from(byPrefix.keys()).filter((key) => key !== prefix).sort();

  // Group by platform and vintage, preserving the order shapes are declared in
  // so the output is stable regardless of how the zip happened to be listed.
  const found: LocatedDocuments[] = [];
  for (const shape of SHAPES) {
    const group = chosen.filter((match) => match.shape === shape);
    if (group.length === 0) continue;
    found.push({
      platform: shape.platform,
      vintage: shape.vintage,
      // NUMERIC, not lexicographic. Sorting these as strings puts posts_10
      // between posts_1 and posts_2, which silently reorders a person's history
      // and is invisible until they scroll far enough to notice.
      paths: group.slice().sort((a, b) => a.part - b.part || a.path.localeCompare(b.path)).map((m) => m.path),
    });
  }

  return { recognised: true, prefix, found, otherPrefixes };
}
