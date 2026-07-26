/**
 * YOUR ALGORITHM, ON EVERY SURFACE THAT RANKS — AND ON YOUR NEXT PHONE.
 *
 * /meshpro sells Algorithm Studio as "Five sliders that set the exact weights
 * your Flow ranks by. Your algorithm, literally." It failed that twice.
 *
 *   IT DID NOT REACH THE FEED. `api/flow/route.ts` passed `{ seen, limit, mode,
 *   studio }` to rankFlowPosts. `feed/page.tsx` and
 *   `api/feed/paginated/route.ts` called the SAME ranker with `{ limit }` and no
 *   studio. So a member's weights governed /flow and were silently ignored on
 *   /feed — the surface most people open first — and on every later page of it.
 *
 *   IT DID NOT SURVIVE THE DEVICE. The weights lived in localStorage
 *   (flow-client.tsx). The paid control was stored where free things live: a new
 *   phone, a different browser or a cleared cache reset it, with no way back.
 *
 * The shape that fixes both is one resolver. `resolveStudioWeights(user, param)`
 * decides the entitlement and the source in a single place, so three call sites
 * cannot drift apart again, and the account column is the record while
 * localStorage is only a cache.
 *
 * ── WHAT THIS CANNOT PROVE ───────────────────────────────────────────────────
 *
 * That the ranking OUTPUT actually differs — that needs a seeded database with
 * enough candidates for the weights to reorder anything, and the seed has 15
 * posts sharing one timestamp. It proves the weights reach every ranker and that
 * only the server decides who may have them.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeStudioWeights, resolveStudioWeights } from "../src/lib/flow-ranking";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

/** Every server path that ranks the merged feed for a signed-in person. */
const RANKED_SURFACES = [
  "src/app/api/flow/route.ts",
  "src/app/(app)/feed/page.tsx",
  "src/app/api/feed/paginated/route.ts",
];

// ── 1. The resolver decides the entitlement, not the caller ──────────────────
{
  const MIX = JSON.stringify({ relationships: 60, recency: 40, discovery: 70, interests: 55, variety: 45 });

  if (resolveStudioWeights(null) !== null) fail("1 entitlement", "a signed-out viewer resolved to studio weights");
  else ok();

  // A free account cannot have them, however they arrive.
  const free = { username: "someone", isMeshPro: false, flowStudio: MIX };
  if (resolveStudioWeights(free) !== null) fail("1 entitlement", "a free account's stored weights were honoured");
  else ok();
  if (resolveStudioWeights(free, MIX) !== null) fail("1 entitlement", "a free account tuned the ranker by passing weights in the request");
  else ok();

  // A paying account gets the stored mix.
  const pro = { username: "someone", isMeshPro: true, flowStudio: MIX };
  if (resolveStudioWeights(pro)?.discovery !== 70) fail("1 entitlement", "a member's stored mix was not applied");
  else ok();

  // A founder has MeshPro derived, not stored — the same rule must hold here.
  const founder = { username: "michaelbucolo", isMeshPro: false, flowStudio: MIX };
  if (resolveStudioWeights(founder)?.discovery !== 70) fail("1 entitlement", "a founder's stored mix was ignored because the column says false");
  else ok();

  // The live parameter wins, so a slider is not one request behind itself.
  const other = JSON.stringify({ relationships: 10, recency: 90, discovery: 10, interests: 10, variety: 10 });
  if (resolveStudioWeights(pro, other)?.recency !== 90) fail("1 entitlement", "an explicit request parameter did not take precedence over the stored mix");
  else ok();

  // Garbage falls back rather than throwing or half-applying.
  if (resolveStudioWeights(pro, "not json")?.discovery !== 70) fail("1 entitlement", "an unparseable parameter did not fall back to the stored mix");
  else ok();
  if (resolveStudioWeights({ username: "x", isMeshPro: true, flowStudio: "{{{" }) !== null) fail("1 entitlement", "an unparseable stored value did not resolve to null");
  else ok();

  // Out-of-range values are clamped, never trusted.
  const wild = normalizeStudioWeights(JSON.stringify({ relationships: 9999, recency: -50, discovery: 1, interests: 1, variety: 1 }));
  if (!wild || wild.relationships !== 100 || wild.recency !== 0) {
    fail("1 entitlement", `weights are not clamped to 0..100 — got ${JSON.stringify(wild)}`);
  } else ok();
}

// ── 2. Every ranked surface asks for the mix ─────────────────────────────────
{
  for (const file of RANKED_SURFACES) {
    const body = strip(read(file));
    if (!/rankFlowPosts\(/.test(body)) {
      fail("2 reach", `${file} no longer calls rankFlowPosts; this gate's list of ranked surfaces is stale and proved nothing`);
      continue;
    }
    ok();
    if (!/resolveStudioWeights\(/.test(body)) {
      fail("2 reach", `${file} ranks the feed without resolving the member's Studio mix — this is exactly how the weights governed /flow and were ignored on /feed`);
    } else ok();
  }
}

// ── 3. No surface decides the entitlement for itself ─────────────────────────
//
// The Flow used to read `(user as { isMeshPro?: boolean }).isMeshPro === true`
// inline. One resolver means one answer; an entitlement each call site
// re-derives is an entitlement that eventually differs between them.
{
  for (const file of RANKED_SURFACES) {
    const body = strip(read(file));
    if (/normalizeStudioWeights\(/.test(body)) {
      fail("3 one decider", `${file} normalises studio weights directly instead of going through resolveStudioWeights, so it decides the entitlement itself`);
    } else ok();
  }
}

// ── 4. The account is the record, localStorage is a cache ────────────────────
{
  const client = strip(read("src/app/(app)/flow/flow-client.tsx"));
  if (!/setFlowStudioWeights\(/.test(client)) {
    fail("4 persistence", "the Flow client no longer writes the Studio mix to the account; the weights would be lost on a new device again");
  } else ok();

  const actions = strip(read("src/lib/actions.ts"));
  const fn = /export async function setFlowStudioWeights\([\s\S]*?\n\}/.exec(actions)?.[0] ?? "";
  if (!fn) {
    fail("4 persistence", "setFlowStudioWeights is gone");
  } else {
    ok();
    if (!/hasMeshPro\(/.test(fn)) {
      fail("4 persistence", "setFlowStudioWeights does not check entitlement server-side; a free account could persist a paid control");
    } else ok();
    if (!/normalizeStudioWeights\(/.test(fn)) {
      fail("4 persistence", "setFlowStudioWeights writes without validating; the column must only ever hold five clamped integers");
    } else ok();
    // Re-serialise from the parsed value, so the stored string cannot be
    // whatever the client sent.
    if (!/JSON\.stringify\(weights\)/.test(fn)) {
      fail("4 persistence", "setFlowStudioWeights stores the raw input rather than the parsed-and-clamped value");
    } else ok();
  }
}

if (failures.length) {
  console.error(`\nstudio-reach: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(`studio-reach: ${checks} assertions passed — one resolver, every ranked surface, stored on the account.`);
