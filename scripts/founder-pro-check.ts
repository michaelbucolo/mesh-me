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
 *   6. NO payload describing another account emits the raw column. (New.)
 *   7. Billing derives entitlement rather than reading the column. (New.)
 *
 * WHY 6 AND 7 EXIST — this gate used to overstate its own coverage, which is the
 * one thing a gate must never do. Assertion 4 named `src/lib/queries.ts` and
 * claimed it covered "the profile read path … so founders read as Pro to OTHER
 * people too". It covered that ONE file. Two other paths shipped broken:
 *
 *   - `src/app/api/mesh/route.ts` emitted `isMeshPro: targetUser.isMeshPro` for
 *     a VISITED mesh, so a founder's mesh announced them as non-Pro to every
 *     visitor while their profile announced them as Pro. `username` was already
 *     in that select; the call was simply not made.
 *   - `src/lib/stripe-billing.ts` did not select `username` at all, so
 *     `hasMeshPro()` was not CALLABLE on the row, and /meshpro and /billing —
 *     the two pages about a person's entitlement — showed a founder the pricing
 *     grid and a checkout button. Worse, `syncMeshProSubscription` writes
 *     `isMeshPro: isActive`, so a founder who ever subscribed and lapsed had the
 *     column reset to 0: precisely the "anything that later writes the column
 *     takes it away" hole this file's own docstring names.
 *
 * So 6 and 7 hold a SHAPE rather than a list of blessed filenames. Naming files
 * is what let the defect live beside the gate that claimed to prevent it.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { FOUNDER_USERNAMES, hasMeshPro, isFounderUsername } from "../src/lib/mesh-pro";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

/** Hand-written source only — src/generated is Prisma's type shapes, not reads. */
function tsxAndTsUnder(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${entry}`;
    if (rel === "src/generated") continue;
    if (statSync(join(ROOT, rel)).isDirectory()) tsxAndTsUnder(rel, out);
    else if (/\.tsx?$/.test(rel)) out.push(rel);
  }
  return out;
}

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

// ── 6. No payload describing ANOTHER account emits the raw column ────────────
//
// The shape, not a filename list. `user` is this codebase's name for the
// SESSION user, and getCurrentUser already resolves the founder grant at the
// chokepoint (auth.ts) — so `isMeshPro: user.isMeshPro` is correct by
// construction. Any OTHER identifier is somebody else's row, read straight from
// the database, where the grant has not been applied.
{
  const files = tsxAndTsUnder("src");
  const offenders: string[] = [];
  for (const file of files) {
    const body = strip(read(file));
    // Only where a row could have been FETCHED. A page that re-emits a payload
    // some query already derived (settings/page.tsx does this) is not a raw
    // read, and flagging it would train people to ignore this gate.
    if (!/\bprisma\./.test(body)) continue;
    for (const m of body.matchAll(/isMeshPro:\s*([A-Za-z_$][\w$]*)\.isMeshPro\b/g)) {
      const ident = m[1];
      if (ident === "user") continue; // session user; founder-correct upstream
      const line = body.slice(0, m.index).split("\n").length;
      offenders.push(`${file}:${line} — isMeshPro: ${ident}.isMeshPro`);
    }
  }
  if (offenders.length) {
    for (const o of offenders) {
      fail("6 cross-user", `${o} reads the stored column for an account that is not the session user; use hasMeshPro(...) so a founder reads as Pro to other people`);
    }
  } else ok();
}

// ── 7. Billing derives entitlement, and can ──────────────────────────────────
{
  const billing = strip(read("src/lib/stripe-billing.ts"));
  // Callable at all: without `username` in the select, hasMeshPro() cannot even
  // be applied to the row, which is how this shipped broken.
  const stateFn = /export async function getMeshProBillingState[\s\S]*?\n}/.exec(billing)?.[0] ?? "";
  if (!/username:\s*true/.test(stateFn)) {
    fail("7 billing", "getMeshProBillingState no longer selects username — hasMeshPro() cannot be called on the row, so /meshpro and /billing fall back to the raw column and show a founder the pricing grid");
  } else ok();
  if (!/hasMeshPro\(/.test(billing)) {
    fail("7 billing", "stripe-billing.ts no longer calls hasMeshPro — the two pages about a person's entitlement would read the column billing itself resets");
  } else ok();
}

// ── 8. Onboarding cannot hand out paid cosmetics ─────────────────────────────
//
// completeOnboarding was the one write path to meshiPreference that never
// consulted the gate. It let every new free account keep ~30 paid options, and
// then trapped them: the settings form resubmits all eight fields, the server
// refused the value it had itself written, and the free alternative was
// disabled in the picker. No way out from inside the product.
{
  const actions = strip(read("src/lib/actions.ts"));
  if (!/clampMeshiOptionsToFree\(/.test(actions)) {
    fail("8 onboarding", "the onboarding Meshi write no longer clamps to free options — a new free account can acquire paid cosmetics during signup");
  } else ok();
  // The trap: the gate must judge what is being ACQUIRED, not what is held.
  const gate = /function findLockedMeshiOptionForFreeUser\([\s\S]*?\n}/.exec(actions)?.[0] ?? "";
  if (!/current\[field\]/.test(gate)) {
    fail("8 onboarding", "the Meshi gate no longer compares against what is already stored — it would reject values the account already holds, locking those users out of every Meshi setting");
  } else ok();
}

if (failures.length) {
  console.error(`\nfounder-pro: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(`founder-pro: ${checks} assertions passed — @${FOUNDER_USERNAMES.join(", @")} have Mesh Pro for life.`);
