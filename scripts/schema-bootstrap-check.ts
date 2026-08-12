/**
 * CAN THE SCHEMA FILE ACTUALLY BUILD A DATABASE?
 *
 * `prod-schema-parity-check.ts` already proves that `prisma/ensure-schema.sql`
 * and `prisma/schema.prisma` name the same tables and columns. That is a
 * comparison of two text files. It says nothing about whether running the SQL
 * produces a database the app can open — and running the SQL is the entire job
 * of `scripts/ensure-schema.mjs`, which is the only thing that ever creates a
 * table in production.
 *
 * The gap between those two facts is where this shipped:
 *
 *     DriverAdapterError: SQLITE_ERROR: no such table: main.UserLocation
 *
 * on /meshimap, against a local database, while `UserLocation` sat correctly in
 * schema.prisma, in a migration, and in ensure-schema.sql. Every file was right.
 * The script that applies them opened with `if (url.startsWith("file:")) exit(0)`,
 * so locally nothing applied anything, and no gate in the repo had ever asked
 * the sync script to actually do its job and then looked at the result.
 *
 * So this one does. It points ensure-schema.mjs at a throwaway database, runs
 * it for real as its own process, and then opens what came out:
 *
 *   1. every table ensure-schema.sql declares exists
 *   2. every index it declares exists
 *   3. a second run is a clean no-op — the file's central claim is idempotence,
 *      and production replays it on every single deploy
 *   4. a local run creates no data-migration state, because local mode is
 *      structural only and the blocks below that line DELETE rows
 *
 * ── WHAT THIS CANNOT PROVE ───────────────────────────────────────────────────
 *
 * That the live remote database matches. It builds a database from empty; a
 * long-lived one that predates a column is repaired by the ALTER TABLE pass at
 * deploy time, which this exercises only in the trivial direction (nothing to
 * add). It also does not compare column types.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";

const ROOT = process.cwd();

const failures: string[] = [];
let checks = 0;
const ok = (condition: boolean, detail: string) => {
  checks += 1;
  if (!condition) failures.push(detail);
};

/** Object names the SQL file promises to create. */
function declaredNames(sql: string) {
  const tables = new Set<string>();
  const indexes = new Set<string>();
  const tableRe = /^CREATE TABLE IF NOT EXISTS\s+"([^"]+)"/gim;
  const indexRe = /^CREATE\s+(?:UNIQUE\s+)?INDEX IF NOT EXISTS\s+"([^"]+)"/gim;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(sql))) tables.add(m[1]);
  while ((m = indexRe.exec(sql))) indexes.add(m[1]);
  return { tables, indexes };
}

async function main() {
  const sql = readFileSync(join(ROOT, "prisma", "ensure-schema.sql"), "utf8");
  const { tables, indexes } = declaredNames(sql);

  // A parser that silently matched nothing would make every assertion below
  // vacuously true — "all zero declared tables exist" passes on an empty file.
  // Refuse to be that gate.
  ok(tables.size >= 50, `expected ensure-schema.sql to declare 50+ tables, parsed ${tables.size} — the parser or the file is broken`);
  ok(indexes.size >= 50, `expected ensure-schema.sql to declare 50+ indexes, parsed ${indexes.size} — the parser or the file is broken`);
  if (failures.length) return;

  const dir = mkdtempSync(join(tmpdir(), "mesh-schema-boot-"));
  const dbPath = join(dir, "bootstrap.db");
  const client = createClient({ url: `file:${dbPath}` });

  const runSync = (label: string) => {
    try {
      return execFileSync("node", [join(ROOT, "scripts", "ensure-schema.mjs")], {
        cwd: ROOT,
        encoding: "utf8",
        // An explicit DATABASE_URL also proves the script prefers the real
        // environment over the .env files it falls back to.
        env: { ...process.env, DATABASE_URL: `file:${dbPath}`, DATABASE_AUTH_TOKEN: "" },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      failures.push(
        `${label}: scripts/ensure-schema.mjs exited non-zero.\n` +
          `${(err.stderr || err.stdout || err.message || "").slice(0, 1200)}`,
      );
      return "";
    }
  };

  const liveNames = async (type: "table" | "index") => {
    const result = await client.execute(
      `SELECT name FROM sqlite_master WHERE type = '${type}' AND name NOT LIKE 'sqlite_%'`,
    );
    return new Set(result.rows.map((row) => String(row.name)));
  };

  try {
    // ── 1. A fresh database gets the whole schema. ─────────────────────────
    const firstOut = runSync("first run");
    if (failures.length) return;

    const builtTables = await liveNames("table");
    const missingTables = [...tables].filter((name) => !builtTables.has(name));
    ok(
      missingTables.length === 0,
      `ensure-schema.mjs did not create ${missingTables.length} declared table(s): ${missingTables.slice(0, 8).join(", ")}` +
        `${missingTables.length > 8 ? ", …" : ""}\n` +
        `  Every one of these is a "no such table" crash on whichever surface reads it.`,
    );

    const builtIndexes = await liveNames("index");
    const missingIndexes = [...indexes].filter((name) => !builtIndexes.has(name));
    ok(
      missingIndexes.length === 0,
      `ensure-schema.mjs did not create ${missingIndexes.length} declared index(es): ${missingIndexes.slice(0, 8).join(", ")}` +
        `${missingIndexes.length > 8 ? ", …" : ""}`,
    );

    // The run must SAY it repaired an empty database. A silent run against a
    // database that gained 67 tables would mean the drift report is decoration.
    ok(
      /was BEHIND the schema/.test(firstOut),
      "building an empty database reported no drift — the drift report never fires, so a stale database would not announce itself either",
    );

    // ── 2. Local mode is structural only. ──────────────────────────────────
    // The data blocks below the local exit include unconditional DELETEs and a
    // marker table. If any of it ran, `_MeshDataMigration` would exist.
    ok(
      !builtTables.has("_MeshDataMigration"),
      "a local sync created _MeshDataMigration — the remote-only data normalizations ran against a local database",
    );

    // ── 3. Replaying it changes nothing. ───────────────────────────────────
    // Production applies this file on every deploy, so "idempotent" is not a
    // nice property, it is the operating assumption.
    const secondOut = runSync("second run");
    if (failures.length) return;

    const tablesAfter = await liveNames("table");
    const indexesAfter = await liveNames("index");
    ok(
      tablesAfter.size === builtTables.size,
      `replaying the sync changed the table count (${builtTables.size} → ${tablesAfter.size}) — it is not idempotent`,
    );
    ok(
      indexesAfter.size === builtIndexes.size,
      `replaying the sync changed the index count (${builtIndexes.size} → ${indexesAfter.size}) — it is not idempotent`,
    );
    ok(
      !/was BEHIND the schema/.test(secondOut),
      "the second run still reported drift — either it is repairing something twice, or the drift report cannot tell in-sync from behind",
    );
  } finally {
    await client.close?.();
    rmSync(dir, { recursive: true, force: true });
  }
}

main()
  .then(() => {
    if (failures.length) {
      console.error("schema bootstrap check FAILED\n");
      for (const failure of failures) console.error(`  ✗ ${failure}\n`);
      process.exit(1);
    }
    console.log(`schema bootstrap OK — ${checks} assertions (builds from empty, idempotent, structural-only locally)`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
