// THE FIRST TEST AGAINST REAL ZIP BYTES.
//
// Every gate before this one drove the pipeline with fixtures — headers in an
// array, a reader that returned bytes from a Map. That was the right way to
// prove the logic, and it cannot prove this: that a genuine archive, produced by
// a real ZIP encoder, comes out the other end as somebody's posts.
//
// zip.js writes archives as well as reading them, so the fixtures here are
// built with the encoder and read back with the decoder. That also makes the
// awkward cases constructible rather than hypothetical — a duplicate filename, a
// directory entry named like a document, a nested archive, a password-protected
// file. Each of those is a real ZIP feature, and each is written into a real ZIP
// below.
//
// ── THE ASSERTION THAT MATTERS MOST ─────────────────────────────────────────
//
// Section 3. A ZIP may legally hold two entries with the same name, and the
// limits are enforced against the HEADER while the bytes come from the ENTRY. If
// those two ever resolve to different entries, every cap in zip-limits judged a
// file that was never opened — a total bypass built from nothing but a duplicate
// filename. The test writes exactly that archive and checks the bytes it gets
// back are the ones that were judged.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32 } from "node:zlib";
import { openArchive } from "../src/lib/portability/read-zip";
import { readArchive } from "../src/lib/portability/read-archive";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
let checks = 0;

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length));
}

const PREFIX = "instagram-janedoe-2024-01-15-A1b2C3/";
const IG = `${PREFIX}your_instagram_activity/content/`;

function post(seconds: number, title: string) {
  return { creation_timestamp: seconds, title, media: [{ uri: "media/posts/1.jpg" }] };
}

type FileSpec = {
  name: string;
  text?: string;
  bytes?: Uint8Array;
  directory?: boolean;
  password?: string;
};

/** Build a REAL zip. Nothing here is a stand-in for the format. */
async function buildZip(files: FileSpec[]): Promise<Blob> {
  const { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter, configure } = await import("@zip.js/zip.js");
  configure({ useWebWorkers: false });

  const blobWriter = new BlobWriter("application/zip");
  const writer = new ZipWriter(blobWriter);

  for (const file of files) {
    if (file.directory) {
      await writer.add(file.name, undefined, { directory: true });
      continue;
    }
    const reader = file.bytes ? new Uint8ArrayReader(file.bytes) : new TextReader(file.text ?? "");
    await writer.add(file.name, reader, file.password ? { password: file.password } : undefined);
  }

  await writer.close();
  return blobWriter.getData();
}

/**
 * Write a ZIP by hand, in stored mode, with no duplicate-name guard.
 *
 * zip.js's own writer REFUSES to emit two entries with the same name — the check
 * is unconditional, with no option to disable it. That is worth stating rather
 * than working around quietly: a duplicate filename cannot come from a
 * well-behaved encoder, so it only ever arrives from an archive somebody built
 * on purpose. Which is exactly the archive this pipeline has to survive, and
 * exactly why the fixture has to be built at the byte level.
 *
 * Stored (method 0) throughout, so every length is known and nothing here
 * depends on a compressor.
 */
function buildRawZip(files: Array<{ name: string; text: string }>): Blob {
  const encoder = new TextEncoder();
  // Explicitly backed by ArrayBuffer: the Blob constructor will not take a
  // Uint8Array that might be over a SharedArrayBuffer, and a bare array literal
  // widens to exactly that.
  const locals: Uint8Array<ArrayBuffer>[] = [];
  const centrals: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = encoder.encode(file.text);
    const crc = crc32(Buffer.from(data)) >>> 0;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // local file header signature
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0, true); // flags
    local.setUint16(8, 0, true); // method: stored
    local.setUint16(10, 0, true); // mod time
    local.setUint16(12, 0x21, true); // mod date (1980-01-01; zero is not a valid date)
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true); // compressed size
    local.setUint32(22, data.length, true); // uncompressed size
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true); // extra length

    const localRecord = new Uint8Array(30 + nameBytes.length + data.length);
    localRecord.set(new Uint8Array(local.buffer), 0);
    localRecord.set(nameBytes, 30);
    localRecord.set(data, 30 + nameBytes.length);
    locals.push(localRecord);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true); // central directory signature
    central.setUint16(4, 20, true); // version made by
    central.setUint16(6, 20, true); // version needed
    central.setUint16(8, 0, true); // flags
    central.setUint16(10, 0, true); // method: stored
    central.setUint16(12, 0, true); // mod time
    central.setUint16(14, 0x21, true); // mod date
    central.setUint32(16, crc, true);
    central.setUint32(20, data.length, true);
    central.setUint32(24, data.length, true);
    central.setUint16(28, nameBytes.length, true);
    central.setUint16(30, 0, true); // extra length
    central.setUint16(32, 0, true); // comment length
    central.setUint16(34, 0, true); // disk number start
    central.setUint16(36, 0, true); // internal attributes
    central.setUint32(38, 0, true); // external attributes
    central.setUint32(42, offset, true); // offset of local header

    const centralRecord = new Uint8Array(46 + nameBytes.length);
    centralRecord.set(new Uint8Array(central.buffer), 0);
    centralRecord.set(nameBytes, 46);
    centrals.push(centralRecord);

    offset += localRecord.length;
  }

  const centralSize = centrals.reduce((total, record) => total + record.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); // end of central directory signature
  end.setUint16(4, 0, true); // this disk
  end.setUint16(6, 0, true); // disk with central directory
  end.setUint16(8, centrals.length, true);
  end.setUint16(10, centrals.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  end.setUint16(20, 0, true); // comment length

  return new Blob([...locals, ...centrals, new Uint8Array(end.buffer)]);
}

