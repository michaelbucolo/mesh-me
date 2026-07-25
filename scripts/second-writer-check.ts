/**
 * SECOND-WRITER GATE — `npm run second-writer:check`
 *
 * ── THE PATTERN ──────────────────────────────────────────────────────────────
 *
 * Nine defects found in this repo share one shape, and it is not "someone forgot
 * a check". It is:
 *
 *     Two places state one fact. Only one of them is ever taught the rule.
 *
 * The duplicate is not wrong on the day it is written. It is wrong on the day
 * the rule changes, because the person changing it fixes the copy they were
 * looking at. Every instance so far:
 *
 *   - messageSync vs the messaging capability table            (#370)
 *   - cursor sprite and floating Meshi each testing pointer    (#371)
 *   - four base-URL resolvers, one falling back to localhost   (#374)
 *   - two revoke implementations, one unguarded                (#375)
 *   - meshEntities gated at egress, focusedContent not         (#377)
 *   - the migration vs the remote schema sync                  (#378)
 *   - searchAll subtracts blocks, /api/search/users does not   (below)
 *   - updateProfileVisibility protects a column, updateMeshPrivacy clobbers it
 *   - createPost stores the safety classification, repost() drops it
 *
 * A gate per instance is a gate per symptom. This one holds the three cases
 * where a SECOND WRITER OR READER of a fact must carry the same rule as the
 * first, pinned by name so the pairing itself cannot quietly dissolve.
 *
 * ── WHAT THIS CANNOT PROVE ───────────────────────────────────────────────────
 *
 * Source text, not dataflow. It pins three known pairs. It does not and cannot
 * discover a fourth: a brand-new people-search endpoint, a third writer of
 * MeshPrivacy.branchOverrides, or a third post-creation path is invisible here
 * until someone adds it below. The ratchet is on the pairs that exist.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const sourceFiles = execFileSync("git", ["ls-files", "src"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  // `git ls-files` still lists a file deleted but not yet staged.
  .filter((f) => f && existsSync(join(ROOT, f)))
  .filter((f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.startsWith("src/generated/"));

// ─────────────────────────────────────────────────────────────────────────────
// 1. EVERY people search subtracts blocks — in both directions.
// ─────────────────────────────────────────────────────────────────────────────
//
// Settings promises it without qualification: blocked accounts "don't appear in
// your feed, search, or live rooms — in both directions". searchAll enforced it
// and said so in a comment. /api/search/users — the OTHER people search, and the
// one behind MeChat's new-conversation picker — did not, so the person you
// blocked stayed one keystroke from being messaged.
//
// Anchored on the search shape (a username/displayName `contains` filter over
// prisma.user), which is what makes a query a people search regardless of what
// the endpoint is called.
// Two sanctioned mechanisms, because the surfaces genuinely differ — a list read
// fetches the set once and reuses it, a single findFirst should not pay a second
// round trip — and each is pinned per file so a search cannot quietly change to
// having NO mechanism. Both live in src/lib/privacy-policy.ts, side by side.
type BlockMechanism = "id-set" | "where-fragment";
const PEOPLE_SEARCHES: Record<string, { what: string; via: BlockMechanism }> = {
  "src/lib/queries.ts": { what: "searchAll, behind /api/search", via: "id-set" },
  "src/app/api/search/users/route.ts": {
    what: "the MeChat new-conversation picker",
    via: "id-set",
  },
  "src/lib/meshi-engine.ts": {
    what: "resolvePersonForViewer — the five person_* Meshi intents",
    via: "where-fragment",
  },
};

const found: string[] = [];
for (const file of sourceFiles) {
  const body = read(file);
  // A people search: filters users by a name-ish `contains`. Deliberately loose
  // — the point is to catch a NEW one that nobody thought to list here.
  if (!/username:\s*\{\s*contains:/.test(body)) continue;
  if (!/prisma\.user\.findMany|prisma\.user\.findFirst/.test(body)) continue;
  found.push(file);
}
assert.deepEqual(
  found.sort(),
  Object.keys(PEOPLE_SEARCHES).sort(),
  "A people search exists in a file this gate does not know about:\n" +
    found.map((f) => `    ${f}`).join("\n") +
    "\n  Every people search must subtract blocked accounts in BOTH directions — Settings\n" +
    "  promises it flatly. Add the file to PEOPLE_SEARCHES in scripts/second-writer-check.ts\n" +
    "  once it does. A search that ignores blocks is also the id-discovery path into every\n" +
    "  other surface, so it turns each of those gates into a two-click bypass.",
);
for (const [file, { what, via }] of Object.entries(PEOPLE_SEARCHES)) {
  const body = read(file);
  if (via === "id-set") {
    assert.match(
      body,
      /getBlockedUserIdSet\(/,
      `${file} (${what}) must load getBlockedUserIdSet() from src/lib/privacy-policy.ts.`,
    );
    // The set has to reach the QUERY, not merely be computed. `notIn` is the only
    // shape that removes them; `not:` takes one id and silently drops the rest.
    assert.match(
      body,
      /id:\s*\{\s*notIn:\s*\[\s*user\.id\s*,\s*\.\.\.\s*blocked/,
      `${file} (${what}) must exclude the blocked set in the query itself:\n` +
        "  `id: { notIn: [user.id, ...blocked] }`. Computing the set and not using it, or using\n" +
        "  `not: user.id` beside it, reads as blocked-aware and returns blocked accounts.",
    );
  } else {
    assert.match(
      body,
      /\.\.\.blockedUserWhere\(/,
      `${file} (${what}) must spread blockedUserWhere() from src/lib/privacy-policy.ts.\n` +
        "  Spreading is what puts the rule in the filter; calling it and discarding the result,\n" +
        "  or re-spelling the NOT/OR inline, is how the third copy appeared in the first place.",
    );
  }
  // Whichever mechanism, it must be the SHARED one. An inline NOT/OR over
  // Block relations is a fourth spelling, and the spellings drift.
  assert.ok(
    !/blockedBy:\s*\{\s*some:\s*\{\s*blockerId/.test(body) || file === "src/lib/privacy-policy.ts",
    `${file} (${what}) hand-rolls the block relation filter. Use blockedUserWhere() or\n` +
      "  getBlockedUserIdSet() from src/lib/privacy-policy.ts — 'a block, in either direction'\n" +
      "  needs exactly one definition, or it gets enforced in some places and not others.",
  );
}
// And nowhere else re-spells it either.
const handRolled = sourceFiles.filter(
  (f) => f !== "src/lib/privacy-policy.ts" && /blockedBy:\s*\{\s*some:\s*\{\s*blockerId/.test(read(f)),
);
assert.deepEqual(
  handRolled,
  [],
  "These files re-implement the two-directional block filter inline:\n" +
    handRolled.map((f) => `    ${f}`).join("\n") +
    "\n  Spread blockedUserWhere(viewerId) from src/lib/privacy-policy.ts instead.",
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. NOBODY CLOBBERS MeshPrivacy.branchOverrides ON UPDATE.
// ─────────────────────────────────────────────────────────────────────────────
//
// The per-branch overrides are the only thing that can hold a branch TIGHTER
// than the overall mesh. `updateMeshPrivacy` wrote them unconditionally,
// defaulting to `{}`, and one of its two callers — the Privacy Control Center —
// never sends them, because it has no per-branch editor. So "Save Mesh
// visibility" there wiped every choice made in Settings and the branches fell
// through to the overall visibility: on a public mesh, that republished the
// platforms branch that onboarding deliberately seeds to "friends".
//
// updateProfileVisibility, twenty lines below it, already omitted the column on
// update and explained why. One column, two writers, one of them told.
const actions = read("src/lib/actions.ts");
// Scoped to updateMeshPrivacy's own body. `prisma.meshPrivacy.upsert` appears
// more than once — onboarding seeds the row too, and IT is a create that
// legitimately writes overrides. An unanchored match reads the wrong one and
// reports on a write that was never the problem.
// Sliced to the next top-level `export`, not by brace matching: the parameter
// is an inline object type, so its own closing `}` sits at column 0 and any
// `\n\}` regex truncates the match before reaching the body.
const fnStart = actions.indexOf("export async function updateMeshPrivacy(");
assert.notEqual(fnStart, -1, "updateMeshPrivacy not found in src/lib/actions.ts");
const nextExport = actions.indexOf("\nexport ", fnStart + 1);
const updateMeshPrivacyFn = actions.slice(fnStart, nextExport === -1 ? undefined : nextExport);
const meshPrivacyUpsert = /prisma\.meshPrivacy\.upsert\(\{[\s\S]*?\n  \}\);/.exec(updateMeshPrivacyFn)?.[0];
assert.ok(meshPrivacyUpsert, "prisma.meshPrivacy.upsert not found inside updateMeshPrivacy");
const updateBlock = /update:\s*\{([\s\S]*?)\n    \},/.exec(meshPrivacyUpsert)?.[1];
assert.ok(updateBlock, "the update branch of the meshPrivacy upsert was not found");
assert.ok(
  !/branchOverrides:\s*JSON\.stringify\([^)]*\|\|/.test(updateBlock),
  "updateMeshPrivacy must not write `branchOverrides: JSON.stringify(x || {})` on UPDATE.\n" +
    "  An absent value means 'leave them alone', not 'clear them' — and the Privacy Control\n" +
    "  Center is a live caller that never sends the field. Writing `{}` there silently\n" +
    "  re-exposes every branch the user set tighter than their overall mesh.",
);
assert.match(
  updateBlock,
  /\.\.\.\(\s*data\.branchOverrides\s*\?\s*\{\s*branchOverrides:/,
  "updateMeshPrivacy must make branchOverrides opt-in on UPDATE — spread it only when the\n" +
    "  caller actually supplied one, matching updateProfileVisibility directly below it.",
);
// Every caller is pinned, because the defect lived in the GAP between them: one
// sends the field, one does not, and the server has to be safe for both.
const meshPrivacyCallers = sourceFiles.filter((f) => /updateMeshPrivacy\s*\(/.test(read(f)));
assert.deepEqual(
  meshPrivacyCallers.sort(),
  [
    "src/components/privacy/privacy-control-center.tsx",
    "src/components/settings/settings-control-center.tsx",
    "src/lib/actions.ts",
  ],
  "The set of updateMeshPrivacy callers changed. Each caller either sends branchOverrides or\n" +
    "  does not, and the server must be correct for both — that gap is exactly where the\n" +
    "  overrides were being erased. Re-check the new caller, then update this list.",
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. EVERY post-creation path carries the safety classification.
// ─────────────────────────────────────────────────────────────────────────────
//
// Every viewer-side adult gate in the product is a filter on `isNsfw` —
// nsfwHiddenWhere() returns `{ isNsfw: false }` for anyone not both opted in and
// currently age-verified. createPost classifies and stores the pair. repost()
// created a Post without it, so the row took the schema defaults (false /
// "general") and an adult post became visible to everyone, including the
// accounts the gate exists for. Reposting laundered it.
const postCreates = [...actions.matchAll(/prisma\.post\.create\(\{[\s\S]*?\n  \}\);/g)].map((m) => m[0]);
assert.ok(
  postCreates.length >= 2,
  `expected at least 2 prisma.post.create sites in actions.ts, found ${postCreates.length} —` +
    " if post creation moved, this gate needs to move with it.",
);
for (const [i, block] of postCreates.entries()) {
  for (const field of ["isNsfw", "contentRating"]) {
    assert.match(
      block,
      new RegExp(String.raw`\b${field}:`),
      `a prisma.post.create in src/lib/actions.ts (site ${i + 1} of ${postCreates.length}) does not set` +
        ` \`${field}\`:\n\n${block.slice(0, 320)}\n\n` +
        "  The schema defaults are `isNsfw false` / `contentRating \"general\"`, so omitting them\n" +
        "  does not mean 'unknown' — it means 'certified safe for everyone', past every adult\n" +
        "  gate in the product. Classify it (classifyContentSafety) or carry it from the source.",
    );
  }
}
// You also cannot rebroadcast what you are not allowed to see.
assert.match(
  actions,
  /if \(original\.isNsfw && !canViewNsfw\(user\)\)/,
  "repost() must refuse when the original is adult and the reposter cannot view adult content.\n" +
    "  canUserInteractWithPost governs visibility and blocks, not age — without this, a viewer\n" +
    "  who fails the age gate can still republish the post to people who also fail it.",
);

console.log(
  `second-writer contract OK — all ${Object.keys(PEOPLE_SEARCHES).length} people searches subtract blocks in each direction\n` +
    "  through one of the two shared mechanisms (none re-spells it inline),\n" +
    `  branchOverrides is opt-in on update across all ${meshPrivacyCallers.length} callers, and all ` +
    `${postCreates.length} post-creation\n  paths carry isNsfw + contentRating.\n` +
    "  Does NOT cover: a fourth instance of the pattern nobody has listed here yet — this is a\n" +
    "  ratchet on three known pairs, not a search for new ones.",
);
