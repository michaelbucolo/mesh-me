// CAPPING EVERY ENTRY AND STILL HAVING NO BOUND AT ALL.
//
// zip-limits.ts decides what may be inflated out of an archive somebody
// downloaded from Instagram and handed to us. The interesting failure is not
// "a bomb got through" — it is a limit set that LOOKS complete and bounds
// nothing.
//
// An entry cap of 64 MB and an entry-count cap of 50,000 feels careful. Their
// product is 3.2 TB. Every individual entry passes every individual check and
// the browser still dies. Only the running total is a bound, and the first
// assertion in this file is the one that proves it.
//
// The other half of the job is the opposite mistake: a cap tight enough to
// reject a real export. Legitimate entries in these archives run 5:1 to 100:1
// and export-shaped JSON reaches ~64:1, so the tests below include the
// legitimate cases that a nervous ratio cap would wrongly refuse. A gate that
// only proves the door is locked never notices it is locked against everyone.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  judgeEntry,
  NOTHING_ADMITTED,
  ZIP_LIMITS,
  type AdmittedSoFar,
  type ArchiveEntryHeader,
} from "../src/lib/portability/zip-limits";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
let checks = 0;

/**
 * Comments are not code. Three gates in this repo have failed by matching their
 * own explanatory paragraphs — this file talks about bombs and ratios at length
 * and must not judge the module by its prose.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length));
}

const entry = (name: string, uncompressedSize: number, compressedSize: number): ArchiveEntryHeader => ({
  name,
  uncompressedSize,
  compressedSize,
});

/** Feed a list of entries through in order, threading the totals as a caller must. */
function admitAll(entries: ArchiveEntryHeader[]): { admitted: number; totals: AdmittedSoFar; firstRefusal: string | null } {
  let totals = NOTHING_ADMITTED;
  let admitted = 0;
  let firstRefusal: string | null = null;
  for (const e of entries) {
    const verdict = judgeEntry(e, totals);
    if (verdict.admit) {
      totals = verdict.next;
      admitted += 1;
    } else if (firstRefusal === null) {
      firstRefusal = verdict.reason;
    }
  }
  return { admitted, totals, firstRefusal };
}

// ── 1. THE CASE THE WHOLE DESIGN EXISTS FOR ─────────────────────────────────
//
// Many entries, each individually under every per-entry cap, summing to far more
// than a browser can hold. This is the attack the running total is the only
// answer to, and it is asserted first because everything else is decoration if
// it fails.
{
  const justUnderPerEntry = ZIP_LIMITS.maxEntryBytes - 1;
  // Ratio kept modest so the ratio cap cannot be what saves us — the point is
  // that the TOTAL is what saves us.
  const swarm = Array.from({ length: 400 }, (_, i) => entry(`content/posts_${i}.json`, justUnderPerEntry, justUnderPerEntry / 4));

  const { admitted, totals } = admitAll(swarm);

  assert.ok(
    admitted < swarm.length,
    "every entry in a 400-file swarm was admitted. Each one passes the per-entry cap; their sum is measured in tens of gigabytes.",
  );
  assert.ok(
    totals.bytes <= ZIP_LIMITS.maxTotalBytes,
    `admitted ${totals.bytes} bytes, over the ${ZIP_LIMITS.maxTotalBytes} total budget — the running total is not actually bounding anything.`,
  );
  checks += 2;

  // And the bound must hold no matter how the bytes are divided up: many small
  // entries must be stopped by exactly the same counter.
  const drizzle = Array.from({ length: 20_000 }, (_, i) => entry(`media/${i}.json`, 1024 * 1024, 256 * 1024));
  const drizzled = admitAll(drizzle);
  assert.ok(
    drizzled.totals.bytes <= ZIP_LIMITS.maxTotalBytes,
    "twenty thousand one-megabyte entries slipped past the total budget.",
  );
  assert.ok(drizzled.firstRefusal !== null, "the drizzle was never refused, so nothing stopped it.");
  checks += 2;

  // The entry COUNT is a separate bound with a separate reason, and the two
  // cases above do not exercise it: both are stopped by the byte budget long
  // before the count matters. Tiny entries never approach 512 MB no matter how
  // many there are, so only the count can stop them — and the cost being
  // bounded here is the central directory, which is paid before a single byte
  // is inflated.
  const swarmOfNothing = Array.from({ length: ZIP_LIMITS.maxEntries + 100 }, (_, i) => entry(`m/${i}.json`, 8, 8));
  const counted = admitAll(swarmOfNothing);
  assert.ok(
    counted.totals.bytes < ZIP_LIMITS.maxTotalBytes / 100,
    "these entries are supposed to be too small for the byte budget to be what stops them. If the bytes are anywhere near the budget this assertion is testing the wrong control.",
  );
  assert.ok(
    counted.totals.entries <= ZIP_LIMITS.maxEntries,
    `admitted ${counted.totals.entries} entries, over the ${ZIP_LIMITS.maxEntries} cap — nothing is bounding the central-directory cost.`,
  );
  assert.ok(
    counted.firstRefusal !== null && /more than/i.test(counted.firstRefusal),
    "an archive with more entries than the cap allows was never refused for that reason.",
  );
  checks += 3;
}

