// THE CONFIDENT ZERO IS THE BUG. EVERYTHING ELSE HERE IS SECONDARY.
//
// locate-posts.ts finds the posts documents in a Meta archive. Its worst failure
// mode does not throw, does not log, and does not look like a failure: a reader
// keyed to one vintage finds nothing on the others and tells the user their
// history is empty. They believe it. Nothing in a build, a type check or a lint
// pass can see that happen.
//
// So the assertions here are weighted accordingly. Section 1 walks every vintage
// through the locator; section 2 proves that an archive we do NOT understand
// says so rather than reporting a count; and section 3 covers the ordering trap
// that silently rewrites the order of somebody's history.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { locatePostDocuments, type LocateResult } from "../src/lib/portability/locate-posts";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
let checks = 0;

/**
 * Comments are not code. This file discusses vintages and folder names at
 * length and must not certify the module by matching its own prose — a mistake
 * four gates in this repo have now made.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length));
}

/** Narrow, or fail with the reason — so a broken case reports why, not "undefined". */
function expectRecognised(result: LocateResult, what: string) {
  assert.equal(
    result.recognised,
    true,
    `${what} was not recognised: ${result.recognised === false ? result.reason : ""}`,
  );
  if (!result.recognised) throw new Error("unreachable");
  return result;
}

/** Realistic noise. A real archive is overwhelmingly media, not documents. */
function withNoise(prefix: string, paths: string[]): string[] {
  return [
    `${prefix}media/posts/202401/photo_1.jpg`,
    `${prefix}media/posts/202401/clip.mp4`,
    `${prefix}personal_information/personal_information.json`,
    `${prefix}ads_information/advertisers_using_your_activity.json`,
    ...paths,
  ];
}

// ── 1. EVERY VINTAGE, UNDER A ROOT FOLDER NAMED AFTER THE ACCOUNT ───────────
//
// The root name is the axis the module is forbidden to depend on, so every case
// here carries one and they are all different.
{
  const cases: Array<[string, string[], string, string, number]> = [
    [
      "instagram-janedoe-2024-01-15-A1b2C3/",
      ["your_instagram_activity/content/posts_1.json"],
      "instagram",
      "2023 and later",
      1,
    ],
    [
      "instagram_data_2022_09_02/",
      ["content/posts_1.json"],
      "instagram",
      "2022 and earlier",
      1,
    ],
    [
      "instagram-old-export/",
      ["media.json"],
      "instagram",
      "before December 2020",
      1,
    ],
    [
      "facebook-jsmith-2024-06-01-XyZ/",
      ["posts/your_posts_1.json"],
      "facebook",
      "any parent directory",
      1,
    ],
  ];

  for (const [prefix, tails, platform, vintage, count] of cases) {
    const listing = withNoise(prefix, tails.map((t) => prefix + t));
    const result = expectRecognised(locatePostDocuments(listing), `${platform} (${vintage})`);

    assert.equal(result.prefix, prefix, `prefix for ${platform} (${vintage}) came out as ${JSON.stringify(result.prefix)}`);
    const group = result.found.find((f) => f.platform === platform);
    assert.ok(group, `${platform} (${vintage}) produced no group at all`);
    assert.equal(group.vintage, vintage, `${platform} matched the wrong vintage: ${group.vintage}`);
    assert.equal(group.paths.length, count, `${platform} (${vintage}) found ${group.paths.length} documents, expected ${count}`);
    checks += 4;
  }

  // No root folder at all — files sitting at the archive root.
  const flat = expectRecognised(
    locatePostDocuments(["your_instagram_activity/content/posts_1.json", "media/x.jpg"]),
    "a rootless archive",
  );
  assert.equal(flat.prefix, "", `a rootless archive produced prefix ${JSON.stringify(flat.prefix)}`);
  checks += 1;
}

