// THE LIMITS EVERY OTHER PART OF THE IMPORTER TRUSTS.
//
// mesh.me's archive importer reads a ZIP that somebody downloaded from Instagram
// or Facebook and handed over. That file is untrusted input in the strongest
// sense: nobody in this system produced it, its format has no published schema,
// and a hostile one is trivially constructed. This module decides what is
// allowed through, BEFORE anything is decompressed.
//
// It is pure and total on purpose. No I/O, no dependency, no way for a caller to
// be halfway through a decision when something throws.
//
// ── THE RANKING IS THE DESIGN, AND IT IS NOT INTUITIVE ──────────────────────
//
// Measured, and recorded in docs/SURFACE_AUDIT.md. Ranked by what actually
// protects the person, not by what feels protective:
//
//   1. WORKER ISOLATION (not in this file — it belongs to the caller). An
//      out-of-memory in a browser is UNCATCHABLE: no exception is thrown, a
//      try/catch does nothing, the tab dies. A Worker you can terminate() is the
//      only mechanism that can actually stop a runaway. Nothing below can
//      substitute for it.
//
//   2. THE RUNNING TOTAL, which is this file's centre of gravity. It is the only
//      control that mathematically bounds output. An entry cap multiplied by a
//      per-entry cap is 1.3-27 TB in the worst case — which is to say, no bound
//      at all. Capping both and skipping the total is security theatre.
//
//   3. NESTING DEPTH 0. Free to enforce, and it removes the entire classic
//      recursive-bomb class. No legitimate social-media export contains a zip
//      inside a zip.
//
//   4. ENTRY COUNT — and for a reason that is easy to get wrong. It is not
//      mainly about decompression. The CENTRAL DIRECTORY IS ITSELF AN ATTACK
//      SURFACE: a 93 MB archive with a million entries cost 18 seconds and 1.2 GB
//      of memory just to instantiate a parser, before a single byte was inflated.
//
//   5. THE RATIO CAP, LAST. It attracts the most attention and earns the least.
//      Legitimate entries in these exports run 5:1 to 100:1, and export-shaped
//      JSON with real per-record variation reaches ~64:1. DEFLATE cannot exceed
//      1032:1. The band between "rejects a real LinkedIn export" and "permits a
//      near-ceiling bomb" is too narrow to defend, and a bomb assembled from many
//      entries each individually under the cap walks straight through it.
//
// IF A LIMIT MUST EVER BE RELAXED, RELAX THE RATIO CAP. Never the running total,
// and never the Worker. Whoever comes here to raise a number should read that
// sentence before they pick which one.
//
// ── WHY THE SHAPE OF judgeEntry IS WHAT IT IS ───────────────────────────────
//
// The running total only bounds anything if the caller actually keeps it. A
// design where the caller must remember to add up bytes is a design where the
// bound silently disappears the first time somebody forgets. So judgeEntry TAKES
// the totals and RETURNS the next totals as part of its accept result. There is
// no separate "now update the counter" step to omit, and an accept result that
// is ignored takes the count with it.

/** What the ZIP central directory tells us before any inflation happens. */
export type ArchiveEntryHeader = {
  /** The entry's name exactly as stored. */
  name: string;
  /** Bytes on disk. From the central directory. */
  compressedSize: number;
  /** Bytes the header CLAIMS it will produce. A claim, never an allocation. */
  uncompressedSize: number;
};

/** Bytes and entries admitted so far. Threaded through, never global. */
export type AdmittedSoFar = {
  bytes: number;
  entries: number;
};

export const NOTHING_ADMITTED: AdmittedSoFar = Object.freeze({ bytes: 0, entries: 0 });

export const ZIP_LIMITS = Object.freeze({
  /**
   * RANK 2 — load-bearing. The only cap that bounds total output. Sized for a
   * text-only pass: real archives are media-dominated and compress at roughly
   * 1.03:1, so the JSON we actually parse is a small fraction of the file.
   */
  maxTotalBytes: 512 * 1024 * 1024,

  /**
   * RANK 4 — bounds central-directory parsing cost, not decompression. A
   * million entries costs seconds and gigabytes before any inflation.
   */
  maxEntries: 50_000,

  /**
   * RANK 4 — one entry may not consume the whole budget. Well under V8's
   * ~512 MB maximum string length, because a JSON.parse of anything near that
   * blocks the main thread for its entire duration regardless of security.
   */
  maxEntryBytes: 64 * 1024 * 1024,

  /**
   * RANK 5 — the softest control, and deliberately generous. Below roughly
   * 300:1 this rejects real archives; a documented threshold of 10:1 is known
   * to have blocked valid files. It exists to catch the lazy single-entry bomb,
   * not to be the defence.
   */
  maxEntryRatio: 500,

  /**
   * The ratio cap only engages once an entry is big enough for the ratio to
   * mean anything. A 200-byte file that expands to 40 KB is a 200:1 ratio and
   * completely ordinary; refusing it would be noise.
   */
  ratioAppliesAboveBytes: 8 * 1024 * 1024,

  /**
   * DEFLATE cannot exceed 1032:1 on a single stream. Anything claiming more is
   * definitionally malformed — a Zip64 or overlap trick — rather than
   * compressed, so it is refused regardless of the softer cap above.
   */
  deflateCeiling: 1032,
});

