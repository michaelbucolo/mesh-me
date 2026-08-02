// THE EDGE. THE ONLY FILE HERE THAT KNOWS A ZIP LIBRARY EXISTS.
//
// Everything else in this folder is pure and gated without a dependency:
// zip-limits, locate-posts, decode-text, parse-export and read-archive together
// import nothing. That was deliberate, and this file is the reason it was worth
// it — the whole pipeline was proved correct before a library was chosen, and
// what remains here is small enough to read in one sitting.
//
// Its entire job: turn a Blob into (a) the central-directory headers and (b) a
// function that inflates ONE named entry. `readArchive` does the rest.
//
// ── WHY THE HEADER THAT WAS JUDGED MUST BE THE ENTRY THAT IS READ ───────────
//
// A ZIP may legally contain two entries with the same name. Nothing forbids it,
// and it is trivial to construct one where the first is 200 bytes and the second
// is 200 megabytes.
//
// That matters here more than anywhere else in the pipeline, because the limits
// are enforced against the HEADER and the bytes come from the ENTRY. If the
// header list carried the small one and `read` resolved the name to the large
// one, every cap in zip-limits would have judged a file that was never opened —
// a complete bypass, produced by nothing more exotic than a duplicate filename.
//
// So both come from the SAME entry object. The first occurrence of a name wins,
// it is the one whose sizes go into the headers, and it is the one `read`
// returns. They cannot diverge because there is only one of them.
//
// ── WHY zip.js IS TOLD NOT TO USE WEB WORKERS ───────────────────────────────
//
// The control ranked above every cap in zip-limits is the ability to STOP a
// runaway: a browser out-of-memory is uncatchable, so the only real defence is
// running the import in a Worker the page can terminate().
//
// This module is built to run INSIDE that Worker. If zip.js then spawned its own
// codec workers, they would be children of a thread whose parent's terminate()
// does not reach them — threads doing unbounded decompression that nothing can
// stop, which is precisely the thing the Worker existed to prevent. Disabling
// them keeps the whole import on one killable thread.
//
// ── WHAT THE LIBRARY'S OWN CHECKS ARE FOR ───────────────────────────────────
//
// zip.js verifies CRC-32 per entry and throws on a declared size that does not
// match the stream. Useful, and not a substitute for anything: those checks fire
// DURING inflation, which is after the decision this pipeline exists to make.
// They are a backstop against a lying header, not a knob to tighten.

import type { ArchiveEntryHeader } from "./zip-limits";
import type { EntryReader } from "./read-archive";

type OpenedArchive = {
  /** One per readable entry, first-occurrence-wins on duplicate names. */
  headers: ArchiveEntryHeader[];
  /** Inflates one entry, by the exact name that appears in `headers`. */
  read: EntryReader;
  /** Releases the reader. Safe to call more than once. */
  close: () => Promise<void>;
};

/**
 * Open an archive and describe it, WITHOUT inflating anything.
 *
 * Listing the central directory costs a handful of ranged reads against the
 * Blob — 169 bytes to enumerate a 51 KB archive, measured. Nothing is
 * decompressed until `read` is called, and `readArchive` only calls it for
 * entries the limits policy has already admitted.
 */
export async function openArchive(source: Blob): Promise<OpenedArchive> {
  // String-literal dynamic import: keeps ~44 KB gzip out of every bundle that
  // does not import an archive, and stays statically resolvable so the
  // dead-code check can still see the dependency is used.
  const { BlobReader, ZipReader, Uint8ArrayWriter, configure } = await import("@zip.js/zip.js");

  configure({ useWebWorkers: false });

  const reader = new ZipReader(new BlobReader(source));
  const entries = await reader.getEntries();

  const headers: ArchiveEntryHeader[] = [];
  // Narrowed to the FILE variant, not the whole Entry union. A directory entry
  // has no getData at all, so letting one into this map would make reading it a
  // runtime question instead of a compile-time one.
  const admitted = new Map<string, Extract<(typeof entries)[number], { directory: false }>>();

  for (const entry of entries) {
    // A directory is not something to read. Note this is the flag from the
    // archive, not a guess from a trailing slash.
    if (entry.directory) continue;

    const name = entry.filename;
    if (!name) continue;

    // FIRST WINS, and the same object serves both roles from here on.
    if (admitted.has(name)) continue;
    admitted.set(name, entry);

    headers.push({
      name,
      uncompressedSize: entry.uncompressedSize,
      compressedSize: entry.compressedSize,
    });
  }

  const read: EntryReader = async (name) => {
    const entry = admitted.get(name);
    if (!entry) {
      throw new Error(`This archive has no entry named "${name}".`);
    }

    // Encrypted entries stay in `headers` on purpose. Dropping them would make a
    // password-protected export look like an archive we did not recognise, which
    // is a different and less true statement than "this file is locked".
    if (entry.encrypted) {
      throw new Error(`"${name}" is password-protected, so its contents cannot be read.`);
    }

    // No guard for a missing getData: the map holds only file entries, so the
    // type system already rules it out. A runtime check here would be
    // unreachable code wearing the costume of a safeguard.
    return entry.getData(new Uint8ArrayWriter());
  };

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await reader.close();
  };

  return { headers, read, close };
}