// ── 2. REAL ARCHIVES MUST STILL GET IN ──────────────────────────────────────
//
// The failure nobody notices until a person complains: limits tuned so tightly
// that a genuine Instagram export is refused.
{
  const realistic: ArchiveEntryHeader[] = [
    // Export-shaped JSON compresses well. 64:1 is the worst legitimate case
    // measured for JSON with real per-record variation.
    entry("your_instagram_activity/content/posts_1.json", 12 * 1024 * 1024, (12 * 1024 * 1024) / 64),
    entry("your_instagram_activity/content/posts_2.json", 8 * 1024 * 1024, (8 * 1024 * 1024) / 15),
    entry("personal_information/personal_information.json", 40 * 1024, 40 * 1024 / 8),
    // Media is already compressed — essentially incompressible.
    entry("media/posts/202401/photo.jpg", 3 * 1024 * 1024, 3 * 1024 * 1024 - 2048),
    entry("media/posts/202401/clip.mp4", 20 * 1024 * 1024, 20 * 1024 * 1024 - 4096),
  ];

  const { admitted, firstRefusal } = admitAll(realistic);
  assert.equal(
    admitted,
    realistic.length,
    `a realistic export was refused: ${firstRefusal}\n  Legitimate entries reach 64:1 and a cap that rejects them rejects real people's archives.`,
  );
  checks += 1;

  // A small file with a spectacular ratio is ordinary and must pass — this is
  // why the ratio cap only engages above a size threshold.
  const tiny = judgeEntry(entry("settings/prefs.json", 400 * 1024, 512), NOTHING_ADMITTED);
  assert.ok(tiny.admit, "a 400 KB file from a 512-byte entry was refused; small files legitimately have huge ratios.");
  checks += 1;
}

// ── 3. THE SINGLE-ENTRY BOMB ────────────────────────────────────────────────
{
  // Above the DEFLATE ceiling: not compression, malformed.
  const impossible = judgeEntry(entry("bomb.bin", 50 * 1024 * 1024, 1024), NOTHING_ADMITTED);
  assert.equal(impossible.admit, false, "an entry claiming better than 1032:1 was admitted; DEFLATE cannot do that.");
  assert.ok(
    !impossible.admit && /1032|malformed/i.test(impossible.reason),
    "the refusal does not explain that the ratio is physically impossible.",
  );
  checks += 2;

  // Over the per-entry byte cap.
  const huge = judgeEntry(entry("huge.json", ZIP_LIMITS.maxEntryBytes + 1, 1024 * 1024), NOTHING_ADMITTED);
  assert.equal(huge.admit, false, "an entry over the per-entry byte cap was admitted.");
  checks += 1;
}

// ── 4. NESTING, TRAVERSAL AND MALFORMED HEADERS ─────────────────────────────
{
  for (const name of ["inner.zip", "backup.tar.gz", "stuff.7z"]) {
    const v = judgeEntry(entry(name, 1024, 512), NOTHING_ADMITTED);
    assert.equal(v.admit, false, `${name} was admitted; nesting depth is meant to be zero.`);
    checks += 1;
  }

  for (const name of ["../../etc/passwd", "/etc/shadow", "https://example.com/x.json"]) {
    const v = judgeEntry(entry(name, 1024, 512), NOTHING_ADMITTED);
    assert.equal(v.admit, false, `${name} was admitted; it points outside the archive.`);
    checks += 1;
  }

  for (const [label, size] of [["NaN", Number.NaN], ["Infinity", Number.POSITIVE_INFINITY], ["negative", -1]] as const) {
    const v = judgeEntry(entry("weird.json", size, 512), NOTHING_ADMITTED);
    assert.equal(v.admit, false, `a header declaring ${label} was admitted; arithmetic on it would poison every later total.`);
    checks += 1;
  }

  const unnamed = judgeEntry(entry("   ", 1024, 512), NOTHING_ADMITTED);
  assert.equal(unnamed.admit, false, "an entry with no name was admitted.");
  checks += 1;
}

