/**
 * PRODUCTION READS A DIFFERENT FILE THAN YOU DO.
 *
 * `prisma/schema.prisma` is what the Prisma client is generated from — the
 * shape every query in the app assumes. `prisma/ensure-schema.sql` is what the
 * BUILD applies to the live database, because production never runs migrations
 * (package.json: `prisma generate && node scripts/ensure-schema.mjs &&
 * next build`). The reconciliation pass in ensure-schema.mjs diffs the
 * live database against THE SQL FILE, not against the Prisma schema.
 *
 * So a column can exist in schema.prisma, have a migration, typecheck, lint,
 * build, pass every gate, deploy green — and still be missing in production,
 * where every query that selects it fails at runtime.
 *
 * THIS IS NOT HYPOTHETICAL. It took the site down. `User.flowStudio` was added
 * to schema.prisma with a migration and shipped; ensure-schema.sql was never
 * touched. Production threw
 *
 *     SQL_INPUT_ERROR: no such column: main.User.flowStudio
 *
 * on /mesh, /mesh.rsc, /api/mesh/presence/stream and /api/meshi/deliveries —
 * because getCurrentUser selects the whole User row, so the failure was not
 * confined to the feature. `npm run check` was green the entire time.
 *
 * It is the house failure mode stated exactly: two places state one fact, and
 * only one of them was ever taught the rule. This is the second one.
 *
 * ── WHAT THIS CANNOT PROVE ───────────────────────────────────────────────────
 *
 * That the live database matches either file. It compares two files in the repo.
 * A database provisioned before a column was added is repaired by the ALTER
 * TABLE pass at build time — but only for columns this check can see, which is
 * the point. It also does not compare types or defaults, only presence: a column
 * declared TEXT here and INTEGER there would pass.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const failures: string[] = [];
const fail = (detail: string) => failures.push(detail);
let checks = 0;
const ok = () => { checks += 1; };

/** Prisma scalar fields per model, ignoring relations and block attributes. */
function prismaModels(src: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const modelRe = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(src))) {
    const [, name, body] = m;
    const fields = new Set<string>();
    for (const line of body.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("//") || t.startsWith("///") || t.startsWith("@@")) continue;
      const f = /^(\w+)\s+(\w+)(\[\])?(\?)?/.exec(t);
      if (!f) continue;
      const [, field, type, isList] = f;
      // A list of another model is a relation, never a column.
      if (isList) continue;
      // A field whose type is another model is a relation; its scalar foreign
      // key is declared separately and will be seen on its own line.
      if (!/^(String|Int|BigInt|Float|Decimal|Boolean|DateTime|Json|Bytes)$/.test(type)) continue;
      // @map renames the COLUMN. The first draft of this check did not know
      // that and reported DataVisibilityPolicy.allowMeshiUse as missing when
      // the column is `allowAiUse` and has been there all along — a gate whose
      // first finding is a false positive is a gate people learn to ignore.
      const mapped = /@map\("([^"]+)"\)/.exec(t);
      fields.add(mapped ? mapped[1] : field);
    }
    out.set(name, fields);
  }
  return out;
}

/** Column names per CREATE TABLE in the SQL production actually applies. */
function sqlTables(src: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const re = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"([^"]+)"\s*\(([\s\S]*?)\n\);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const [, table, body] = m;
    const cols = out.get(table) ?? new Set<string>();
    for (const line of body.split("\n")) {
      const t = line.trim();
      const c = /^"([^"]+)"\s+\w/.exec(t);
      if (c) cols.add(c[1]);
    }
    out.set(table, cols);
  }
  return out;
}

const models = prismaModels(read("prisma/schema.prisma"));
const tables = sqlTables(read("prisma/ensure-schema.sql"));

// The parsers must be able to SEE. A clean report from a broken parser is how
// this defect shipped in the first place.
if (models.size < 20) fail(`only ${models.size} Prisma models parsed — the parser is broken, not the schema`);
else ok();
if (tables.size < 20) fail(`only ${tables.size} SQL tables parsed — the parser is broken, not the schema`);
else ok();

// Models that legitimately have no table in ensure-schema.sql would be a
// separate defect; report them rather than skipping silently.
const missingTables: string[] = [];
let compared = 0;

for (const [model, fields] of models) {
  const cols = tables.get(model);
  if (!cols) {
    missingTables.push(model);
    continue;
  }
  compared += 1;
  const missing = [...fields].filter((f) => !cols.has(f));
  if (missing.length) {
    fail(
      `${model}: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} in schema.prisma but NOT in prisma/ensure-schema.sql.\n` +
      `    Production applies the SQL file, so every query selecting ${missing.length === 1 ? "it" : "them"} will fail at runtime\n` +
      `    with "no such column" — including getCurrentUser, which selects the whole row.`,
    );
  } else ok();
}

if (missingTables.length) {
  fail(`no CREATE TABLE in prisma/ensure-schema.sql for: ${missingTables.join(", ")} — a freshly provisioned database would not have ${missingTables.length === 1 ? "it" : "them"} at all`);
} else ok();

if (compared < 20) {
  fail(`only ${compared} models were actually compared; this check is not covering the schema`);
} else ok();

if (failures.length) {
  console.error(`\nprod-schema-parity: ${failures.length} failure(s)\n`);
  for (const f of failures) console.error("  " + f);
  console.error("\n  Add the column to prisma/ensure-schema.sql. A migration is not enough — production never runs migrations.\n");
  process.exit(1);
}
console.log(`prod-schema-parity: ${checks} assertions passed — ${compared} models, every scalar field also present in the SQL production applies.`);
