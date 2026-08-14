/**
 * JOURNEY-AUDIT FIXES — eight adversarially confirmed P1s, held shut.
 *
 * An 8-journey production drive (16 agents: every finding independently
 * re-driven by a verifier told to refute it; none were) found:
 *
 *   - THE TWO-FACED FEED: /api/feed/paginated's ranked branch had no
 *     cold-profile fallback while page.tsx did — clicking the "All" chip
 *     wiped a feed SSR had just painted, and ranked page 2+ returned nothing.
 *   - THE VANISHED VOCABULARY: every feed view chip was display:none under
 *     768px with no replacement — 7 of 8 views unreachable on a phone.
 *   - THE OFF-SCREEN KEYS: MeChat's tap-to-pin action bar rendered at
 *     left-full/right-full of the bubble — own-message keys unreachable by
 *     ANY scroll at 390px.
 *   - THE SILENT HEART: setFlowLike rejected every "public-" id the supply
 *     lane mints; the heart flashed and rolled back with no error surfaced.
 *   - THE DEAD DOORS: /feed/public-<id> 404ed while Share toasted
 *     "Link copied" for that dead link.
 *   - THE EMPTY FLOW: expired supply had no self-heal — and the WRONG fix
 *     (serving expired rows) would violate the platforms' retention terms.
 *   - THE UNFINDABLE FRIEND: search's discovery-consent gate hid people the
 *     searcher already follows.
 *   - THE DOUBLE-COUNTED INBOX: "message" notifications duplicated their
 *     threads — 3 conversations counted as 7, "Reply" rows dead-ended at
 *     /notifications.
 *
 * WHAT THIS CANNOT PROVE: runtime behavior — the targeted drives cover that.
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

const paginated = strip(read("src/app/api/feed/paginated/route.ts"));
const globals = read("src/app/globals.css");
const mechatThread = strip(read("src/components/messages/mechat-thread.tsx"));
const actions = strip(read("src/lib/actions.ts"));
const postPage = strip(read("src/app/(app)/feed/[postId]/page.tsx"));
const feedData = strip(read("src/lib/feed-data.ts"));
const supplyStore = strip(read("src/lib/public-supply/store.ts"));
const supplyRunner = strip(read("src/lib/public-supply/runner.ts"));
const flowRoute = strip(read("src/app/api/flow/route.ts"));
const queries = strip(read("src/lib/queries.ts"));
const readInbox = strip(read("src/lib/inbox/read-inbox.ts"));
const spatial = strip(read("src/components/spatial-init.tsx"));
const delivery = strip(read("src/components/meshi/meshi-delivery.tsx"));
const postCard = strip(read("src/components/feed/post-card.tsx"));

// ── 1. One feed, one answer ──────────────────────────────────────────────────
{
  const rankedAt = paginated.indexOf("rankFlowPosts");
  const branch = paginated.slice(rankedAt, paginated.indexOf("} else"));
  if (rankedAt < 0 || !/mergedPosts\.length === 0/.test(branch) || !/getCombinedFeedPosts\(/.test(branch)) {
    fail("1 feed", "the ranked branch lost its cold-profile fallback — the API and the page disagree about the same feed again");
  } else ok();
}

// ── 2. The vocabulary exists on phones ───────────────────────────────────────
{
  // Within any max-width media block, .feed-mode-strip may scroll but never
  // vanish. Scan every `.feed-mode-strip {` rule body for display: none.
  let at = 0;
  let hidden = false;
  for (;;) {
    const start = globals.indexOf(".feed-mode-strip {", at);
    if (start < 0) break;
    const body = globals.slice(start, globals.indexOf("}", start));
    if (/display:\s*none/.test(body)) hidden = true;
    at = start + 1;
  }
  if (hidden) {
    fail("2 chips", "a .feed-mode-strip rule sets display:none — the feed's whole view vocabulary vanishes at that width");
  } else ok();
  if (!/feed-mode-strip \{[^}]*overflow-x:\s*auto/.test(globals)) {
    fail("2 chips", "the chip strip no longer scrolls horizontally");
  } else ok();
}

// ── 3. Message keys stay on screen ───────────────────────────────────────────
{
  // The div opens with its testid; className (and the placement ternary)
  // follow it, so the scan window extends FORWARD from the anchor.
  const barAt = mechatThread.indexOf('data-testid="mechat-message-actions"');
  const bar = mechatThread.slice(barAt, barAt + 2400);
  if (!/bottom-full/.test(bar)) {
    fail("3 mechat", "the pinned bar lost its above-the-bubble mobile placement");
  } else ok();
  // The original defect verbatim: unprefixed side placement applying at all
  // widths. Side placement must be md:-scoped.
  if (/"right-full mr-2"|"left-full ml-2"/.test(bar)) {
    fail("3 mechat", "the action bar's side placement lost its md: scope — keys render off a 390px screen again");
  } else ok();
  if (!/md:right-full/.test(bar) || !/md:left-full/.test(bar)) {
    fail("3 mechat", "the desktop side placement is gone from the pinned bar");
  } else ok();
}

// ── 4. Public supply is a full citizen ───────────────────────────────────────
{
  const likeAt = actions.indexOf("export async function setFlowLike");
  const likeGuard = actions.slice(likeAt, likeAt + 800);
  if (!/startsWith\("public-"\)/.test(likeGuard)) {
    fail("4 public", "setFlowLike rejects public- ids again — the silent heart");
  } else ok();
  if (!/startsWith\("public-"\)/.test(postPage) || !/startsWith\("friend-platform-"\)/.test(postPage)) {
    fail("4 public", "the post page rescue lost public-/friend-platform- — Comments and Share 404 again");
  } else ok();
  if (!/startsWith\("public-"\)/.test(feedData) || !/getPublicPostById/.test(feedData)) {
    fail("4 public", "getFeedPostById lost its public- resolver branch");
  } else ok();
}

// ── 5. Empty heals by FETCHING, never by stretching retention ────────────────
{
  const readAt = supplyStore.indexOf("export async function readPublicSupply");
  const readBody = supplyStore.slice(readAt, readAt + 1200);
  if (!/expiresAt:\s*\{\s*gt:/.test(readBody)) {
    fail("5 supply", "readPublicSupply lost its expiry clause — retention is a TERMS commitment; serving expired rows violates it");
  } else ok();
  if (!/export async function claimSupplyAutoRefresh/.test(supplyRunner) || !/durableRateLimit\("public-supply:auto-refresh"/.test(supplyRunner)) {
    fail("5 supply", "the self-heal claim (durable, global) is gone from the runner");
  } else ok();
  if (!/claimSupplyAutoRefresh\(\)/.test(flowRoute) || !/after\(/.test(flowRoute)) {
    fail("5 supply", "the flow route no longer claims + runs the supply self-refresh after an empty response");
  } else ok();
  if (!/refreshingSupply/.test(flowRoute)) {
    fail("5 supply", "the flow payload lost its refreshingSupply honesty flag");
  } else ok();
}

// ── 6. Consent gates strangers, not your own graph ───────────────────────────
{
  const searchAt = queries.indexOf("export async function searchAll");
  const usersLane = queries.slice(searchAt, searchAt + 2600);
  if (!/id:\s*\{\s*in:\s*knownIds\s*\}/.test(usersLane)) {
    fail("6 search", "the users lane lost the own-graph exemption — people you follow are unfindable again");
  } else ok();
  if (!/showInDiscovery:\s*true,\s*\.\.\.profileDiscoveryConsentWhere\(\)/.test(usersLane)) {
    fail("6 search", "the stranger branch lost its discovery-consent gate — the exemption must never widen to strangers");
  } else ok();
  if (!/filter\(\(id\) => !blocked\.has\(id\)\)/.test(usersLane)) {
    fail("6 search", "knownIds no longer excludes blocked users — a block must sever search in both directions");
  } else ok();
}

// ── 7. The thread is the ledger ──────────────────────────────────────────────
{
  if (!/recipientId:\s*userId,\s*type:\s*\{\s*not:\s*"message"\s*\}/.test(readInbox)) {
    fail("7 inbox", 'the inbox reads "message" notifications again — threads double-counted, Reply rows dead-ending at /notifications');
  } else ok();
}

// ── 8. Ask the policy before the API; stop asking after a 401 ────────────────
{
  const probeAt = spatial.indexOf("async function detectGenericXr");
  const probe = spatial.slice(probeAt, probeAt + 900);
  const guardAt = probe.indexOf('allowsFeature("xr-spatial-tracking")');
  const askAt = probe.indexOf("isSessionSupported(");
  if (guardAt < 0 || askAt < 0 || guardAt > askAt) {
    fail("8 console", "the XR probe no longer checks the app's own Permissions-Policy first — a console error on every wide pageview");
  } else ok();
  if (!/status === 401/.test(delivery) || !/unauthorizedRef/.test(delivery)) {
    fail("8 console", "the deliveries poll no longer stops on 401 — guests get recurring first-party errors again");
  } else ok();
}

// ── 9. Numbers speak English ─────────────────────────────────────────────────
{
  if (!/likeCount === 1 \? "like" : "likes"/.test(postCard)) {
    fail("9 plurals", '"1 likes" is back on every single-like post');
  } else ok();
  if (!/comments === 1 \? "comment" : "comments"/.test(postCard)) {
    fail("9 plurals", '"View 1 comments" is back');
  } else ok();
}

// ── 10. Scanner integrity ────────────────────────────────────────────────────
{
  if (paginated.length < 1500 || queries.length < 50_000 || globals.length < 100_000) {
    fail("10 integrity", "a scanned file shrank implausibly — the scanner may be reading the wrong tree");
  } else ok();
}

if (failures.length) {
  console.error(`\njourney-fixes: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`journey-fixes: all ${checks} assertions passed — eight P1s stay dead, and the fixes stayed honest.`);
