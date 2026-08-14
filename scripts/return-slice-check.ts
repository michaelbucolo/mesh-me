/**
 * THE RETURN SLICE — win the morning open, honestly.
 *
 * The defects this slice fixed, held shut:
 *
 *   - THE BUSY BADGE: the nav's unread-messages SQL counted MUTED threads.
 *     "MUTED MEANS MUTED" (lib/mesh/wants-you.ts) — a badge that overrides an
 *     explicit "do not bother me" to look busier has failed its one job.
 *   - THE LYING BOOKMARK: the feed's save button on platform-origin posts set
 *     cosmetic state and returned — nothing persisted, a reload erased the
 *     save — and external posts refused saving outright while /api/saves
 *     existed precisely to snapshot them.
 *   - THE CHURNED CURSOR: lastSeenAt is touched every ≤60s by presence, so
 *     nothing could ever say "since you left". caughtUpAt exists for that,
 *     and ONLY the brief's dismiss may write it.
 *   - ONE DEFINITION OF OWED: every surface that states a needs-you number
 *     (inbox, nav/PWA badge, Return Brief) must ride readInboxSignals — a
 *     second `senderId !== me` derivation is the drift the inbox forbids.
 *
 * WHAT THIS CANNOT PROVE: runtime behavior — the browser drives cover that.
 * This is source text, held against regression.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
// Comment-strip is mandatory: these files document the defects they fixed,
// quoting the banned idioms in their own comments.
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

function grepAllTs(pattern: string): string[] {
  try {
    return execFileSync("grep", ["-rlF", pattern, "src", "--include=*.ts", "--include=*.tsx"], { encoding: "utf8" })
      .split("\n").filter(Boolean).filter((f) => !f.startsWith("src/generated/"));
  } catch {
    return [];
  }
}

/** Slice from a marker to the next top-level `const ` at the same indent —
 * good enough to isolate one handler in a component body. */
function body(source: string, marker: string, endMarker: string): string {
  const at = source.indexOf(marker);
  if (at < 0) return "";
  const end = source.indexOf(endMarker, at + marker.length);
  return end < 0 ? source.slice(at) : source.slice(at, end);
}

const unreadRoute = strip(read("src/app/api/layout/unread-counts/route.ts"));
const appShell = strip(read("src/components/layout/app-shell.tsx"));
const postCard = strip(read("src/components/feed/post-card.tsx"));
const timeline = strip(read("src/app/(app)/feed/feed-timeline-client.tsx"));
const savedPage = strip(read("src/app/(app)/saved/page.tsx"));
const palette = strip(read("src/components/layout/command-palette.tsx"));
const brief = strip(read("src/lib/return-brief.ts"));
const briefView = strip(read("src/components/feed/return-brief.tsx"));
const actions = read("src/lib/actions.ts");
const presenceRoute = read("src/app/api/mesh/presence/route.ts");
const statusRoute = read("src/app/api/status/route.ts");
const inboxPage = strip(read("src/app/(app)/inbox/page.tsx"));
const inboxView = strip(read("src/components/inbox/inbox-view.tsx"));
const feedPage = strip(read("src/app/(app)/feed/page.tsx"));
const feedData = strip(read("src/lib/feed-data.ts"));
const paginated = strip(read("src/app/api/feed/paginated/route.ts"));
const manifest = strip(read("src/app/manifest.ts"));
const overlay = strip(read("src/components/layout/keyboard-shortcuts-overlay.tsx"));
const composer = strip(read("src/components/feed/post-composer.tsx"));

// ── 1. Badges only tell the truth ────────────────────────────────────────────
{
  if (!/AND\s+tm\."notificationsMuted"\s*=\s*false/.test(unreadRoute)) {
    fail("1 badges", "the muted filter left the unread-messages SQL — the nav badge counts muted threads again");
  } else ok();
  // The SUCCESS payload specifically — the ZERO constant carrying a needsYou
  // key must not satisfy this.
  if (!/unreadNotifications, unreadMessages, needsYou/.test(unreadRoute)) {
    fail("1 badges", "the unread-counts success payload lost needsYou");
  } else ok();
  // The CALL, not the import — an import with the call swapped for a stub is
  // exactly the drift this holds shut.
  if (!/readInboxSignals\(user\.id\)/.test(unreadRoute)) {
    fail("1 badges", "the route no longer calls readInboxSignals — a second owed derivation is the drift the inbox forbids");
  } else ok();
  if (!/"setAppBadge" in navigator/.test(appShell)) {
    fail("1 badges", "the Badging API call lost its feature-detection guard");
  } else ok();
  if (!/setAppBadge\?\.\(\s*needsYou\s*\)/.test(appShell)) {
    fail("1 badges", "the icon badge is no longer fed needsYou directly");
  } else ok();
  if (/setAppBadge\?\.\([^)]*(unreadNotifications|unreadMessages|\+)/.test(appShell)) {
    fail("1 badges", "the icon badge is fed arithmetic over unread counts — a like is not an obligation");
  } else ok();
  if (!/clearAppBadge/.test(appShell)) {
    fail("1 badges", "the badge has no clear path — a stale number is a manufactured one");
  } else ok();
}

