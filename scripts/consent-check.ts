// Consent gate for the three DataVisibilityPolicy switches
// (`npm run consent:check`).
//
// THE CONTRACT THIS PINS. The privacy control center shows one dropdown per
// data category; the client expands each choice into `allowDiscovery`,
// `allowAnalytics` and `allowMeshiUse` on DataVisibilityPolicy. Those three
// booleans were written and echoed back to the UI but never read by any query,
// so three switches promised control and delivered none. src/lib/consent.ts is
// now the single definition of each, and this gate keeps it that way:
//
//   profile      → allowDiscovery gates the USER appearing in people discovery
//   native_posts → allowDiscovery gates their NATIVE POSTS appearing in content
//                  discovery
//   analytics    → allowAnalytics gates building the private analytics dashboard
//   meshi_memory → allowMeshiUse gates Meshi reading a user's mesh, in both
//                  directions (their own chat, and anyone else asking about them)
//
// ── WHAT THIS GATE ACTUALLY COVERS ──────────────────────────────────────────
//
//   1. BEHAVIOUR of the pure helpers: that an absent policy reads as permissive
//      and a denying row reads as a denial, and that each filter fragment is
//      built as `none: { ... flag: false }` (never `some: { flag: true }`, which
//      would deny everyone who never opened the privacy centre), pinned to the
//      right entityType with `entityId: null`.
//   2. COVERAGE of discovery reads, by source text: every `showInDiscovery: true`
//      in a server-side Prisma filter must sit in an object literal that also
//      spreads a consent fragment. `showInDiscovery` is the account-wide
//      discovery switch, so any new query that needs it needs the per-category
//      one too — that is what makes this catch discovery paths written later.
//      Everything not gated must be named in EXPECTED_UNGATED below with a
//      reason, and the counts must match exactly, so adding an ungated read to
//      an already-listed file still fails.
//   3. CHOKEPOINTS: named call sites that must keep calling a named gate
//      (the analytics loader, the Meshi chat route, the Meshi person resolver).
//   4. SINGLE DEFINITION: no module other than src/lib/consent.ts may put these
//      three columns into a Prisma filter, so the gates cannot drift apart.
//
// ── WHAT THIS GATE CANNOT COVER — read this before trusting it ──────────────
//
//   * It is source-text matching plus unit assertions, NOT dataflow analysis.
//     It reads balanced braces, not a TypeScript AST, so a filter built up
//     dynamically (`const w = {...}; if (x) w.showInDiscovery = true`), or
//     assembled across files, or passed through a helper, is invisible to it.
//   * It only reasons about discovery reads that use `showInDiscovery`. A brand
//     new discovery surface that never mentions `showInDiscovery` — say one
//     keyed on `isPublic` alone — will NOT be caught. Item 2 is a ratchet on a
//     known pattern, not a proof of completeness.
//   * It cannot check analytics or Meshi coverage the same way, because those
//     have no equivalent account-wide column to anchor on. For them it can only
//     assert that the specific chokepoints in item 3 still call their gate; a
//     newly added analytics aggregate or Meshi read path is NOT detected.
//   * It runs without a database, so it proves the SHAPE of each filter, not
//     that Prisma resolves it as intended against real rows.
//
// Runs standalone (no DOM, no DB): `npm run consent:check`.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  hasAnalyticsConsent,
  hasMeshiConsent,
  meshiConsentWhere,
  nativePostDiscoveryConsentWhere,
  policyGrants,
  profileDiscoveryConsentWhere,
} from "../src/lib/consent";

const ROOT = join(__dirname, "..");
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");

// ---------------------------------------------------------------------------
// 1. Absent policy is PERMISSIVE; only an explicit false denies.
// ---------------------------------------------------------------------------

assert.equal(policyGrants(null, "allowDiscovery"), true, "no policy row must read as consent (nothing was asked)");
assert.equal(policyGrants(undefined, "allowAnalytics"), true, "an unset policy must read as consent");
assert.equal(policyGrants({}, "allowMeshiUse"), true, "a row that never stored the flag must read as consent");
assert.equal(policyGrants({ allowDiscovery: true }, "allowDiscovery"), true, "an explicit grant is a grant");
assert.equal(policyGrants({ allowDiscovery: false }, "allowDiscovery"), false, "an explicit denial is a denial");
assert.equal(policyGrants({ allowAnalytics: false }, "allowAnalytics"), false, "analytics denial is honored");
assert.equal(policyGrants({ allowMeshiUse: false }, "allowMeshiUse"), false, "Meshi denial is honored");
// Flags must not bleed across each other — one switch off is not all switches off.
assert.equal(policyGrants({ allowDiscovery: false }, "allowAnalytics"), true, "discovery denial must not deny analytics");
assert.equal(policyGrants({ allowMeshiUse: false }, "allowDiscovery"), true, "Meshi denial must not deny discovery");

