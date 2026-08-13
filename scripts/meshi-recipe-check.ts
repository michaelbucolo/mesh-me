/**
 * SAVED LOOKS (MESHI RECIPES) — the owner's memory, never an entitlement.
 *
 * The failure shapes this gate exists to catch:
 *
 *   - THE SECOND WARDROBE GATE: an applyMeshiRecipe server action, or any
 *     new MeshiPreference writer, would fork the platform's one
 *     user-initiated wardrobe gate (updateMeshiPreference) and quietly
 *     bypass the audits that regex its source.
 *   - THE BOTTLED LIE: a recipe built from client-sent style fields could
 *     bottle a look the gate never admitted. Snapshots come from the
 *     persisted row, server-side, full stop.
 *   - THE CHURN LEVER: a cap checked on rename/delete/apply — or a lapse
 *     that deletes shelves — turns depth into hostage-taking.
 *   - THE SMUGGLED STOREFRONT: a share/import surface for recipes is an
 *     itemized premium-piece list one hop from checkout. Zero API surface,
 *     mechanically.
 *   - THE UNDRESSING APPLY: a fallback to bare defaults (instead of the
 *     currently equipped value) would strip someone's Meshi on apply.
 *
 * WHAT THIS CANNOT PROVE (stated): source text, not dataflow; the truth
 * table exercises the pure clamp, not the studio's wiring of it.
 */

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { resolveMeshiRecipeCap } from "../src/lib/mesh-pro";
import { resolveRecipeApplication, type MeshiRecipeSnapshot } from "../src/lib/meshi-wardrobe";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const actions = strip(read("src/lib/actions.ts"));
const meshPro = strip(read("src/lib/mesh-pro.ts"));
const panel = strip(read("src/components/settings/meshi-wardrobe-panel.tsx"));
const schema = read("prisma/schema.prisma");
const ensure = read("prisma/ensure-schema.sql");

function body(source: string, marker: string) {
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const next = source.indexOf("export ", start + marker.length);
  return next > start ? source.slice(start, next) : source.slice(start);
}

// ── 1. Zero new MeshiPreference writers ──────────────────────────────────────
{
  // The census, corrected against real source: TWO upserts live in actions.ts
  // (completeOnboarding + updateMeshiPreference) and the three refund resets
  // (charter, patron, meshi-item) each keep exactly one updateMany. Recipes
  // add NOTHING — apply is client-side into the studio form.
  if ((actions.match(/meshiPreference\.upsert/g) ?? []).length !== 2) {
    fail("1 writers", "actions.ts no longer has exactly 2 meshiPreference.upsert sites (onboarding + updateMeshiPreference)");
  } else ok();
  for (const [file, expected] of [["src/lib/charter.ts", 1], ["src/lib/patron.ts", 1], ["src/lib/meshi-item.ts", 1]] as const) {
    if ((strip(read(file)).match(/meshiPreference\.updateMany/g) ?? []).length !== expected) {
      fail("1 writers", `${file} no longer has exactly ${expected} meshiPreference.updateMany (its refund reset)`);
    } else ok();
  }
  if (/meshiPreference/.test(panel) || /meshiPreference/.test(strip(read("src/lib/meshi-provenance.ts")))) {
    fail("1 writers", "a recipe/provenance module references meshiPreference — the one-gate rule broke");
  } else ok();
  if (/export async function applyMeshiRecipe/.test(actions)) {
    fail("1 writers", "an applyMeshiRecipe server action exists — apply is client-side through the studio form by design");
  } else ok();
}

// ── 2. Snapshot honesty ──────────────────────────────────────────────────────
{
  if (!/export async function saveMeshiRecipe\(name: string\)/.test(actions)) {
    fail("2 snapshot", "saveMeshiRecipe's signature grew beyond a name — client style fields could bottle an unadmitted look");
  } else ok();
  const saveBody = body(actions, "export async function saveMeshiRecipe");
  if (!/meshiPreference\.findUnique/.test(saveBody)) {
    fail("2 snapshot", "saveMeshiRecipe no longer snapshots from the persisted row");
  } else ok();
  if (!/hatStyle: look\.hatStyle/.test(saveBody) || !/badgeStyle: look\.badgeStyle/.test(saveBody)) {
    fail("2 snapshot", "the recipe create no longer copies the fetched row's fields");
  } else ok();
  // Transactional count-before-create, the journal precedent.
  if (!/\$transaction/.test(saveBody) || !/meshiRecipe\.count/.test(saveBody) || !/held >= cap/.test(saveBody)) {
    fail("2 snapshot", "the cap lost its transactional count-before-create");
  } else ok();
}

