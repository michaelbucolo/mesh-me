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

const url = process.env.DATABASE_URL || "";
const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;

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
} finally {
  await client.close?.();
}