// ── 2. AN ARCHIVE WE DO NOT UNDERSTAND MUST SAY SO ──────────────────────────
//
// The assertion this module exists for. "We could not read this" and "you have
// no posts" are different sentences that ask the user to do different things,
// and collapsing them is how somebody concludes their history is gone.
{
  const unknown = locatePostDocuments([
    "SomeOtherPlatform/export/data.json",
    "SomeOtherPlatform/export/media/1.jpg",
    "readme.txt",
  ]);
  assert.equal(unknown.recognised, false, "an unfamiliar layout was reported as recognised.");
  if (unknown.recognised) throw new Error("unreachable");
  assert.equal(unknown.filesSeen, 3, `filesSeen was ${unknown.filesSeen}, so the caller cannot tell empty from unreadable.`);
  assert.ok(
    unknown.reason.length > 40,
    "the refusal does not explain itself. A person reading it needs to know their history might still be there.",
  );
  // NOT a blocklist of words, and the two attempts that were tell the story.
  // Forbidding "no posts" flagged "it MAY MEAN the export has no posts" — the
  // message correctly offering a possibility. Forbidding "your history is empty"
  // then flagged "we are NOT GOING TO CLAIM your history is empty" — its own
  // denial. A substring test cannot tell an assertion from its negation, and
  // every tightening of the pattern is one rewording away from misfiring again.
  //
  // So the prose is checked only for what can be checked positively: that it
  // admits it does not know. The claim "this never reports a confident zero" is
  // carried by the TYPE, asserted structurally in the block below, where it is
  // not a matter of wording at all.
  assert.ok(
    /\bmay\b|\bmight\b|cannot tell/i.test(unknown.reason),
    `the refusal states a conclusion where it should admit uncertainty: ${JSON.stringify(unknown.reason)}`,
  );
  checks += 4;

  // An empty archive is a DIFFERENT answer to an unreadable one, and both are
  // different from "you have no posts".
  const empty = locatePostDocuments([]);
  assert.equal(empty.recognised, false, "an empty archive was reported as recognised.");
  if (empty.recognised) throw new Error("unreachable");
  assert.equal(empty.filesSeen, 0, "an empty archive did not report zero files seen.");
  assert.notEqual(empty.reason, unknown.reason, "an empty archive and an unreadable one give the same message; they are not the same problem.");
  checks += 3;

  // There is no way to express "recognised with nothing found" — the type has no
  // such state, and this asserts the implementation has not invented one.
  for (const listing of [[], ["nope.txt"], ["a/b/c.json"]]) {
    const r = locatePostDocuments(listing);
    assert.ok(
      r.recognised === false || r.found.length > 0,
      `${JSON.stringify(listing)} came back recognised with an empty found list — the confident zero, wearing a different hat.`,
    );
    checks += 1;
  }
}

// ── 3. ORDERING: THE BUG THAT REWRITES A HISTORY ────────────────────────────
{
  const prefix = "instagram-janedoe-2024-01-15/";
  // Deliberately listed out of order, and deliberately crossing the point where
  // string sorting and number sorting disagree.
  const listing = [
    `${prefix}your_instagram_activity/content/posts_10.json`,
    `${prefix}your_instagram_activity/content/posts_2.json`,
    `${prefix}your_instagram_activity/content/posts_1.json`,
    `${prefix}your_instagram_activity/content/posts_11.json`,
    `${prefix}your_instagram_activity/content/posts_3.json`,
  ];
  const result = expectRecognised(locatePostDocuments(listing), "a split Instagram export");
  const group = result.found.find((f) => f.platform === "instagram");
  assert.ok(group, "the split export produced no Instagram group");
  assert.deepEqual(
    group.paths.map((p) => p.replace(`${prefix}your_instagram_activity/content/`, "")),
    ["posts_1.json", "posts_2.json", "posts_3.json", "posts_10.json", "posts_11.json"],
    "split documents came back in the wrong order. Sorted as strings, posts_10 lands between posts_1 and posts_2 and quietly reorders somebody's history.",
  );
  assert.equal(group.paths.length, 5, `only ${group.paths.length} of 5 split parts were collected — the rest of the history is missing.`);
  checks += 3;
}

