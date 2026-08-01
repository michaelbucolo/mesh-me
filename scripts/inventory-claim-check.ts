// A LIE TOLD WITH ARITHMETIC.
//
// The lifetime inventory on /analytics sums your Mesh.me posts, videos and
// comments together with the ones read from your connected platforms. It is a
// good number: it answers "how much have I actually made?", a question no
// platform is keen for you to ask, and it does it without a streak, a
// comparison, or a reason to come back tomorrow.
//
// It is also INCOMPLETE BY CONSTRUCTION, and that is the whole risk.
//
// PlatformPost and PlatformComment rows exist only for a platform whose
// official API lets Mesh.me read your content. Six of the twelve — Instagram,
// Facebook, Threads, Snapchat, LinkedIn, Pinterest — offer no such API and
// contribute exactly zero, permanently, however long they have been connected.
// Someone whose life is on Instagram would be shown a confident total that
// describes almost none of it.
//
// Printing "everything you've posted, everywhere" over that is not a rounding
// error. It is the platform's central promise being made false by a component
// that has no idea it is doing so. So this gate holds three things:
//
//   1. The card never claims completeness it cannot have.
//   2. The coverage is always rendered — the caveat cannot be dropped while
//      the numbers stay.
//   3. The split between "readable" and "unreadable" comes from the capability
//      table, not from a hand-written list that can drift away from it.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformCapability } from "../src/lib/platform-capabilities";
import { MESH_PLATFORM_IDS } from "../src/lib/platforms";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
let checks = 0;

/**
 * Comments are not copy. A gate that reads them will match the paragraph
 * explaining the rule and fail the file that follows it — which is exactly what
 * happened here on the first run, and what happened to `oauth-precondition`
 * before it, where the opposite mistake let a mutation pass because the
 * check's own name appeared in a comment two lines above the branch.
 */
function stripComments(source: string): string {
  return source
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, (m) => " ".repeat(m.length)) // JSX {/* */}
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length));
}

const CARD = "src/components/analytics/content-inventory-card.tsx";
const LIB = "src/lib/content-inventory.ts";
const cardSource = read(CARD);
const card = stripComments(cardSource);
const lib = read(LIB);

// ── 1. THE SHAPE OF THE OMISSION, COMPUTED ──────────────────────────────────
//
// Not asserted from memory. If a platform ever gains an official content API
// and its entry flips, this recomputes and the gate relaxes on its own.
{
  const readable = MESH_PLATFORM_IDS.filter((id) => getPlatformCapability(id)?.importContent);
  const unreadable = MESH_PLATFORM_IDS.filter((id) => !getPlatformCapability(id)?.importContent);

  assert.ok(
    unreadable.length > 0,
    "no platform is unreadable any more, which would make this gate unnecessary — delete it deliberately rather than letting it pass vacuously.",
  );
  checks += 1;

  assert.ok(
    readable.length < MESH_PLATFORM_IDS.length,
    `all ${MESH_PLATFORM_IDS.length} platforms are readable, so a completeness claim would be true; re-examine this gate before removing it.`,
  );
  checks += 1;
}

// ── 2. THE CARD MAY NOT CLAIM COMPLETENESS ──────────────────────────────────
{
  const forbidden: { pattern: RegExp; why: string }[] = [
    { pattern: /\beverywhere\b/i, why: "six platforms contribute nothing; 'everywhere' is false for all of them" },
    { pattern: /\ball your (posts|content|platforms|accounts)\b/i, why: "the total is not all of anything" },
    { pattern: /\bevery (post|platform|account)\b/i, why: "the count omits every post on six platforms" },
    { pattern: /\bacross all\b/i, why: "it is across some, and the card must say which" },
    { pattern: /\bcomplete (history|record|archive)\b/i, why: "it is structurally incomplete" },
    { pattern: /\bnothing missing\b/i, why: "a great deal is missing and it is nameable" },
  ];

  for (const { pattern, why } of forbidden) {
    const hit = card.match(pattern)?.[0] ?? null;
    assert.equal(
      hit,
      null,
      `${CARD} claims completeness with ${JSON.stringify(hit)} — ${why}.\n` +
        "  The number is a sum over the platforms an official API lets us read. Say that, and name them.",
    );
    checks += 1;
  }
}

