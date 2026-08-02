// THE SECOND IMPORT IS THE TEST.
//
// Mapping posts to rows is unremarkable. What this module has to get right is
// what happens when somebody imports the same archive again — after a failure,
// from a fresh export that overlaps the old one, or just because they forgot.
//
// A doubled history does not look like a bug. There is no error, no failed
// write, no moment that obviously went wrong; there are simply two of
// everything, and the person is left to wonder whether they did it or the tool
// did. So the assertions below are weighted almost entirely toward stability of
// identity: the same post must produce the same sourceId across imports, across
// re-exports that renumber files, and across a fresh export that added posts at
// the top.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { archiveSourceType, toRows } from "../src/lib/portability/to-rows";
import type { ParseResult } from "../src/lib/portability/parse-export";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
let checks = 0;

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length));
}

/**
 * The opposite of stripComments: keep only the prose, and flatten it.
 *
 * A phrase in a comment is wrapped to fit the column limit, so "the SECOND
 * import" is really "SECOND\n// import" in the file and a plain regex misses it.
 * Every prose assertion in this repo has so far worked by luck — the phrases
 * happened not to straddle a line break. Removing the comment markers and
 * collapsing whitespace makes the check about the words rather than about where
 * the author happened to wrap them.
 */
function prose(source: string): string {
  return source
    .split("\n")
    .map((line) => line.replace(/^\s*(\/\/|\*)\s?/, ""))
    .join(" ")
    .replace(/\s+/g, " ");
}

type Post = ParseResult["posts"][number];

function post(publishedAtMs: number, text: string, mediaPaths: string[] = []): Post {
  return { publishedAtMs, text, mediaPaths };
}

// ── 1. THE SAME POST IS THE SAME ROW, EVERY TIME ────────────────────────────
{
  const posts = [
    post(1700000000000, "morning", ["media/posts/1.jpg"]),
    post(1700000100000, "afternoon", ["media/posts/2.mp4"]),
    post(1700000200000, ""),
  ];

  const first = toRows("instagram", posts);
  const second = toRows("instagram", posts);
  assert.deepEqual(
    first.map((r) => r.sourceId),
    second.map((r) => r.sourceId),
    "two runs over the same posts produced different identities. Every re-import would duplicate the entire history.",
  );
  checks += 1;

  // And across a process boundary the identity must be a value, not a reference —
  // JSON round-tripping is what an API request does to it.
  const shipped = JSON.parse(JSON.stringify(first)) as typeof first;
  assert.deepEqual(shipped.map((r) => r.sourceId), first.map((r) => r.sourceId), "identities did not survive serialisation.");
  checks += 1;

  // Distinct posts must not collide.
  assert.equal(new Set(first.map((r) => r.sourceId)).size, 3, "three different posts did not produce three identities.");
  checks += 1;
}

// ── 2. A RE-EXPORT THAT RENUMBERS EVERYTHING CHANGES NOTHING ────────────────
//
// The failure an index-based identity would cause: export again a month later,
// one new post lands at the top, every older post shifts by one, and the whole
// history imports a second time as new.
{
  const original = [
    post(1700000000000, "oldest", ["media/1.jpg"]),
    post(1700000100000, "middle", []),
    post(1700000200000, "newest", ["media/2.jpg"]),
  ];
  // A month later: one new post, and the order the reader happened to produce.
  const laterExport = [
    post(1700900000000, "brand new", ["media/9.jpg"]),
    post(1700000200000, "newest", ["media/2.jpg"]),
    post(1700000100000, "middle", []),
    post(1700000000000, "oldest", ["media/1.jpg"]),
  ];

  const before = new Set(toRows("instagram", original).map((r) => r.sourceId));
  const after = toRows("instagram", laterExport);
  const carriedOver = after.filter((r) => before.has(r.sourceId));

  assert.equal(
    carriedOver.length,
    3,
    `only ${carriedOver.length} of 3 previously-imported posts were recognised on a re-export. The rest would be inserted again as new.`,
  );
  assert.equal(after.length - carriedOver.length, 1, "the genuinely new post was not the only new identity.");
  checks += 2;
}