// ---------------------------------------------------------------------------
// 2. Filter fragments: the right flag, on the right category, fail-open shape.
// ---------------------------------------------------------------------------

type Fragment = { dataVisibilityPolicies: { none: Record<string, unknown> } };

function assertFragment(
  fragment: Fragment,
  expected: { entityType: unknown; flag: string },
  label: string,
) {
  const none = fragment.dataVisibilityPolicies?.none;
  assert.ok(none, `${label}: must filter through dataVisibilityPolicies.none`);
  // `none` is what makes an absent row permissive. `some: { flag: true }` would
  // read as "must have opted in" and silently delete every account that never
  // opened the privacy centre from discovery — the exact failure this whole
  // change exists to avoid.
  assert.ok(
    !("some" in fragment.dataVisibilityPolicies) && !("every" in fragment.dataVisibilityPolicies),
    `${label}: must use none (fail-open), never some/every`,
  );
  assert.deepEqual(none.entityType, expected.entityType, `${label}: must pin its own category`);
  assert.equal(none.entityId, null, `${label}: category rules are the entityId-less rows`);
  assert.equal(none[expected.flag], false, `${label}: must match on ${expected.flag} === false`);
  // Exactly one consent column per fragment: reading a flag outside the
  // category its switch governs would enforce a placeholder, not a choice.
  const flags = ["allowDiscovery", "allowAnalytics", "allowMeshiUse"].filter((f) => f in none);
  assert.deepEqual(flags, [expected.flag], `${label}: must read only ${expected.flag}`);
}

assertFragment(profileDiscoveryConsentWhere(), { entityType: "profile", flag: "allowDiscovery" }, "profile discovery");
assertFragment(
  nativePostDiscoveryConsentWhere(),
  { entityType: "native_posts", flag: "allowDiscovery" },
  "native post discovery",
);
assertFragment(
  meshiConsentWhere(),
  { entityType: { in: ["meshi_memory", "meshi_ai"] }, flag: "allowMeshiUse" },
  "meshi use",
);
// The pre-rename spelling is still on disk, so every Meshi read has to accept both.
assert.deepEqual(
  meshiConsentWhere().dataVisibilityPolicies.none.entityType,
  { in: ["meshi_memory", "meshi_ai"] },
  "the legacy meshi_ai category must still be honored",
);

assert.equal(typeof hasAnalyticsConsent, "function", "analytics consent must be resolved server-side");
assert.equal(typeof hasMeshiConsent, "function", "Meshi consent must be resolved server-side");

// ---------------------------------------------------------------------------
// 3. Discovery coverage: every showInDiscovery filter carries its category rule.
// ---------------------------------------------------------------------------

// Only these two govern DISCOVERY. meshiConsentWhere() is a different switch;
// a discovery read gated solely by it enforces the wrong person's choice.
const DISCOVERY_FRAGMENTS = [
  "profileDiscoveryConsentWhere",
  "nativePostDiscoveryConsentWhere",
];

// Which discovery rule each gated site must use, pinned by exact count. The
// Profile rule governs finding a PERSON; the Mesh.me-posts rule governs finding
// their POSTS. Swapping them compiles, passes types, and silently moves a
// person onto a switch they did not operate — so it is pinned, not inferred.
const EXPECTED_GATED: { key: string; count: number }[] = [
  { key: "src/app/api/meshi/actions/route.ts:profileDiscoveryConsentWhere", count: 1 },
  // Composed through OR with an existing-follow exemption, not spread flat: the
  // Profile rule governs being FOUND by someone who does not know you, and this
  // endpoint also feeds MeChat's new-conversation picker.
  { key: "src/app/api/search/users/route.ts:profileDiscoveryConsentWhere", count: 1 },
  // Composed through AND with meshiConsentWhere(): both fragments key on
  // `dataVisibilityPolicies`, so spreading them side by side would silently drop
  // the first and Meshi would answer for accounts that switched discovery off.
  { key: "src/lib/meshi-engine.ts:profileDiscoveryConsentWhere", count: 1 },
  { key: "src/lib/feed-data.ts:nativePostDiscoveryConsentWhere", count: 1 },
  { key: "src/lib/global-mesh.ts:profileDiscoveryConsentWhere", count: 1 },
  { key: "src/lib/queries.ts:nativePostDiscoveryConsentWhere", count: 3 },
  { key: "src/lib/queries.ts:profileDiscoveryConsentWhere", count: 2 },
];