// ── 4. THE MORE-SPECIFIC VINTAGE MUST WIN ───────────────────────────────────
//
// "your_instagram_activity/content/posts_1.json" ends with "content/posts_1.json".
// If the general shape is tried first, every modern export is labelled as the
// old vintage AND the computed prefix swallows "your_instagram_activity/",
// which breaks every media path later resolved against it.
{
  const prefix = "instagram-janedoe-2024-01-15/";
  const result = expectRecognised(
    locatePostDocuments([`${prefix}your_instagram_activity/content/posts_1.json`]),
    "a modern Instagram export",
  );
  assert.equal(result.prefix, prefix, `the prefix swallowed part of the layout: ${JSON.stringify(result.prefix)}`);
  const group = result.found.find((f) => f.platform === "instagram");
  assert.equal(group?.vintage, "2023 and later", `a modern export was labelled "${group?.vintage}".`);
  checks += 2;
}

// ── 5. THREADS RIDES INSIDE THE INSTAGRAM EXPORT ────────────────────────────
//
// One archive, two platforms. A locator that returns a single platform drops
// one of them entirely.
{
  const prefix = "instagram-janedoe-2024-01-15/";
  const result = expectRecognised(
    locatePostDocuments([
      `${prefix}your_instagram_activity/content/posts_1.json`,
      `${prefix}your_instagram_activity/threads/threads_and_replies.json`,
      `${prefix}media/posts/1.jpg`,
    ]),
    "an Instagram export carrying Threads",
  );
  const platforms = result.found.map((f) => f.platform).sort();
  assert.deepEqual(
    platforms,
    ["instagram", "threads"],
    `one archive should yield both platforms, got ${JSON.stringify(platforms)}. Threads has no archive of its own — dropping it here means it is never importable at all.`,
  );
  assert.equal(result.prefix, prefix, "the prefix changed when Threads was present.");
  checks += 2;
}

// ── 6. AWKWARD LISTINGS ─────────────────────────────────────────────────────
{
  // Backslash separators, which some zip producers emit.
  const backslash = expectRecognised(
    locatePostDocuments(["root\\your_instagram_activity\\content\\posts_1.json"]),
    "a backslash-separated listing",
  );
  assert.equal(backslash.found[0]?.paths[0], "root\\your_instagram_activity\\content\\posts_1.json", "the original path was not preserved.");
  checks += 1;

  // Directory entries are not documents. The fixture has to be a directory whose
  // name would otherwise MATCH — a zip may legally contain an entry called
  // "posts_1.json/". Testing with an ordinary folder proves nothing, because the
  // shape patterns are anchored on ".json" and a trailing slash never matches
  // them; the guard would look tested while being unreachable.
  const dirs = locatePostDocuments([
    "root/your_instagram_activity/content/posts_1.json/",
    "root/media.json/",
  ]);
  assert.equal(dirs.recognised, false, "a directory entry named like a document was treated as a document.");
  checks += 1;

  // Duplicates in the listing must not duplicate the history.
  const dupe = expectRecognised(
    locatePostDocuments(["a/content/posts_1.json", "a/content/posts_1.json"]),
    "a listing with a repeated entry",
  );
  assert.equal(dupe.found[0]?.paths.length, 1, "a repeated entry produced the same document twice.");
  checks += 1;

  // Two archives in one zip: one is read, and the other is REPORTED rather than
  // silently dropped.
  // The SMALLER archive is listed first on purpose. With it second, "pick the
  // first prefix seen" and "pick the largest" give the same answer and the test
  // cannot tell them apart.
  const two = expectRecognised(
    locatePostDocuments([
      "second/content/posts_1.json",
      "first/content/posts_1.json",
      "first/content/posts_2.json",
    ]),
    "two archives in one zip",
  );
  assert.equal(two.prefix, "first/", `the larger archive was not chosen: ${two.prefix}`);
  assert.deepEqual(two.otherPrefixes, ["second/"], "the ignored archive was not reported, so a caller would show a count that quietly excludes it.");
  checks += 2;

  // Case is not something to depend on — and asserting only that it was
  // RECOGNISED is not enough, because a differently-cased modern path still
  // matches the older vintage's shape. That reads as success while labelling the
  // export wrong and computing a prefix that swallows part of the layout.
  const upper = expectRecognised(
    locatePostDocuments(["Root/Your_Instagram_Activity/Content/Posts_1.json"]),
    "a differently-cased export",
  );
  assert.equal(upper.prefix, "Root/", `case-sensitive matching produced prefix ${JSON.stringify(upper.prefix)}`);
  assert.equal(
    upper.found[0]?.vintage,
    "2023 and later",
    `a differently-cased modern export was labelled "${upper.found[0]?.vintage}".`,
  );
  checks += 2;
}

