/**
 * DISCONNECT GATE — revoking a platform must take the copied data with it.
 *
 * `MessageThread.connectedAccountId` was a bare `String?` with no foreign key
 * for the whole life of the mirrored-DM feature. Disconnecting a platform
 * deleted the `ConnectedAccount` row and left every mirrored thread behind,
 * pointing at an id that no longer existed. Those rows hold real
 * correspondence — message bodies, plus the other party's name, handle and
 * avatar in metadata — stored unencrypted because it arrived from a platform
 * that had already read it. Nothing in the product could reach them and nothing
 * deleted them, so they survived a GDPR erasure request and Meta's
 * data-deletion callback alike.
 *
 * The failure was not a missing line. It was that the two disconnect paths —
 * the interactive route and Meta's callbacks — each wrote their own teardown,
 * so there was no single place where "what must be deleted" was stated. This
 * gate holds the shape that prevents the recurrence rather than the symptom:
 *
 *   1. There is exactly ONE definition of the teardown, and every path uses it.
 *   2. That definition removes mirrored threads.
 *   3. The schema backs it with a cascade, so a path that somehow bypasses the
 *      helper still cannot leave orphans behind.
 *   4. The raw-SQL schema used for fresh databases carries the same constraint,
 *      because a database built from it never runs the migration.
 *
 * WHAT THIS CANNOT PROVE
 *   That the cascade fires at runtime — that needs a live database, and it is
 *   verified separately against one. This reads source text.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const TEARDOWN_MODULE = "src/lib/connected-account-deletion.ts";
const teardown = read(TEARDOWN_MODULE);

// ── 1. One teardown, used by every path ───────────────────────────────────────
//
// `connectedAccount.delete` outside the shared module means a path that decided
// for itself what disconnecting means. That is exactly how the two paths drifted.
const sourceFiles = execFileSync("git", ["ls-files", "src"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  // `git ls-files` still lists a file deleted but not yet staged, so a gate run
  // mid-refactor would die on ENOENT instead of reporting anything.
  .filter((f) => f && existsSync(join(ROOT, f)))
  .filter((f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.startsWith("src/generated/"));

const rogue: string[] = [];
for (const file of sourceFiles) {
  if (file === TEARDOWN_MODULE) continue;
  const body = readFileSync(join(ROOT, file), "utf8");
  if (/\bconnectedAccount\s*\.\s*delete(Many)?\s*\(/.test(body)) rogue.push(file);
}
assert.deepEqual(
  rogue,
  [],
  `These files delete a ConnectedAccount without going through the shared teardown:\n` +
    rogue.map((f) => `    ${f}`).join("\n") +
    `\n  Call purgeConnectedAccountRows() from ${TEARDOWN_MODULE} instead. Every path that\n` +
    `  removes a connection must remove the same rows — when they were written\n` +
    `  separately they drifted, and mirrored DMs survived both.`,
);

// ── 1b. One revoke, too ──────────────────────────────────────────────────────
//
// #370 unified WHAT gets deleted. The revoke stayed duplicated, and that half
// drifted the same way: the shared function wraps `decryptSecret` in a
// try/catch — it throws on malformed ciphertext and on AES-GCM auth failure
// after a key rotation — and the interactive route's copy did not. The throw
// escaped as a 500 BEFORE the teardown ran, so the user could not disconnect
// and the account plus its mirrored DMs were retained, permanently and
// silently. A privacy control that fails that way is worse than none.
// `(?<!function\s)` so the declaration in oauth.ts is not mistaken for a call —
// the helper has to be defined somewhere, and that somewhere is not a violation.
const revokers: string[] = [];
for (const file of sourceFiles) {
  if (file === TEARDOWN_MODULE || !existsSync(join(ROOT, file))) continue;
  if (/(?<!function\s)\brevokeOAuthToken\s*\(/.test(readFileSync(join(ROOT, file), "utf8"))) {
    revokers.push(file);
  }
}
assert.deepEqual(
  revokers,
  [],
  "These files revoke a provider token outside the shared disconnect path:\n" +
    revokers.map((f) => `    ${f}`).join("\n") +
    `\n  Call disconnectConnectedAccount() from ${TEARDOWN_MODULE} instead. It guards the\n` +
    "  decryptSecret call, so an unreadable token cannot abort the teardown that follows it.",
);
assert.match(
  teardown,
  /export async function disconnectConnectedAccount\b/,
  `${TEARDOWN_MODULE} must export disconnectConnectedAccount — the one disconnect path,\n` +
    "  revoke and teardown together.",
);

// ── 2. The teardown removes mirrored threads ─────────────────────────────────
assert.match(
  teardown,
  /async function purgeConnectedAccountRows\b/,
  `${TEARDOWN_MODULE} must define purgeConnectedAccountRows — the one definition of what\n` +
    "  disconnecting deletes. It is deliberately NOT exported: callers go through\n" +
    "  disconnectConnectedAccount(), which pairs it with the guarded provider revoke.",
);
assert.match(
  teardown,
  /messageThread\s*\.\s*deleteMany\s*\(\s*\{\s*where:\s*\{\s*connectedAccountId/,
  "purgeConnectedAccountRows must delete mirrored MessageThreads.\n" +
    "  Their messages and membership rows follow by cascade; the thread row is the\n" +
    "  only one that has to be named. Without it, revoking a platform leaves the\n" +
    "  copied correspondence in the database with nothing able to reach or remove it.",
);
assert.match(
  teardown,
  /platformPermission\s*\.\s*deleteMany\s*\(/,
  "purgeConnectedAccountRows must delete the granted-scope records: they describe\n" +
    "  access to a connection that no longer exists.",
);

// ── 3. The schema backs it with a cascade ────────────────────────────────────
const schema = read("prisma/schema.prisma");
const messageThread = /^model MessageThread \{([\s\S]*?)^\}/m.exec(schema)?.[1];
assert.ok(messageThread, "MessageThread model not found in prisma/schema.prisma");
assert.match(
  messageThread,
  /connectedAccount\s+ConnectedAccount\?\s+@relation\([^)]*onDelete:\s*Cascade/,
  "MessageThread.connectedAccountId must be a real relation with onDelete: Cascade.\n" +
    "  As a bare String? it was a foreign key in name only: deleting the account left\n" +
    "  the mirrored threads behind pointing at a dead id. Cascade is correct rather\n" +
    "  than merely convenient — these rows are a COPY of correspondence that lives on\n" +
    "  the platform, and revoking access is the moment the copy stops being ours.",
);

// ── 4. Fresh databases get the same constraint ───────────────────────────────
//
// ensure-schema.sql builds a database from nothing and never runs the migration,
// so a constraint added only in the migration would be missing there forever.
const ensureSql = read("prisma/ensure-schema.sql");
const createTable = /CREATE TABLE IF NOT EXISTS "MessageThread" \(([\s\S]*?)\n\);/.exec(ensureSql)?.[1];
assert.ok(createTable, 'CREATE TABLE for "MessageThread" not found in prisma/ensure-schema.sql');
assert.match(
  createTable,
  /FOREIGN KEY \("connectedAccountId"\) REFERENCES "ConnectedAccount" \("id"\) ON DELETE CASCADE/,
  'prisma/ensure-schema.sql must give "MessageThread" the same ON DELETE CASCADE foreign key.\n' +
    "  A database built from this file never runs the migration, so without it every\n" +
    "  fresh deployment reintroduces the leak.",
);

// ── 5. The remediation reaches the database it was written for ───────────────
//
// Items 1-4 all passed while the leak was still live in production, which is the
// most useful thing this gate has ever taught. The purge of already-orphaned
// threads shipped as a migration, and PRODUCTION NEVER RUNS MIGRATIONS: the
// remote database is provisioned with `prisma db push` and kept current by
// scripts/ensure-schema.mjs, which is strictly additive. So a gate that
// reads prisma/migrations was reporting a guarantee about a file, and the file
// was not the thing that governs the live data.
//
// One fact — "orphaned mirrored threads are deleted" — needs a statement in each
// place that can enact it, and this pins the second one.
const remote = read("scripts/ensure-schema.mjs");
assert.match(
  remote,
  /DELETE FROM "MessageThread"[\s\S]{0,200}?"connectedAccountId" NOT IN \(SELECT "id" FROM "ConnectedAccount"\)/,
  "scripts/ensure-schema.mjs must purge mirrored threads whose connection is gone.\n" +
    "  The migration that does this NEVER RUNS in production — the remote database is synced by\n" +
    "  this script, not by prisma migrate. Without the sweep here, the purge exists only in a file\n" +
    "  no deployment executes, and the correspondence stays in the live database.",
);
for (const table of ["Message", "ThreadMember"]) {
  assert.match(
    remote,
    new RegExp(String.raw`DELETE FROM "${table}" WHERE "threadId" IN`),
    `scripts/ensure-schema.mjs must also purge "${table}" rows of orphaned threads.\n` +
      "  Production's MessageThread has no foreign key, so nothing cascades for us — every table\n" +
      "  has to be named, deepest first. Message rows are the message bodies themselves.",
  );
}
// Deepest first: deleting the thread before its children would leave the
// children permanently unreachable, since the subquery that identifies them
// resolves through the thread row.
const orderOf = (needle: string) => remote.indexOf(needle);
assert.ok(
  orderOf('DELETE FROM "Message" WHERE "threadId" IN') <
    orderOf('DELETE FROM "MessageThread"\n       WHERE "connectedAccountId"'),
  "the orphan purge must delete Message rows BEFORE the MessageThread rows that identify them —\n" +
    "  the reverse order strands the message bodies with nothing able to find them again.",
);
// Not runOnce: replaying it can only remove rows that are unreachable by
// definition, and a standing sweep bounds any future regression by the deploy
// cadence instead of leaving it in place indefinitely.
assert.ok(
  !/runOnce\(\s*["'][^"']*(orphan|mirrored|thread)[^"']*["']/i.test(remote),
  "the orphan purge must NOT be wrapped in runOnce. runOnce exists for normalizations that would\n" +
    "  clobber user choices on replay; this one has nothing to overwrite, and running it every\n" +
    "  deploy is what makes it a standing sweep rather than a one-time repair.",
);

// ── 6. The teardown also removes what does NOT live in a mirrored thread ─────
//
// Items 1-5 are all expressed in terms of `MessageThread.connectedAccountId`,
// and that is the whole of their reach. The comment import writes into the
// ordinary mesh-native DM between two people, which carries NULL there by
// design — that thread holds their own correspondence and must survive the
// disconnect. So a purge that deletes by thread could never touch the imported
// rows, and every one of them stayed in MeChat after the connection was
// revoked: the other party's handle, the comment text, and a link back to the
// platform post the user had just withdrawn our access to.
assert.match(
  teardown,
  /platformComment\s*\.\s*findMany\s*\(\s*\{\s*where:\s*\{\s*connectedAccountId/,
  "purgeConnectedAccountRows must read this account's platform-issued comment ids BEFORE the\n" +
    "  ConnectedAccount row goes — PlatformComment cascades with it, and after that there is\n" +
    "  nothing left to identify which imported messages came from this authorization.",
);
assert.match(
  teardown,
  /messageType:\s*"imported_comment"/,
  "purgeConnectedAccountRows must delete the imported_comment Messages this connection created.\n" +
    "  They sit in mesh-native threads (connectedAccountId NULL), so the thread-level deleteMany\n" +
    "  above cannot see them, and no other path deletes them at all.",
);
// Scoped by comment id, not by platform: the same 1:1 thread can hold comments
// imported under the OTHER person's connection, and those are not ours to take.
assert.match(
  teardown,
  /platformCommentId:\s*\{\s*in:\s*importedIds\s*\}/,
  "the imported-comment purge must be scoped to THIS account's platformCommentIds. Deleting\n" +
    "  every imported_comment for the platform would also delete the ones the other party's own\n" +
    "  connection imported into the same thread — their authorization, still in force.",
);
assert.match(
  teardown,
  /messages:\s*\{\s*none:\s*\{\}\s*\}/,
  "purgeConnectedAccountRows must delete threads left holding nothing once the imported\n" +
    "  comments are gone. A thread the import created is empty afterwards, and an empty thread\n" +
    "  still asserts that these two people are connected on the platform just disconnected.\n" +
    "  It must be bounded to the threads just emptied — a thread someone opened and never wrote\n" +
    "  in is indistinguishable from the outside, and it is theirs.",
);

// ── 7. And the residue already in the live database is swept ─────────────────
//
// Same lesson as item 5: a fix that only governs new disconnects leaves every
// past one exactly as it was. Both sweeps live in the remote sync because that
// is the script production actually runs.
assert.match(
  remote,
  /DELETE FROM "Message"\s*\n?\s*WHERE "messageType" = 'imported_comment'\s*\n?\s*AND "threadId" IN \(SELECT "id" FROM "MessageThread" WHERE "threadType" <> 'direct'\)/,
  "scripts/ensure-schema.mjs must remove imported comments that were delivered into\n" +
    "  group or community threads. The import matched its thread on membership alone, so for any\n" +
    "  two people who shared a community it selected the community room and published the comment\n" +
    "  to everyone in it. The code path is fixed; these rows are what it already did.",
);
assert.match(
  remote,
  /messageType" = 'imported_comment'[\s\S]{0,400}?NOT EXISTS \([\s\S]{0,300}?"ConnectedAccount"[\s\S]{0,200}?ca\."platform" = m\."sourcePlatform"/,
  "scripts/ensure-schema.mjs must also purge imported comments whose authorizing\n" +
    "  connection is already gone — the disconnects that happened before the teardown learned to\n" +
    "  do it. The import only runs for the account that owns the commented-on post, so the thread\n" +
    "  member who is not the sender is that account holder; if nobody but the sender still has\n" +
    "  that platform connected, the authorization these rows depend on has been revoked.",
);
assert.ok(
  !/runOnce\(\s*["'][^"']*(imported|comment)[^"']*["']/i.test(remote),
  "the imported-comment sweeps must NOT be wrapped in runOnce, for the same reason as the orphan\n" +
    "  sweep: there is no user choice to overwrite, and running them every deploy bounds any future\n" +
    "  regression by the deploy cadence instead of leaving it in place indefinitely.",
);

// ── 8. THE OTHER CONTROL THAT PROMISES TO DELETE IMPORTED DATA ───────────────
//
// Everything above governs DISCONNECT. There is a second control with the same
// promise and a different code path: "Delete all imported data" in the privacy
// centre, which removes the copies while KEEPING the connection. It deleted six
// tables and left the two other children of ConnectedAccount — mirrored DM
// threads and imported for-you feed items — behind. And because it deliberately
// keeps the account row alive, the schema cascade never fired to catch them
// either.
//
// The button and its confirm dialog are both unqualified ("Imported Mesh.me
// copies from all connected platforms will be removed"), and mirrored threads
// hold real correspondence — message bodies plus the other party's name, handle
// and avatar. Two controls promising one thing; only one of them was ever
// taught the full list. Same pattern as the two disconnect paths that started
// this file.
const dataControls = read("src/app/api/data-controls/route.ts");
const syncedDataAt = dataControls.indexOf('action === "delete-synced-data"');
assert.notEqual(syncedDataAt, -1, 'the "delete-synced-data" action was not found in /api/data-controls.');
const syncedDataBlock = dataControls.slice(syncedDataAt, dataControls.indexOf("connectedAccount.updateMany", syncedDataAt));
for (const [table, why] of [
  ["messageThread", "mirrored DM threads — the most sensitive imported category, and the one the copy most clearly promises to clear"],
  ["platformFeedItem", "imported for-you feed items, which feed-data.ts reads straight back into the feed, so leaving them means the 'deleted' content keeps rendering"],
] as const) {
  assert.match(
    syncedDataBlock,
    new RegExp(String.raw`tx\.${table}\.deleteMany\(\{\s*where:\s*\{\s*connectedAccountId`),
    `"Delete all imported data" must delete ${table} rows: ${why}.\n` +
      "  The control keeps the ConnectedAccount row alive on purpose, so nothing cascades for it —\n" +
      "  every imported table has to be named here explicitly.",
  );
}
// And the transparency count has to agree with what the button deletes, or the
// user cannot even learn the data exists.
const storedCounts = read("src/lib/privacy-control-center.ts");
for (const field of ["mirroredThreads", "feedItems"]) {
  assert.match(
    storedCounts,
    new RegExp(String.raw`${field}:\s*\w+Count`),
    `src/lib/privacy-control-center.ts must count ${field} in importedStored. The panel calls itself\n` +
      "  \"a transparent count of what Mesh.me currently stores\"; a category that is stored, is deleted\n" +
      "  by the button beside it, and appears in neither, is the opposite of transparent.",
  );
}

console.log(
  "disconnect contract OK — one shared teardown (no path deletes a ConnectedAccount on its\n" +
    "  own), it removes mirrored DM threads and granted scopes, both the Prisma schema and\n" +
    "  ensure-schema.sql back it with ON DELETE CASCADE, and the remote sync sweeps orphaned\n" +
    "  threads on every deploy so the remediation reaches production and not just the repo.\n" +
    "  It also removes the imported platform comments that live in mesh-native threads, which no\n" +
    "  thread-level purge could ever reach, and sweeps both residues (delivered-to-a-room, and\n" +
    "  connection-already-revoked) out of the live database on every deploy.\n" +
    "  Does NOT cover: whether the cascade fires at runtime — that needs a live database.\n" +
    "  KNOWN GAP, deliberate: production's existing MessageThread table carries NO foreign key.\n" +
    "  Adding it means a SQLite table rebuild, and both Message and ThreadMember cascade off\n" +
    "  MessageThread, so a DROP without a reliable PRAGMA foreign_keys=OFF deletes every message\n" +
    "  in the product. The enforcing path there is the application-level teardown above; the\n" +
    "  cascade protects freshly provisioned databases. See the note in ensure-schema.mjs.",
);
