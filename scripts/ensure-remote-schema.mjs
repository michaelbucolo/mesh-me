#!/usr/bin/env node
/**
 * Additive production schema sync.
 *
 * The production database is a remote libSQL/Turso instance provisioned via
 * `prisma db push`, and the Vercel build does not run migrations. That left the
 * live schema behind the codebase (e.g. missing `PlatformFeedItem`), which
 * hard-crashed /feed and /explore with "no such table".
 *
 * This runs during the build and applies `prisma/ensure-schema.sql`, which is
 * the full schema rendered as `CREATE TABLE/INDEX IF NOT EXISTS`. It is strictly
 * additive: it creates missing tables/indexes and never drops or alters existing
 * data. Local builds (file: URLs) are skipped — those use migrations.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const url = (process.env.DATABASE_URL || "").trim();
const authToken = (process.env.DATABASE_AUTH_TOKEN || "").trim() || undefined;

// Only sync remote databases. Local dev/CI uses a file DB + migrations.
if (!url || url.startsWith("file:")) {
  console.log("[ensure-schema] Local/file database — skipping remote schema sync.");
  process.exit(0);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(here, "..", "prisma", "ensure-schema.sql");
const raw = readFileSync(sqlPath, "utf8");

// Split into individual statements (strip -- comments, split on `;`).
const statements = raw
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

const client = createClient({ url, authToken });

let created = 0;
let skipped = 0;

// Indexes must run AFTER the column-level sync: an index over a column that
// was added to the schema later than the (pre-existing) table would otherwise
// fail with "no such column" before the ALTER TABLE pass gets a chance to add
// it — which is exactly how the MessageThread unique index broke the build.
const tableStatements = statements.filter((s) => /^CREATE TABLE/i.test(s));
const otherStatements = statements.filter((s) => !/^CREATE TABLE/i.test(s));

const runStatements = async (list) => {
  for (const stmt of list) {
    try {
      await client.execute(stmt);
      created += 1;
    } catch (error) {
      const message = String(error?.message || error);
      // Idempotent statements should not error, but tolerate races / pre-existing
      // objects defensively; surface anything genuinely unexpected.
      if (/already exists/i.test(message)) {
        skipped += 1;
        continue;
      }
      console.error("[ensure-schema] Failed statement:\n", stmt.slice(0, 200));
      throw error;
    }
  }
};

try {
  // Phase 1: tables only, so every table exists before we diff columns.
  await runStatements(tableStatements);

  // ── Column-level additive sync ──────────────────────────────────────────
  // CREATE TABLE IF NOT EXISTS only helps for *new* tables. A table that was
  // provisioned remotely with an older shape silently misses columns added to
  // the schema later, and every Prisma write against it fails (e.g. the
  // MeshPresence heartbeats behind live Meshis). Diff each table's real
  // columns against the schema and ALTER TABLE ADD COLUMN what's missing.
  let addedColumns = 0;
  for (const stmt of statements) {
    const m = /^CREATE TABLE IF NOT EXISTS\s+"([^"]+)"\s*\(([\s\S]*)\)\s*$/i.exec(stmt);
    if (!m) continue;
    const table = m[1];
    // Top-level comma split (no nested parens in our column defs except
    // constraint clauses, which we skip anyway).
    const parts = [];
    let depth = 0;
    let cur = "";
    for (const ch of m[2]) {
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
      if (ch === "," && depth === 0) {
        parts.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    if (cur.trim()) parts.push(cur.trim());

    const info = await client.execute(`PRAGMA table_info("${table}")`);
    if (!info.rows.length) continue; // table missing entirely — created above
    const existing = new Set(info.rows.map((r) => String(r.name)));

    for (const def of parts) {
      const col = /^"([^"]+)"\s+(.*)$/s.exec(def);
      if (!col) continue; // table-level constraint (FOREIGN KEY, UNIQUE, ...)
      const [, name, rest] = col;
      if (existing.has(name)) continue;
      // SQLite ADD COLUMN restrictions: no PRIMARY KEY/UNIQUE, and NOT NULL
      // requires a constant default. Sanitize the definition accordingly.
      let colDef = rest
        .replace(/\s+PRIMARY KEY(\s+AUTOINCREMENT)?/i, "")
        .replace(/\s+UNIQUE/i, "")
        .trim();
      if (/NOT NULL/i.test(colDef) && !/DEFAULT/i.test(colDef)) {
        const type = colDef.split(/\s+/)[0].toUpperCase();
        const fallback = /INT|REAL|NUMERIC|BOOLEAN|BIGINT/.test(type)
          ? "0"
          : /DATETIME|TIMESTAMP/.test(type)
            ? "'1970-01-01 00:00:00'"
            : "''";
        colDef += ` DEFAULT ${fallback}`;
      }
      try {
        await client.execute(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${colDef}`);
        addedColumns += 1;
        console.log(`[ensure-schema] Added missing column ${table}.${name}`);
      } catch (error) {
        const message = String(error?.message || error);
        if (/duplicate column/i.test(message)) continue;
        console.error(`[ensure-schema] Failed to add column ${table}.${name}:`, message);
        throw error;
      }
    }
  }
  if (addedColumns) {
    console.log(`[ensure-schema] Column sync complete (${addedColumns} column(s) added).`);
  }

  // Phase 3: indexes and everything else — safe now that all columns exist.
  await runStatements(otherStatements);
  console.log(`[ensure-schema] Remote schema in sync (${created} applied, ${skipped} pre-existing).`);

  // ── One-time data normalizations ────────────────────────────────────────
  // Guarded by a marker table so each runs exactly once — they must never
  // re-run, or they'd clobber choices users have since made.
  await client.execute(
    "CREATE TABLE IF NOT EXISTS _MeshDataMigration (id TEXT PRIMARY KEY, appliedAt TEXT NOT NULL)",
  );
  const runOnce = async (id, apply) => {
    const done = await client.execute({ sql: "SELECT id FROM _MeshDataMigration WHERE id = ?", args: [id] });
    if (done.rows.length) return;
    await apply();
    await client.execute({ sql: "INSERT INTO _MeshDataMigration (id, appliedAt) VALUES (?, ?)", args: [id, new Date().toISOString()] });
    console.log(`[ensure-schema] Applied one-time data migration: ${id}`);
  };

  // Early accounts were created under an over-conservative default that left the
  // whole network undiscoverable (nobody could be found or followed). Bring
  // existing non-suspended accounts in line with the corrected "findable by
  // default" behaviour, once. Content visibility (isPublic) is untouched.
  await runOnce("discovery-default-2026", async () => {
    await client.execute("UPDATE User SET showInDiscovery = 1 WHERE showInDiscovery = 0 AND isSuspended = 0");
  });

  // Presence was dead for the whole network: every account was created with
  // hideActivityStatus=1 (the old default), and the presence endpoint drops
  // heartbeats for hidden users — so no one could ever see anyone live. Since
  // the feature never worked, nobody meaningfully chose that value; reset it
  // once so live Meshis work, and users who want to hide can do so in privacy
  // settings.
  await runOnce("presence-visible-2026", async () => {
    await client.execute("UPDATE User SET hideActivityStatus = 0 WHERE hideActivityStatus = 1 AND isSuspended = 0");
  });

  // Round two: the ONBOARDING flow's local defaults (hideActivityStatus=true,
  // showInDiscovery=false) silently re-flipped both flags for every account
  // that completed onboarding after the migration above — which is every real
  // account. Verified live with two fresh signups whose heartbeats came back
  // {hidden: true}. The defaults are fixed in the flow; repair the accounts
  // that walked through the broken version once.
  await runOnce("presence-visible-2026b", async () => {
    await client.execute("UPDATE User SET hideActivityStatus = 0 WHERE hideActivityStatus = 1 AND isSuspended = 0");
    await client.execute("UPDATE User SET showInDiscovery = 1 WHERE showInDiscovery = 0 AND isSuspended = 0");
  });

  // Permissive backfill for the DataVisibilityPolicy consent flags, mirroring
  // prisma/migrations/20260725060000_backfill_data_visibility_consent (which
  // only runs against local/file databases). Until src/lib/consent.ts shipped,
  // allowDiscovery/allowAnalytics/allowMeshiUse were written but never read, so
  // a stored `false` recorded no decision — it was simply the column default or
  // a placeholder the client fills in for categories the switch does not
  // govern. Bring those up to the permissive value that was genuinely in force,
  // while leaving the deliberate restrictive choices (a non-public `profile`, a
  // `hidden` analytics/Meshi rule) intact so the switches finally mean
  // something. See the migration file for the full reasoning per statement.
  // This MUST stay in runOnce: replayed on every deploy it would overwrite
  // every choice users make from here on.
  await runOnce("data-visibility-consent-backfill-2026", async () => {
    // Retire the pre-rename 'meshi_ai' category first: /api/data-controls
    // matches rows by the normalized name, so a legacy row is never updated and
    // would strand a denial the privacy centre cannot clear.
    await client.execute(
      `DELETE FROM DataVisibilityPolicy WHERE entityType = 'meshi_ai' AND EXISTS (
         SELECT 1 FROM DataVisibilityPolicy AS newer
         WHERE newer.userId = DataVisibilityPolicy.userId
           AND newer.entityType = 'meshi_memory'
           AND newer.entityId IS DataVisibilityPolicy.entityId)`,
    );
    await client.execute(
      "UPDATE DataVisibilityPolicy SET entityType = 'meshi_memory' WHERE entityType = 'meshi_ai'",
    );
    await client.execute(
      "UPDATE DataVisibilityPolicy SET allowDiscovery = 1 WHERE allowDiscovery = 0 AND (visibility = 'public' OR (entityType = 'native_posts' AND visibility NOT IN ('private', 'hidden')))",
    );
    await client.execute(
      "UPDATE DataVisibilityPolicy SET allowAnalytics = 1 WHERE allowAnalytics = 0 AND visibility <> 'hidden'",
    );
    await client.execute(
      "UPDATE DataVisibilityPolicy SET allowAiUse = 1 WHERE allowAiUse = 0 AND visibility <> 'hidden' AND entityType IN ('meshi_memory', 'meshi_ai')",
    );
  });

  // ── Orphaned mirrored DMs — swept on EVERY deploy, not once ─────────────
  //
  // `MessageThread.connectedAccountId` was a bare TEXT column with no foreign
  // key for the whole life of the mirrored-DM feature. Disconnecting a platform
  // deleted the ConnectedAccount row and left every mirrored thread behind
  // pointing at an id that no longer existed: unreachable from any surface,
  // deleted by nothing, and still present after a GDPR erasure request or
  // Meta's data-deletion callback. Those rows hold real correspondence —
  // message bodies, plus the other party's name, handle and avatar in
  // metadata — stored unencrypted because it arrived from a platform that had
  // already read it.
  //
  // The remediation shipped as a migration
  // (20260725093000_message_thread_connected_account_cascade). PRODUCTION NEVER
  // RUNS MIGRATIONS — see the header of this file — so the purge never
  // executed against the live database, and neither did the ON DELETE CASCADE:
  // `CREATE TABLE IF NOT EXISTS "MessageThread"` no-ops against the existing
  // table, and the column catch-up loop above skips table-level constraints by
  // construction (`if (!col) continue`). The fix was real in the repo and inert
  // where the data actually lives. That is the same failure the leak itself
  // came from — two statements of one fact, only one of them maintained.
  //
  // NOT runOnce, deliberately. Replaying this can only ever delete rows that are
  // already unreachable by definition, so re-running it is free, and running it
  // every deploy makes it a standing sweep rather than a one-time repair: if any
  // future path ever orphans a mirrored thread again, the next deploy takes it
  // out instead of leaving it there for another year. The one-time blocks above
  // are runOnce because replaying THEM would overwrite choices users have since
  // made; this one has nothing to overwrite. Deepest table first — the FK that
  // would cascade for us is exactly the one production lacks.
  const ORPHANED_THREADS = `SELECT "id" FROM "MessageThread"
     WHERE "connectedAccountId" IS NOT NULL
       AND "connectedAccountId" NOT IN (SELECT "id" FROM "ConnectedAccount")`;
  // A NULL connectedAccountId is a mesh-native thread and is never touched.
  const orphanCount = await client.execute(
    `SELECT COUNT(*) AS n FROM (${ORPHANED_THREADS})`,
  );
  const orphans = Number(orphanCount.rows[0]?.n ?? 0);
  if (orphans > 0) {
    await client.execute(`DELETE FROM "Message" WHERE "threadId" IN (${ORPHANED_THREADS})`);
    await client.execute(`DELETE FROM "ThreadMember" WHERE "threadId" IN (${ORPHANED_THREADS})`);
    await client.execute(
      `DELETE FROM "MessageThread"
       WHERE "connectedAccountId" IS NOT NULL
         AND "connectedAccountId" NOT IN (SELECT "id" FROM "ConnectedAccount")`,
    );
    console.log(
      `[ensure-schema] Purged ${orphans} mirrored DM thread(s) belonging to revoked connections.`,
    );
  }

  // ── Imported platform comments — swept on EVERY deploy, same reasoning ──
  //
  // migratePlatformCommentsIntoMeChat turns comments on your connected-platform
  // posts into MeChat messages. It wrote them into MESH-NATIVE threads, which
  // carry a NULL connectedAccountId — so neither the cascade nor the sweep above
  // has ever been able to see them, and neither could the disconnect teardown,
  // which deletes by thread. Two separate residues are left in the live data.
  //
  // (a) Comments delivered to a GROUP OR COMMUNITY thread. The import matched
  //     its thread on membership alone — "has member A and has member B" — with
  //     no threadType filter. A community thread holds every member of the
  //     community, so for any two people who shared one, that lookup selected
  //     the community room and published the imported comment to all of it. The
  //     import now goes through findOrCreateDirectThread (src/lib/direct-thread.ts)
  //     and cannot do this again; these rows are what it already did. An
  //     imported comment in a non-direct thread is never intentional, so the
  //     rule needs no judgement call.
  //
  // (b) Comments whose authorizing connection is already gone. The import only
  //     ever runs for the account that OWNS the post being commented on, so the
  //     thread member who is not the sender is that account holder. If nobody in
  //     the thread besides the sender still has that platform connected, the
  //     authorization these rows depend on has been revoked — and until now
  //     nothing deleted them. Reconnecting re-imports them on the next sync, so
  //     removal costs nothing that consent does not restore.
  //
  // Standing rather than runOnce for the same reason as the block above: there
  // is no user choice here to overwrite, and a sweep every deploy bounds any
  // future regression instead of leaving it in place indefinitely.
  const chunked = async (values, run) => {
    for (let i = 0; i < values.length; i += 400) {
      const slice = values.slice(i, i + 400);
      await run(slice, slice.map(() => "?").join(", "));
    }
  };

  const leakedToRooms = await client.execute(
    `SELECT COUNT(*) AS n FROM "Message"
      WHERE "messageType" = 'imported_comment'
        AND "threadId" IN (SELECT "id" FROM "MessageThread" WHERE "threadType" <> 'direct')`,
  );
  const leaked = Number(leakedToRooms.rows[0]?.n ?? 0);
  if (leaked > 0) {
    await client.execute(
      `DELETE FROM "Message"
        WHERE "messageType" = 'imported_comment'
          AND "threadId" IN (SELECT "id" FROM "MessageThread" WHERE "threadType" <> 'direct')`,
    );
    console.log(
      `[ensure-schema] Removed ${leaked} imported platform comment(s) that had been delivered into group/community threads.`,
    );
  }

  // The thread is NOT deleted here, only the message: a group or community
  // thread is a real conversation that happens to have been polluted.
  const stranded = await client.execute(
    `SELECT m."id" AS id, m."threadId" AS threadId FROM "Message" m
      WHERE m."messageType" = 'imported_comment'
        AND NOT EXISTS (
          SELECT 1 FROM "ThreadMember" tm
            JOIN "ConnectedAccount" ca
              ON ca."userId" = tm."userId" AND ca."platform" = m."sourcePlatform"
           WHERE tm."threadId" = m."threadId" AND tm."userId" <> m."senderId")`,
  );
  if (stranded.rows.length > 0) {
    const messageIds = stranded.rows.map((r) => String(r.id));
    const threadIds = [...new Set(stranded.rows.map((r) => String(r.threadId)))];
    await chunked(messageIds, (args, placeholders) =>
      client.execute({ sql: `DELETE FROM "Message" WHERE "id" IN (${placeholders})`, args }));

    // Threads left holding nothing are the ones the import created. An empty
    // thread still states that these two people are connected on a platform
    // whose authorization is gone. Bounded to the threads just emptied — a
    // thread someone opened and never wrote in is indistinguishable otherwise,
    // and it is theirs.
    let husks = 0;
    await chunked(threadIds, async (args, placeholders) => {
      const empty = await client.execute({
        sql: `SELECT "id" FROM "MessageThread"
               WHERE "id" IN (${placeholders})
                 AND "connectedAccountId" IS NULL
                 AND NOT EXISTS (
                   SELECT 1 FROM "Message" WHERE "Message"."threadId" = "MessageThread"."id")`,
        args,
      });
      const ids = empty.rows.map((r) => String(r.id));
      if (ids.length === 0) return;
      husks += ids.length;
      const marks = ids.map(() => "?").join(", ");
      await client.execute({ sql: `DELETE FROM "ThreadMember" WHERE "threadId" IN (${marks})`, args: ids });
      await client.execute({ sql: `DELETE FROM "MessageThread" WHERE "id" IN (${marks})`, args: ids });
    });
    console.log(
      `[ensure-schema] Purged ${messageIds.length} imported platform comment(s) whose connection was revoked` +
        `${husks ? `, and ${husks} thread(s) left empty by them` : ""}.`,
    );
  }

  // WHAT IS DELIBERATELY NOT DONE HERE: adding the ON DELETE CASCADE to the
  // live table.
  //
  // SQLite cannot add a foreign key in place, so it means the twelve-step table
  // rebuild — create, copy, DROP TABLE "MessageThread", rename. Both "Message"
  // and "ThreadMember" hold `ON DELETE CASCADE` foreign keys REFERENCING
  // MessageThread, so that DROP deletes every message in the product unless
  // `PRAGMA foreign_keys=OFF` is genuinely in force. A Prisma migration gets
  // that guarantee. This script does not: it speaks to Turso over HTTP, where
  // PRAGMA is per-connection and ignored inside a transaction, and there is no
  // atomic boundary around DROP-then-RENAME — a failure between them leaves the
  // product with no MessageThread table at all.
  //
  // That is a catastrophic, irreversible downside in exchange for defence in
  // depth, on an operation that cannot be rehearsed against the real database.
  // The enforcing path in production is the application-level teardown in
  // src/lib/connected-account-deletion.ts, which deletes mirrored threads
  // explicitly, and scripts/disconnect-purge-check.ts holds it as the single
  // definition every disconnect path must use. The cascade still ships in
  // ensure-schema.sql, so every freshly provisioned database gets it.
  //
  // Do not "just add the rebuild" without a tested backup-and-restore for the
  // live database. The sweep above is what closes the leak.
  // ── Founder MeshPro ────────────────────────────────────────────────────
  // Deliberately NOT inside runOnce. A one-time UPDATE affects zero rows if the
  // account does not exist yet, and there is no second chance — so a founder who
  // signs up after the deploy would never be granted. Re-asserted every deploy
  // instead: idempotent (the WHERE excludes rows already granted), tiny, and
  // self-healing whenever the account appears.
  //
  // The runtime guarantee does not depend on this at all — lib/mesh-pro.ts
  // derives MeshPro from the username, so a founder has it from their first
  // request regardless of what this column says. This exists so the stored data
  // agrees with what the product shows, for analytics and anything reading the
  // table directly.
  {
    const founders = ["stephen", "michaelbucolo"];
    const placeholders = founders.map(() => "?").join(", ");
    const result = await client.execute({
      sql: `UPDATE User SET isMeshPro = 1, meshProSince = COALESCE(meshProSince, ?)
            WHERE lower(username) IN (${placeholders}) AND isMeshPro = 0`,
      args: [new Date().toISOString(), ...founders],
    });
    if (result.rowsAffected > 0) {
      console.log(`[ensure-schema] Granted founder MeshPro to ${result.rowsAffected} account(s)`);
    }
  }

} finally {
  await client.close?.();
}
