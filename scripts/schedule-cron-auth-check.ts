/**
 * THE SCHEDULER'S DOOR — an unforgeable, session-free, GET-only wall.
 *
 * The failure shapes this gate exists to catch:
 *
 *   - THE OPEN DOOR: `"" === ""` — secret never configured, empty header,
 *     route wide open. Unset env must DISABLE the route, loudly.
 *   - THE TIMING ORACLE: a === comparison leaks the secret byte by byte.
 *     The compare is length-pre-checked timingSafeEqual, in ONE shared
 *     module, so a second cron route cannot reinvent it weaker.
 *   - THE SESSION PATH: a cron route that also answers to cookies is a CSRF
 *     surface (the P0 the public-supply route documents). Nothing here may
 *     import getCurrentUser; non-GET verbs answer 405 with Allow: GET.
 *
 * WHAT THIS CANNOT PROVE: runtime timing itself (source text, not a timing
 * harness); that Vercel actually sends the header (deployment config).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cronSecretMatches } from "../src/lib/cron-secret";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const route = strip(read("src/app/api/compose/scheduler/route.ts"));
const secretLib = strip(read("src/lib/cron-secret.ts"));

// ── 1. The comparison, truth-tabled ──────────────────────────────────────────
{
  if (cronSecretMatches("s3cret", undefined) !== false || cronSecretMatches("s3cret", "") !== false) {
    fail("1 compare", "an unset/empty secret does not refuse — the route would be open the day the env var is forgotten");
  } else ok();
  if (cronSecretMatches("", "s3cret") !== false || cronSecretMatches(null, "s3cret") !== false) {
    fail("1 compare", "an empty/missing header passes");
  } else ok();
  if (cronSecretMatches("", "") !== false) {
    fail("1 compare", "the classic empty-vs-empty trap is open");
  } else ok();
  if (cronSecretMatches("s3cret-but-longer", "s3cret") !== false) {
    fail("1 compare", "a wrong-length presentation passes (or throws)");
  } else ok();
  if (cronSecretMatches("s3creT", "s3cret") !== false) {
    fail("1 compare", "a one-byte near-miss passes");
  } else ok();
  if (cronSecretMatches("s3cret", "s3cret") !== true) {
    fail("1 compare", "the exact secret is refused");
  } else ok();
  if (cronSecretMatches("Bearer s3cret", "s3cret") !== true || cronSecretMatches("bearer s3cret", "s3cret") !== true) {
    fail("1 compare", "the Bearer prefix Vercel attaches is not accepted");
  } else ok();
  // The compare itself is constant-time on the equal-length path.
  if (!/timingSafeEqual/.test(secretLib) || !/a\.length !== b\.length/.test(secretLib)) {
    fail("1 compare", "cron-secret.ts lost timingSafeEqual or its length pre-check");
  } else ok();
}

// ── 2. One wall, no second door ──────────────────────────────────────────────
{
  if (!/cronSecretMatches\(header, process\.env\.SCHEDULE_CRON_SECRET\)/.test(route) ||
      !/cronSecretMatches\(header, process\.env\.CRON_SECRET\)/.test(route)) {
    fail("2 wall", "the route no longer authenticates via the shared compare against SCHEDULE_CRON_SECRET with the CRON_SECRET fallback");
  } else ok();
  if (/timingSafeEqual|===\s*process\.env/.test(route)) {
    fail("2 wall", "the route reinvented the comparison inline — the shared module is the only compare");
  } else ok();
  if (!/status: 401/.test(route)) {
    fail("2 wall", "a bad secret no longer answers 401");
  } else ok();
  if (/getCurrentUser|mesh_session|cookies\(/.test(route)) {
    fail("2 wall", "the scheduler route grew a session path — the CSRF surface public-supply documents as a P0");
  } else ok();
  if (!/status: 405/.test(route) || !/Allow: "GET"/.test(route)) {
    fail("2 wall", "non-GET verbs no longer answer 405 with Allow: GET");
  } else ok();
  for (const verb of ["POST", "PUT", "PATCH", "DELETE"]) {
    if (!new RegExp(`export const ${verb} = methodNotAllowed`).test(route)) {
      fail("2 wall", `${verb} is no longer pinned to methodNotAllowed`);
    } else ok();
  }
  // Counts only in the response — never content or usernames.
  if (/username|\.text|title/.test(route.match(/return NextResponse\.json\(\{ ok: true[\s\S]*?\);/)?.[0] ?? "")) {
    fail("2 wall", "the tick response leaks more than counts");
  } else ok();
}

// ── 3. The clock is wired ────────────────────────────────────────────────────
{
  const vercel = read("vercel.json");
  if (!/"path": "\/api\/compose\/scheduler"/.test(vercel)) {
    fail("3 wiring", "vercel.json lost the scheduler cron — nothing ever ticks in production");
  } else ok();
  if (!/"path": "\/api\/public-supply\/refresh"/.test(vercel)) {
    fail("3 wiring", "the public-supply cron vanished while wiring the scheduler");
  } else ok();
  if (!/export const maxDuration = 60/.test(route) || !/force-dynamic/.test(route)) {
    fail("3 wiring", "the route lost force-dynamic or its maxDuration bound");
  } else ok();
}

if (failures.length) {
  console.error(`\nschedule-cron-auth: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`schedule-cron-auth: all ${checks} assertions passed — the tick's door fails closed, answers one verb, and rides no session.`);
