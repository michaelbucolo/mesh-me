// THE PART THAT PUTS THE OTHER FOUR TOGETHER.
//
// zip-limits decides what may be inflated. locate-posts decides which files to
// look at. decode-text repairs Meta's mangling. parse-export reads one document.
// Each is pure and separately gated, and none of them imports a ZIP library.
//
// This is the orchestration, and it does not import one either. It takes the
// central-directory headers and a function that reads one entry's bytes. That
// keeps the whole pipeline testable against a fake reader — every path below,
// including the ones that only happen with a hostile archive, can be exercised
// without constructing a real ZIP file. The library gets plugged in at the edge,
// where the only thing it has to get right is "give me these bytes".
//
// ── THE HEADER IS A CLAIM, AND IT IS CHECKED TWICE ──────────────────────────
//
// Every entry is judged on its DECLARED size before anything is read, because
// the point of the limits is to avoid reading. But a declared size is something
// an attacker writes, so the bytes that actually arrive are checked again
// against the same budget. An archive that declares 1 KB and delivers 100 MB
// gets through the first check by construction; only the second one sees it.
//
// ── WHY THE TEXT IS REPAIRED AFTER PARSING, NOT BEFORE ──────────────────────
//
// The audit note that prompted this said to re-decode the bytes before
// JSON.parse. That is right for one of the two forms this bug takes and wrong
// for the other, so this does both, in the order that cannot lose data.
//
// Meta's JSON usually carries the mangling as Ã©-style ESCAPES, which
// are perfectly valid JSON. The file is well-formed UTF-8; the damage is in the
// string values. Re-decoding the whole file's bytes first would not touch those
// escapes at all, and on a file that is only partly affected it risks breaking
// the JSON structure itself — turning a recoverable text problem into an
// unparseable document.
//
// The other form is a file whose raw bytes are mangled. That one does not decode
// as UTF-8 at all, so it is caught by trying strict UTF-8 first and falling back
// to Latin-1 only when that fails — which is exactly the shape the bytes are in.
//
// Doing both, in that order, covers both forms. Doing only what the note said
// would silently miss the common one.

import { judgeEntry, NOTHING_ADMITTED, type AdmittedSoFar, type ArchiveEntryHeader } from "./zip-limits";
import { decodeExportText } from "./decode-text";
import { locatePostDocuments } from "./locate-posts";
import { parseExportDocument, type ParseResult } from "./parse-export";

/** Reads one entry's bytes. Supplied by the caller, so this module stays pure. */
export type EntryReader = (name: string) => Promise<Uint8Array>;

type Refusal = { name: string; reason: string };

type ImportReport = {
  /** Posts recovered, in document order. Every field came from the file. */
  posts: ParseResult["posts"];
  /** Which platforms these came from, so the caller does not have to guess. */
  platforms: string[];
  /** Entries the limits policy would not admit. */
  refused: Refusal[];
  /** Documents that could not be read or parsed at all. */
  unreadable: Refusal[];
  /**
   * Individual records dropped by the parser, with the document they came from.
   * A count the caller is expected to show — "we read 400 posts and skipped 3"
   * is a true sentence, and "we read 400 posts" on its own is not.
   */
  skipped: { document: string; index: number; reason: string }[];
  /** Captions repaired from Meta's mangling. Worth telling the user about. */
  textRepairs: number;
};

/**
 * Same shape as locate-posts, and for the same reason: there is no branch that
 * means "we read your archive and it was empty", because that is a claim this
 * code is not in a position to make.
 */
export type ImportResult =
  | { understood: true; prefix: string; report: ImportReport }
  | { understood: false; reason: string; filesSeen: number };

const STRICT_UTF8 = new TextDecoder("utf-8", { fatal: true });

/**
 * Bytes to text, covering both forms of Meta's encoding bug.
 *
 * Strict UTF-8 first: a well-formed file decodes and nothing is guessed at. If
 * that throws, the file is not UTF-8, and the overwhelmingly likely reason is
 * that its bytes are the mangled form — so read them as Latin-1, which is what
 * they are, and let decode-text decide whether it can repair them.
 */