// ── 3. THE PARTS OF A POST THAT MATTER, AND ONLY THOSE ──────────────────────
{
  const base = post(1700000000000, "hello", ["media/1.jpg"]);
  const id = (p: Post) => toRows("instagram", [p])[0].sourceId;

  assert.notEqual(id(base), id(post(1700000000001, "hello", ["media/1.jpg"])), "a different timestamp produced the same identity.");
  assert.notEqual(id(base), id(post(1700000000000, "hello!", ["media/1.jpg"])), "different text produced the same identity.");
  assert.notEqual(id(base), id(post(1700000000000, "hello", ["media/2.jpg"])), "different media produced the same identity.");
  assert.notEqual(id(base), id(post(1700000000000, "hello", [])), "dropping the media produced the same identity.");
  checks += 4;

  // A caption cannot be crafted to impersonate another post. Without framing,
  // ("a", ["b"]) and ("ab", []) would hash the same bytes.
  assert.notEqual(
    id(post(1700000000000, "a", ["b"])),
    id(post(1700000000000, "ab", [])),
    "a caption can impersonate another post's media list. The hashed parts are being concatenated without unambiguous framing.",
  );
  assert.notEqual(
    id(post(1700000000000, "x:y", [])),
    id(post(1700000000000, "x", ["y"])),
    "a caption containing the framing separator collides with a different post.",
  );
  checks += 2;

  // The platform namespace must separate identical content on two platforms.
  const igRow = toRows("instagram", [base])[0];
  const fbRow = toRows("facebook", [base])[0];
  assert.notEqual(igRow.sourceType, fbRow.sourceType, "the same post on two platforms shares a sourceType.");
  assert.equal(igRow.sourceId, fbRow.sourceId, "sourceId should describe the POST; the platform belongs in sourceType.");
  checks += 2;

  // And an archive import must never collide with a live API sync.
  assert.notEqual(archiveSourceType("instagram"), "instagram", "an archive import shares a namespace with a live sync, so one can overwrite the other.");
  assert.match(archiveSourceType("instagram"), /archive/i, "the archive namespace is not identifiable.");
  checks += 2;
}

// ── 4. DUPLICATES WITHIN ONE IMPORT ARE COLLAPSED HERE ──────────────────────
//
// Meta splits exports across numbered files and the same post can appear twice.
// Letting the database reject the second means a failed write mid-transaction
// rather than a row that was simply never offered.
{
  const twice = [
    post(1700000000000, "same", ["media/1.jpg"]),
    post(1700000100000, "different", []),
    post(1700000000000, "same", ["media/1.jpg"]),
  ];
  const rows = toRows("instagram", twice);
  assert.equal(rows.length, 2, `a post listed twice in one archive produced ${rows.length} rows.`);
  assert.equal(new Set(rows.map((r) => r.sourceId)).size, rows.length, "the returned rows contain a duplicate identity.");
  checks += 2;
}

// ── 5. THE ROW ITSELF ───────────────────────────────────────────────────────
{
  const rows = toRows("instagram", [
    post(1700000000000, "with a photo", ["media/posts/1.jpg"]),
    post(1700000100000, "with a video", ["media/posts/2.mp4"]),
    post(1700000200000, "with both", ["media/posts/3.jpg", "media/posts/4.mov"]),
    post(1700000300000, "just words"),
    post(1700000400000, ""),
  ]);

  assert.deepEqual(
    rows.map((r) => r.canonicalType),
    ["photo", "video", "video", "text", "text"],
    "canonicalType does not follow the media the post actually carries.",
  );
  checks += 1;

  // The date comes from the post. parse-export refuses to invent one, and this
  // must not quietly reintroduce "now".
  assert.equal(rows[0].sourceCreatedAt.getTime(), 1700000000000, "sourceCreatedAt is not the post's own timestamp.");
  checks += 1;

  // An empty caption is a real thing and must survive as one.
  assert.equal(rows[4].textContent, "", "an empty caption became something other than an empty string.");
  checks += 1;

  // mediaJson must always be parseable, including when there is no media.
  for (const row of rows) {
    const parsed = JSON.parse(row.mediaJson);
    assert.ok(Array.isArray(parsed), `mediaJson is not an array for ${JSON.stringify(row.textContent)}`);
    checks += 1;
  }
  assert.deepEqual(JSON.parse(rows[3].mediaJson), [], "a post with no media did not produce an empty array.");
  assert.deepEqual(JSON.parse(rows[2].mediaJson), ["media/posts/3.jpg", "media/posts/4.mov"], "media paths were altered.");
  checks += 2;

  // No posts, no rows — and no crash.
  assert.deepEqual(toRows("instagram", []), [], "an empty import produced rows.");
  checks += 1;
}

