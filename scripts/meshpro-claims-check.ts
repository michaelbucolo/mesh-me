/**
 * A PAID PROMISE MUST NAME THE CODE THAT KEEPS IT.
 *
 * /meshpro is the page people read before they hand over money. It shipped
 * with claims nothing enforced:
 *
 *   "…plus a subtle gold aura, live."   No CSS rule. No render path. The only
 *   trace in the whole codebase was a comment header in globals.css with
 *   nothing underneath it, and two more comments in the presence layer. The
 *   `isPro` flag travelled the entire pipeline — column, store, broadcast, and
 *   the roster's own change-detection key — and not one renderer read it. Sold
 *   for months; drawn never.
 *
 *   "Deeper analytics: audience overlap across platforms, longer history,
 *   exportable reports."   Three claims. Audience overlap was real and free to
 *   everyone. The export was the GDPR account dump — a legal right, not a
 *   perk, and also free. And "longer history" did not exist in any form:
 *   CHART_DAYS and METRIC_WINDOW_DAYS were flat module constants with no plan
 *   branch anywhere in the file.
 *
 *   "Aurora, Ember, Ocean, and Dawn skies over your mesh."   The four papers
 *   are really there and really Pro-gated, but their ids are internal: every
 *   label a person can read says Botanical, Kraft, Blueprint, Sunlit. The card
 *   named four things nobody could find, over a "sky" the design had already
 *   replaced with paper.
 *
 * Marketing copy is the cheapest thing in a repo to write and the least likely
 * to be revisited when the feature underneath it moves. This makes each claim
 * cost a file path and a symbol, and fails the build when either goes away.
 *
 * ── WHAT THIS CANNOT PROVE ───────────────────────────────────────────────────
 *
 * That the named code delivers what the sentence says. `enforcedIn` is a
 * pointer, not a proof: it catches a claim whose implementation was deleted or
 * renamed, not one whose implementation quietly stopped doing the thing. The
 * per-feature gates (studio-reach, founder-pro) are where behaviour is proved.
 * What this buys is that no claim can be added or kept without SOMETHING real
 * to point at, and that the pointer is checked on every build.
 */

import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const PAGE = "src/app/(app)/meshpro/page.tsx";
const page = read(PAGE);

// ── 1. Every unlock names where it is enforced ───────────────────────────────

/** Each `{ … }` object literal inside the `unlocks` array. */
function unlockEntries(src: string): string[] {
  const start = src.indexOf("const unlocks:");
  if (start < 0) return [];
  const open = src.indexOf("= [", start);
  if (open < 0) return [];
  // Walk to the matching close bracket so a nested object cannot end it early.
  let depth = 0;
  let end = -1;
  for (let i = open + 2; i < src.length; i += 1) {
    const c = src[i];
    if (c === "[") depth += 1;
    else if (c === "]") {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) return [];
  const body = src.slice(open + 3, end);

  const entries: string[] = [];
  let braceDepth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "{") { braceDepth += 1; if (braceDepth === 1) { current = ""; continue; } }
    if (ch === "}") { braceDepth -= 1; if (braceDepth === 0) { entries.push(current); continue; } }
    if (braceDepth > 0) current += ch;
  }
  return entries;
}

const entries = unlockEntries(page);

// The parser must be able to SEE. A clean report from a parser that found no
// claims is the exact shape of the bug this file exists to prevent.
if (entries.length < 4) {
  fail("1 catalogue", `only ${entries.length} unlock(s) parsed from ${PAGE} — the parser is broken, not the page`);
} else ok();

const title = (entry: string) => /title:\s*"([^"]+)"/.exec(entry)?.[1] ?? "<untitled>";

for (const entry of entries) {
  const name = title(entry);
  const file = /enforcedIn:\s*\{\s*file:\s*"([^"]+)"/.exec(entry)?.[1];
  const symbol = /symbol:\s*"([^"]+)"/.exec(entry)?.[1];

  if (!file || !symbol) {
    fail(
      "1 catalogue",
      `"${name}" is advertised on /meshpro with no enforcedIn — name the file and symbol that deliver it, ` +
      `or delete the claim. A promise with nothing to point at is how "a subtle gold aura" was sold for months without ever being drawn.`,
    );
    continue;
  }
  ok();

  if (!existsSync(join(ROOT, file))) {
    fail("2 pointer", `"${name}" claims to be enforced in ${file}, which does not exist`);
    continue;
  }
  ok();

  if (!new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(read(file))) {
    fail(
      "2 pointer",
      `"${name}" claims to be enforced by \`${symbol}\` in ${file}, and that symbol is not there. ` +
      `Either the feature moved and this pointer is stale, or the feature is gone and the claim should be too.`,
    );
  } else ok();
}

