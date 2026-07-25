/**
 * MESHI ACTION GATE — `npm run meshi-act:check`
 *
 * Meshi acts on the user's behalf: it posts, follows, unfolows, reacts,
 * comments and sends DMs as them. This holds the two properties that make that
 * acceptable, both of which were false.
 *
 * ── 1. THE MEMORY RULE APPLIES TO THE ROUTE THAT ACTS ────────────────────────
 *
 * The tenth instance of the pattern scripts/second-writer-check.ts exists for.
 * /api/meshi/chat consults hasMeshiConsent, and meshiQuery repeats it at the
 * engine door with a comment saying the repetition is what makes the gate
 * server-authoritative rather than merely well-placed. /api/meshi/actions —
 * the endpoint that WRITES — consulted it nowhere.
 *
 * So a user who switched Meshi memory off was told, in Meshi's own words,
 * "Your privacy rules say I should not use your Mesh, so I am not reading it",
 * while that route read their follow graph and their threads and wrote to both.
 * The reassurance and the behaviour were produced by different files.
 *
 * ── 2. A WRITE ON ONE SURFACE IS TRUE ON THE OTHER ───────────────────────────
 *
 * "Going through the flow is still going through the mesh, just a different
 * form factor." The mesh does not read reactions live — it serves a per-process
 * cached payload refreshed by a 25s poll — so a write that does not invalidate
 * that cache is invisible there for up to 45 seconds. Every other reaction path
 * in the product calls clearMeshCache; this route did not, which made the Flow
 * and the mesh two copies that agree eventually rather than one thing.
 *
 * ── WHAT THIS CANNOT PROVE ───────────────────────────────────────────────────
 *
 * That the cache invalidation works across server instances. It does not:
 * clearMeshCache deletes from a module-level Map, so on more than one instance
 * a write on A leaves B stale until its own poll. That is a real, known limit
 * and it is recorded here rather than implied away.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const ACTIONS = "src/app/api/meshi/actions/route.ts";
const actions = read(ACTIONS);

// ── 1. Consent, before any branch runs ───────────────────────────────────────
assert.match(
  actions,
  /hasMeshiConsent/,
  `${ACTIONS} must consult hasMeshiConsent. It is the endpoint that posts, follows, reacts,\n` +
    "  comments and DMs as the user; /api/meshi/chat has checked it all along and this one did not.",
);
// It has to gate the whole switch, not one branch. A per-branch check is how
// the next action added arrives ungated.
const switchAt = actions.indexOf("switch (action) {");
const consentAt = actions.indexOf("hasMeshiConsent(user.id)");
assert.ok(consentAt !== -1 && switchAt !== -1, "expected both the consent call and the action switch");
assert.ok(
  consentAt < switchAt,
  "the consent check must run BEFORE the action switch, not inside a branch. Gating one branch at a\n" +
    "  time means every action added later starts ungated, which is exactly how this route ended up\n" +
    "  with five writes and no check at all.",
);
// Refusal, not degradation — there is no reduced version of following someone.
//
// Sliced to the consent block by explicit bounds rather than matched with a
// bounded lookahead. A `[\s\S]{0,N}` window is tuned to today's message length:
// lengthen the copy and the assertion silently stops finding the status it was
// written to check, which is a gate that reports OK for the wrong reason.
const consentBlockEnd = actions.indexOf("switch (action) {", consentAt);
const consentBlock = actions.slice(consentAt, consentBlockEnd);
assert.match(
  consentBlock,
  /status:\s*403/,
  "consent-off must REFUSE (403). The chat route can drop grounding and still answer the question\n" +
    "  that was typed; there is no partial version of a write.",
);

// ── 2. A durable limit on a write endpoint ───────────────────────────────────
assert.match(
  actions,
  /durableRateLimit\(/,
  `${ACTIONS} must use durableRateLimit. The in-memory limiter is a Map that resets on every cold\n` +
    "  start, so on serverless it cannot bound anything — and this route writes.",
);

// ── 3. Every write reaches the mesh ──────────────────────────────────────────
//
// Anchored on the branches that change what the mesh DRAWS: reactions and
// comments are both rendered on a node.
for (const branch of ["react", "comment"]) {
  const start = actions.indexOf(`case "${branch}": {`);
  assert.notEqual(start, -1, `${ACTIONS} must handle the "${branch}" action.`);
  // Slice to the next `case "` at the same indentation rather than by brace
  // matching — the branch bodies contain object literals whose braces would
  // truncate the slice early.
  const nextCase = actions.indexOf('\n      case "', start + 1);
  const body = actions.slice(start, nextCase === -1 ? undefined : nextCase);
  // EVERY exit that wrote something, not just one of them. `react` toggles: it
  // has an un-like path that returns early and a like path that falls through,
  // and a single `.includes` assertion is satisfied by whichever one survives.
  // Mutation-tested — deleting the invalidation from the un-like path passed
  // until this counted returns instead.
  const writesInBranch = (body.match(/return NextResponse\.json\(\{\s*\n?\s*success: true/g) || []).length;
  const invalidations = (body.match(/clearMeshCache\(user\.id\)/g) || []).length;
  assert.ok(
    writesInBranch > 0,
    `the "${branch}" branch has no success path — this assertion is measuring nothing.`,
  );
  assert.ok(
    invalidations >= writesInBranch,
    `the "${branch}" branch has ${writesInBranch} success path(s) but only ${invalidations} call(s) to\n` +
      "  clearMeshCache(user.id). The mesh serves a cached payload on a 25s poll, so a write that does\n" +
      "  not invalidate it is invisible there — the Flow and the mesh stop being one surface in two\n" +
      "  form factors and become two copies that agree eventually. A toggle has TWO paths and both\n" +
      "  change what the mesh draws.",
  );
}

// ── 4. Content Meshi authors is sanitized ────────────────────────────────────
//
// The post branch always sanitized. The DM branch did not — the one Meshi write
// that lands in ANOTHER person's inbox was the one passing a raw string — and
// the comment branch is new content published under the user's name.
for (const [field, what] of [
  ["body.messageContent", "a direct message"],
  ["text", "a comment"],
] as const) {
  assert.ok(
    new RegExp(String.raw`sanitizeForDisplay\(${field.replace(".", "\\.")}`).test(actions),
    `${ACTIONS} must sanitize ${what} before storing it. Content authored by an assistant and\n` +
      "  published under the user's name is the last place to trust an unescaped string.",
  );
}

// ── 5. The Flow announces what the user is watching ──────────────────────────
//
// Meshi cannot act on "this post" if it cannot see which post. /flow emitted no
// data-meshi-* attributes at all, so getVisibleFocusedContent matched nothing
// and focusedContent was permanently null on the one surface built for reacting
// to what is on screen.
const FLOW = "src/app/(app)/flow/flow-client.tsx";
const flow = read(FLOW);
assert.match(
  flow,
  /"data-meshi-content-card":\s*"true"/,
  `${FLOW} must emit the grounded-context card attribute, or Meshi is blind on /flow.`,
);
// Only the ACTIVE reel — announcing every mounted slide lets Meshi answer about
// one the user already scrolled past.
assert.match(
  flow,
  /\{\.\.\.\(active\s*\n?\s*\?\s*\{/,
  `${FLOW} must announce ONLY the active reel. Several slides are mounted at once; marking them all\n` +
    "  hands Meshi more than one card and lets it answer about the wrong one.",
);
// And the id must be the NATIVE post id. The egress gate in /api/meshi/chat
// resolves the author by this id to check THEIR memory rule before their text
// reaches the provider; a platform-prefixed id finds no Post row and the gate
// fails open. That is the exact hole that had to be fixed in ContentLens.
assert.match(
  flow,
  /"data-meshi-content-id":\s*isNativePost \? post\.id : ""/,
  `${FLOW} must send a native post id or nothing. /api/meshi/chat resolves the author by this id to\n` +
    "  check their Meshi memory rule before any of their text leaves the building; an id that finds\n" +
    "  no Post row makes that gate fail OPEN. ContentLens had this exact bug.",
);

console.log(
  "meshi action contract OK — the memory rule gates the whole action switch (not one branch) and\n" +
    "  refuses rather than degrades, a durable limit bounds the write endpoint, the react and comment\n" +
    "  branches both invalidate the mesh cache so a like in the Flow is true on the mesh, DM and\n" +
    "  comment content is sanitized, and /flow announces only the active reel with a native post id.\n" +
    "  Does NOT cover, and this is a real limit: clearMeshCache writes to a module-level Map, so on\n" +
    "  more than one server instance a write on one leaves the others stale until their own poll.",
);