// ── 3. Recipes are user-initiated, private, and shareless ────────────────────
{
  // The DELEGATE (prisma/tx.meshiRecipe.) is the ratcheted surface — UI files
  // may carry recipe props, but only actions (writes) and queries (owner
  // read) may touch rows.
  const writeVerb = /meshiRecipe\.(create|update|updateMany|delete|deleteMany|upsert)/;
  const grepped = execFileSync("grep", ["-rlE", "(prisma|tx)\\.meshiRecipe\\.", "src"], { encoding: "utf8" })
    .split("\n").filter(Boolean).filter((f) => !f.startsWith("src/generated/"));
  const allowed = new Set(["src/lib/actions.ts", "src/lib/queries.ts"]);
  const strays = grepped.filter((f) => !allowed.has(f));
  if (strays.length > 0) {
    fail("3 private", `the meshiRecipe delegate reached: ${strays.join(", ")} — actions (writes) and queries (owner read) are the whole surface`);
  } else ok();
  if (writeVerb.test(strip(read("src/lib/queries.ts")))) {
    fail("3 private", "queries.ts writes meshiRecipe rows — reads only");
  } else ok();
  // Zero API surface: no route can serve or accept a recipe, so sharing
  // cannot exist mechanically.
  let apiHits = "";
  try {
    apiHits = execFileSync("grep", ["-ril", "meshiRecipe", "src/app/api"], { encoding: "utf8" });
  } catch {
    // grep exits 1 on no matches — exactly what we want.
  }
  if (apiHits.trim()) {
    fail("3 private", `meshiRecipe appears in API routes: ${apiHits.trim()} — zero share surface, mechanically`);
  } else ok();
  // Each mutation adjudicates the session user before touching rows.
  for (const fn of ["saveMeshiRecipe", "renameMeshiRecipe", "deleteMeshiRecipe"]) {
    const fnBody = body(actions, `export async function ${fn}`);
    const authAt = fnBody.indexOf("getCurrentUser()");
    const writeAt = fnBody.search(/meshiRecipe\./);
    if (authAt < 0 || writeAt < 0 || authAt > writeAt) {
      fail("3 private", `${fn} touches rows before getCurrentUser`);
    } else ok();
    if (!/userId: user\.id/.test(fnBody)) {
      fail("3 private", `${fn} lost its ownership scoping`);
    } else ok();
  }
}

