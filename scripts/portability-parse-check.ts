// A PARSER FOR SOMEBODY ELSE'S FORMAT MAY SKIP, BUT IT MAY NEVER INVENT.
//
// parse-export.ts reads the consumer archive the six no-API platforms are
// obliged to hand you. Nobody publishes a schema for it, it changes without
// notice, and it is the only route into half the roster.
//
// The failure that matters is not "the parser broke". It is "the parser
// helpfully filled in a plausible default" — a timestamp of now, an empty
// caption — and put a post in your history THAT YOU NEVER WROTE, with nothing
// downstream able to tell it from a real one. Losing a post is recoverable:
// re-export. Fabricating one is not.
//
// So most of these assertions are about what the parser REFUSES to do.

import assert from "node:assert/strict";
import { parseExportDocument, parseExportText } from "../src/lib/portability/parse-export";

let checks = 0;
const ok = () => { checks += 1; };

// ── 1. The shapes that have actually been observed all parse ────────────────
{
  // Meta: bare array, seconds, caption on the media child.
  const meta = [
    { media: [{ uri: "media/posts/1.jpg", creation_timestamp: 1_600_000_000, title: "at the beach" }] },
  ];
  const a = parseExportDocument(meta);
  assert.equal(a.posts.length, 1, "a bare Meta-shaped array should yield one post");
  assert.equal(a.posts[0].text, "at the beach", "caption on the media child must be found");
  assert.equal(a.posts[0].mediaPaths[0], "media/posts/1.jpg");
  assert.equal(a.posts[0].publishedAtMs, 1_600_000_000_000, "seconds must be normalised to ms");
  checks += 4;

  // {posts: [...]} wrapper, caption on the entry, ms timestamps.
  const wrapped = { posts: [{ timestamp: 1_600_000_000_000, caption: "a thought" }] };
  const b = parseExportDocument(wrapped);
  assert.equal(b.posts.length, 1, "a {posts:[...]} wrapper should yield one post");
  assert.equal(b.posts[0].publishedAtMs, 1_600_000_000_000, "ms timestamps must pass through unscaled");
  assert.equal(b.posts[0].mediaPaths.length, 0, "a text-only post is still a post");
  checks += 3;

  // A single-key wrapper under a name we have not seen before.
  const unknownKey = { pinterest_pins: [{ created_at: 1_600_000_000, description: "a pin" }] };
  assert.equal(parseExportDocument(unknownKey).posts.length, 1, "a single-key wrapper should be unwrapped");
  ok();
}

// ── 2. NOTHING IS EVER INVENTED ─────────────────────────────────────────────
//
// The centre of the whole file. Each of these entries is missing something the
// parser could plausibly fill in, and must be SKIPPED rather than completed.
{
  const undateable = [
    { title: "no date at all" },
    { title: "unusable date", creation_timestamp: 0 },
    { title: "not a number", creation_timestamp: "yesterday" },
    { title: "out of range low", creation_timestamp: 12345 },
    { title: "out of range high", creation_timestamp: 1e15 },
  ];
  const r = parseExportDocument(undateable);
  assert.equal(r.posts.length, 0, "NOT ONE of these may become a post — every one would need a fabricated date");
  assert.equal(r.skipped.length, 5, "and every one must be reported, not silently dropped");
  for (const s of r.skipped) {
    assert.ok(s.reason.length > 15, "each skip must explain itself in words a person can act on");
    checks += 1;
  }
  checks += 2;

  // A timestamp with nothing attached is not a post either.
  const bare = parseExportDocument([{ creation_timestamp: 1_600_000_000 }]);
  assert.equal(bare.posts.length, 0, "a timestamp with no caption and no media is not a post");
  assert.equal(bare.skipped.length, 1);
  checks += 2;
}