const observedGated = new Map<string, number>();

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

const CONSENT_FRAGMENTS = [
  "profileDiscoveryConsentWhere",
  "nativePostDiscoveryConsentWhere",
  "meshiConsentWhere",
];

// Server-side files that legitimately mention `showInDiscovery: true` WITHOUT a
// consent fragment, with the reason and the exact number of such occurrences.
// A mismatch fails the build: adding an ungated discovery read to a file that is
// already listed still trips the count.
const EXPECTED_UNGATED: Array<{ file: string; count: number; why: string }> = [
  {
    file: "src/components/onboarding/onboarding-flow.tsx",
    count: 1,
    why: "client-side form default for the signup toggle — not a Prisma filter",
  },
  {
    file: "src/lib/actions.ts",
    count: 2,
    why: "one account-creation default write, one `select` of the caller's own flags — neither reads other people",
  },
  {
    file: "src/lib/global-mesh.ts",
    count: 3,
    why: "imported platform-post supply (x2, governed by PlatformPost.visibility) and a self-preview `select`",
  },
  {
    file: "src/lib/feed-data.ts",
    count: 2,
    why: "imported platform-post discovery, governed by the already-enforced PlatformPost.visibility",
  },
  {
    file: "src/lib/queries.ts",
    count: 1,
    why: "searchAll's imported platform-post lane, governed by PlatformPost.visibility",
  },
  {
    file: "src/app/api/mechat/sessions/route.ts",
    count: 1,
    why: "MeChat invite reachability — a permission check on a known id, not a discovery listing",
  },
  {
    file: "src/app/api/mechat/sessions/[sessionId]/route.ts",
    count: 1,
    why: "MeChat invite reachability for a single named user",
  },
  {
    file: "src/app/(app)/messages/[threadId]/page.tsx",
    count: 1,
    why: "share-preview of one imported platform post already sent into a thread",
  },
];

/**
 * The object literal directly enclosing `index`, by balanced braces. Good
 * enough for the query literals in this repo and deliberately dumb — see the
 * coverage caveats in the header.
 */
