// THE WHOLE PIPELINE, DRIVEN BY A FAKE ARCHIVE.
//
// read-archive.ts is the only place where the limits policy, the locator, the
// decoder and the parser meet, so it is the only place where they can be wired
// together WRONGLY while each one stays individually correct. The interesting
// assertions here are about the seams:
//
//   - the running total spans the ARCHIVE, not one document (resetting it per
//     file restores exactly the unbounded case zip-limits exists to prevent);
//   - nothing is read before it is admitted, which is the entire point of
//     judging on the central directory;
//   - a header that under-declares its size is caught by the SECOND check,
//     because the first one trusted a number an attacker wrote;
//   - one bad document does not lose the rest of the import.
//
// Because the reader is injected, every one of those — including the hostile
// cases — is exercised without constructing a single real ZIP file.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readArchive, type ImportResult } from "../src/lib/portability/read-archive";
import { ZIP_LIMITS, type ArchiveEntryHeader } from "../src/lib/portability/zip-limits";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
let checks = 0;

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length));
}

const ENCODER = new TextEncoder();
const PREFIX = "instagram-janedoe-2024-01-15/";
const IG = `${PREFIX}your_instagram_activity/content/`;

/** Bytes as Latin-1 characters — Meta's exporter's mistake, reproduced. */
function latin1(...bytes: number[]): string {
  return String.fromCharCode(...bytes);
}

function post(seconds: number, title: string) {
  return { creation_timestamp: seconds, title, media: [{ uri: "media/posts/1.jpg" }] };
}

/** A fake archive: headers plus the bytes each entry would yield. */
class FakeArchive {
  readonly headers: ArchiveEntryHeader[] = [];
  private readonly bytes = new Map<string, Uint8Array>();
  readonly readCalls: string[] = [];

  /** Add a JSON document. `declared` overrides the header's honesty. */
  addDocument(name: string, value: unknown, declared?: number) {
    const encoded = ENCODER.encode(JSON.stringify(value));
    this.bytes.set(name, encoded);
    // compressedSize is derived from the DECLARED size, because that is what a
    // real central directory holds — the two numbers come from the same record.
    // Deriving it from the actual bytes instead gives an over-declared header an
    // absurd ratio, and the entry gets refused as malformed before the check
    // under test is ever reached.
    const claimed = declared ?? encoded.length;
    this.headers.push({
      name,
      uncompressedSize: claimed,
      compressedSize: Math.max(1, Math.floor(claimed / 4)),
    });
    return this;
  }

  /** Add raw bytes — for encodings JSON.stringify cannot express. */
  addRaw(name: string, raw: Uint8Array, declared?: number) {
    this.bytes.set(name, raw);
    this.headers.push({
      name,
      uncompressedSize: declared ?? raw.length,
      compressedSize: Math.max(1, Math.floor(raw.length / 4)),
    });
    return this;
  }

  /** Add a header with no readable bytes — media, or an entry that fails to read. */
  addHeader(header: ArchiveEntryHeader) {
    this.headers.push(header);
    return this;
  }

  reader = async (name: string): Promise<Uint8Array> => {
    this.readCalls.push(name);
    const found = this.bytes.get(name);
    if (!found) throw new Error(`no bytes for ${name}`);
    return found;
  };
}

function expectUnderstood(result: ImportResult, what: string) {
  assert.equal(result.understood, true, `${what} was not understood: ${result.understood === false ? result.reason : ""}`);
  if (!result.understood) throw new Error("unreachable");
  return result;
}