// ── 3. Malformed input is a result, never a throw ───────────────────────────
//
// One bad file must not lose the whole import. Everything below returns.
{
  for (const [label, input] of [
    ["invalid JSON", "{not json at all"],
    ["empty string", ""],
    ["a bare number", "42"],
    ["null", "null"],
  ] as const) {
    const r = parseExportText(input);
    assert.equal(r.posts.length, 0, `${label} must yield no posts`);
    assert.ok(r.skipped.length >= 1, `${label} must yield a reason rather than silence`);
    checks += 2;
  }

  // Non-object entries inside an otherwise valid array.
  const mixed = parseExportDocument([null, 5, "text", { creation_timestamp: 1_600_000_000, title: "real" }]);
  assert.equal(mixed.posts.length, 1, "the one real entry must survive its broken neighbours");
  assert.equal(mixed.skipped.length, 3, "and each broken neighbour must be counted");
  checks += 2;
}

// ── 4. Paths that escape the archive never enter the media list ─────────────
//
// A path with ".." or a leading "/" or a scheme is either a broken export or an
// attempt at traversal. Either way it is not something to resolve against
// extracted files later. The media is dropped; the post survives if it has
// anything else, because punishing the person for their platform's malformed
// export would be the wrong trade.
{
  const hostile = parseExportDocument([
    {
      creation_timestamp: 1_600_000_000,
      title: "has a caption",
      media: [
        { uri: "../../etc/passwd" },
        { uri: "/etc/shadow" },
        { uri: "https://example.com/x.jpg" },
        { uri: "media/posts/ok.jpg" },
      ],
    },
  ]);
  assert.equal(hostile.posts.length, 1, "the post survives — it still has a caption");
  assert.deepEqual(
    hostile.posts[0].mediaPaths,
    ["media/posts/ok.jpg"],
    "only the in-archive relative path may survive; traversal and absolute and remote are dropped",
  );
  checks += 2;

  // And if traversal was the ONLY media and there is no caption, nothing is
  // imported at all rather than an empty post appearing in someone's history.
  const onlyHostile = parseExportDocument([{ creation_timestamp: 1_600_000_000, media: [{ uri: "../x" }] }]);
  assert.equal(onlyHostile.posts.length, 0, "an entry whose only media was rejected is not a post");
  checks += 1;
}

// ── 5. The follower graph is not in these files and must not be conjured ────
//
// W3C's data-portability minutes record the follower graph as "the primary
// asset and normally not exported, not even upon GDPR request". The parser's
// output type has no field for it, which is the real guarantee — this asserts
// the shape stays that way, so nobody adds one and starts filling it from a
// "followers" key that means something else entirely.
{
  const withFollowers = parseExportDocument([
    { creation_timestamp: 1_600_000_000, title: "a post", followers: ["someone", "someone-else"] },
  ]);
  assert.equal(withFollowers.posts.length, 1);
  assert.deepEqual(
    Object.keys(withFollowers.posts[0]).sort(),
    ["mediaPaths", "publishedAtMs", "text"],
    "an imported post carries exactly three fields. No graph, no follower list, no invented relationships —\n" +
      "  consumer exports do not contain the social graph, and a field here would invite someone to fake it.",
  );
  checks += 2;
}

console.log(
  `portability-parse OK — ${checks} assertions.\n` +
    "  Every observed export shape parses (bare array, {posts:[]}, unknown single-key wrapper;\n" +
    "  seconds and milliseconds; caption on the entry and on the media child).\n" +
    "  NOTHING is ever invented: five undateable entries and a bare timestamp all skip with a\n" +
    "  stated reason rather than gaining a fabricated date. Malformed input returns a result\n" +
    "  instead of throwing, so one bad file cannot lose an import. Traversal, absolute and\n" +
    "  remote paths never enter the media list. An imported post has exactly three fields —\n" +
    "  there is nowhere to put a social graph these files do not contain.\n" +
    "  Does NOT cover: a shape nobody has seen yet. That is what the skip count is for, and it\n" +
    "  is why the caller must show it.",
);
