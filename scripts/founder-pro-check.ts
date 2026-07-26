/**
 * FOUNDER MESH PRO — granted in code, so it cannot lapse.
 *
 * @stephen and @michaelbucolo have Mesh Pro for life. That is implemented as a
 * DERIVED property rather than a row, and this holds the reasoning in place:
 *
 *   A one-time `UPDATE User SET isMeshPro = 1 WHERE username IN (...)` has two
 *   holes. It affects zero rows if the account does not exist yet, with no
 *   second chance — so a founder who signs up after the migration ran would
 *   never be granted. And anything that later writes the column (a billing
 *   webhook, a downgrade path, a restore from an older backup) takes it away
 *   again. Derived from the username, it cannot be missed and cannot be revoked.
 *
 * What this asserts:
 *   1. Both founders resolve to Mesh Pro through the real function, with the
 *      stored column false — i.e. the derivation alone is sufficient.
 *   2. It is not a blanket grant: an ordinary account is unaffected.
 *   3. The session chokepoint (getCurrentUser) applies it, so every
 *      authenticated request sees it.
 *   4. The profile read path applies it, so founders read as Pro to OTHER
 *      people too, not only to themselves.
 *   5. The deploy-time SQL grant is idempotent and NOT wrapped in runOnce.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FOUNDER_USERNAMES, hasMeshPro, isFounderUsername } from "../src/lib/mesh-pro";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

// ── 1. Both founders resolve to Pro with the column false ────────────────────
for (const username of FOUNDER_USERNAMES) {
  if (!hasMeshPro({ username, isMeshPro: false })) {
    fail("1 derived", `@${username} does not resolve to Mesh Pro when the stored column is false`);
  } else ok();
  // Usernames are stored as typed; the comparison must not care.
  for (const variant of [username.toUpperCase(), ` ${username} `, username[0].toUpperCase() + username.slice(1)]) {
    if (!isFounderUsername(variant)) fail("1 derived", `isFounderUsername missed the variant ${JSON.stringify(variant)}`);
    else ok();
  }
}
// The two the user actually named must both be present.
for (const expected of ["stephen", "michaelbucolo"]) {
  if (!(FOUNDER_USERNAMES as readonly string[]).includes(expected)) {
    fail("1 derived", `@${expected} is no longer in FOUNDER_USERNAMES — the grant was dropped`);
  } else ok();
}

// ── 2. Not a blanket grant ───────────────────────────────────────────────────
for (const outsider of ["alexcreates", "demouser", "", "stephenx", "notstephen"]) {
  if (hasMeshPro({ username: outsider, isMeshPro: false })) {
    fail("2 scope", `@${outsider} was granted Mesh Pro — the founder list is matching too broadly`);
  } else ok();
}
// A paying member is still Pro whatever their name.
if (!hasMeshPro({ username: "somebody", isMeshPro: true })) {
  fail("2 scope", "a paid member no longer resolves to Mesh Pro");
} else ok();
if (hasMeshPro(null) || hasMeshPro(undefined)) {
  fail("2 scope", "hasMeshPro(null/undefined) returned true");
} else ok();

// ── 3-4. Both read paths apply it ────────────────────────────────────────────
{
  const auth = strip(read("src/lib/auth.ts"));
  if (!/isFounderUsername\(/.test(auth)) {
    fail("3 session", "getCurrentUser no longer applies the founder grant — a founder would not see Pro on their own account");
  } else ok();

  const queries = strip(read("src/lib/queries.ts"));
  if (!/isMeshPro:\s*hasMeshPro\(/.test(queries)) {
    fail("4 profile", "the profile payload no longer derives isMeshPro — founders would not read as Pro to other people");
  } else ok();
}

// ── 5. The deploy grant is idempotent and unconditional ──────────────────────
{
  const ensure = read("scripts/ensure-remote-schema.mjs");
  const grant = /UPDATE User SET isMeshPro = 1[\s\S]{0,240}?isMeshPro = 0/.exec(ensure);
  if (!grant) {
    fail("5 deploy", "the founder Mesh Pro grant is gone from ensure-remote-schema.mjs");
  } else {
    ok();
    // `AND isMeshPro = 0` is what makes replaying it harmless.
    if (!/AND isMeshPro = 0/.test(grant[0])) {
      fail("5 deploy", "the grant is no longer idempotent — it would rewrite rows on every deploy");
    } else ok();
  }
  // If it were wrapped in runOnce it would never reach an account created later.
  const wrapped = /runOnce\([^)]*founder/i.test(ensure);
  if (wrapped) {
    fail("5 deploy", "the founder grant is inside runOnce; it must re-assert so a founder who signs up later is still granted");
  } else ok();
  for (const username of FOUNDER_USERNAMES) {
    if (!ensure.includes(`"${username}"`)) {
      fail("5 deploy", `@${username} is missing from the deploy-time grant list`);
    } else ok();
  }
}

if (failures.length) {
  console.error(`\nfounder-pro: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(`founder-pro: ${checks} assertions passed — @${FOUNDER_USERNAMES.join(", @")} have Mesh Pro for life.`);
