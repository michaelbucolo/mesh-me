/**
 * JOURNEY-AUDIT MINORS — the confirmed P2/P3 slice, held shut.
 *
 * The same 16-agent journey audit that produced the eight P1s also confirmed
 * a band of smaller defects, each one a paper cut on a flagship journey:
 *
 *   - THE SCRIPTLESS PAGES: every prerendered public page (/developers,
 *     /terms, …) cached HTML with no CSP nonce while the proxy stamped a
 *     fresh one per request — ~25 refused-script console errors, zero JS.
 *   - THE SQUINT GATE: the flagship mobile login's submit arrow was 30x30,
 *     the password peek 26x26, every text link ~19px tall.
 *   - THE SILENT SWAP: an unknown identifier morphed Log in into Create
 *     account with no "not found" anywhere; a wrong password showed TWO
 *     differently-worded errors at once.
 *   - THE DEAD GUEST ROW: a guest's Like/Comment/Repost/Save taps were
 *     silent no-ops with live-looking hover tints.
 *   - THE DOOR TO THE LOBBY: every message door outside the inbox stopped at
 *     the MeChat index while /messages/<threadId> existed and worked.
 *   - THE CLIPPED KEYS, ACT II: the desktop 3-column thread pane (365px at
 *     1440!) clipped the side-floating action bar and was idly h-scrollable.
 *   - THE PARKED MASCOT: the Meshi float covered Flow's "Why this?" key
 *     dead-center at 390px; author rows on public reels 404ed; a dry
 *     "More like this" lane left a permanently inert chevron; the empty
 *     Flow miscounted text posts as videos "that did not report a length".
 *   - THE FOUR-RESULT NOTHING: connect-CTA tiles counted as search results
 *     ("Top 4" on a nonsense query) and zero-match lane tabs went blank.
 *   - THE ZERO-FOLLOWER CROWN: "Biggest audience" went to a never-synced
 *     platform with 0 followers while the bar beside it showed mesh.me 100%;
 *     two near-identical engagement rates disagreed by 100 points.
 *
 * WHAT THIS CANNOT PROVE: runtime behavior — the targeted drive covers that.
 * This is source text, held against regression.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const globals = read("src/app/globals.css");
const entry = strip(read("src/components/auth/mesh-entry-experience.tsx"));
const authShell = strip(read("src/components/auth/auth-shell.tsx"));
const postDetail = strip(read("src/app/(app)/feed/[postId]/post-detail-client.tsx"));
const notifications = strip(read("src/lib/notifications.ts"));
const delivery = strip(read("src/components/meshi/meshi-delivery.tsx"));
const messagesPage = strip(read("src/app/(app)/messages/page.tsx"));
const mechatThread = strip(read("src/components/messages/mechat-thread.tsx"));
const meshiFloat = strip(read("src/components/meshi/meshi-float.tsx"));
const flowClient = strip(read("src/app/(app)/flow/flow-client.tsx"));
const flowRanking = strip(read("src/lib/flow-ranking.ts"));
const searchClient = strip(read("src/app/(app)/search/search-client.tsx"));
const crossPlatform = strip(read("src/components/analytics/cross-platform-command.tsx"));
const analyticsLib = strip(read("src/lib/analytics-dashboard.ts"));
const analyticsDash = strip(read("src/components/analytics/analytics-dashboard.tsx"));
const gates = strip(read("src/components/mesh/ui/gates.tsx"));

// ── 1. Prerendered pages actually run their scripts ──────────────────────────
// The proxy stamps a per-request CSP nonce; only per-request rendering lets
// Next stamp it onto its scripts. A page allowed back into the prerender set
// ships ~25 refused-script errors and zero hydration.
{
  const pages = [
    "src/app/about/page.tsx",
    "src/app/data-deletion/page.tsx",
    "src/app/developers/page.tsx",
    "src/app/features/page.tsx",
    "src/app/help/page.tsx",
    "src/app/offline/page.tsx",
    "src/app/privacy/page.tsx",
    "src/app/support/page.tsx",
    "src/app/terms/page.tsx",
    "src/app/trust/page.tsx",
    "src/app/reset-password/layout.tsx",
  ];
  for (const page of pages) {
    if (!/export const dynamic = "force-dynamic"/.test(strip(read(page)))) {
      fail("1 csp", `${page} lost force-dynamic — its prerendered HTML carries no nonce and every script is refused`);
    } else ok();
  }
}

// ── 2. The gate is tappable ──────────────────────────────────────────────────
{
  const goAt = globals.indexOf(".mesh-gate-go {");
  const go = globals.slice(goAt, globals.indexOf("}", goAt));
  if (!/border: 5px solid transparent/.test(go) || !/calc\(2\.2rem \+ 10px\)/.test(go)) {
    fail("2 gate", ".mesh-gate-go lost its hit-area expansion — the submit arrow is a 30x30 squint target again");
  } else ok();
  const peekAt = globals.indexOf(".mesh-gate-peek {");
  const peek = globals.slice(peekAt, globals.indexOf("}", peekAt));
  if (!/padding: 0\.875rem/.test(peek)) {
    fail("2 gate", ".mesh-gate-peek lost its 44px padding — the password eye is 26x26 again");
  } else ok();
  const linkAt = globals.indexOf(".mesh-gate-textlink {");
  const link = globals.slice(linkAt, globals.indexOf("}", linkAt));
  if (!/padding: 0\.8rem 0\.35rem/.test(link) || !/margin: -0\.8rem -0\.35rem/.test(link)) {
    fail("2 gate", ".mesh-gate-textlink lost its hit-area padding — text links are 19px tall again");
  } else ok();
  const footAt = globals.indexOf(".mesh-gate-links > * {");
  const foot = globals.slice(footAt, globals.indexOf("}", footAt));
  if (!/min-height: 44px/.test(foot)) {
    fail("2 gate", ".mesh-gate-links > * describes a 44px floor it no longer declares");
  } else ok();
  if (!/mt-3 flex w-fit/.test(authShell)) {
    fail("2 gate", "the Privacy-first pill went back to inline-flex — flush against the tagline on the same line");
  } else ok();
}

// ── 3. The gate speaks once, and says why ────────────────────────────────────
{
  if (/Incorrect password\. Try again or reset it\./.test(entry)) {
    fail("3 voice", "the hardcoded bubble error is back — two phrasings of one wrong password");
  } else ok();
  if (!/No account matches/.test(entry)) {
    fail("3 voice", "the unknown-identity note is gone — Log in silently swaps to Create account again");
  } else ok();
  // The password stage renders the live `message` in Meshi's bubble; the
  // duplicate red line under the field is gone from that stage.
  if (!/mesh-gate-bubble" role=\{message && !success \? "alert" : undefined\}/.test(entry)) {
    fail("3 voice", "the bubble no longer carries the live error (or lost its alert role)");
  } else ok();
}

// ── 4. A guest's tap opens a door ────────────────────────────────────────────
{
  if (!/const requireSignIn = \(\) => \{/.test(postDetail) || !/router\.push\(`\/login\?next=\$\{encodeURIComponent\(`\/feed\/\$\{post\.id\}`\)\}`\)/.test(postDetail)) {
    fail("4 guest", "requireSignIn is gone — guest taps on Like/Comment/Repost/Save are silent no-ops again");
  } else ok();
  const guards = (postDetail.match(/if \(requireSignIn\(\)\) return;/g) || []).length;
  if (guards < 4) {
    fail("4 guest", `only ${guards}/4 handlers route guests to sign-in (like, save, repost, comment)`);
  } else ok();
  if (!/aria-label=\{saved \? "Remove from saved" : "Save post"\}/.test(postDetail)) {
    fail("4 guest", "the bookmark button lost its accessible name again");
  } else ok();
}

// ── 5. Message doors open the conversation ───────────────────────────────────
{
  if (!/\/messages\?with=\$\{encodeURIComponent\(notification\.actor\.username\)\}/.test(notifications)) {
    fail("5 doors", "message notifications point at the index again instead of ?with=<who spoke>");
  } else ok();
  if (!/\/messages\?with=\$\{encodeURIComponent\(current\.fromUsername\)\}/.test(delivery)) {
    fail("5 doors", "the Meshi delivery's Reply door dead-ends at the index again");
  } else ok();
  if (!/redirect\(`\/messages\/\$\{thread\.id\}`\)/.test(messagesPage) || !/directThreadWhere\(/.test(messagesPage)) {
    fail("5 doors", "/messages lost its ?with= resolver (or hand-rolls the direct-thread filter the second-writer gate bans)");
  } else ok();
}

// ── 6. The conversation search has an exit; the pane stays still ─────────────
{
  if (!/aria-label="Clear conversation search"/.test(mechatThread)) {
    fail("6 mechat", "the in-thread search lost its clear button");
  } else ok();
  if (!/event\.key === "Escape" && searchQuery\) setSearchQuery\(""\)/.test(mechatThread)) {
    fail("6 mechat", "Escape no longer clears the conversation filter");
  } else ok();
  if (!/overflow-x-clip px-3 pt-4 pb-20/.test(mechatThread) || !/md:pb-4/.test(mechatThread)) {
    fail("6 mechat", "the phone-width bottom padding is gone — the Meshi assistant parks on the newest message's meta line again");
  } else ok();
}

// ── 7. The Flow's chrome yields, its doors open, its words count honestly ────
{
  if (!/data-on-flow=\{onFlowRoute/.test(meshiFloat) || !/\.meshi-float-shell\[data-on-flow="true"\]/.test(globals)) {
    fail("7 flow", "the float no longer yields on phone-width Flow — the mascot parks on 'Why this?' again");
  } else ok();
  if (!/tried\?: boolean/.test(flowClient) || !/laneTotal === 0 && !laneTried/.test(flowClient)) {
    fail("7 flow", "a dry similar-lane is indistinguishable from an untried one — the dead chevron is back");
  } else ok();
  if (!/Nothing similar right now/.test(flowClient)) {
    fail("7 flow", "a dry lane fails silently again");
  } else ok();
  if (!/externalAuthor\?\.profileUrl/.test(flowClient) || !/const nativeAuthor = !post\.platform/.test(flowClient)) {
    fail("7 flow", "public-reel author rows link to /profile/<channel name> again — a guaranteed 404");
  } else ok();
  // The identifier alone survives deleting the counting branch (declaration
  // and return keep the word) — pin the increment.
  if (!/notVideo \+= 1/.test(flowRanking) || !/notVideo/.test(flowClient)) {
    fail("7 flow", "text posts are counted as videos 'that did not report a length' again");
  } else ok();
  if (/long-form or did not report a length/.test(flowClient)) {
    fail("7 flow", "the miscounting cold-start copy is back verbatim");
  } else ok();
}

// ── 8. Search results are results ────────────────────────────────────────────
{
  const totalsAt = searchClient.indexOf("const totals = useMemo");
  const totals = searchClient.slice(totalsAt, searchClient.indexOf("}), [results]);", totalsAt));
  if (/sourceIndex/.test(totals)) {
    fail("8 search", "connect-CTA tiles count as search results again — 'Top 4' on a nonsense query, honest empty state unreachable");
  } else ok();
  if (!/Nothing in \{tabs\.find/.test(searchClient)) {
    fail("8 search", "a zero-match lane tab renders a blank panel again");
  } else ok();
  // The tiles render BELOW the real lanes: the sourceIndex section's render
  // site must come after the wikipedia ("Public reference") section's.
  const tilesAt = searchClient.indexOf("Social index sources");
  const wikiAt = searchClient.indexOf("Public reference");
  if (tilesAt < 0 || wikiAt < 0 || tilesAt < wikiAt) {
    fail("8 search", "the connect tiles rank above real results again");
  } else ok();
}

// ── 9. Crowns are earned; one definition of engagement ───────────────────────
{
  const reachAt = crossPlatform.indexOf("const byReach");
  const reach = crossPlatform.slice(reachAt, crossPlatform.indexOf("const byRate"));
  if (!/mesh\.me/.test(reach) || !/followerCount > 0/.test(reach) || !/totalViews > 0/.test(reach)) {
    fail("9 crowns", "a 0-follower platform can win Biggest audience/Most reach again, or mesh.me is no longer a candidate");
  } else ok();
  if (!/averageEngagementRate: engagementRate\([^)]*totalFollowersFromPlatforms \+ nativeFollowerTotal\)/.test(analyticsLib)) {
    fail("9 crowns", "the scorecard rate dropped native followers again — 100.0% vs 0.0% on one page");
  } else ok();
  if (/sub="of your audience responds"/.test(analyticsDash)) {
    fail("9 crowns", "the hero tile literally claims the whole audience responds again");
  } else ok();
}

// ── 10. Doors meet the 44px floor ────────────────────────────────────────────
{
  const composer = strip(read("src/components/compose/composer-view.tsx"));
  if (!/href="\/compose\/queue" className="flex min-h-11 items-center/.test(composer)) {
    fail("10 touch", "the composer's Queue door is a 19px text line again");
  } else ok();
  const proInsights = strip(read("src/components/analytics/pro-insights.tsx"));
  if (!/href="\/meshpro" className="inline-flex min-h-11 items-center/.test(proInsights)) {
    fail("10 touch", "See MeshPro is a 19px text line again");
  } else ok();
  const permissions = strip(read("src/components/analytics/privacy-permissions-manager.tsx"));
  if (!/min-h-11 rounded-full px-3\.5/.test(permissions)) {
    fail("10 touch", "the Access enabled/paused pill is a 25px target again");
  } else ok();
  if (!/flex min-h-11 items-center rounded-full border/.test(crossPlatform)) {
    fail("10 touch", "Connect more platforms is a sub-40px target again");
  } else ok();
}

// ── 11. The Global Mesh pill clears the tab bar ──────────────────────────────
{
  if (!/bottom-\[calc\(var\(--mobile-nav-h\)\+2rem\)\]/.test(gates) || !/md:bottom-8/.test(gates)) {
    fail("11 mesh", "the empty-state pill anchors at bottom-8 alone again — clipped behind the mobile tab bar");
  } else ok();
}

// ── 12. Integrity floors ─────────────────────────────────────────────────────
{
  const floors: Array<[string, number]> = [
    ["src/components/auth/mesh-entry-experience.tsx", 20000],
    ["src/app/(app)/flow/flow-client.tsx", 60000],
    ["src/app/(app)/search/search-client.tsx", 15000],
    ["src/components/messages/mechat-thread.tsx", 50000],
  ];
  for (const [file, floor] of floors) {
    if (read(file).length < floor) {
      fail("12 floors", `${file} shrank below ${floor} bytes — a gated fix was likely deleted wholesale`);
    } else ok();
  }
}

if (failures.length > 0) {
  console.error(`journey-minors: ${failures.length} failure(s)`);
  for (const failure of failures) console.error("  " + failure);
  process.exit(1);
}
console.log(`journey-minors: all ${checks} assertions passed — the paper cuts stay closed.`);