function bytesToText(bytes: Uint8Array): string {
  try {
    return STRICT_UTF8.decode(bytes);
  } catch {
    let latin1 = "";
    // Chunked so a large document cannot blow the argument limit on spread.
    for (let i = 0; i < bytes.length; i += 8192) {
      latin1 += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    // Returned whether or not anything was repaired. Requiring a repair here
    // would reject a genuine Latin-1 file that read perfectly well, and would
    // also mean this function had a failure mode that JSON.parse already
    // covers — anything that is not really text fails there, with a message
    // that says so. One check, in the place that can actually tell.
    return decodeExportText(latin1).text;
  }
}

/**
 * Read every post document in an archive.
 *
 * `headers` is the central directory. `read` fetches one entry's bytes. Nothing
 * here inflates anything itself, and nothing is read that the limits policy did
 * not admit first.
 */
export async function readArchive(
  headers: readonly ArchiveEntryHeader[],
  read: EntryReader,
): Promise<ImportResult> {
  const located = locatePostDocuments(headers.map((header) => header.name));
  if (!located.recognised) {
    return { understood: false, reason: located.reason, filesSeen: located.filesSeen };
  }

  const byName = new Map(headers.map((header) => [header.name, header]));
  const report: ImportReport = {
    posts: [],
    platforms: [],
    refused: [],
    unreadable: [],
    skipped: [],
    textRepairs: 0,
  };

  // The running total spans the WHOLE archive, not one document. Resetting it
  // per file would restore exactly the unbounded case zip-limits exists to
  // prevent — many entries, each individually fine.
  let admitted: AdmittedSoFar = NOTHING_ADMITTED;

  for (const group of located.found) {
    let contributed = false;

    for (const name of group.paths) {
      const header = byName.get(name);
      if (!header) {
        // locate-posts only ever names paths it was given, so this cannot happen
        // from a listing derived from `headers`. It can happen if a caller
        // passes a doctored listing, and silently dropping the file would be the
        // wrong answer to that.
        report.unreadable.push({ name, reason: "This file was listed but has no entry in the archive index." });
        continue;
      }

      const verdict = judgeEntry(header, admitted);
      if (!verdict.admit) {
        report.refused.push({ name, reason: verdict.reason });
        continue;
      }

      let bytes: Uint8Array;
      try {
        bytes = await read(name);
      } catch (error) {
        // KEEP WHAT THE READER SAID. "Could not be read" is true of a locked
        // file, a corrupt one and an unsupported compression method alike, and
        // only one of those is something the person can do anything about —
        // a password-protected export can be exported again without one.
        // Throwing the reader's sentence away loses exactly the part that tells
        // them which situation they are in. Bounded, because it is text from a
        // library rather than something written for a person to read.
        const detail = error instanceof Error && error.message ? ` ${error.message.slice(0, 160)}` : "";
        report.unreadable.push({ name, reason: `This file could not be read out of the archive.${detail}` });
        continue;
      }

      // THE SECOND CHECK. The verdict above trusted a number written by whoever
      // built the archive; this one measures what actually arrived. A header
      // that under-declares is not a rounding error, it is the whole trick.
      if (bytes.length > header.uncompressedSize) {
        report.refused.push({
          name,
          reason: "This file is larger than the archive index said it would be, so its index cannot be trusted.",
        });
        continue;
      }
      // Charge the budget the REAL size, not the declared one. A file that
      // claims 300 MB and delivers 1 KB would otherwise eat the whole archive's
      // allowance and get every later document refused for no reason.
      //
      // This second call cannot refuse: the bytes are provably no larger than a
      // declared size that already passed, since the check above rejects
      // anything bigger. The branch exists because `next` lives behind a union
      // that has to be narrowed to be read at all — it is the type system
      // asking, not a second opinion. If it ever does fire, the argument above
      // has stopped holding and refusing is the right answer to that.
      const settled = judgeEntry({ ...header, uncompressedSize: bytes.length }, admitted);
      if (!settled.admit) {
        report.refused.push({ name, reason: settled.reason });
        continue;
      }
      admitted = settled.next;

      const text = bytesToText(bytes);
      let root: unknown;
      try {
        root = JSON.parse(text);
      } catch {
        report.unreadable.push({ name, reason: "This file is not valid JSON, so nothing could be read from it." });
        continue;
      }

      const parsed = parseExportDocument(root);
      for (const post of parsed.posts) {
        const decoded = decodeExportText(post.text);
        report.textRepairs += decoded.repairs;
        report.posts.push(decoded.repairs > 0 ? { ...post, text: decoded.text } : post);
        contributed = true;
      }
      for (const skip of parsed.skipped) {
        report.skipped.push({ document: name, index: skip.index, reason: skip.reason });
      }
    }

    // Only claim a platform we actually recovered something from. Listing one
    // because a file with the right name existed would tell the user their
    // Facebook history imported when none of it did.
    if (contributed) report.platforms.push(group.platform);
  }

  return { understood: true, prefix: located.prefix, report };
}