// ── 4. Cap discipline: depth, never a churn lever ────────────────────────────
{
  if (!/const MESHI_RECIPE_CAPS = \{ free: 3, pro: 12 \} as const;/.test(meshPro)) {
    fail("4 caps", "MESHI_RECIPE_CAPS drifted from { free: 3, pro: 12 } or left mesh-pro.ts");
  } else ok();
  if (resolveMeshiRecipeCap(false) !== 3 || resolveMeshiRecipeCap(true) !== 12) {
    fail("4 caps", "resolveMeshiRecipeCap answers wrong");
  } else ok();
  if ((actions.match(/MESHI_RECIPE_CAPS/g) ?? []).length > 0 && !/resolveMeshiRecipeCap/.test(actions)) {
    fail("4 caps", "actions.ts reimplements the cap instead of importing resolveMeshiRecipeCap");
  } else if (!/resolveMeshiRecipeCap\(hasMeshPro\(user\)\)/.test(body(actions, "export async function saveMeshiRecipe"))) {
    fail("4 caps", "saveMeshiRecipe no longer resolves the cap from the entitlement UNION (founder/gift/paid)");
  } else ok();
  // The cap gates SAVE alone. Rename/delete stay free of counting.
  for (const fn of ["renameMeshiRecipe", "deleteMeshiRecipe"]) {
    if (/count\(|resolveMeshiRecipeCap|MESHI_RECIPE_CAPS/.test(body(actions, `export async function ${fn}`))) {
      fail("4 caps", `${fn} counts or caps — lapse and cleanup must never be gated`);
    } else ok();
  }
  // The at-cap copy: plain sentences, no link, no lock, no countdown.
  if (!/Your shelf holds three looks on the free plan; MeshPro holds twelve\./.test(read("src/lib/actions.ts"))) {
    fail("4 caps", "the free at-cap sentence drifted — it states the shelf plainly, names no link, teases nothing");
  } else ok();
}

// ── 5. Apply purity: the clamp mirrors the gate and never undresses ──────────
{
  const current: MeshiRecipeSnapshot = {
    hatStyle: "beanie", faceStyle: "happy", colorTheme: "blue", hairStyle: "none",
    hairColor: "inherit", accessoryStyle: "none", eyeStyle: "regular", badgeStyle: "none",
  };
  const recipe: MeshiRecipeSnapshot = {
    ...current, hatStyle: "tophat", colorTheme: "crimson", badgeStyle: "charter",
  };
  const none = { isPro: false, hasCharterSeat: false, hasPatronRecord: false };

  const free = resolveRecipeApplication(recipe, current, {}, none);
  if (free.next.hatStyle !== "beanie" || free.next.colorTheme !== "blue" || free.next.badgeStyle !== "none") {
    fail("5 apply", `a free account's clamp leaked a premium value: ${JSON.stringify(free.next)}`);
  } else ok();
  if (free.next.hatStyle === "none") {
    fail("5 apply", "the clamp fell back to the bare default — apply must keep the equipped value, never undress");
  } else ok();

  const owned = resolveRecipeApplication(recipe, current, { hats: new Set(["tophat"]) }, none);
  if (owned.next.hatStyle !== "tophat" || owned.next.colorTheme !== "blue") {
    fail("5 apply", "an owned $1.99 piece did not apply (or ownership leaked across axes)");
  } else ok();

  const pro = resolveRecipeApplication(recipe, current, {}, { ...none, isPro: true });
  if (pro.next.hatStyle !== "tophat" || pro.next.colorTheme !== "crimson") {
    fail("5 apply", "Pro ornaments did not apply");
  } else ok();
  if (pro.next.badgeStyle !== "none") {
    fail("5 apply", "the charter pin applied on Pro alone — the SEAT is the gate, not the tier");
  } else ok();
  const seated = resolveRecipeApplication(recipe, current, {}, { ...none, isPro: true, hasCharterSeat: true });
  if (seated.next.badgeStyle !== "charter") {
    fail("5 apply", "a seat holder's charter pin did not apply");
  } else ok();
  const patronRecipe = { ...current, badgeStyle: "patron" };
  if (resolveRecipeApplication(patronRecipe, current, {}, { ...none, isPro: true }).next.badgeStyle !== "none") {
    fail("5 apply", "the patron pin applied without the record");
  } else ok();
  if (resolveRecipeApplication(patronRecipe, current, {}, { ...none, hasPatronRecord: true }).next.badgeStyle !== "patron") {
    fail("5 apply", "a patron of record's pin did not apply");
  } else ok();

  const unknown = resolveRecipeApplication({ ...current, hatStyle: "zzz-retired" }, current, {}, { ...none, isPro: true });
  if (unknown.next.hatStyle !== "beanie") {
    fail("5 apply", "an unknown/retired token applied — vocabulary drift must keep the equipped value");
  } else ok();
  if (unknown.fallbacks.length !== 1) {
    fail("5 apply", "the fallback count lies — the studio's quiet note would miscount");
  } else ok();
}

// ── 6. Quiet by law + schema parity ──────────────────────────────────────────
{
  if (/notification\.create|sendPushForNotification/.test(
    body(actions, "export async function saveMeshiRecipe") +
    body(actions, "export async function renameMeshiRecipe") +
    body(actions, "export async function deleteMeshiRecipe"),
  )) {
    fail("6 quiet", "a recipe mutation notifies — nothing on this shelf speaks, ever");
  } else ok();
  const model = /model MeshiRecipe \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? "";
  if (!/onDelete: Cascade/.test(model) || !/@@unique\(\[userId, name\]\)/.test(model)) {
    fail("6 parity", "MeshiRecipe lost its cascade or its per-owner name uniqueness");
  } else ok();
  if (!/CREATE TABLE IF NOT EXISTS "MeshiRecipe"/.test(ensure) || !/"MeshiRecipe_userId_name_key"/.test(ensure)) {
    fail("6 parity", "MeshiRecipe is missing from ensure-schema.sql — production never gets the shelf");
  } else ok();
  // The /meshpro card's promise resolves (meshpro-claims-check enforces the
  // pointer contract; this pins the pairing so the card and cap move together).
  if (!/enforcedIn: \{ file: "src\/lib\/mesh-pro\.ts", symbol: "MESHI_RECIPE_CAPS" \}/.test(strip(read("src/app/(app)/meshpro/page.tsx")))) {
    fail("6 parity", "the Saved looks card no longer points at MESHI_RECIPE_CAPS");
  } else ok();
}

if (failures.length) {
  console.error(`\nmeshi-recipe: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`meshi-recipe: all ${checks} assertions passed — the shelf bottles only admitted looks, applies through the one gate, and can never become a storefront.`);
