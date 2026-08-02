// THE BODY IS ASSEMBLED BY CLIENT CODE, WHICH IS TO SAY BY ANYTHING.
//
// The archive is read in the browser and never uploaded — only the posts the
// person chose to import are sent. That is the right architecture, and it means
// this endpoint's input is a JSON array built by code running on a machine we do
// not control.
//
// So the same rule the parser works under applies: SKIP, NEVER INVENT. A post
// with no usable timestamp is dropped with the count reported, not given one —
// because a post dated "now" lands at the top of somebody's timeline claiming to
// be something they wrote today.
//
// The route itself cannot be exercised here (it needs a server and a seeded
// database, and the check chain runs before either), so validation lives in its
// own module and this drives it directly.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_POSTS_PER_REQUEST, validateImportRequest } from "../src/lib/portability/import-request";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
let checks = 0;

function prose(source: string): string {
  return source
    .split("\n")
    .map((line) => line.replace(/^\s*(\/\/|\*)\s?/, ""))
    .join(" ")
    .replace(/\s+/g, " ");
}

const WHEN = 1_700_000_000_000;

function body(posts: unknown[], platform = "instagram") {
  return { platform, posts };
}

function ok(result: ReturnType<typeof validateImportRequest>, what: string) {
  assert.equal(result.ok, true, `${what} was rejected: ${result.ok === false ? result.reason : ""}`);
  if (!result.ok) throw new Error("unreachable");
  return result;
}

// ── 1. A NORMAL BATCH ───────────────────────────────────────────────────────
{
  const result = ok(
    validateImportRequest(body([
      { publishedAtMs: WHEN, text: "hello", mediaPaths: ["media/1.jpg"] },
      { publishedAtMs: WHEN + 1000, text: "", mediaPaths: ["media/2.mp4"] },
      { publishedAtMs: WHEN + 2000, text: "words only", mediaPaths: [] },
    ])),
    "a normal batch",
  );
  assert.equal(result.posts.length, 3, `kept ${result.posts.length} of 3`);
  assert.equal(result.dropped, 0, "a clean batch reported drops.");
  assert.equal(result.platform, "instagram", "the platform was altered.");
  checks += 3;
}

// ── 2. NOTHING IS INVENTED ──────────────────────────────────────────────────
//
// Each of these is missing something a post cannot be given by guessing.
{
  const undated = [
    { text: "no date at all", mediaPaths: ["media/1.jpg"] },
    { publishedAtMs: null, text: "null date", mediaPaths: ["media/1.jpg"] },
    { publishedAtMs: "1700000000000", text: "string date", mediaPaths: ["media/1.jpg"] },
    { publishedAtMs: Number.NaN, text: "NaN", mediaPaths: ["media/1.jpg"] },
    { publishedAtMs: Number.POSITIVE_INFINITY, text: "Infinity", mediaPaths: ["media/1.jpg"] },
    { publishedAtMs: 0, text: "epoch", mediaPaths: ["media/1.jpg"] },
    { publishedAtMs: -WHEN, text: "negative", mediaPaths: ["media/1.jpg"] },
    // Seconds, not milliseconds — a real mistake, and one that would land the
    // post in 1970 rather than failing loudly.
    { publishedAtMs: 1_700_000_000, text: "seconds", mediaPaths: ["media/1.jpg"] },
  ];

  const result = ok(validateImportRequest(body(undated)), "a batch of undated posts");
  assert.equal(result.posts.length, 0, `${result.posts.length} undated posts were kept. Each would appear in a timeline at a date nobody wrote.`);
  assert.equal(result.dropped, undated.length, `dropped was ${result.dropped}, expected ${undated.length}`);
  checks += 2;

  // Dropped must be REPORTED, not folded away. "Imported 460" when 40 were
  // discarded tells the person something false about their own history.
  const mixed = ok(
    validateImportRequest(body([
      { publishedAtMs: WHEN, text: "keeps", mediaPaths: [] },
      { text: "dropped", mediaPaths: [] },
    ])),
    "a mixed batch",
  );
  assert.equal(mixed.posts.length, 1, "the good post was lost.");
  assert.equal(mixed.dropped, 1, "the dropped post was not counted.");
  checks += 2;
}

