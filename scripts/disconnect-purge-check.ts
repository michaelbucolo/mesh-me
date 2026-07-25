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

// ── 2. The teardown removes mirrored threads ─────────────────────────────────
assert.match(
  teardown,
  /export async function purgeConnectedAccountRows\b/,
  `${TEARDOWN_MODULE} must export purgeConnectedAccountRows — it is the one definition of\n` +
    "  what disconnecting deletes, and the disconnect route imports it by name.",
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

console.log(
  "disconnect contract OK — one shared teardown (no path deletes a ConnectedAccount on its\n" +
    "  own), it removes mirrored DM threads and granted scopes, and both the Prisma schema\n" +
    "  and ensure-schema.sql back it with ON DELETE CASCADE.\n" +
    "  Does NOT cover: whether the cascade fires at runtime — that needs a live database.",
);