// ── 7. PURE, AND HONEST IN ITS SOURCE ───────────────────────────────────────
{
  const listing = ["a/content/posts_2.json", "a/content/posts_1.json"];
  const first = JSON.stringify(locatePostDocuments(listing));
  for (let i = 0; i < 3; i += 1) {
    assert.equal(JSON.stringify(locatePostDocuments(listing)), first, "locatePostDocuments is not deterministic.");
    checks += 1;
  }
  assert.deepEqual(listing, ["a/content/posts_2.json", "a/content/posts_1.json"], "the input listing was mutated.");
  checks += 1;

  const source = readFileSync(join(ROOT, "src/lib/portability/locate-posts.ts"), "utf8");
  const code = stripComments(source);

  // Each phrase belongs to exactly one piece of reasoning that a future edit
  // would otherwise remove without noticing what it was for.
  for (const [phrase, why] of [
    [/root folder name/i, "that the archive's root folder name must never be matched on — it is named after the account and the date"],
    [/order is load-bearing/i, "that the shape list is ordered most-specific-first, and that reordering it mislabels every modern export"],
    [/numeric, not lexicographic/i, "why split documents are sorted by number, without which posts_10 lands between posts_1 and posts_2"],
    [/parent director/i, "that Facebook's parent directory is matched as a wildcard"],
    [/nobody verified|never verified/i, "that the wildcard exists because the three directory names were never verified, and guessing one would produce the confident zero for the other two"],
    [/one LEVEL rather than no level/, "why the wildcard must consume a directory level: matching the bare filename folds the parent into the computed prefix and breaks every media path resolved against it"],
  ] as const) {
    assert.ok(
      phrase.test(source),
      `the module no longer explains ${why}.`,
    );
    checks += 1;
  }

  // The prefix must come from a matched document, not from splitting the path
  // and taking the first segment — that is the root-name dependency by another
  // name.
  assert.ok(
    !/entryNames\[0\]|\.split\("\/"\)\[0\]/.test(code),
    "the module derives something from the first path segment, which is the root folder name it promises not to depend on.",
  );
  checks += 1;
}

console.log(
  `locate-posts OK — ${checks} assertions.\n` +
    "  All three Instagram vintages, Facebook under a parent directory, and Threads riding inside the\n" +
    "  Instagram export are located under account-specific root folder names that differ in every case,\n" +
    "  because the anchor is the posts file and the prefix is computed by subtraction.\n" +
    "  An archive we do not understand reports that in words and never as a count — the confident zero\n" +
    "  is unrepresentable, since `found` cannot be reached without narrowing past `recognised: false`\n" +
    "  and is never empty when it is. Split documents sort numerically, so posts_10 follows posts_9.\n" +
    "  Does NOT cover: whether a located file actually parses. This module only says where to look —\n" +
    "  a wider net here fails loudly in the parser, which is the right direction to be wrong in.",
);