// ── 3. A POST WITH NEITHER WORDS NOR MEDIA IS NOT A POST ────────────────────
{
  const result = ok(
    validateImportRequest(body([
      { publishedAtMs: WHEN, text: "", mediaPaths: [] },
      { publishedAtMs: WHEN + 1, text: "   ", mediaPaths: [] },
      { publishedAtMs: WHEN + 2 },
    ])),
    "a batch of empty entries",
  );
  assert.equal(result.posts.length, 1, "whitespace-only text was treated as no content, or vice versa.");
  checks += 1;
}

// ── 4. TRAVERSAL IN MEDIA PATHS ─────────────────────────────────────────────
//
// These are resolved against extracted files later. The same refusal
// parse-export and zip-limits already make, made again at the boundary where
// the data crosses a machine.
{
  const result = ok(
    validateImportRequest(body([
      {
        publishedAtMs: WHEN,
        text: "hostile paths",
        mediaPaths: ["../../etc/passwd", "/etc/shadow", "https://example.com/x.jpg", "media/fine.jpg"],
      },
    ])),
    "a post with hostile paths",
  );
  assert.deepEqual(result.posts[0].mediaPaths, ["media/fine.jpg"], `escaping paths survived: ${JSON.stringify(result.posts[0].mediaPaths)}`);
  checks += 1;

  // Dropping every path must not silently drop the post if it still has words.
  const wordsOnly = ok(
    validateImportRequest(body([{ publishedAtMs: WHEN, text: "still a post", mediaPaths: ["../nope"] }])),
    "a post whose only path escaped",
  );
  assert.equal(wordsOnly.posts.length, 1, "a post with words was discarded because its media was refused.");
  assert.deepEqual(wordsOnly.posts[0].mediaPaths, [], "the escaping path survived.");
  checks += 2;
}

// ── 5. PLATFORM ALLOWLIST ───────────────────────────────────────────────────
//
// Accepting anything would mint ContentSource rows under a sourceType no
// importer produces and no reader expects.
{
  for (const platform of ["instagram", "facebook", "threads", "snapchat", "linkedin", "pinterest"]) {
    const result = validateImportRequest(body([{ publishedAtMs: WHEN, text: "x", mediaPaths: [] }], platform));
    assert.equal(result.ok, true, `${platform} ships an archive but was rejected.`);
    checks += 1;
  }

  for (const platform of ["twitter", "youtube", "tiktok", "", "ARCHIVE:instagram", "../instagram", "instagram; drop"]) {
    const result = validateImportRequest(body([{ publishedAtMs: WHEN, text: "x", mediaPaths: [] }], platform));
    assert.equal(result.ok, false, `${JSON.stringify(platform)} was accepted as an archive platform.`);
    checks += 1;
  }

  // Case and whitespace are not something to depend on.
  assert.equal(validateImportRequest(body([{ publishedAtMs: WHEN, text: "x", mediaPaths: [] }], "  Instagram  ")).ok, true, "a differently-cased platform was rejected.");
  checks += 1;
}