// ── 6. AWKWARD CONTENT SURVIVES ─────────────────────────────────────────────
{
  const awkward = [
    post(1700000000000, "emoji \u{1f600} and accents café", ["media/1.jpg"]),
    post(1700000100000, "a".repeat(20_000), []),
    post(1700000200000, 'quotes " and \\ backslashes', ["media/with space.jpg"]),
    post(1700000300000, "日本語のキャプション", []),
  ];
  const rows = toRows("instagram", awkward);
  assert.equal(rows.length, 4, "awkward content lost a post.");
  assert.equal(new Set(rows.map((r) => r.sourceId)).size, 4, "awkward content collided.");
  assert.equal(rows[0].textContent, "emoji \u{1f600} and accents café", "text was altered on the way into the row.");
  assert.equal(rows[1].textContent.length, 20_000, "a long caption was truncated silently.");
  assert.deepEqual(JSON.parse(rows[2].mediaJson), ["media/with space.jpg"], "a path with a space did not survive JSON.");
  checks += 5;

  // Every identity must be a safe database key: hex, bounded, no separators.
  for (const row of rows) {
    assert.match(row.sourceId, /^[0-9a-f]{40}$/, `sourceId is not a bounded hex digest: ${row.sourceId}`);
    checks += 1;
  }
}

// ── 7. THE MODULE EXPLAINS THE CHOICE A FUTURE EDIT WOULD UNDO ──────────────
{
  const source = readFileSync(join(ROOT, "src/lib/portability/to-rows.ts"), "utf8");
  const code = stripComments(source);
  const words = prose(source);

  for (const [phrase, why] of [
    [/CONTENT HASH rather than a counter or an index/, "why the identity is a hash of the post rather than its position, without which a re-export renumbers everything and imports the whole history again"],
    [/length-prefixed|unambiguous/i, "why the hashed parts are framed, without which a caption can impersonate another post's media list"],
    [/second import/i, "that importing the same archive twice is the case this module exists for"],
  ] as const) {
    assert.ok(phrase.test(words), `the module no longer explains ${why}.`);
    checks += 1;
  }

  // Nothing here may read a clock. An identity that moves is an identity that
  // duplicates, and Date.now() is the easiest way to introduce one.
  assert.ok(
    !/Date\.now\(\)|new Date\(\)/.test(code),
    "this module reads the clock. Any identity that depends on when the import ran makes every re-import a duplicate.",
  );
  checks += 1;
}

console.log(
  `to-rows OK — ${checks} assertions.\n` +
    "  The identity of an imported post is a framed content hash, so the same post is the same row\n" +
    "  across runs, across serialisation, and across a re-export that adds posts and renumbers every\n" +
    "  file — the case an index-based identity would turn into a second copy of somebody's whole\n" +
    "  history, silently and with no error to see. Timestamp, text and media each change it; nothing\n" +
    "  about the file, the position or the clock does. A caption cannot impersonate another post's\n" +
    "  media list. Duplicates within one archive are collapsed before the database sees them.\n" +
    "  Does NOT cover: the write itself. These rows still have to reach ContentSource, whose unique\n" +
    "  key is what actually enforces all of this — nothing here can substitute for that constraint.",
);
