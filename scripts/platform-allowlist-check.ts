/**
 * MESH.ME OFFERS THE TWELVE US-POPULAR SOCIAL PLATFORMS. NOT THIRTY-SIX.
 *
 * There were two lists. `PLATFORM_CAPABILITIES` in platform-capabilities.ts had
 * 17 entries; `CATEGORY_BY_PLATFORM` in platform-adapters.ts had 36. They
 * disagreed about GitHub, Reddit, Behance, Substack, dev.to and a dozen others,
 * and which one a surface happened to read decided what a user saw on the
 * connect page.
 *
 * That is this codebase's recurring failure, and it has now caused: a
 * production outage (schema.prisma vs ensure-schema.sql), a paid feature that
 * ignored its own setting on the page selling it (three ranked surfaces listed,
 * a fourth forgotten), and a gold aura sold for months that nothing drew. Same
 * shape every time — two places state one fact, and only one is taught the rule.
 *
 * lib/platforms.ts is the fact. This asserts nothing else claims otherwise.
 *
 * ── WHAT THIS CANNOT PROVE ───────────────────────────────────────────────────
 *
 * That an allowed platform actually works. It checks the SET of platforms the
 * product offers, not whether connecting one succeeds or whether its content
 * ever arrives. A platform can be on the list, pass this gate, and have no
 * working integration at all — which is exactly true of several of them today.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { MESH_PLATFORM_IDS } from "../src/lib/platforms";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

// ── 1. The list itself is sane ───────────────────────────────────────────────
{
  if (MESH_PLATFORM_IDS.length < 9) {
    fail("1 the list", `only ${MESH_PLATFORM_IDS.length} platforms — the allow-list is broken, not the product`);
  } else ok();

  const dupes = MESH_PLATFORM_IDS.filter((id, i) => MESH_PLATFORM_IDS.indexOf(id) !== i);
  if (dupes.length) fail("1 the list", `duplicate ids: ${dupes.join(", ")}`);
  else ok();

  // Ids are storage keys: ConnectedAccount.platform, PlatformPost.platform and
  // PublicPost.platform all hold them, so a rename orphans real rows.
  const bad = MESH_PLATFORM_IDS.filter((id) => !/^[a-z]+$/.test(id));
  if (bad.length) fail("1 the list", `ids must be lowercase and unpunctuated (they are database values): ${bad.join(", ")}`);
  else ok();

  // The brief, verbatim: "only have the most popular social media apps in the
  // US". These twelve, EXACTLY — named individually so quietly dropping one
  // fails, and set-checked both ways so quietly ADDING one fails too, because
  // additions are what the brief forbids.
  const POPULAR_US = [
    "instagram", "facebook", "twitter", "threads", "snapchat", "reddit",
    "linkedin", "pinterest", "tiktok", "youtube", "twitch", "discord",
  ];
  for (const required of POPULAR_US) {
    if (!MESH_PLATFORM_IDS.includes(required)) {
      fail("1 the list", `"${required}" is one of the twelve US-popular platforms mesh.me is for, and it is not on the list`);
    } else ok();
  }
  const extras = MESH_PLATFORM_IDS.filter((id) => !POPULAR_US.includes(id));
  if (extras.length) {
    fail("1 the list", `extra platform(s) beyond the twelve: ${extras.join(", ")} — the brief is US-popular social apps ONLY`);
  } else ok();
}

// ── 2. Capabilities offer exactly the allow-list ─────────────────────────────
{
  const caps = strip(read("src/lib/platform-capabilities.ts"));
  if (!/isMeshPlatform/.test(caps)) {
    fail("2 one source", "platform-capabilities.ts does not filter through isMeshPlatform, so it can offer a platform the product does not have");
  } else ok();
  if (!/RAW_PLATFORM_CAPABILITIES/.test(caps)) {
    fail("2 one source", "the raw/filtered split is gone; the exported capability map is unfiltered again");
  } else ok();
}

// ── 3. No supply lane for a platform we do not offer ─────────────────────────
//
// A lane fetching Mastodon content into a product with no Mastodon is content
// from nowhere, attributed to a platform the user cannot connect, mute or
// reason about.
{
  const dir = "src/lib/public-supply/providers";
  const files = existsSync(join(ROOT, dir))
    ? readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".ts"))
    : [];

  if (files.length === 0) {
    fail("3 supply", `no provider files in ${dir} — either the supply layer is gone, or this gate cannot see it`);
  } else ok();

  for (const file of files) {
    const body = strip(read(`${dir}/${file}`));
    const platform = /platform:\s*"([a-z]+)"/.exec(body)?.[1];
    if (!platform) {
      fail("3 supply", `${dir}/${file} declares no platform`);
      continue;
    }
    if (!MESH_PLATFORM_IDS.includes(platform)) {
      fail("3 supply", `${dir}/${file} fetches "${platform}", which mesh.me does not offer. Content from a platform a user cannot connect, mute or reason about does not belong in their feed.`);
    } else ok();
  }
}

// ── 4. The status surface only speaks about platforms we offer ───────────────
{
  const registry = strip(read("src/lib/public-supply/registry.ts"));
  for (const m of registry.matchAll(/platform:\s*"([a-z]+)"/g)) {
    if (!MESH_PLATFORM_IDS.includes(m[1])) {
      fail("4 status", `the connect page would tell users about "${m[1]}", which is not a mesh.me platform`);
    } else ok();
  }
}

if (failures.length) {
  console.error(`\nplatform-allowlist: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(`platform-allowlist: ${checks} assertions passed — ${MESH_PLATFORM_IDS.length} platforms, one list, nothing else offered.`);