// ── 6. SIZE LIMITS ──────────────────────────────────────────────────────────
{
  const tooMany = Array.from({ length: MAX_POSTS_PER_REQUEST + 1 }, (_, i) => ({
    publishedAtMs: WHEN + i,
    text: `post ${i}`,
    mediaPaths: [],
  }));
  const result = validateImportRequest(body(tooMany));
  assert.equal(result.ok, false, "an oversized batch was accepted.");
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.status, 413, `expected 413, got ${result.status}`);
  assert.ok(/again|smaller/i.test(result.reason), "the refusal does not tell the caller what to do instead.");
  assert.ok(/nothing was saved/i.test(result.reason), "the refusal does not say whether a partial batch was written, which is the first thing anyone would ask.");
  checks += 4;

  // Exactly at the limit is fine — an off-by-one here silently truncates the
  // last batch of every import.
  const exactly = validateImportRequest(body(tooMany.slice(0, MAX_POSTS_PER_REQUEST)));
  assert.equal(exactly.ok, true, "a batch of exactly the limit was rejected.");
  checks += 1;

  // Absurd content is bounded, not rejected — a long caption is somebody's post.
  const long = ok(
    validateImportRequest(body([
      { publishedAtMs: WHEN, text: "a".repeat(500_000), mediaPaths: Array.from({ length: 400 }, (_, i) => `media/${i}.jpg`) },
    ])),
    "a post with absurd content",
  );
  assert.ok(long.posts[0].text.length <= 100_000, `text was not bounded: ${long.posts[0].text.length}`);
  assert.ok(long.posts[0].mediaPaths.length <= 100, `media list was not bounded: ${long.posts[0].mediaPaths.length}`);
  assert.ok(long.posts[0].text.length > 0, "a long caption was discarded rather than bounded.");
  checks += 3;
}

// ── 7. MALFORMED BODIES DO NOT THROW ────────────────────────────────────────
{
  for (const bad of [null, undefined, 42, "a string", [], { platform: "instagram" }, { posts: [] }, { platform: 7, posts: [] }]) {
    const result = validateImportRequest(bad);
    assert.equal(result.ok, false, `${JSON.stringify(bad)} was accepted.`);
    assert.ok(!result.ok && result.reason.length > 10, "a refusal came back without an explanation.");
    checks += 2;
  }

  // Entries that are not objects are dropped, not fatal.
  const junk = ok(
    validateImportRequest(body([null, 7, "post", [], { publishedAtMs: WHEN, text: "real", mediaPaths: [] }])),
    "a batch containing junk",
  );
  assert.equal(junk.posts.length, 1, "the real post was lost among junk.");
  assert.equal(junk.dropped, 4, `expected 4 junk entries dropped, got ${junk.dropped}`);
  checks += 2;
}

// ── 8. PURE, AND HONEST IN ITS SOURCE ───────────────────────────────────────
{
  const sample = body([{ publishedAtMs: WHEN, text: "x", mediaPaths: ["media/1.jpg"] }]);
  const first = JSON.stringify(validateImportRequest(sample));
  for (let i = 0; i < 3; i += 1) {
    assert.equal(JSON.stringify(validateImportRequest(sample)), first, "validateImportRequest is not deterministic.");
    checks += 1;
  }

  const source = readFileSync(join(ROOT, "src/lib/portability/import-request.ts"), "utf8");
  const words = prose(source);

  assert.ok(
    !/Date\.now\(\)/.test(source),
    "this module reads the clock. A validator that can date a post is a validator that will.",
  );
  checks += 1;

  for (const [phrase, why] of [
    [/SKIP, NEVER INVENT/i, "that a post missing a required field is dropped rather than given a default"],
    [/never uploaded|never leaves/i, "that the archive itself does not reach this endpoint, which is why the body is small and why it is untrusted"],
  ] as const) {
    assert.ok(phrase.test(words), `the module no longer explains ${why}.`);
    checks += 1;
  }
}

console.log(
  `import-request OK — ${checks} assertions.\n` +
    "  The body is built by client code, so it is untrusted in the ordinary way. Eight kinds of\n" +
    "  unusable timestamp — missing, null, string, NaN, Infinity, zero, negative, and seconds mistaken\n" +
    "  for milliseconds — are all dropped rather than defaulted, because a post dated 'now' appears at\n" +
    "  the top of a timeline claiming to be something written today. Drops are counted and returned,\n" +
    "  since reporting 460 imported when 40 were discarded is a false statement about someone's own\n" +
    "  history. Traversal paths are refused at the machine boundary as well as in the parser, and a\n" +
    "  post keeps its words when its media is refused. Only the six platforms that actually ship an\n" +
    "  archive are accepted. Absurd content is bounded rather than rejected — a long caption is still\n" +
    "  somebody's post.\n" +
    "  Does NOT cover: the route around this, which holds auth, the rate limit and one call. Those\n" +
    "  need a server and a seeded database, and the check chain runs before either exists.",
);