export type EntryVerdict =
  | { admit: true; next: AdmittedSoFar }
  | { admit: false; reason: string };

/** Names that escape the archive, exactly as parse-export.ts already refuses. */
function escapesArchive(name: string): boolean {
  return name.includes("..") || name.startsWith("/") || /^[a-z]+:\/\//i.test(name);
}

/** A zip inside a zip. Depth 0 means we never look inside one. */
function isNestedArchive(name: string): boolean {
  return /\.(zip|tar|gz|tgz|bz2|xz|7z|rar)$/i.test(name.trim());
}

/**
 * Decide whether one entry may be inflated, given everything admitted so far.
 *
 * Checks run cheapest-and-most-certain first: a malformed header or a traversal
 * name costs nothing to detect and admits no judgement, while the ratio test is
 * the only one that is a heuristic at all.
 */
export function judgeEntry(entry: ArchiveEntryHeader, sofar: AdmittedSoFar): EntryVerdict {
  const name = entry.name.trim();

  if (!name) {
    return { admit: false, reason: "This entry has no name, so there is no way to say what it is." };
  }
  if (escapesArchive(name)) {
    return {
      admit: false,
      reason: `"${name}" points outside the archive. That is either a broken export or an attempt at traversal, and neither is something to open.`,
    };
  }
  if (isNestedArchive(name)) {
    return {
      admit: false,
      reason: `"${name}" is an archive inside an archive. Nothing a platform exports needs that, and refusing to look inside removes a whole class of decompression bomb.`,
    };
  }

  // A size that is not a finite, non-negative number is a malformed header, and
  // arithmetic on it would quietly poison every total that follows.
  const declared = entry.uncompressedSize;
  const stored = entry.compressedSize;
  if (!Number.isFinite(declared) || declared < 0 || !Number.isFinite(stored) || stored < 0) {
    return { admit: false, reason: `"${name}" declares a size that is not a real number, so its header cannot be trusted.` };
  }

  if (declared > ZIP_LIMITS.maxEntryBytes) {
    return {
      admit: false,
      reason: `"${name}" says it holds ${formatBytes(declared)}, over the ${formatBytes(ZIP_LIMITS.maxEntryBytes)} limit for a single file.`,
    };
  }

  // Ratio checks last, and only where a ratio is meaningful. Note this reads the
  // DECLARED size — it never allocates from it. Allocating a buffer sized by a
  // header field is a live JS vulnerability with 33-million-to-1 amplification
  // from a 120-byte file.
  if (stored > 0) {
    const ratio = declared / stored;
    if (ratio > ZIP_LIMITS.deflateCeiling) {
      return {
        admit: false,
        reason: `"${name}" claims to expand ${Math.round(ratio)} times over. DEFLATE cannot exceed ${ZIP_LIMITS.deflateCeiling}:1, so this header is malformed rather than well compressed.`,
      };
    }
    if (declared > ZIP_LIMITS.ratioAppliesAboveBytes && ratio > ZIP_LIMITS.maxEntryRatio) {
      return {
        admit: false,
        reason: `"${name}" expands ${Math.round(ratio)} times over, past the ${ZIP_LIMITS.maxEntryRatio}:1 limit for a file this size.`,
      };
    }
  }

  // The bound. Everything above narrows what one entry may do; only this decides
  // what all of them together may do.
  const nextEntries = sofar.entries + 1;
  if (nextEntries > ZIP_LIMITS.maxEntries) {
    return {
      admit: false,
      reason: `This archive has more than ${ZIP_LIMITS.maxEntries.toLocaleString()} files. Reading a list that long costs real time and memory before anything is even opened.`,
    };
  }

  const nextBytes = sofar.bytes + declared;
  if (nextBytes > ZIP_LIMITS.maxTotalBytes) {
    return {
      admit: false,
      reason: `Reading "${name}" would take this import past ${formatBytes(ZIP_LIMITS.maxTotalBytes)} in total. Stopping here rather than running your browser out of memory.`,
    };
  }

  return { admit: true, next: { bytes: nextBytes, entries: nextEntries } };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}
