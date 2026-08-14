/**
 * JOURNEY-AUDIT ROUND 2 — the new-surface findings, held shut.
 *
 * A second adversarial audit (4 journey drivers + per-finding refuters, all
 * against the production build) drove the surfaces built AFTER round 1:
 * Return Brief, /saved, Publish Studio, and the personal data API. Ten
 * findings confirmed, zero refuted:
 *
 *   - THE PHANTOM BADGE: unread-counts derived "unread" from ANY other-sender
 *     message newer than lastRead, while the inbox judges the THREAD by its
 *     newest message — a viewer's own reply left a permanent "1" on the
 *     MeChat badge that no surface could explain.
 *   - THE LEAKED TOKEN: meshi_delivery rows carry a "[mid:<id>]" machine
 *     prefix that must be stripped at every rendering edge; the inbox forgot,
 *     and phones burned the whole preview line on it.
 *   - THE DOUBLE CAUGHT-UP: the divider said "You're caught up" and the
 *     end-of-feed sentinel said "You are caught up." on one screen.
 *   - THE ROTTED THUMBNAIL: a saved item whose external thumbnail host died
 *     rendered the browser's broken-image glyph.
 *   - THE THREE-NAME TOGGLE: one bookmark action announced three different
 *     aria vocabularies across card/detail/rail.
 *   - THE SILENT OVERDUE: a queued post whose time passed with no scheduler
 *     sat under "Waiting" forever with nothing admitting it.
 *   - THE RED HELLO: /compose first paint showed a "Blocked" refusal before
 *     a word was typed.
 *   - THE SUB-FLOOR CONTROLS: schedule datetime inputs (34px), token scope
 *     rows (19px), and the inline "Read the docs" link (15px — min-height is
 *     a no-op on inline elements) all sat under the product's own 44px rule.
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

const unreadCounts = strip(read("src/app/api/layout/unread-counts/route.ts"));
const readInbox = strip(read("src/lib/inbox/read-inbox.ts"));
const feedTimeline = strip(read("src/app/(app)/feed/feed-timeline-client.tsx"));
const savedList = strip(read("src/components/saved/saved-list.tsx"));
const postCard = strip(read("src/components/feed/post-card.tsx"));
const flowClient = strip(read("src/app/(app)/flow/flow-client.tsx"));
const queueView = strip(read("src/components/compose/queue-view.tsx"));
const composerView = strip(read("src/components/compose/composer-view.tsx"));
const tokensPanel = strip(read("src/components/privacy/api-tokens-panel.tsx"));

// ── 1. One definition of an unread thread ────────────────────────────────────
{
  // The badge counts THREADS whose newest message is another sender's — the
  // correlated newest-message join is the fix's signature.
  if (!/INNER JOIN "Message" m ON m\."id" = \(/.test(unreadCounts) || !/ORDER BY m2\."createdAt" DESC/.test(unreadCounts)) {
    fail("1 badge", "unreadMessages counts raw messages again — the phantom MeChat badge is back");
  } else ok();
  if (!/notificationsMuted" = false/.test(unreadCounts)) {
    fail("1 badge", "the badge stopped honoring mutes");
  } else ok();
}

// ── 2. The machine prefix is stripped at THIS edge too ───────────────────────
{
  if (!/parseDeliveryNotificationMessage\(n\.message\?\.trim\(\)\)\.text/.test(readInbox)) {
    fail("2 mid", "the inbox renders raw [mid:] machine prefixes again");
  } else ok();
}

// ── 3. "Caught up" belongs to the visit boundary alone ───────────────────────
{
  if (/You are caught up\./.test(feedTimeline)) {
    fail("3 caughtup", "the end-of-feed sentinel says \"caught up\" again — two meanings, one phrase, one screen");
  } else ok();
  if (!/That&rsquo;s everything\./.test(feedTimeline)) {
    fail("3 caughtup", "the end-of-list sentinel lost its own words");
  } else ok();
}

// ── 4. A rotted thumbnail degrades calmly ────────────────────────────────────
{
  const imgAt = savedList.indexOf("row.thumbnailUrl ? (");
  const block = savedList.slice(imgAt, imgAt + 1600);
  if (!/onError=\{/.test(block) || !/display = "none"/.test(block)) {
    fail("4 saved", "the snapshot <img> lost its onError fallback — broken-image glyphs on /saved again");
  } else ok();
}

// ── 5. One vocabulary for the saved toggle ───────────────────────────────────
{
  if (!/aria-label=\{saved \? "Remove from saved" : "Save post"\}/.test(postCard)) {
    fail("5 vocab", "the feed card's bookmark speaks its own dialect again");
  } else ok();
  if (!/label=\{saved \? "Remove from saved" : "Save post"\}/.test(flowClient)) {
    fail("5 vocab", "the flow rail's bookmark speaks its own dialect again");
  } else ok();
}

// ── 6. Observably stuck, never silent ────────────────────────────────────────
{
  if (!/data-testid="queue-overdue"/.test(queueView) || !/nothing has picked it up yet/.test(queueView)) {
    fail("6 queue", "an overdue queued post sits silent under Waiting again");
  } else ok();
  // SSR/client clocks differ: the judgement must be mounted-only.
  if (!/useState<number \| null>\(null\)/.test(queueView) || !/setNow\(Date\.now\(\)\)/.test(queueView)) {
    fail("6 queue", "the lateness clock lost its mounted-only guard (SSR hydration mismatch)");
  } else ok();
}

// ── 7. An empty box is not a blocked post ────────────────────────────────────
{
  if (!/const draftEmpty = !text\.trim\(\) && !title\.trim\(\)/.test(composerView)) {
    fail("7 compose", "the empty-draft neutral state is gone — first paint shows a red Blocked refusal again");
  } else ok();
  if (!/draftEmpty \? "#ffffff1f"/.test(composerView) || !/Waiting for words/.test(composerView)) {
    fail("7 compose", "the empty draft renders the WARN treatment again");
  } else ok();
  if (!/on && !\(draftEmpty && !verdict\?\.ok\)/.test(composerView)) {
    fail("7 compose", "the Blocked pill renders on an untouched composer again");
  } else ok();
}

// ── 8. Every control meets the floor ─────────────────────────────────────────
{
  const datetimeFloors = (read("src/components/compose/composer-view.tsx").match(/colorScheme: "dark", minHeight: 44/g) || []).length
    + (read("src/components/compose/queue-view.tsx").match(/colorScheme: "dark", minHeight: 44/g) || []).length;
  if (datetimeFloors < 3) {
    fail("8 floors", `only ${datetimeFloors}/3 schedule datetime inputs carry the 44px floor`);
  } else ok();
  if (!/className="flex min-h-11 items-center gap-2 text-sm/.test(tokensPanel)) {
    fail("8 floors", "the token scope rows are 19px targets again");
  } else ok();
  if (!/className="inline-flex min-h-11 items-center font-semibold/.test(tokensPanel)) {
    fail("8 floors", "'Read the docs' is an inline 15px target again — min-height is a no-op on inline elements");
  } else ok();
}

// ── 9. Integrity floors ──────────────────────────────────────────────────────
{
  const floors: Array<[string, number]> = [
    ["src/components/compose/queue-view.tsx", 12000],
    ["src/components/compose/composer-view.tsx", 12000],
    ["src/app/api/layout/unread-counts/route.ts", 1800],
  ];
  for (const [file, floor] of floors) {
    if (read(file).length < floor) {
      fail("9 floors", `${file} shrank below ${floor} bytes — a gated fix was likely deleted wholesale`);
    } else ok();
  }
}

if (failures.length > 0) {
  console.error(`journey-round2: ${failures.length} failure(s)`);
  for (const failure of failures) console.error("  " + failure);
  process.exit(1);
}
console.log(`journey-round2: all ${checks} assertions passed — the new surfaces stay honest.`);