// ── 3. The claims that were false must not come back ─────────────────────────
//
// Named individually rather than by pattern: each was a specific untruth with
// a specific reason, and a regex broad enough to catch "aura" in general would
// also catch honest future copy.
//
// SCOPED TO WHAT A READER SEES. The first run of this section failed on the
// comments that explain why each phrase was removed — the words "gold aura",
// "audience overlap" and "exportable reports" all appear in the page's source
// as history. A gate that cannot tell copy from commentary would force the
// next person to delete the explanation in order to ship, which is how the
// reason gets lost and the claim comes back.
{
  const body = entries
    .flatMap((entry) => [/title:\s*"([^"]+)"/.exec(entry)?.[1], /body:\s*"([^"]+)"/.exec(entry)?.[1]])
    .filter(Boolean)
    .join("\n");

  // If the copy did not extract, every assertion below passes vacuously.
  if (body.length < 100) {
    fail("3 no relapse", `only ${body.length} characters of advertised copy extracted — the title/body reader is broken, so nothing below was actually checked`);
  } else ok();

  // The mesh's Meshis have weight and do not glow — globals.css says so twice,
  // once about the owner Meshi and once about nodes. The mark is a rim.
  if (/\baura\b/i.test(body)) {
    fail("3 no relapse", `/meshpro says "aura" again. The design rejected emission for these sprites ("a contact shadow, not an aura"); the MeshPro mark is a hairline rim (.meshi-pro-rim).`);
  } else ok();

  // Free for everyone. Selling it means either paywalling it — which makes the
  // product worse to make a sentence true — or lying.
  if (/audience overlap/i.test(body)) {
    fail("3 no relapse", `/meshpro sells "audience overlap" again. computeAudienceOverlap (analytics-dashboard.ts) runs for every account with no plan branch, so it is not a Pro perk.`);
  } else ok();

  // /api/data-controls?action=export is a data-protection right.
  if (/exportable reports?/i.test(body)) {
    fail("3 no relapse", `/meshpro sells "exportable reports" again. The only export is the full-account data dump at /api/data-controls, which is a legal right available to everyone, not an analytics report.`);
  } else ok();

  // The picker says Botanical / Kraft / Blueprint / Sunlit.
  for (const internal of ["Aurora", "Ember", "Ocean", "Dawn"]) {
    if (new RegExp(`\\b${internal}\\b`).test(body)) {
      fail("3 no relapse", `/meshpro advertises the paper "${internal}", which is an internal id (paint/papers.ts). Every label a person can read says Botanical, Kraft, Blueprint or Sunlit.`);
    } else ok();
  }
}

