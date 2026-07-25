/**
 * FLOW FORM GATE — `npm run flow-form:check`
 *
 * The Flow is a shorts-and-reels surface. "No long form content" is a product
 * rule, and this holds the three ways it has already been broken or could
 * quietly become false again.
 *
 * ── WHY A NUDGE IS NOT A RULE ────────────────────────────────────────────────
 *
 * It shipped as a ranking bias: `score += 1.5` for short, `score -= 0.9` for
 * long, under a comment that said "never filtered". A penalty cannot express
 * "never" — only "later" — and on a surface you scroll indefinitely, "later"
 * arrives in about a minute. Worse, the bias lived inside scoreFlowPost, which:
 *
 *   - chronological mode returns before ever calling, and
 *   - the sideways "more like this" lane never calls at all.
 *
 * So the single rule that decides what this surface IS applied in one of three
 * modes. That is why the assertions below are about WHERE the rule is applied,
 * not just that it exists.
 *
 * ── WHY DURATION HAS TO BE FIRST ─────────────────────────────────────────────
 *
 * Every other signal is a guess about a container, and three were broken:
 * the media-type branch was dead code (buildExternalMedia only ever emits
 * "video" | "image"); every YouTube item including real Shorts was classified
 * LONG because the adapter hardcodes a `watch?v=` URL; and `youtu.be` was
 * deliberately left unclassified. A number beats all of that, so the ingest
 * that produces the number is pinned here too — a filter reading a column
 * nothing populates is a filter that excludes everything.
 *
 * ── WHAT THIS CANNOT PROVE ───────────────────────────────────────────────────
 *
 * That YouTube returns the duration, or that any given item is really short.
 * It reads source text. What it can prove is that the rule is an exclusion,
 * that no mode escapes it, and that the column it depends on is written on
 * both branches of the upsert.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const RANKING = "src/lib/flow-ranking.ts";
const ranking = read(RANKING);

// ── 1. The rule is an EXCLUSION ──────────────────────────────────────────────
assert.match(
  ranking,
  /function isFlowEligible\(/,
  `${RANKING} must define isFlowEligible — one predicate for "belongs on a shorts-and-reels surface".`,
);
for (const banned of ["SHORT_FORM_BOOST", "LONG_FORM_PENALTY"]) {
  assert.ok(
    !ranking.includes(banned),
    `${RANKING} still defines ${banned}. Ranking cannot express "never", only "later", and this\n` +
      "  surface is shorts-only. A scoring nudge beside a filter is also a lie about the pool: it\n" +
      "  implies long-form is present and ordered lower when in fact it has been removed.",
  );
}

// ── 2. NO MODE ESCAPES IT ────────────────────────────────────────────────────
//
// The filter must be applied to the candidate pool BEFORE the mode branches.
// Applying it inside the scorer is exactly the bug: chronological returns
// before scoring, so it would keep showing long-form.
const rankFn = ranking.slice(ranking.indexOf("export function rankFlowPosts"));
const filterAt = rankFn.indexOf("posts.filter(isFlowEligible)");
const chronoAt = rankFn.indexOf('mode === "chronological"');
const scoreAt = rankFn.indexOf("scoreFlowPost(post");
assert.ok(filterAt !== -1, "rankFlowPosts must filter its candidate pool with isFlowEligible.");
assert.ok(
  chronoAt !== -1 && filterAt < chronoAt,
  "rankFlowPosts must apply isFlowEligible BEFORE the chronological early-return.\n" +
    "  Chronological skips scoring entirely, so a rule applied during scoring does not exist there —\n" +
    "  which is precisely how long-form stayed visible in that mode.",
);
assert.ok(
  scoreAt === -1 || filterAt < scoreAt,
  "the eligibility filter must run before scoring, not inside it.",
);
assert.match(
  ranking.slice(ranking.indexOf("export function rankRelatedPosts")),
  /\.filter\(isFlowEligible\)/,
  "rankRelatedPosts must filter too. The sideways 'more like this' lane had no form-class term at\n" +
    "  all, so long-form could enter the Flow through it even from a short anchor.",
);

// ── 3. DURATION IS THE PRIMARY SIGNAL ────────────────────────────────────────
// Sliced by explicit bounds, both asserted. `indexOf` returns -1 for a missing
// needle and `slice(start, -1)` silently means "to one char before the end" —
// so a renamed boundary would quietly widen this slice to the whole file and
// every assertion below would start passing for the wrong reason.
const classStart = ranking.indexOf("function flowFormClass(");
const classEnd = ranking.indexOf("function isFlowEligible(");
assert.ok(classStart !== -1, "flowFormClass not found in " + RANKING);
assert.ok(classEnd > classStart, "isFlowEligible must follow flowFormClass — the slice bounds depend on it.");
const classFn = ranking.slice(classStart, classEnd);
assert.match(
  classFn,
  /post\.durationSeconds/,
  "flowFormClass must read post.durationSeconds. Every other signal is a guess about a URL or a\n" +
    "  container name, and three of them were outright broken.",
);
const durationAt = classFn.indexOf("durationSeconds");
const urlAt = classFn.indexOf("SHORT_FORM_URL");
assert.ok(
  urlAt === -1 || durationAt < urlAt,
  "duration must be consulted BEFORE the URL-shape fallbacks — it is a measurement, they are guesses.",
);
// Unknown must not silently pass. The request was "no long form content", and a
// permissive fallback is exactly how long-form returns.
assert.match(
  classFn,
  /return "unknown";\s*\n\}/,
  "flowFormClass must fall through to \"unknown\" rather than to a permissive default. isFlowEligible\n" +
    "  admits only \"short\", so unknown is excluded — the strict direction, deliberately.",
);
assert.match(
  ranking,
  /export function flowFormStats\(/,
  `${RANKING} must export flowFormStats. A strict filter can empty the surface, and a caller has to\n` +
    "  be able to say WHY rather than render a blank screen — silent truncation reads as 'there is\n" +
    "  nothing' when the truth is 'we could not tell what these were'.",
);

// ── 4. THE COLUMN THE RULE DEPENDS ON IS ACTUALLY WRITTEN ────────────────────
//
// A filter reading a field nothing populates excludes everything. `durationSeconds`
// sat in the schema unread and unwritten for its whole life before this.
const sync = read("src/lib/platform-sync.ts");
assert.match(
  sync,
  /function parseIso8601Duration\(/,
  "platform-sync must parse ISO-8601 durations — that is the format YouTube reports, and it is the\n" +
    "  only per-item length any connected platform gives us today.",
);
assert.match(
  sync,
  /part=statistics,status,contentDetails/,
  "the YouTube videos request must ask for contentDetails, or there is no duration to parse.",
);
assert.match(
  sync,
  /durationSeconds: post\.durationSeconds/,
  "the platformPost upsert must persist durationSeconds.",
);
assert.match(
  sync,
  /durationSeconds: item\.durationSeconds/,
  "the platformFeedItem UPDATE branch must persist durationSeconds too. `create` spreads ...item\n" +
    "  while `update` enumerates fields, so without it an item first seen before its platform\n" +
    "  reported a duration would never acquire one and would stay excluded forever.",
);
for (const model of ["PlatformPost", "PlatformFeedItem"]) {
  const schema = read("prisma/schema.prisma");
  const block = new RegExp(String.raw`model ${model} \{([\s\S]*?)^\}`, "m").exec(schema)?.[1];
  assert.ok(block, `${model} not found in prisma/schema.prisma`);
  assert.match(block, /durationSeconds\s+Int\?/, `${model} must carry durationSeconds.`);
  // And a freshly provisioned database has to get it, since production never
  // runs migrations — the same lesson as the disconnect gate.
  //
  // The table body is SLICED OUT before searching it. A single
  // `CREATE TABLE "X" \(...[\s\S]*?"durationSeconds"` regex passes when the
  // column is missing from X but present in any table below it — the match
  // simply runs across the boundary. Mutation-tested: deleting the column from
  // PlatformPost alone was reported as fine, because PlatformMedia further down
  // still had one.
  const ensureSql = read("prisma/ensure-schema.sql");
  const createTable = new RegExp(
    String.raw`CREATE TABLE IF NOT EXISTS "${model}" \(([\s\S]*?)\n\);`,
  ).exec(ensureSql)?.[1];
  assert.ok(createTable, `CREATE TABLE for "${model}" not found in prisma/ensure-schema.sql`);
  assert.match(
    createTable,
    /"durationSeconds" INTEGER/,
    `prisma/ensure-schema.sql must give "${model}" a durationSeconds column. A database built from\n` +
      "  that file never runs a migration, so without it every fresh deployment has a Flow that\n" +
      "  can classify nothing and therefore shows nothing.",
  );
}

// ── 5. THE FEED CARRIES BOTH FIELDS TO THE RANKER ────────────────────────────
//
// postType was read by buildExternalMedia to pick video-vs-image and then
// discarded, so the ranker could not see the one field that says what format an
// item IS. Storing a column the pipeline drops on the floor is the same defect
// as not storing it.
const feedData = read("src/lib/feed-data.ts");
for (const field of ["postType", "durationSeconds"]) {
  assert.match(
    feedData,
    new RegExp(String.raw`${field}\??:.*(string|number)`),
    `FeedCardPost must declare ${field} — the ranker cannot filter on a field the card type omits.`,
  );
  const mappings = (feedData.match(new RegExp(String.raw`${field}: (post|item)\.`, "g")) || []).length;
  assert.ok(
    mappings >= 5,
    `only ${mappings} external mapping(s) in feed-data.ts carry ${field}; expected every one.\n` +
      "  A provider that drops it produces items the Flow must classify as unknown and exclude,\n" +
      "  which looks exactly like 'that platform has no content'.",
  );
}

console.log(
  "flow form contract OK — the Flow is shorts-only by EXCLUSION, not by a ranking nudge; the filter\n" +
    "  runs before the mode branches (so chronological cannot escape it) and inside the related lane;\n" +
    "  duration is consulted before any URL guess and unknown is excluded rather than admitted;\n" +
    "  flowFormStats exists so an empty Flow can be explained; and the column the rule depends on is\n" +
    "  parsed from YouTube, written on both upsert branches, present in the schema AND in\n" +
    "  ensure-schema.sql, and carried to the ranker by every feed provider.\n" +
    "  Does NOT cover: whether YouTube actually returns a duration, or whether any given item really\n" +
    "  is short — this reads source text, not the network.",
);