// ── 3. THE CAVEAT CANNOT BE DROPPED WHILE THE NUMBERS STAY ──────────────────
//
// The realistic regression is not someone writing "everywhere". It is someone
// tidying the card, deciding the coverage footnote is clutter, and leaving
// three confident numbers with nothing qualifying them.
{
  for (const field of ["postsAndPhotos", "videos", "commentsAndReplies"]) {
    assert.ok(card.includes(field), `${CARD} no longer renders ${field}; this gate is describing a card that changed shape.`);
    checks += 1;
  }

  assert.ok(
    card.includes("readable") && card.includes("unreadable"),
    `${CARD} renders the totals without rendering their coverage. The caveat is not decoration —\n` +
      "  without it the card asserts a completeness the data does not have. Both lists must be shown.",
  );
  checks += 1;

  // Naming the platforms is the point. "some platforms" would satisfy a
  // careless version of the rule above while telling the reader nothing.
  assert.ok(
    /listNames\(\s*unreadable\s*\)/.test(card),
    `${CARD} must NAME the connected accounts that contribute nothing, not describe them vaguely.\n` +
      "  'Instagram adds nothing to this count' is useful; 'some platforms are not included' is not.",
  );
  checks += 1;
}

// ── 4. THE SPLIT COMES FROM THE CAPABILITY TABLE ────────────────────────────
//
// A hardcoded list of "the six" would be correct today and wrong the day one of
// them ships an API — and nothing would notice.
{
  assert.ok(
    lib.includes("getPlatformCapability") && lib.includes("importContent"),
    `${LIB} must decide readability from the capability table, not from a list written by hand.`,
  );
  checks += 1;

  for (const id of MESH_PLATFORM_IDS) {
    assert.ok(
      !new RegExp(`["']${id}["']`).test(lib),
      `${LIB} mentions the platform id ${JSON.stringify(id)} literally. Naming platforms here means the split\n` +
        "  can drift out of agreement with platform-capabilities.ts, which is the one place that knows.",
    );
    checks += 1;
  }

  // "unreadable" must mean "the API does not offer it", never "the last sync
  // failed". Those are different sentences and only one is true of Instagram.
  assert.ok(
    !/syncStatus|syncError|lastSyncAt/.test(lib),
    `${LIB} is reading sync state. A platform belongs in 'unreadable' because its API offers nothing —\n` +
      "  not because a sync errored today. Conflating them tells someone to retry something that cannot work.",
  );
  checks += 1;
}

// ── 5. THE CARD IS ACTUALLY MOUNTED ─────────────────────────────────────────
//
// This repo has shipped correct, gated, invisible code twice now — a co-browse
// room with no reachable door and a create page with no link. A card nobody can
// see is not a surfaced number.
{
  const page = read("src/app/(app)/analytics/page.tsx");

  // MUST be the JSX, not the identifier. The first version of this assertion
  // accepted `page.includes("ContentInventoryCard")`, and a mutation that
  // deleted the rendered element while leaving the import behind PASSED it —
  // this gate certifying the exact bug it was written to catch. An import is
  // evidence of intent; only the element is evidence of a rendered card.
  assert.ok(
    /<ContentInventoryCard\b/.test(page),
    "the analytics page imports the inventory card but never RENDERS it, so none of the above is visible\n" +
      "  to anyone. An unrendered component is indistinguishable from one that was never written.",
  );
  checks += 1;

  assert.ok(
    /getContentInventory\s*\(/.test(page),
    "the analytics page never calls getContentInventory, so the card has no data to render.",
  );
  checks += 1;
}

console.log(
  `inventory-claim OK — ${checks} assertions.\n` +
    "  The lifetime inventory never claims completeness it cannot have, always renders which of your\n" +
    "  connected accounts fed it and which could not, names them rather than waving at them, and takes\n" +
    "  that split from the capability table so it relaxes by itself if a platform ever opens up.\n" +
    "  'Unreadable' means the API offers nothing — never that a sync failed.\n" +
    "  Does NOT cover: whether the counts are arithmetically right, only what is claimed about them.",
);