// ── 4. The gold rim is actually drawn ────────────────────────────────────────
//
// The specific defect, asserted specifically: a rule in the stylesheet, a
// colour token behind it in BOTH themes, and at least one renderer applying
// the class. Any one of the three missing puts the claim back where it was.
{
  const css = read("src/app/globals.css");
  const tokens = read("src/app/tokens.css");

  // Not merely "a rule with that selector exists": the two @media overrides
  // also match that, and they only retune --pro-gilt. Mutation-testing this
  // check caught exactly that — the drawing rule was disabled and the gate
  // still passed on the leftovers. What must exist is the declaration that
  // actually paints.
  const rimRule = /\.meshi-pro-rim\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  if (!rimRule) {
    fail("4 the rim", "there is no .meshi-pro-rim rule in globals.css — the MeshPro mark is a comment again");
  } else if (!/\bfilter\s*:/.test(rimRule) || !/drop-shadow\(/.test(rimRule)) {
    fail("4 the rim", ".meshi-pro-rim exists but declares no drop-shadow filter, so it selects a Meshi and draws nothing on it");
  } else if (!/var\(--meshpro-gilt\)/.test(rimRule)) {
    fail("4 the rim", ".meshi-pro-rim does not read var(--meshpro-gilt), so the rim is a hardcoded colour that cannot follow the theme");
  } else ok();

  // Both themes. One value would read as gold on one background and as mud on
  // the other, and the mesh is used in both.
  const gilt = tokens.match(/--meshpro-gilt:/g)?.length ?? 0;
  if (gilt < 2) {
    fail("4 the rim", `--meshpro-gilt is defined ${gilt} time(s) in tokens.css; it needs a light and a dark value, or the rim is invisible in one theme`);
  } else ok();

  // THE COUNT GOES BACK TO FOUR, BECAUSE THE FOUR DRAW SITES ARE BACK.
  //
  // While the tile layout owned /mesh this read meshfield/mesh-field.tsx and
  // asked only for `>= 1`, with the reasoning that the field rendered every
  // Meshi through a SINGLE element so the divergence could not happen. That
  // reasoning was sound for the field and is simply not true of the canvas,
  // which is what /mesh mounts again: mesh/live/meshi-layer.tsx draws a Meshi
  // at FOUR independent sites — a remote visitor, the mesh owner at the heart,
  // the viewer's own wandering one, and a departing visitor mid-fade. Each
  // needs the rim on its own; miss one and the mark blinks out depending on
  // who is looking, which is the exact bug the four was chosen to catch.
  //
  // So the threshold is not a style preference that got tightened — it is a
  // count of how many places the code can get this wrong, and the code went
  // back to having four of them.
  const layer = read("src/components/mesh/live/meshi-layer.tsx");
  const applications = layer.match(/meshi-pro-rim/g)?.length ?? 0;
  if (applications < 4) {
    fail(
      "4 the rim",
      `meshi-layer.tsx applies .meshi-pro-rim ${applications} time(s); every Meshi it draws needs it (remote visitor, mesh owner, your own, and one leaving) or the mark blinks out depending on who is looking`,
    );
  } else ok();

  // The whole point is that the server decides. A client-side guess about who
  // is Pro is how a cosmetic becomes a lie.
  if (!/p\.isPro/.test(layer)) {
    fail("4 the rim", "meshi-layer.tsx no longer reads isPro off the presence entry, so remote members' marks are not server-authoritative");
  } else ok();
}

// ── 5. Pro's analytics window is genuinely longer ────────────────────────────
{
  const analytics = read("src/lib/analytics-dashboard.ts");
  // Not `export function`: it has one caller, in its own module, so exporting
  // it only to satisfy this gate would be a dead export that knip rightly
  // rejects. The gate follows the code, not the other way round.
  const fn = /\bfunction analyticsWindow\([\s\S]*?\n\}/.exec(analytics)?.[0] ?? "";
  if (!fn) {
    fail("5 longer memory", "analyticsWindow is gone — /meshpro sells 'a year of your analytics' with nothing deciding the window");
  } else {
    ok();
    if (!/isPro\s*\?/.test(fn)) {
      fail("5 longer memory", "analyticsWindow does not branch on isPro; the window is flat again, which is exactly what the old 'longer history' claim was lying about");
    } else ok();
  }

  // The window must actually reach the queries, not just exist.
  if (!/analyticsWindow\(hasMeshPro\(user\)\)/.test(analytics)) {
    fail("5 longer memory", "the dashboard loader does not resolve the window from hasMeshPro(user), so a founder's derived membership or a paid one would not widen anything");
  } else ok();

  // A chart with more slots than the query filled reads as "you did nothing".
  if (/makeSeries\(\)/.test(analytics)) {
    fail("5 longer memory", "makeSeries() is called with no window; the series length and the query window must come from the same resolve or the chart shows empty days that were never queried");
  } else ok();
}

// ── 6. The gift card keeps the same contract as the unlocks ──────────────────
//
// "Give MeshPro" is the one card on the page you buy FOR someone else, and it
// is exactly as capable of rotting: a card pointing at a delivery path that
// was renamed or deleted is money taken with nothing granted. Same rule, same
// cost — the claim names a file and a symbol, and both must exist.
{
  const gift = /const giftCard\s*=\s*\{[\s\S]*?\n\};/.exec(page)?.[0] ?? "";
  if (!gift) {
    fail("6 gift", `no giftCard const found in ${PAGE} — if gifting was removed, remove this section with it; if it moved, point this gate at it`);
  } else {
    ok();
    const file = /enforcedIn:\s*\{\s*file:\s*"([^"]+)"/.exec(gift)?.[1];
    const symbol = /symbol:\s*"([^"]+)"/.exec(gift)?.[1];
    if (!file || !symbol) {
      fail("6 gift", `the gift card has no enforcedIn — name the code that actually grants a purchased gift, or delete the card`);
    } else if (!existsSync(join(ROOT, file))) {
      fail("6 gift", `the gift card claims to be enforced in ${file}, which does not exist`);
    } else if (!new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(read(file))) {
      fail("6 gift", `the gift card claims \`${symbol}\` in ${file}, and that symbol is not there — the pointer is stale or the grant path is gone`);
    } else ok();
    // The card must actually render FROM the const, or the pointer checks a
    // literal nobody displays while the visible card drifts free.
    if (!/giftCard\.href/.test(page) || !/giftCard\.title/.test(page)) {
      fail("6 gift", "the page no longer renders from the giftCard const — the checked claim and the visible card have come apart");
    } else ok();
  }
}

if (failures.length) {
  console.error(`\nmeshpro-claims: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(`meshpro-claims: ${checks} assertions passed — ${entries.length} advertised unlocks (and the gift card), every one pointing at code that exists.`);