async function main() {

// ── 1. A REAL INSTAGRAM EXPORT, END TO END ──────────────────────────────────
{
  const blob = await buildZip([
    { name: `${PREFIX}media/posts/1.jpg`, text: "not really a jpeg, but a real entry" },
    { name: `${PREFIX}personal_information/personal_information.json`, text: JSON.stringify({ name: "Jane" }) },
    { name: `${IG}posts_1.json`, text: JSON.stringify([post(1700000000, "first"), post(1700000100, "second")]) },
    { name: `${IG}posts_2.json`, text: JSON.stringify([post(1700000200, "third")]) },
  ]);

  const archive = await openArchive(blob);
  const result = await readArchive(archive.headers, archive.read);
  await archive.close();

  assert.equal(result.understood, true, `a real Instagram export was not understood: ${result.understood === false ? result.reason : ""}`);
  if (!result.understood) throw new Error("unreachable");
  assert.equal(result.prefix, PREFIX, `prefix came out as ${JSON.stringify(result.prefix)}`);
  assert.deepEqual(
    result.report.posts.map((p) => p.text),
    ["first", "second", "third"],
    "posts did not survive a round trip through a real archive.",
  );
  assert.deepEqual(result.report.platforms, ["instagram"], `platforms: ${JSON.stringify(result.report.platforms)}`);
  assert.equal(result.report.refused.length, 0, `a clean archive had refusals: ${JSON.stringify(result.report.refused)}`);
  assert.equal(result.report.unreadable.length, 0, `a clean archive had unreadable entries: ${JSON.stringify(result.report.unreadable)}`);
  checks += 6;
}

// ── 2. NOTHING IS INFLATED THAT WAS NOT ASKED FOR ───────────────────────────
//
// A real export is overwhelmingly media by volume. Opening it must cost the
// central directory and nothing else, and only located documents may be read.
{
  const blob = await buildZip([
    { name: `${PREFIX}media/posts/1.jpg`, text: "x".repeat(5000) },
    { name: `${PREFIX}media/posts/2.jpg`, text: "y".repeat(5000) },
    { name: `${PREFIX}media/stories/3.mp4`, text: "z".repeat(5000) },
    { name: `${IG}posts_1.json`, text: JSON.stringify([post(1700000000, "only me")]) },
  ]);

  const archive = await openArchive(blob);
  const inflated: string[] = [];
  const watched = async (name: string) => {
    inflated.push(name);
    return archive.read(name);
  };

  const result = await readArchive(archive.headers, watched);
  await archive.close();

  assert.equal(result.understood, true, "the watched archive was not understood.");
  assert.deepEqual(
    inflated,
    [`${IG}posts_1.json`],
    `entries were inflated that nobody asked for: ${JSON.stringify(inflated)}. Media is the bulk of a real export and must never be decompressed to find posts.`,
  );
  checks += 2;
}

// ── 3. DUPLICATE FILENAMES: THE JUDGED HEADER IS THE READ ENTRY ─────────────
//
// The bypass this module's design exists to close.
{
  const small = "SMALL";
  const large = "L".repeat(20_000);
  // Hand-built: zip.js will not write this archive, which is the point.
  const blob = buildRawZip([
    { name: `${IG}posts_1.json`, text: small },
    { name: `${IG}posts_1.json`, text: large },
  ]);

  const archive = await openArchive(blob);

  const matching = archive.headers.filter((h) => h.name === `${IG}posts_1.json`);
  assert.equal(
    matching.length,
    1,
    `a duplicate name produced ${matching.length} headers. Two headers for one name means the caller cannot know which entry it judged.`,
  );

  const bytes = await archive.read(`${IG}posts_1.json`);
  await archive.close();

  assert.equal(
    bytes.length,
    matching[0].uncompressedSize,
    `the bytes read (${bytes.length}) are not the size the header declared (${matching[0].uncompressedSize}).\n` +
      "  This is the duplicate-filename bypass: every cap in zip-limits judged an entry that was never opened.",
  );
  assert.equal(new TextDecoder().decode(bytes), small, "the SECOND entry was returned for a name whose FIRST entry was judged.");
  checks += 3;
}

// ── 4. DIRECTORIES, INCLUDING ONE NAMED LIKE A DOCUMENT ─────────────────────
{
  const blob = await buildZip([
    { name: `${IG}`, directory: true },
    { name: `${IG}posts_1.json/`, directory: true },
    { name: `${IG}posts_1.json`, text: JSON.stringify([post(1700000000, "real one")]) },
  ]);

  const archive = await openArchive(blob);
  const names = archive.headers.map((h) => h.name);
  assert.ok(!names.some((n) => n.endsWith("/")), `a directory entry reached the headers: ${JSON.stringify(names)}`);

  const result = await readArchive(archive.headers, archive.read);
  await archive.close();
  assert.equal(result.understood, true, "an archive with directory entries was not understood.");
  if (!result.understood) throw new Error("unreachable");
  assert.equal(result.report.posts.length, 1, `expected the one real document to be read, got ${result.report.posts.length} posts`);
  checks += 3;
}

// ── 5. A NESTED ARCHIVE IS LISTED BUT NEVER OPENED ──────────────────────────
//
// It is not a posts document, so the locator never names it and nothing ever
// inflates it. Worth asserting rather than assuming: "we never look inside a zip
// in a zip" is only true if nothing reaches for it.
{
  const inner = await buildZip([{ name: "deep.json", text: "[]" }]);
  const innerBytes = new Uint8Array(await inner.arrayBuffer());

  const blob = await buildZip([
    { name: `${PREFIX}backup.zip`, bytes: innerBytes },
    { name: `${IG}posts_1.json`, text: JSON.stringify([post(1700000000, "outer")]) },
  ]);

  const archive = await openArchive(blob);
  const inflated: string[] = [];
  const watched = async (name: string) => {
    inflated.push(name);
    return archive.read(name);
  };
  const result = await readArchive(archive.headers, watched);
  await archive.close();

  assert.ok(
    archive.headers.some((h) => h.name === `${PREFIX}backup.zip`),
    "the nested archive is missing from the headers, so the limits policy could never see it.",
  );
  assert.ok(!inflated.includes(`${PREFIX}backup.zip`), "the nested archive was inflated.");
  assert.equal(result.understood, true, "an archive containing a nested archive was not understood.");
  if (!result.understood) throw new Error("unreachable");
  assert.equal(result.report.posts.length, 1, "the outer document was not read.");
  checks += 4;
}

// ── 6. A PASSWORD-PROTECTED DOCUMENT SAYS SO ────────────────────────────────
//
// It must not vanish into "we did not recognise this archive" — that is a
// different and less true statement than "this file is locked".
{
  const blob = await buildZip([
    { name: `${IG}posts_1.json`, text: JSON.stringify([post(1700000000, "locked")]), password: "hunter2" },
  ]);

  const archive = await openArchive(blob);
  assert.ok(
    archive.headers.some((h) => h.name === `${IG}posts_1.json`),
    "an encrypted entry was dropped from the headers, so the archive would read as unrecognised.",
  );

  const result = await readArchive(archive.headers, archive.read);
  await archive.close();

  assert.equal(result.understood, true, "an archive whose only document is encrypted was reported as unrecognised.");
  if (!result.understood) throw new Error("unreachable");
  assert.equal(result.report.posts.length, 0, "an encrypted document somehow produced posts.");
  assert.equal(result.report.unreadable.length, 1, `expected the locked file to be reported, got ${JSON.stringify(result.report.unreadable)}`);
  // And it must say WHY. "Could not be read" is equally true of a corrupt file
  // and an unsupported compression method, and only one of these three is
  // something the person can act on — they can export again without a password.
  assert.ok(
    /password/i.test(result.report.unreadable[0].reason),
    `the report does not say the file is locked, only that it failed: ${JSON.stringify(result.report.unreadable[0].reason)}`,
  );
  checks += 5;
}

// ── 7. BYTES SURVIVE EXACTLY ────────────────────────────────────────────────
//
// Including bytes that are not valid UTF-8, because media is not text and a
// reader that quietly decodes would corrupt it.
{
  const raw = new Uint8Array(512);
  for (let i = 0; i < raw.length; i += 1) raw[i] = (i * 7 + 13) % 256;

  const blob = await buildZip([{ name: `${PREFIX}media/posts/1.bin`, bytes: raw }]);
  const archive = await openArchive(blob);
  const back = await archive.read(`${PREFIX}media/posts/1.bin`);
  await archive.close();

  assert.equal(back.length, raw.length, `length changed: ${back.length} vs ${raw.length}`);
  assert.deepEqual(Array.from(back), Array.from(raw), "arbitrary bytes did not survive the round trip.");
  checks += 2;
}

// ── 8. AN ARCHIVE THAT IS NOT AN EXPORT, AND ONE THAT IS NOT A ZIP ──────────
{
  const blob = await buildZip([{ name: "SomeOtherPlatform/data.json", text: "[]" }]);
  const archive = await openArchive(blob);
  const result = await readArchive(archive.headers, archive.read);
  await archive.close();
  assert.equal(result.understood, false, "an unrelated archive was reported as understood.");
  if (result.understood) throw new Error("unreachable");
  assert.ok(result.filesSeen > 0, "filesSeen was zero for an archive that had a file in it.");
  checks += 2;

  // Not a ZIP at all. This must throw rather than return an empty archive that
  // would read as "recognised nothing".
  const notZip = new Blob([new TextEncoder().encode("this is a text file, not an archive")]);
  let threw = false;
  try {
    const opened = await openArchive(notZip);
    await opened.close();
  } catch {
    threw = true;
  }
  assert.equal(threw, true, "a file that is not a ZIP opened successfully, which would report an empty archive rather than a wrong file.");
  checks += 1;
}

// ── 9. THE MODULE KEEPS ITS TWO NON-OBVIOUS PROMISES IN WRITING ─────────────
{
  const source = readFileSync(join(ROOT, "src/lib/portability/read-zip.ts"), "utf8");
  const code = stripComments(source);

  for (const [phrase, why] of [
    [/same name/i, "that a ZIP may hold two entries with one name, and why the header judged has to be the entry read"],
    [/terminate\(\)/, "that this runs inside a Worker the page can terminate, which is why zip.js is told not to spawn its own"],
  ] as const) {
    assert.ok(phrase.test(source), `the module no longer explains ${why}.`);
    checks += 1;
  }

  // The dynamic import must stay a string literal or the dead-code check cannot
  // see the dependency, and the bundle split silently stops being verifiable.
  assert.ok(
    /import\("@zip\.js\/zip\.js"\)/.test(code),
    "the zip.js import is no longer a plain string literal, so knip can no longer resolve it.",
  );
  checks += 1;

  // Nothing else in this folder may import the library. That separation is what
  // made the rest of the pipeline testable without one.
  const siblings = ["zip-limits", "decode-text", "locate-posts", "parse-export", "read-archive"];
  for (const sibling of siblings) {
    const text = readFileSync(join(ROOT, `src/lib/portability/${sibling}.ts`), "utf8");
    assert.ok(
      !/@zip\.js/.test(stripComments(text)),
      `${sibling}.ts now imports the ZIP library. Keeping it in exactly one file is what lets every other module be gated without a dependency.`,
    );
    checks += 1;
  }
}

console.log(
  `read-zip OK — ${checks} assertions.\n` +
    "  A genuine ZIP, written by a real encoder, is read back into somebody's posts — the first test\n" +
    "  in this pipeline that is not driven by fixtures. Only located documents are inflated: media\n" +
    "  and a nested archive are listed for the limits policy to see and never opened.\n" +
    "  A duplicate filename resolves to ONE header and the bytes read are the bytes that header\n" +
    "  described, which is the bypass this module is shaped to close. Directory entries — including\n" +
    "  one named exactly like a document — stay out. A password-protected file is reported as locked\n" +
    "  rather than disappearing into 'unrecognised'. Arbitrary non-UTF-8 bytes survive exactly, and a\n" +
    "  file that is not a ZIP throws instead of reading as an empty archive.\n" +
    "  Also asserted: no other module in this folder imports the library.\n" +
    "  Does NOT cover: the Worker itself. This module is built to run inside one and says so, but\n" +
    "  spawning and terminating it belongs to the UI, which does not exist yet.",
);

}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