// Everything below lives in main() because these gates are transpiled to CJS,
// where top-level await is not available. The catch at the bottom is not
// decoration: without it a rejected promise would print a warning and this
// script would still exit 0, which is a gate that cannot fail.
async function main() {

// ── 1. A REALISTIC ARCHIVE READS END TO END ─────────────────────────────────
{
  const archive = new FakeArchive()
    .addDocument(`${IG}posts_1.json`, [post(1700000000, "first"), post(1700000100, "second")])
    .addDocument(`${IG}posts_2.json`, [post(1700000200, "third")])
    .addHeader({ name: `${PREFIX}media/posts/1.jpg`, uncompressedSize: 300_000, compressedSize: 299_000 });

  const result = expectUnderstood(await readArchive(archive.headers, archive.reader), "a realistic export");
  assert.equal(result.prefix, PREFIX, `prefix came out as ${JSON.stringify(result.prefix)}`);
  assert.equal(result.report.posts.length, 3, `recovered ${result.report.posts.length} posts, expected 3`);
  assert.deepEqual(result.report.posts.map((p) => p.text), ["first", "second", "third"], "posts came back in the wrong order or with the wrong text.");
  assert.deepEqual(result.report.platforms, ["instagram"], `platforms came out as ${JSON.stringify(result.report.platforms)}`);
  assert.equal(result.report.refused.length, 0, `a clean archive had refusals: ${JSON.stringify(result.report.refused)}`);
  checks += 5;

  // The media file is never opened. Reading it would be pure waste on an archive
  // that is overwhelmingly media by volume.
  assert.ok(
    !archive.readCalls.includes(`${PREFIX}media/posts/1.jpg`),
    "a media file was read. Only located documents should ever be opened.",
  );
  checks += 1;
}

// ── 2. THE RUNNING TOTAL SPANS THE ARCHIVE, NOT ONE DOCUMENT ────────────────
//
// The seam bug that would restore the unbounded case. Each document below is
// comfortably under every per-entry cap; together they are over the budget.
{
  const perDoc = 40 * 1024 * 1024;
  const filler = "x".repeat(perDoc - 200);
  const archive = new FakeArchive();
  const wanted = Math.ceil(ZIP_LIMITS.maxTotalBytes / perDoc) + 4;
  for (let i = 1; i <= wanted; i += 1) {
    archive.addDocument(`${IG}posts_${i}.json`, [post(1700000000 + i, filler)]);
  }

  const result = expectUnderstood(await readArchive(archive.headers, archive.reader), "an oversized archive");
  assert.ok(
    result.report.refused.length > 0,
    `${wanted} documents totalling over the archive budget produced no refusals at all. The running total is being reset per document, which is the same as having no total.`,
  );
  assert.ok(
    result.report.posts.length < wanted,
    "every document was admitted despite the archive exceeding the total budget.",
  );
  // And the refusal must be the TOTAL, not a per-entry cap — each of these is
  // well under maxEntryBytes, so a per-entry refusal would mean the wrong
  // control fired and this test proves nothing.
  assert.ok(
    result.report.refused.some((r) => /in total/i.test(r.reason)),
    `refusals cite the wrong control: ${JSON.stringify(result.report.refused.map((r) => r.reason).slice(0, 2))}`,
  );
  checks += 3;

  // Nothing past the budget is even READ. Refusing after reading would bound
  // memory only after having already spent it.
  assert.ok(
    archive.readCalls.length < wanted,
    `every one of ${wanted} documents was read even though ${result.report.refused.length} were refused.`,
  );
  checks += 1;
}

// ── 3. A HEADER THAT UNDER-DECLARES IS CAUGHT AFTER READING ─────────────────
//
// The first check trusts a number the archive's author wrote. This is the one
// that measures what actually arrived.
{
  const archive = new FakeArchive()
    .addDocument(`${IG}posts_1.json`, [post(1700000000, "honest")])
    // Claims 40 bytes, delivers far more.
    .addDocument(`${IG}posts_2.json`, [post(1700000100, "y".repeat(50_000))], 40);

  const result = expectUnderstood(await readArchive(archive.headers, archive.reader), "an archive with a lying header");
  assert.equal(result.report.posts.length, 1, "the lying entry's posts were accepted.");
  assert.equal(result.report.refused.length, 1, `expected exactly one refusal, got ${result.report.refused.length}`);
  assert.ok(
    /larger than the archive index said/i.test(result.report.refused[0].reason),
    `the refusal does not identify the lying header: ${result.report.refused[0].reason}`,
  );
  checks += 3;

  // The OTHER direction, which is not an attack but a waste. A header that
  // OVER-declares must be charged what it actually delivered — otherwise one
  // file claiming most of the budget starves every document after it, and the
  // user loses history to a number that was never true.
  // Each stays under the per-entry cap so THAT is not what fires; together their
  // DECLARED sizes exceed the archive budget while their real sizes are a few
  // hundred bytes in total.
  const nearEntryCap = ZIP_LIMITS.maxEntryBytes - 1;
  const overCount = Math.ceil(ZIP_LIMITS.maxTotalBytes / nearEntryCap) + 2;
  const overDeclared = new FakeArchive();
  for (let i = 1; i <= overCount; i += 1) {
    overDeclared.addDocument(`${IG}posts_${i}.json`, [post(1700000000 + i, "small")], nearEntryCap);
  }

  const thrifty = expectUnderstood(await readArchive(overDeclared.headers, overDeclared.reader), "an archive of over-declared headers");
  assert.equal(
    thrifty.report.posts.length,
    overCount,
    `only ${thrifty.report.posts.length} of ${overCount} posts survived. These files DECLARE most of the budget and deliver a few hundred bytes each, so charging the declared size throws away history over numbers that were never true.`,
  );
  assert.equal(thrifty.report.refused.length, 0, `documents were refused after over-declared headers: ${JSON.stringify(thrifty.report.refused.slice(0, 2))}`);
  checks += 2;
}

// ── 4. ONE BAD DOCUMENT DOES NOT LOSE THE IMPORT ────────────────────────────
{
  const archive = new FakeArchive()
    .addDocument(`${IG}posts_1.json`, [post(1700000000, "survives")])
    .addRaw(`${IG}posts_2.json`, ENCODER.encode("{ this is not json"))
    .addDocument(`${IG}posts_3.json`, [post(1700000200, "also survives")])
    // Declared, but the reader throws for it.
    .addHeader({ name: `${IG}posts_4.json`, uncompressedSize: 100, compressedSize: 50 });

  const result = expectUnderstood(await readArchive(archive.headers, archive.reader), "an archive with one broken document");
  assert.deepEqual(
    result.report.posts.map((p) => p.text),
    ["survives", "also survives"],
    "a malformed document took the rest of the import down with it.",
  );
  assert.equal(result.report.unreadable.length, 2, `expected 2 unreadable documents, got ${result.report.unreadable.length}`);
  assert.ok(
    result.report.unreadable.every((u) => u.reason.length > 20),
    "an unreadable document was recorded without an explanation.",
  );
  checks += 3;

  // Records the parser dropped are reported WITH their document, so "3 skipped"
  // can be traced to a file rather than floating free.
  const undated = new FakeArchive().addDocument(`${IG}posts_1.json`, [
    post(1700000000, "kept"),
    { title: "no timestamp anywhere" },
  ]);
  const partial = expectUnderstood(await readArchive(undated.headers, undated.reader), "a document with an undated entry");
  assert.equal(partial.report.posts.length, 1, "an undated entry was invented a date and kept.");
  assert.equal(partial.report.skipped.length, 1, `expected 1 skipped record, got ${partial.report.skipped.length}`);
  assert.equal(partial.report.skipped[0].document, `${IG}posts_1.json`, "a skipped record does not name the document it came from.");
  checks += 3;
}

// ── 5. MOJIBAKE IS REPAIRED, AND COUNTED ────────────────────────────────────
{
  // JSON.stringify writes these as Ã© escapes, which is exactly the
  // form Meta ships. The file itself is valid UTF-8; the damage is in the value.
  const mangled = latin1(0x63, 0x61, 0x66, 0xc3, 0xa9);
  const archive = new FakeArchive().addDocument(`${IG}posts_1.json`, [
    post(1700000000, mangled),
    post(1700000100, "plain ascii"),
  ]);

  const result = expectUnderstood(await readArchive(archive.headers, archive.reader), "an archive with mangled captions");
  assert.equal(result.report.posts[0].text, "café", `the caption was not repaired: ${JSON.stringify(result.report.posts[0].text)}`);
  assert.equal(result.report.posts[1].text, "plain ascii", "an untouched caption was altered.");
  assert.equal(result.report.textRepairs, 1, `textRepairs was ${result.report.textRepairs}, expected exactly 1`);
  checks += 3;

  // A file whose BYTES are Latin-1 rather than UTF-8 must still read. This is
  // the other form of the same bug, and the strict-then-fall-back order is what
  // covers it.
  const json = JSON.stringify([post(1700000000, "café")]);
  const latin1Bytes = new Uint8Array(json.length);
  for (let i = 0; i < json.length; i += 1) latin1Bytes[i] = json.charCodeAt(i) & 0xff;
  const rawArchive = new FakeArchive().addRaw(`${IG}posts_1.json`, latin1Bytes);
  const rawResult = expectUnderstood(await readArchive(rawArchive.headers, rawArchive.reader), "a Latin-1 encoded document");
  assert.equal(rawResult.report.posts.length, 1, "a Latin-1 document was not read at all.");
  assert.equal(rawResult.report.posts[0].text, "café", `Latin-1 bytes produced ${JSON.stringify(rawResult.report.posts[0].text)}`);
  checks += 2;
}

// ── 6. AN ARCHIVE WE DO NOT UNDERSTAND STAYS UNDERSTOOD-FALSE ───────────────
//
// The property has to survive the extra layer. A pipeline that quietly turns
// "did not recognise" into "read successfully, zero posts" undoes the whole
// point of the locator's type.
{
  const archive = new FakeArchive().addDocument("SomeOtherPlatform/export/data.json", [post(1700000000, "hi")]);
  const result = await readArchive(archive.headers, archive.reader);
  assert.equal(result.understood, false, "an unrecognised archive was reported as understood.");
  if (result.understood) throw new Error("unreachable");
  assert.equal(result.filesSeen, 1, `filesSeen was ${result.filesSeen}`);
  assert.ok(result.reason.length > 40, "the refusal does not explain itself.");
  checks += 3;

  assert.equal(archive.readCalls.length, 0, "an unrecognised archive still had files read out of it.");
  checks += 1;
}

// ── 7. A PLATFORM IS ONLY CLAIMED IF SOMETHING CAME FROM IT ─────────────────
//
// Listing a platform because a correctly-named file existed would tell someone
// their Facebook history imported when none of it did.
{
  const archive = new FakeArchive()
    .addDocument(`${IG}posts_1.json`, [post(1700000000, "real")])
    .addRaw(`${PREFIX}your_instagram_activity/threads/threads_and_replies.json`, ENCODER.encode("{ broken"));

  const result = expectUnderstood(await readArchive(archive.headers, archive.reader), "an archive with an unreadable Threads file");
  assert.deepEqual(
    result.report.platforms,
    ["instagram"],
    `platforms claimed ${JSON.stringify(result.report.platforms)} when Threads produced nothing.`,
  );
  assert.equal(result.report.unreadable.length, 1, "the broken Threads document was not reported.");
  checks += 2;

  // And when it DOES work, both are claimed.
  const both = new FakeArchive()
    .addDocument(`${IG}posts_1.json`, [post(1700000000, "ig")])
    .addDocument(`${PREFIX}your_instagram_activity/threads/threads_and_replies.json`, [post(1700000100, "th")]);
  const bothResult = expectUnderstood(await readArchive(both.headers, both.reader), "an archive with working Threads");
  assert.deepEqual(bothResult.report.platforms.slice().sort(), ["instagram", "threads"], "both platforms should be claimed when both produced posts.");
  checks += 1;
}

// ── 8. THE MODULE EXPLAINS ITS TWO NON-OBVIOUS DECISIONS ────────────────────
{
  const source = readFileSync(join(ROOT, "src/lib/portability/read-archive.ts"), "utf8");
  const code = stripComments(source);

  for (const [phrase, why] of [
    [/checked twice|second check|SECOND CHECK/, "that the declared size is checked before reading and the real size again after, because the first number is written by whoever built the archive"],
    [/after parsing, not before|after parsing/i, "why the text repair happens after JSON.parse rather than on the raw bytes, which is where it would miss the escape form entirely"],
  ] as const) {
    assert.ok(phrase.test(source), `the module no longer explains ${why}.`);
    checks += 1;
  }

  // The total must be declared once, outside the document loop. A `let admitted`
  // inside the loop is the per-document reset that section 2 exists to catch,
  // and it is worth failing on the shape as well as the behaviour.
  assert.ok(
    !/for\s*\([^)]*\)\s*\{[^}]*let\s+admitted/.test(code),
    "the admitted-so-far total is declared inside a loop, so it resets and bounds nothing.",
  );
  checks += 1;
}

console.log(
  `read-archive OK — ${checks} assertions.\n` +
    "  The limits policy, locator, decoder and parser are driven together against a fake archive, so\n" +
    "  the hostile cases are exercised without building a real ZIP. The running total spans the whole\n" +
    "  archive rather than one document — proven by an archive of individually-legal files that is\n" +
    "  collectively over budget, and by the fact that the excess is never even read. A header that\n" +
    "  under-declares its size is caught by the second check, after the bytes arrive. One malformed\n" +
    "  document, one unreadable entry and one undated record each cost only themselves. Captions are\n" +
    "  repaired in both encodings Meta ships and the repairs are counted, and a platform is claimed\n" +
    "  only when a post actually came from it.\n" +
    "  Does NOT cover: the ZIP library itself, or the Worker that has to contain it. This module never\n" +
    "  touches either — which is the reason all of the above is testable at all.",
);

}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