// ── 5. EVERY REFUSAL SAYS SOMETHING A PERSON CAN ACT ON ─────────────────────
{
  const refusals = [
    judgeEntry(entry("inner.zip", 1024, 512), NOTHING_ADMITTED),
    judgeEntry(entry("../x", 1024, 512), NOTHING_ADMITTED),
    judgeEntry(entry("bomb.bin", 50 * 1024 * 1024, 1024), NOTHING_ADMITTED),
    judgeEntry(entry("huge.json", ZIP_LIMITS.maxEntryBytes + 1, 1024), NOTHING_ADMITTED),
  ];
  for (const r of refusals) {
    assert.equal(r.admit, false, "expected a refusal here");
    assert.ok(!r.admit && r.reason.length > 30, "a refusal must explain itself in words, not a bare no.");
    checks += 2;
  }
}

// ── 6. PURE AND DETERMINISTIC ───────────────────────────────────────────────
//
// A limit that depends on the clock, on randomness, or on hidden state is not a
// limit anyone can reason about — or test.
{
  const e = entry("content/posts_1.json", 5 * 1024 * 1024, 512 * 1024);
  const first = JSON.stringify(judgeEntry(e, NOTHING_ADMITTED));
  for (let i = 0; i < 5; i += 1) {
    assert.equal(JSON.stringify(judgeEntry(e, NOTHING_ADMITTED)), first, "judgeEntry is not deterministic.");
    checks += 1;
  }

  // No hidden accumulator: judging the same entry repeatedly against the same
  // starting totals must never drift, which is what makes the caller-threaded
  // design safe.
  const a = judgeEntry(e, { bytes: 100, entries: 1 });
  const b = judgeEntry(e, { bytes: 100, entries: 1 });
  assert.deepEqual(a, b, "judgeEntry carries state between calls.");
  checks += 1;
}

// ── 7. THE MODULE MUST SAY WHICH LIMITS ARE LOAD-BEARING ────────────────────
//
// Not decoration. The next person to raise a number needs to find, in the file
// they are editing, which one is safe to move. Read past the comments so this
// checks the prose deliberately rather than by accident.
{
  const source = readFileSync(join(ROOT, "src/lib/portability/zip-limits.ts"), "utf8");
  const code = stripComments(source);

  assert.ok(
    /relax the ratio cap/i.test(source),
    "the module does not record which limit is the safe one to relax. That sentence is the only thing standing between a future edit and the removal of the actual bound.",
  );
  checks += 1;

  // And the ranking must be about the running total, not merely mention it.
  assert.ok(
    /running total/i.test(source) && /uncatchable/i.test(source),
    "the module does not explain that a browser OOM is uncatchable, which is why Worker isolation outranks every cap in this file.",
  );
  checks += 1;

  // The code itself must never allocate from a declared size.
  assert.ok(
    !/new (Uint8Array|ArrayBuffer|Buffer)\s*\(\s*[a-zA-Z_$.]*(uncompressedSize|declared)/.test(code),
    "the module allocates a buffer from a header-declared size — a live vulnerability with 33-million-to-1 amplification.",
  );
  checks += 1;
}

console.log(
  `zip-limits OK — ${checks} assertions.\n` +
    "  A 400-file swarm and a 20,000-file drizzle, each entry passing every per-entry cap, are both\n" +
    "  stopped by the running total — the only control that bounds anything, since entry cap times\n" +
    "  per-entry cap is measured in terabytes. A realistic Instagram export (including a legitimate\n" +
    "  64:1 JSON entry and a 400 KB file from a 512-byte entry) is ADMITTED, because a cap that\n" +
    "  rejects real archives is its own kind of failure. Nesting, traversal, sub-DEFLATE-ceiling\n" +
    "  claims and malformed headers are refused, every refusal explains itself, and judgeEntry is\n" +
    "  pure and deterministic with no hidden accumulator.\n" +
    "  Does NOT cover: the Worker isolation that outranks all of this, which lives in the caller —\n" +
    "  no cap here can substitute for being able to terminate() a runaway.",
);
