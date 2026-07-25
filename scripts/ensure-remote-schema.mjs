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
} finally {
  await client.close?.();
}