/**
 * Blank out comments while preserving offsets, so a fragment name quoted in a
 * `// TODO: re-add ...ConsentWhere()` note can never be mistaken for a live gate.
 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

function enclosingObjectLiteral(source: string, index: number): string {
  let depth = 0;
  let start = -1;
  for (let i = index; i >= 0; i -= 1) {
    const ch = source[i];
    if (ch === "}") depth += 1;
    else if (ch === "{") {
      if (depth === 0) {
        start = i;
        break;
      }
      depth -= 1;
    }
  }
  if (start === -1) return "";

  let open = 0;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") open += 1;
    else if (ch === "}") {
      open -= 1;
      if (open === 0) return source.slice(start, i + 1);
    }
  }
  return source.slice(start);
}

const sourceFiles = execFileSync("git", ["ls-files", "src"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  // `git ls-files` still lists a file deleted but not yet staged, so a gate run
  // mid-refactor would die on ENOENT instead of reporting anything.
  .filter((f) => f && existsSync(join(ROOT, f)))
  .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));

const ungatedByFile = new Map<string, number>();
let gatedCount = 0;

for (const file of sourceFiles) {
  const source = read(file);
  if (!source.includes("showInDiscovery: true")) continue;

  let from = 0;
  for (;;) {
    const index = source.indexOf("showInDiscovery: true", from);
    if (index === -1) break;
    from = index + 1;

    // Skip prose: the fragments are documented in comments that quote the clause.
    const lineText = source.slice(source.lastIndexOf("\n", index) + 1, source.indexOf("\n", index)).trim();
    if (lineText.startsWith("//") || lineText.startsWith("*")) continue;

    const literal = stripComments(enclosingObjectLiteral(source, index));
    // A fragment counts only when it is CALLED in live code — spread into the
    // filter, or composed through AND:/OR:. Three ways a read used to pass while
    // enforcing nothing, each reproduced against this repo:
    //   - the name sitting in a `// TODO: re-add ...ConsentWhere()` comment,
    //   - a fragment under `NOT: { ... }`, which returns exactly the accounts
    //     that opted OUT — the precise inverse of the promise,
    //   - the wrong switch's fragment, e.g. a people-search gated on
    //     meshiConsentWhere(), so the Profile rule enforces nothing while the
    //     Meshi rule silently removes people from search.
    const present = CONSENT_FRAGMENTS.filter((fragment) =>
      new RegExp(String.raw`\b${fragment}\s*\(`).test(literal),
    );
    const inverted = present.some((fragment) =>
      new RegExp(String.raw`NOT\s*:\s*\{[^{}]*\b${fragment}\s*\(`).test(literal),
    );
    assert.ok(
      !inverted,
      `${file}:${lineOf(source, index)}: a consent fragment sits under NOT: — that returns ONLY\n` +
        `  the accounts which opted out, the exact inverse of what the switch promises.`,
    );

    const discovery = present.filter((fragment) => DISCOVERY_FRAGMENTS.includes(fragment));
    if (present.length > 0) {
      assert.ok(
        discovery.length > 0,
        `${file}:${lineOf(source, index)}: this discovery read is gated only by ${present.join(" + ")}.\n` +
          `  meshiConsentWhere() governs the Meshi rule, not discovery — gating a discovery read on\n` +
          `  it means the switch the person actually operated enforces nothing, while an unrelated\n` +
          `  one silently filters. Use profileDiscoveryConsentWhere() or nativePostDiscoveryConsentWhere().`,
      );
      // Which of the two discovery rules applies is not inferable from the query
      // shape — `user: {}` means "post author" in a post query and "member" in a
      // membership query — so it is pinned per site instead of guessed.
      const key = `${file}:${discovery.slice().sort().join("+")}`;
      observedGated.set(key, (observedGated.get(key) ?? 0) + 1);
      gatedCount += 1;
    } else {
      ungatedByFile.set(file, (ungatedByFile.get(file) ?? 0) + 1);
    }
  }
}

const expectedByFile = new Map(EXPECTED_UNGATED.map((entry) => [entry.file, entry]));

for (const [file, count] of [...ungatedByFile].sort()) {
  const expected = expectedByFile.get(file);
  assert.ok(
    expected,
    `${file} filters on showInDiscovery without a per-category consent fragment.\n` +
      `  Discovery reads must also honor the privacy centre's Profile / Mesh.me posts rules —\n` +
      `  spread profileDiscoveryConsentWhere() or nativePostDiscoveryConsentWhere() from\n` +
      `  src/lib/consent.ts into the same filter. If this read genuinely is not a discovery\n` +
      `  listing, add it to EXPECTED_UNGATED in scripts/consent-check.ts with the reason.`,
  );
  assert.equal(
    count,
    expected.count,
    `${file}: expected ${expected.count} ungated showInDiscovery read(s) (${expected.why}), found ${count}.\n` +
      `  A new one needs either a consent fragment or an updated reason here.`,
  );
}

for (const entry of EXPECTED_UNGATED) {
  assert.ok(
    ungatedByFile.has(entry.file),
    `${entry.file} no longer has an ungated showInDiscovery read — drop its stale EXPECTED_UNGATED entry.`,
  );
}

// Gated reads are pinned by EXACT count per (file, rule), not by a floor. A
// floor only catches deletion; an exact count also catches a gate swapped for
// the OTHER discovery rule, which compiles and typechecks but moves a person
// onto a switch they never operated. Both directions must be deliberate.
const expectedGatedByKey = new Map(EXPECTED_GATED.map((e) => [e.key, e.count]));

for (const [key, count] of [...observedGated].sort()) {
  const expected = expectedGatedByKey.get(key);
  const [file, rule] = key.split(/:(?=[a-zA-Z]+ConsentWhere)/);
  assert.ok(
    expected !== undefined,
    `${file} now gates a discovery read with ${rule}, which is not in EXPECTED_GATED.\n` +
      `  If that is the right rule for this surface, add it to scripts/consent-check.ts.\n` +
      `  If the read moved between the Profile rule and the Mesh.me-posts rule, that is a\n` +
      `  change in which switch governs it — say so deliberately.`,
  );
  assert.equal(
    count,
    expected,
    `${file}: expected ${expected} discovery read(s) gated by ${rule}, found ${count}.`,
  );
}

for (const { key, count } of EXPECTED_GATED) {
  assert.equal(
    observedGated.get(key) ?? 0,
    count,
    `${key} is pinned at ${count} gated read(s) but ${observedGated.get(key) ?? 0} were found —\n` +
      "  a gated read was deleted, renamed, or re-pointed at the other discovery rule.",
  );
}

assert.ok(
  gatedCount >= 10,
  `only ${gatedCount} discovery reads still carry a consent fragment (expected at least 10).`,
);

// ---------------------------------------------------------------------------
// 4. Chokepoints: the reads that have no showInDiscovery anchor to ratchet on.
// ---------------------------------------------------------------------------

const analyticsSource = read("src/lib/analytics-dashboard.ts");
assert.match(
  analyticsSource,
  /hasAnalyticsConsent\(user\.id\)/,
  "the analytics dashboard loader must resolve allowAnalytics before building the dashboard",
);
// Anchored on the CALL, not the bare identifier: the identifier's first
// occurrence is the import on line 2, which made this comparison true no matter
// where — or whether — the check actually ran.
const analyticsGateAt = analyticsSource.indexOf("hasAnalyticsConsent(user.id)");
const analyticsScanAt = analyticsSource.indexOf("loadAnalyticsDashboard(user)");
assert.ok(analyticsGateAt !== -1, "analytics consent gate call site not found");
assert.ok(analyticsScanAt !== -1, "loadAnalyticsDashboard(user) call site not found");
assert.ok(
  analyticsGateAt < analyticsScanAt,
  "the analytics consent check must precede (and skip) the 30+ query scan, not filter its output",
);

const chatSource = read("src/app/api/meshi/chat/route.ts");
assert.match(chatSource, /hasMeshiConsent\(user\.id\)/, "the Meshi chat route must resolve the caller's allowMeshiUse");
assert.match(
  chatSource,
  /context:\s*groundedContext/,
  "the reasoning provider must receive the consent-filtered context, never the raw client one",
);
assert.match(
  chatSource,
  /meshiMayUseCallerData\s*&&/,
  "the grounding query must be skipped outright when the caller withdrew Meshi consent",
);
assert.ok(
  !/callMeshiReasoning\(\{\s*message,\s*context,/.test(chatSource),
  "raw client context must not reach callMeshiReasoning",
);

const engineSource = read("src/lib/meshi-engine.ts");
assert.match(
  engineSource,
  /async function resolvePersonForViewer[\s\S]{0,900}?meshiConsentWhere\(\)/,
  "the shared Meshi person resolver must drop subjects who withdrew Meshi consent",
);
// meshi-engine.ts is "use server", so meshiQuery is a dispatchable Server Action
// a client can call directly. The route's check alone would be bypassable.
assert.match(
  engineSource,
  /export async function meshiQuery[\s\S]{0,700}?hasMeshiConsent\(viewer\.id\)/,
  "meshiQuery must re-check the caller's consent itself — it is reachable without the chat route",
);

// ---------------------------------------------------------------------------
// 5. One definition per flag: nobody re-implements a gate locally.
// ---------------------------------------------------------------------------

// Files allowed to name the consent columns at all, and why.
const FLAG_MENTIONS_ALLOWED = new Set([
  "src/lib/consent.ts", // the definitions
  "src/app/api/data-controls/route.ts", // the writer + read-back for the UI
  "src/lib/privacy-control-center.ts", // echoes stored values to the UI
  "src/lib/analytics-dashboard.ts", // echoes stored values to the UI
  "src/components/privacy/privacy-control-center.tsx", // the switches themselves
  "src/lib/global-mesh.ts", // reads one row through policyGrants for the self-preview
]);

for (const file of sourceFiles) {
  const source = read(file);
  if (!/allowDiscovery|allowAnalytics|allowMeshiUse/.test(source)) continue;
  assert.ok(
    FLAG_MENTIONS_ALLOWED.has(file),
    `${file} names a DataVisibilityPolicy consent column directly.\n` +
      `  These three flags have exactly one definition each in src/lib/consent.ts —\n` +
      `  import a helper from there instead of hand-rolling the filter, or add this file\n` +
      `  to FLAG_MENTIONS_ALLOWED in scripts/consent-check.ts if it only displays values.`,
  );
}

const consentSource = read("src/lib/consent.ts");
assert.match(consentSource, /^import "server-only";/m, "the consent gates must be server-only — a client gate is not a gate");

console.log(
  `consent contract OK — ${gatedCount} discovery reads carry their category rule, ` +
    `${[...ungatedByFile.values()].reduce((a, b) => a + b, 0)} justified exemptions, ` +
    "analytics/Meshi chokepoints gated, one definition per flag.\n" +
    "  Covers: fail-open fragment shape, showInDiscovery-anchored discovery reads, named chokepoints.\n" +
    "  Does NOT cover: discovery paths that never mention showInDiscovery, dynamically built\n" +
    "  filters, or newly added analytics/Meshi read paths — see this script's header.",
);