// ── 2. Saves that survive reload ─────────────────────────────────────────────
{
  const saveHandler = body(postCard, "const handleSave", "const handleRepost");
  if (!saveHandler) {
    fail("2 saves", "handleSave not found in post-card — the scanner may be reading the wrong file");
  } else ok();
  if (!/fetch\("\/api\/saves"/.test(saveHandler)) {
    fail("2 saves", "the non-native save branch no longer persists to /api/saves — the button lies again");
  } else ok();
  // The original defect verbatim: flip cosmetic state, return before any
  // persistence. One `return;` is the signed-out early-out; a second means a
  // branch bails before the write again.
  if ((saveHandler.match(/return;/g) ?? []).length > 1) {
    fail("2 saves", "handleSave grew an early return beyond the auth check — a save path that exits before persisting");
  } else ok();
  if (/requireSourceAccount\(\s*"save"/.test(postCard)) {
    fail("2 saves", 'saving is gated on requireSourceAccount("save") again — a save is a private mesh-side bookmark, never a platform action');
  } else ok();
  if (!/savedRefs\?\.has\(post\.id\)/.test(postCard)) {
    fail("2 saves", "post-card no longer derives saved state from savedRefs — external saves vanish on reload");
  } else ok();
  if (!/fetch\("\/api\/saves"/.test(timeline)) {
    fail("2 saves", "the feed timeline no longer fetches the saved list once for its cards");
  } else ok();
  for (const fn of ["getSavedPosts", "getSavedFlowItems"]) {
    if (!savedPage.includes(fn)) {
      fail("2 saves", `/saved lost ${fn} — the one list must span native and external`);
    } else ok();
  }
  if (!palette.includes('"/saved"')) {
    fail("2 saves", "the command palette lost its /saved door");
  } else ok();
  if (!/href="\/saved"/.test(appShell)) {
    fail("2 saves", "the account dropdown lost its Saved row");
  } else ok();
}

// ── 3. The Return Brief and its cursor ───────────────────────────────────────
{
  for (const [name, source] of [["presence", presenceRoute], ["status", statusRoute]] as const) {
    if (source.includes("caughtUpAt")) {
      fail("3 brief", `the ${name} route touches caughtUpAt — presence churn must never move the visit cursor`);
    } else ok();
  }
  const writers = grepAllTs("caughtUpAt: new Date");
  if (writers.length !== 1 || writers[0] !== "src/lib/actions.ts") {
    fail("3 brief", `caughtUpAt is written from ${JSON.stringify(writers)} — the brief's dismiss (lib/actions.ts) must be its only writer`);
  } else ok();
  if (!actions.startsWith('"use server"')) {
    fail("3 brief", "lib/actions.ts lost its \"use server\" directive — markCaughtUp must be a server action");
  } else ok();
  if (!/export async function markCaughtUp/.test(actions)) {
    fail("3 brief", "markCaughtUp is gone");
  } else ok();
  if (!/readInboxSignals/.test(brief)) {
    fail("3 brief", "return-brief.ts no longer imports the shared owed reader");
  } else ok();
  if (/senderId\s*!==/.test(brief)) {
    fail("3 brief", "return-brief.ts grew its own senderId derivation — one definition of owed, not two");
  } else ok();
  // The brief is a DIFF: it counts obligations that arose since the cursor by
  // filtering the SHARED judgement's items. Without the window filter,
  // standing obligations make "Caught up" a button that never dismisses.
  if (!/owedItems\.filter\(\(item\) => item\.atMs > since/.test(brief)) {
    fail("3 brief", "the brief's needs-you count lost its since-window — the diff became the ledger and Caught up can never dismiss");
  } else ok();
  if (!/=== 0\)\s*\{\s*return null;/.test(brief.replace(/\n/g, " ")) && !/=== 0\) \{[\s\S]{0,20}return null;/.test(brief)) {
    fail("3 brief", "the all-zero early return is gone — an empty brief must render nothing, never a cheery card");
  } else ok();
  if (!/action=\{markCaughtUp\}/.test(briefView)) {
    fail("3 brief", "the brief's Caught up button no longer submits the server action");
  } else ok();
  if (!/<ReturnBrief/.test(feedPage)) {
    fail("3 brief", "the feed page no longer renders the Return Brief");
  } else ok();
  if (!/\{returnBrief\}/.test(timeline)) {
    fail("3 brief", "the timeline no longer places the server-rendered brief slot");
  } else ok();
  if (!/filter/.test(inboxPage) || !/initialTab/.test(inboxPage)) {
    fail("3 brief", "inbox/page.tsx no longer wires ?filter= to the initial tab — the brief's deep link lands on the wrong list");
  } else ok();
  if (!/initialTab\?: Tab/.test(inboxView) || !/useState<Tab>\(initialTab\)/.test(inboxView)) {
    fail("3 brief", "InboxView no longer honors initialTab");
  } else ok();
}

// ── 4. Doors: manifest, palette, keyboard ────────────────────────────────────
{
  // Cross-file drift assert: the manifest shortcut must carry the literal
  // query param the composer reads — renaming either side fails here.
  const composeParam = /searchParams\.get\("([a-z]+)"\)/.exec(composer)?.[1];
  if (!composeParam) {
    fail("4 doors", "could not extract the composer's open param from post-composer.tsx");
  } else ok();
  if (composeParam && !manifest.includes(`/feed?${composeParam}=true`)) {
    fail("4 doors", `no manifest shortcut targets /feed?${composeParam}=true — the icon long-press lost its composer door`);
  } else ok();
  if (!/url: "\/compose"/.test(manifest)) {
    fail("4 doors", "the manifest lost its Publish Studio shortcut");
  } else ok();
  if (!palette.includes('"/compose"')) {
    fail("4 doors", "the command palette lost its Post everywhere door — /compose is back to one inbound link");
  } else ok();
  if (!/c: "studio"/.test(overlay)) {
    fail("4 doors", "the G-prefix navigation map lost c → studio");
  } else ok();
  if (!/studio: "\/compose"/.test(overlay)) {
    fail("4 doors", "actionHref lost studio → /compose");
  } else ok();
  // Works-but-undocumented drift: every actionHref key must appear as an
  // `action:` in shortcutGroups, or the shortcuts panel denies a shortcut
  // that works.
  const hrefBlock = body(overlay, "const actionHref", "};");
  const keys = [...hrefBlock.matchAll(/^\s{6}([a-zA-Z]+):/gm)].map((m) => m[1]);
  if (keys.length < 8) {
    fail("4 doors", `scanner-sees floor: only ${keys.length} actionHref keys parsed`);
  } else ok();
  for (const key of keys) {
    if (!overlay.includes(`action: "${key}"`)) {
      fail("4 doors", `shortcut action "${key}" routes but is undocumented in shortcutGroups`);
    } else ok();
  }
}

// ── 5. The finite following feed ─────────────────────────────────────────────
{
  if (!/isNew: new Date\(post\.createdAt\)\.getTime\(\) > sinceMs/.test(feedData)) {
    fail("5 finite", "feed-data no longer stamps isNew server-side");
  } else ok();
  if (!/source === "following" && index === caughtUpDividerIndex/.test(timeline)) {
    fail("5 finite", "the caught-up divider lost its following-only condition — a boundary in the reshuffling ranked order lies");
  } else ok();
  // The client uses Date.now() legitimately (scroll throttle, optimistic ids);
  // what it must never do is COMPUTE newness — derive isNew from a clock or a
  // timestamp, or read the cursor at all.
  if (/returnBriefSince|returnBriefCursor|caughtUpAt/.test(timeline)) {
    fail("5 finite", "the timeline client reads the caught-up cursor — the boundary must be server-derived");
  } else ok();
  if (/isNew\s*[:=][^,\n]*(Date\.now|createdAt)/.test(timeline)) {
    fail("5 finite", "the timeline client computes isNew from a clock or timestamp — the boundary must be server-derived");
  } else ok();
  if (!/newSince: source === "following"/.test(paginated)) {
    fail("5 finite", "the paginated API no longer stamps newness for following pages — loadMore would move the line");
  } else ok();
}

// ── 6. Scanner integrity ─────────────────────────────────────────────────────
{
  if (postCard.length < 25_000) {
    fail("6 integrity", "post-card.tsx shrank implausibly — the scanner may be reading the wrong file");
  } else ok();
  if (!unreadRoute.includes("SELECT COUNT")) {
    fail("6 integrity", "the unread-counts route lost its SQL — a scanner that sees no query proves nothing about its filters");
  } else ok();
  if ((manifest.match(/url: "/g) ?? []).length < 5) {
    fail("6 integrity", "the manifest sees fewer than 5 shortcut/icon urls — parse drift");
  } else ok();
}

if (failures.length) {
  console.error(`\nreturn-slice: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`return-slice: all ${checks} assertions passed — badges honest, saves durable, the return has a brief and an end.`);
