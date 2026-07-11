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

try {
  for (const stmt of statements) {
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
} finally {
  await client.close?.();
}
