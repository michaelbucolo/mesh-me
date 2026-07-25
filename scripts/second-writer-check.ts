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

// ─────────────────────────────────────────────────────────────────────────────
// 4. EVERY 1:1 CONVERSATION IS FOUND AND CREATED IN ONE PLACE.
// ─────────────────────────────────────────────────────────────────────────────
//
// Three callers opened a DM. Two stated both rules — the thread must be
// `threadType: "direct"`, and neither party may have blocked the other. The
// third, the platform-comment import, stated neither:
//
//   - It matched on membership alone. A community thread holds EVERY member of
//     the community, so for any two people who shared one, "the thread with A
//     and B in it" was the community room, and a comment addressed to one
//     person was posted in front of all of them.
//   - It ran with no block check, so blocking someone on Mesh.me did nothing to
//     the path that turns their platform comment into a message in your MeChat.
//
// The lookup shape is what carries the defect, so the gate bans the shape
// everywhere but the one module — a caller that re-types the three clauses is
// free to omit `threadType` again, and that omission is invisible at review.
const DIRECT_THREAD_MODULE = "src/lib/direct-thread.ts";
const inlineDirectLookups = sourceFiles.filter((f) => {
  if (f === DIRECT_THREAD_MODULE) return false;
  const body = read(f);
  // Two `members: { some: { userId … } }` clauses inside one messageThread
  // query: the "find the thread these two people share" shape, whatever the
  // surrounding code calls it.
  return /messageThread\s*\.\s*(findFirst|findMany|findUnique)\s*\(\{[\s\S]{0,400}?members:\s*\{\s*some:[\s\S]{0,200}?members:\s*\{\s*some:/.test(body);
});
assert.deepEqual(
  inlineDirectLookups,
  [],
  "These files hand-roll the 'thread shared by these two people' lookup:\n" +
    inlineDirectLookups.map((f) => `    ${f}`).join("\n") +
    `\n  Use directThreadWhere() or findOrCreateDirectThread() from ${DIRECT_THREAD_MODULE}.\n` +
    "  Written inline, the filter is one missing line away from matching a group or community\n" +
    "  thread — which is exactly how an imported platform comment got delivered to a whole\n" +
    "  community room.",
);

const directThread = read(DIRECT_THREAD_MODULE);
// The shared definition must actually carry both rules; a shared helper that
// dropped one would pass the ban above while reintroducing the defect in every
// caller at once.
assert.match(
  directThread,
  /export function directThreadWhere[\s\S]{0,400}?threadType:\s*"direct"/,
  `${DIRECT_THREAD_MODULE}: directThreadWhere must filter on threadType: "direct". Membership is\n` +
    "  not sufficient — group and community threads contain arbitrarily many people, and both of\n" +
    '  the two people you are looking for can be inside a room of two hundred. "direct" is the\n' +
    "  only marker of a two-person conversation.",
);
assert.match(
  directThread,
  /export async function findOrCreateDirectThread[\s\S]{0,600}?directMessagingBlocked\(/,
  `${DIRECT_THREAD_MODULE}: findOrCreateDirectThread must consult directMessagingBlocked before\n` +
    "  returning or creating a thread. Settings promises blocks work in both directions without\n" +
    "  qualification; a conversation opened around that check makes the promise false.",
);
assert.match(
  directThread,
  /prisma\.messageThread\.create\(\{[\s\S]{0,200}?threadType:\s*"direct"/,
  `${DIRECT_THREAD_MODULE}: the thread it CREATES must be marked threadType: "direct" too.\n` +
    "  The schema default is \"direct\", but relying on a default means the next person to change\n" +
    "  it silently un-marks every DM in the product, and the lookup above would stop finding them.",
);
// Every caller goes through it — including the ones that only need the fragment.
// FIVE, not the three the defect report named. The ban above is what found the
// other two: `/api/meshi/actions` carried a hand-fixed copy of both rules with a
// comment saying it "mirrors the messages route", and meshi-engine's "Meshi,
// send a message to X" intent had a FOURTH spelling — `every` over the pair plus
// two `some` clauses, and no threadType at all. Listing them here is what makes
// the removal of any one of them a build failure rather than a silent regression.
const DIRECT_THREAD_CALLERS = [
  "src/app/(app)/messages/[threadId]/page.tsx",
  "src/app/api/meshi/actions/route.ts",
  "src/app/api/messages/route.ts",
  "src/lib/actions.ts",
  "src/lib/meshi-engine.ts",
  "src/lib/platform-sync.ts",
];
for (const file of DIRECT_THREAD_CALLERS) {
  assert.match(
    read(file),
    /\b(findOrCreateDirectThread|directThreadWhere|directMessagingBlocked)\b/,
    `${file} opens 1:1 conversations and must import them from ${DIRECT_THREAD_MODULE}.`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. A PROFILE'S VISIBILITY IS DESCRIBED THE SAME WAY EVERYWHERE IT IS SHOWN.
// ─────────────────────────────────────────────────────────────────────────────
//
// `User.isPublic` is NOT the gate. canViewProfile grants access when
// `isPublic !== false || meshVisibility === "public"`, so a profile with
// isPublic=false and mesh visibility "public" is world-readable. Two screens —
// the Settings header pill and the Analytics privacy row — read the raw column
// and both printed "Private profile" over exactly that profile.
//
// It is not a corner case. /privacy-controls writes User.isPublic and
// MeshPrivacy.meshVisibility through two independent actions, neither touching
// the other column, and the schema default for isPublic is false — so choosing
// "public" for the mesh alone produces the state. Settings even disagreed with
// ITSELF: the "Who can see your profile" picker on the same screen showed
// Public while the header pill said Private.
// The rule and the gate it describes must stay the SAME expression. Pinning
// only WHERE the rule lives leaves it free to drift from canViewProfile — a
// mutation that changed the shared rule to `isPublic === true` passed until
// this compared the two predicates directly.
const gateClause = /subject\.isPublic !== false \|\| visibility === "public"/;
const ruleClause = /isPublic !== false \|\| visibility === "public"/;
const gateSrc = read("src/lib/privacy-policy.ts");
const gateStart = gateSrc.indexOf("export function canViewProfile(");
assert.notEqual(gateStart, -1, "canViewProfile not found in src/lib/privacy-policy.ts");
const gateBody = gateSrc.slice(gateSrc.indexOf("{", gateStart));
assert.match(
  gateBody,
  gateClause,
  "canViewProfile's public clause changed shape. If the gate moved, the label rule in\n" +
    "  src/lib/profile-visibility.ts has to move with it — update BOTH and this assertion.",
);
// Matched against the FUNCTION BODY, not the file. The file's header comment
// quotes the predicate to explain itself, so a whole-file match is satisfied by
// the prose while the code says something else entirely — mutation-tested:
// rewriting the rule to `isPublic === true` passed until this sliced the body.
const ruleSrc = read("src/lib/profile-visibility.ts");
const ruleStart = ruleSrc.indexOf("export function effectiveProfileVisibility(");
assert.notEqual(ruleStart, -1, "effectiveProfileVisibility not found in src/lib/profile-visibility.ts");
const ruleBody = ruleSrc.slice(ruleSrc.indexOf("{", ruleStart));
assert.match(
  ruleBody,
  ruleClause,
  "effectiveProfileVisibility no longer uses the same predicate as canViewProfile.\n" +
    "  The label exists to describe that gate; the moment the two expressions differ, the label is\n" +
    "  wrong again in exactly the way it was wrong before — silently, and about privacy.",
);

const VISIBILITY_LABELS = [
  "src/components/settings/settings-control-center.tsx",
  "src/components/analytics/analytics-dashboard.tsx",
];
for (const file of VISIBILITY_LABELS) {
  const body = read(file);
  assert.match(
    body,
    /effectiveProfileVisibility\(/,
    `${file} must derive the profile-visibility label from effectiveProfileVisibility()\n` +
      "  in src/lib/profile-visibility.ts, derived from the same expression canViewProfile uses\n" +
      "  expression — so a label cannot drift from the gate it claims to describe.",
  );
  assert.ok(
    !/isPublic\s*\?\s*"Public profile"/.test(body),
    `${file} still branches a visibility label on the raw isPublic column. That column is not the\n` +
      "  gate: a profile with isPublic=false and meshVisibility \"public\" is world-readable, and this\n" +
      "  is exactly the shape that labelled it \"Private profile\".",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. EVERY ACCOUNT CAN DELETE ITSELF.
// ─────────────────────────────────────────────────────────────────────────────
//
// deleteAccount required a password unconditionally. Accounts created through
// Google or Apple do not have one: identity-auth.ts stores a hash of 48 random
// bytes so "password sign-in can never succeed for them" — its own words — so
// verifyPassword could never return true and those accounts could not be
// deleted by any route, ever. A GDPR Article 17 failure, under a Privacy Policy
// that promises deletion without qualification.
//
// The rule has TWO halves and both must hold: the password check still applies
// to accounts that HAVE a password (this must never become a way to skip it),
// and it must not apply to accounts that cannot. The branch is chosen by
// whether an AuthIdentity row exists — server-side, never from client input.
const actionsSrc = read("src/lib/actions.ts");
const deleteStart = actionsSrc.indexOf("export async function deleteAccount(");
assert.notEqual(deleteStart, -1, "deleteAccount not found in src/lib/actions.ts");
const nextExportAfterDelete = actionsSrc.indexOf("\nexport ", deleteStart + 1);
const deleteFn = actionsSrc.slice(deleteStart, nextExportAfterDelete === -1 ? undefined : nextExportAfterDelete);

assert.match(
  deleteFn,
  /authIdentity\.count\(\{\s*where:\s*\{\s*userId:\s*user\.id/,
  "deleteAccount must decide the re-authentication method from the AuthIdentity table.\n" +
    "  Federated accounts hold an unusable password hash by design, so a password check is not a\n" +
    "  weaker path for them — it is an impossible one, and it locked them out of erasure entirely.",
);
assert.match(
  deleteFn,
  /if \(hasUsablePassword\)\s*\{[\s\S]*?verifyPassword\(currentPassword/,
  "the password check must stay INSIDE the hasUsablePassword branch. Accounts that have a password\n" +
    "  must still prove it — the fix for the locked-out case must not become a way around it for\n" +
    "  everyone else.",
);
assert.ok(
  !/^\s*const hasUsablePassword = .*(formData|body|request)/m.test(deleteFn),
  "hasUsablePassword must be derived from the database, never from the request. A client-supplied\n" +
    "  flag would let anyone skip re-authentication by sending it.",
);
// And the form must not demand what the account cannot have — the UI half of
// the same lockout.
assert.match(
  read("src/app/(app)/settings/tabs/delete-account-tab.tsx"),
  /!hasPassword \|\| currentPassword\.length > 0/,
  "the delete form must not require a password from an account that has none — otherwise its own\n" +
    "  delete button stays permanently disabled, which is the same lockout one layer up.",
);

console.log(
  `second-writer contract OK — all ${Object.keys(PEOPLE_SEARCHES).length} people searches subtract blocks in each direction\n` +
    "  through one of the two shared mechanisms (none re-spells it inline),\n" +
    `  branchOverrides is opt-in on update across all ${meshPrivacyCallers.length} callers, and all ` +
    `${postCreates.length} post-creation\n  paths carry isNsfw + contentRating, and all ` +
    `${DIRECT_THREAD_CALLERS.length} callers open a 1:1 conversation through the one\n  module that states both` +
    " the direct-only and the block rule (none re-spells the lookup).\n" +
    "  Does NOT cover: a fifth instance of the pattern nobody has listed here yet — this is a\n" +
    "  ratchet on four known pairs, not a search for new ones.",
);
