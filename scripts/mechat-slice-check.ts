/**
 * MECHAT DAILY DRIVER — reach, control, honest chrome.
 *
 * The defects this slice fixed, held shut:
 *
 *   - THE SEARCH HIJACK: tapping a quoted reply used to FILTER the thread to
 *     bubbles matching the quoted text. The quote is a door, not a query.
 *   - THE DEAD MUTE: ThreadMember.notificationsMuted existed, was serialized,
 *     and silenced nothing — every send fanned out notification rows and
 *     lock-screen push to every member unconditionally.
 *   - THE 150-MESSAGE WALL: the latest-window cap made a thread's older
 *     history permanently unreachable, and the 5s poll would have silently
 *     deleted any paged-in history that dared to load.
 *   - THE HOVER-ONLY BAR: `hidden md:group-hover:flex` kept react/reply/
 *     edit/unsend out of the tab order entirely — keyboard users had no
 *     message actions at all.
 *   - THE LYING LIST: read and unread rows rendered with the same weight,
 *     and the info rail glowed with sub-AA pastel inks.
 *
 * scripts/mechat-guard-check.ts (the privacy gate) is deliberately NOT
 * extended — it stays diff-free forever. These assertions are equally
 * binding from here.
 *
 * WHAT THIS CANNOT PROVE: runtime behavior — the browser drives cover that.
 * This is source text, held against regression.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
// Comment-strip is mandatory here: the thread quotes banned idioms in its
// own comments (it documents the defects it fixed).
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const route = strip(read("src/app/api/messages/[threadId]/route.ts"));
const thread = strip(read("src/components/messages/mechat-thread.tsx"));
const list = strip(read("src/components/messages/mechat-conversation-list.tsx"));
const rail = strip(read("src/components/messages/mechat-info-rail.tsx"));
const globals = read("src/app/globals.css");

function body(source: string, marker: string): string {
  const at = source.indexOf(marker);
  if (at < 0) return "";
  const next = source.indexOf("\nexport ", at + marker.length);
  return next < 0 ? source.slice(at) : source.slice(at, next);
}

// ── 1. The quote is a door, not a query ──────────────────────────────────────
{
  const replyBlock = thread.slice(thread.indexOf("{message.replyTo && ("));
  if (thread.indexOf("{message.replyTo && (") < 0) {
    fail("1 quote", "sanity: the quoted-reply render branch is gone — the scanner is blind");
  } else ok();
  const handler = replyBlock.slice(0, replyBlock.indexOf("</button>"));
  if (/setSearchQuery/.test(handler)) {
    fail("1 quote", "the quote button hijacks search again — the original defect, verbatim");
  } else ok();
  if (!/jumpToMessage\(message\.replyTo\.id\)/.test(handler)) {
    fail("1 quote", "the quote button no longer jumps to the original message by id");
  } else ok();
  if (!/scrollIntoView/.test(thread) || !/data-message-id=\{message\.id\}/.test(thread)) {
    fail("1 quote", "the jump lost its target machinery (data-message-id + scrollIntoView)");
  } else ok();
  const recallAt = globals.indexOf(".mechat-recall {");
  const reducedAt = globals.indexOf(".mechat-recall { animation: none; }");
  if (recallAt < 0 || reducedAt < 0) {
    fail("1 quote", "the recall flash lost its rule or its prefers-reduced-motion pair");
  } else ok();
  if (!/\.mechat-recall \{ animation: mechatRecall [\d.]+s var\(--mesh-ease-out\)/.test(globals)) {
    fail("1 quote", "the recall flash left the house ease");
  } else ok();
}

// ── 2. Mute silences interruptions, never messages ───────────────────────────
{
  const post = body(route, "export async function POST");
  const createManyAt = post.indexOf("notification.createMany");
  if (createManyAt < 0) {
    fail("2 mute", "sanity: POST's notification fanout is gone — the scanner is blind");
  } else ok();
  const fanout = post.slice(createManyAt, createManyAt + 600);
  if (!/notificationsMuted/.test(fanout)) {
    fail("2 mute", "the notification fanout stopped filtering muted members");
  } else ok();
  const pushAt = post.indexOf("pushMessage");
  const pushRegion = pushAt >= 0 ? post.slice(pushAt, post.indexOf("clearMeChatTyping")) : "";
  if (!/notificationsMuted/.test(pushRegion)) {
    fail("2 mute", "the push loop stopped honoring notificationsMuted — muted threads buzz lock screens again");
  } else ok();
  const patch = body(route, "export async function PATCH");
  const muteAction = patch.slice(patch.indexOf('action === "mute"'));
  if (patch.indexOf('action === "mute"') < 0) {
    fail("2 mute", "the mute action left the PATCH handler");
  } else ok();
  const muteUpdate = muteAction.slice(0, muteAction.indexOf("return NextResponse"));
  if (!/userId_threadId: \{ userId: user\.id, threadId \}/.test(muteUpdate)) {
    fail("2 mute", "mute no longer targets the caller's own membership row exclusively");
  } else ok();
  if (/body\.(memberId|userId|targetId)/.test(muteAction.slice(0, 800))) {
    fail("2 mute", "mute reads a caller-supplied member identifier — muting is first-person only");
  } else ok();
  if (!/aria-pressed=\{muted\}/.test(strip(read("src/components/messages/mechat-mute-toggle.tsx")))) {
    fail("2 mute", "the mute toggle lost its pressed state — silent selection");
  } else ok();
}

// ── 3. History is reachable, and the poll cannot eat it ──────────────────────
{
  const get = body(route, "export async function GET");
  if (!/searchParams\.get\("before"\)/.test(get) || !/createdAt: \{ lt: cursor \}/.test(get)) {
    fail("3 history", "the GET history cursor is gone — the 151st-oldest message is unreachable again");
  } else ok();
  const beforeBranch = get.slice(get.indexOf('if (before && beforeId)'), get.indexOf("const now = new Date()"));
  if (get.indexOf('if (before && beforeId)') < 0 || /lastRead/.test(beforeBranch)) {
    fail("3 history", "the history branch bumps lastRead — reading history is not reading the newest");
  } else ok();
  if (!/const merged = mergeThreadMessages\(prev, nextMessages\)/.test(thread)) {
    fail("3 history", "loadThread no longer folds the poll through mergeThreadMessages");
  } else ok();
  if (/JSON\.stringify\(prev\) === JSON\.stringify\(nextMessages\) \? prev : nextMessages/.test(thread)) {
    fail("3 history", "the poll wipes state with the raw latest-150 window — the original defect, verbatim");
  } else ok();
  const merge = body(thread, "function mergeThreadMessages");
  if (!/new Set\(latest\.map\(\(message\) => message\.id\)\)/.test(merge)) {
    fail("3 history", "mergeThreadMessages lost its id union — duplicates on every poll");
  } else ok();
  // Anchored to fetchOlder's own body — the arrival effect ALSO adds seen
  // ids, so a whole-file regex would keep matching after the pre-seed died.
  const fetchOlderAt = thread.indexOf("const fetchOlder");
  const jumpAt = thread.indexOf("const jumpToMessage");
  const fetchOlderBody = fetchOlderAt >= 0 && jumpAt > fetchOlderAt ? thread.slice(fetchOlderAt, jumpAt) : "";
  if (!fetchOlderBody) {
    fail("3 history", "sanity: fetchOlder/jumpToMessage anchors are gone — the scanner is blind");
  } else ok();
  if (!/seenIdsRef\.current\.add\(message\.id\)/.test(fetchOlderBody)) {
    fail("3 history", "fetchOlder lost its seen-id pre-seeding — paged-in history replays entrance springs");
  } else ok();
  if (!/restoreScrollRef/.test(thread)) {
    fail("3 history", "the prepend no longer restores the scroll offset — the viewport jumps");
  } else ok();
}

// ── 4. Keyboard-reachable actions ────────────────────────────────────────────
{
  if (!/data-testid="mechat-message-actions"/.test(thread)) {
    fail("4 keyboard", "sanity: the action bar's testid is gone — the scanner is blind");
  } else ok();
  const barAt = thread.indexOf('data-testid="mechat-message-actions"');
  const bar = thread.slice(barAt, barAt + 1600);
  if (/hidden md:group-hover:flex/.test(bar)) {
    fail("4 keyboard", "the bar is display-gated behind hover at md+ again — out of the tab order, the original defect");
  } else ok();
  if (!/group-focus-within/.test(bar)) {
    fail("4 keyboard", "the bar lost group-focus-within — keyboard users cannot reach react/reply/edit/unsend");
  } else ok();
  if (!/role="status"/.test(thread)) {
    fail("4 keyboard", "the search count lost role=status");
  } else ok();
}

// ── 5. Copy — the fourth verb, incoming included ─────────────────────────────
{
  const barAt = thread.indexOf('data-testid="mechat-message-actions"');
  const bar = thread.slice(barAt);
  const copyAt = bar.indexOf("navigator.clipboard.writeText");
  const firstMineAt = bar.indexOf("{isMine && !isExternalThread");
  if (copyAt < 0) {
    fail("5 copy", "the Copy key is gone from the action bar");
  } else ok();
  if (copyAt >= 0 && firstMineAt >= 0 && copyAt > firstMineAt) {
    fail("5 copy", "Copy renders after the first isMine guard — incoming messages lost it");
  } else ok();
  // The guard immediately enclosing the Copy key must not mention isMine —
  // wrapping it (`isMine && message.content &&`) strips it from incoming
  // messages just as surely as moving it does.
  if (copyAt >= 0 && /isMine/.test(bar.slice(Math.max(0, copyAt - 300), copyAt))) {
    fail("5 copy", "Copy's enclosing guard references isMine — incoming messages lost the fourth verb");
  } else ok();
  if (!/!message\.metadata\.unsent && \(/.test(thread)) {
    fail("5 copy", "the bar's unsent guard is gone — unsent messages grow an action bar");
  } else ok();
}

// ── 6. Honest chrome ─────────────────────────────────────────────────────────
{
  const ternaries = [...list.matchAll(/unread\s*\?\s*"([^"]*)"\s*:\s*"([^"]*)"/g)];
  if (ternaries.some((m) => m[1] === m[2])) {
    fail("6 chrome", "an unread ternary has identical branches — the list stopped telling the truth");
  } else ok();
  if (!/unread \? "font-semibold" : "font-medium"/.test(list)) {
    fail("6 chrome", "unread weight no longer differs from read weight in the conversation list");
  } else ok();
  if (/accent-glow|blur-2xl/.test(rail)) {
    fail("6 chrome", "the info rail glows again");
  } else ok();
  if (/text-(sky|pink|red|indigo|emerald)-300/.test(rail)) {
    fail("6 chrome", "sub-AA pastel platform inks returned to the info rail");
  } else ok();
  if (/mechat-send-in/.test(thread + list + rail) || /\.mechat-send-in \{/.test(globals)) {
    fail("6 chrome", "the buried .mechat-send-in rule was resurrected");
  } else ok();
  if (!/Shared Sources/.test(rail) || !/formatRelativeTime/.test(list)) {
    fail("6 chrome", "sanity: a scanned surface lost its landmark — the scanner is blind");
  } else ok();
}

if (failures.length) {
  console.error(`\nmechat-slice: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`mechat-slice: all ${checks} assertions passed — reach, control, honest chrome.`);
