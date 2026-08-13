/**
 * MESHI'S JOURNAL — durable memory that stays consented, owner-typed, and
 * genuinely deletable.
 *
 * The failure shapes this gate exists to catch, each fatal to a promise the
 * product makes out loud:
 *
 *   - RETENTION WITHOUT CONSENT: the grant row is the consent, fail-closed.
 *     An absent-permissive flip means Meshi keeps memory for users never asked.
 *   - HIDDEN INSTEAD OF DELETED: "off = deleted" is a schema cascade from one
 *     teardown. A soft-delete column or second delete path makes it a lie.
 *   - THE SECOND READER: consent-check says outright it cannot see new
 *     readers of consented activity — so this gate ratchets journal-table
 *     access to ONE module and pins consent-before-computation at both doors.
 *   - THE THIRD-PARTY LEAK: a durable row built from grounded context would
 *     carry someone ELSE's name/text past their own consent withdrawal.
 *     Writers accept the owner's typed words and nothing else.
 *   - THE WATCHED COMPANION: notifications, proactive pushes, or a cached
 *     digest that outlives withdrawal turn "known" into "watched".
 *
 * WHAT THIS CANNOT PROVE (stated, consent-check style): source text, not
 * dataflow; dynamically assembled queries are invisible; runtime cascade
 * behavior needs a live DB; a future non-chat surface that speaks memory is
 * caught only by the section-4 ratchet.
 */

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const lib = strip(read("src/lib/meshi-memory.ts"));
const memoryRoute = strip(read("src/app/api/meshi/memory/route.ts"));
const chatRoute = strip(read("src/app/api/meshi/chat/route.ts"));
const schema = read("prisma/schema.prisma");
const ensure = read("prisma/ensure-schema.sql");

function body(source: string, marker: string) {
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const next = source.indexOf("export ", start + marker.length);
  return next > start ? source.slice(start, next) : source.slice(start);
}

// ── 1. Fail-closed grant ─────────────────────────────────────────────────────
{
  // No grant row = no journal, everywhere a write could happen.
  if (!/const grant = await getJournalGrant\(user\.id\);\s*if \(!grant\) return \{ error: "no-grant" as const \};/.test(body(lib, "export async function rememberKeepsake"))) {
    fail("1 fail-closed", "rememberKeepsake no longer refuses without a grant — retention without consent");
  } else ok();
  if (!/if \(!grant\) return null;/.test(body(lib, "export async function recallJournalDigest"))) {
    fail("1 fail-closed", "recallJournalDigest no longer refuses without a grant");
  } else ok();
  if (!/if \(!grant\) return;/.test(body(lib, "export async function saveThread"))) {
    fail("1 fail-closed", "saveThread no longer refuses without a grant");
  } else ok();
}

// ── 2. Cascade in BOTH schemas ───────────────────────────────────────────────
{
  const grantModel = /model MeshiJournalGrant \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? "";
  const entryModel = /model MeshiJournalEntry \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? "";
  if (!/onDelete: Cascade/.test(grantModel) || !/onDelete: Cascade/.test(entryModel)) {
    fail("2 cascade", "a journal cascade is gone from schema.prisma — withdrawal orphans memory rows");
  } else ok();
  const ensureGrant = /CREATE TABLE IF NOT EXISTS "MeshiJournalGrant"[\s\S]*?\);/.exec(ensure)?.[0] ?? "";
  const ensureEntry = /CREATE TABLE IF NOT EXISTS "MeshiJournalEntry"[\s\S]*?\);/.exec(ensure)?.[0] ?? "";
  if (!/ON DELETE CASCADE/.test(ensureGrant) || !/ON DELETE CASCADE/.test(ensureEntry)) {
    fail("2 cascade", "a journal cascade is gone from ensure-schema.sql — fresh production databases get orphaning tables (the MessageThread failure reborn)");
  } else ok();
}

// ── 3. One teardown; delete, not hide ────────────────────────────────────────
{
  const deleteSites = execFileSync(
    "grep",
    ["-rc", "--include=*.ts", "--include=*.tsx", "--exclude-dir=generated", "meshiJournalGrant.delete", "src/"],
    { cwd: ROOT },
  ).toString().trim().split("\n").filter((line) => !line.endsWith(":0"));
  if (deleteSites.length !== 1 || !deleteSites[0].startsWith("src/lib/meshi-memory.ts")) {
    fail("3 teardown", `the grant delete exists in ${deleteSites.join(", ") || "no file"} — exactly one teardown, in the lib, is the rule`);
  } else ok();
  if (!/meshiJournalGrant\.deleteMany\(\{ where: \{ userId \} \}\)/.test(body(lib, "export async function withdrawMeshiJournal"))) {
    fail("3 teardown", "withdrawMeshiJournal no longer deletes the grant row");
  } else ok();
  if (/hiddenAt|archivedAt|disabled/.test(/model MeshiJournalGrant \{[\s\S]*?\n\}[\s\S]*?model MeshiJournalEntry \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? "")) {
    fail("3 teardown", "a soft-delete column appeared on a journal model — off must mean deleted, never hidden");
  } else ok();
  if (!/withdrawMeshiJournal/.test(memoryRoute) || !/withdrawMeshiJournal/.test(chatRoute)) {
    fail("3 teardown", "a forget-all surface no longer calls the single teardown");
  } else ok();
}

// ── 4. Single-definition ratchet ─────────────────────────────────────────────
{
  // consent-check states it cannot see NEW readers of consented activity.
  // This is the answer: the journal tables are touchable from exactly one
  // module, so a new reader/writer anywhere else fails the build.
  const sites = execFileSync(
    "grep",
    ["-rlE", "--include=*.ts", "--include=*.tsx", "--exclude-dir=generated", "meshiJournal(Grant|Entry)\\.", "src/"],
    { cwd: ROOT },
  ).toString().trim().split("\n").filter(Boolean).sort();
  if (sites.join() !== "src/lib/meshi-memory.ts") {
    fail("4 ratchet", `journal tables are accessed outside the lib: ${sites.join(", ")} — an ungated computation path over memory`);
  } else ok();
}

// ── 5. Consent before computation, both doors ────────────────────────────────
{
  const adjudicationAt = memoryRoute.indexOf('if (!grant && action !== "grant" && action !== "forget-all")');
  const switchAt = memoryRoute.indexOf("switch (action)");
  if (adjudicationAt < 0 || switchAt < 0 || adjudicationAt > switchAt) {
    fail("5 doors", "the memory route no longer adjudicates the grant BEFORE the action switch");
  } else ok();
  if (!/status: 403/.test(memoryRoute.slice(0, switchAt > 0 ? switchAt : undefined))) {
    fail("5 doors", "the pre-switch refusal is not a 403");
  } else ok();
  const consentAt = chatRoute.indexOf("hasMeshiConsent(user.id)");
  const recallAt = chatRoute.indexOf("recallJournalDigest(user)");
  if (consentAt < 0 || recallAt < 0 || recallAt < consentAt) {
    fail("5 doors", "the chat route recalls memory before the consent gates — hoisted recall");
  } else ok();
  // The engine-door repetition: the lib re-checks BOTH itself, so no caller
  // can hoist the adjudication away from the data.
  const recallBody = body(lib, "export async function recallJournalDigest");
  if (!/hasMeshiConsent\(user\.id\)/.test(recallBody) || !/getJournalGrant\(user\.id\)/.test(recallBody)) {
    fail("5 doors", "recallJournalDigest lost its own consent/grant re-check — a paused read rule keeps feeding stored memory upstream");
  } else ok();
}

// ── 6. Owner-text-only writes / third-party exclusion ────────────────────────
{
  if (/meshEntities|focusedContent|MeshGraphEntity|authorId|displayName/.test(lib + memoryRoute)) {
    fail("6 owner-text", "grounded-context tokens appear in the journal lib or route — another person's handle/text could become durably stored past their consent");
  } else ok();
  if (/meshi-content|meshi-knowledge/.test(lib)) {
    fail("6 owner-text", "the journal lib imports Meshi content/knowledge modules");
  } else ok();
  // The thread writer's input is THE USER'S OWN MESSAGE — never the reply.
  if (!/saveThread\(user, message\)/.test(chatRoute)) {
    fail("6 owner-text", "the thread write no longer takes the user's own message — a model-authored digest can smuggle third parties into durable rows");
  } else ok();
  if (!/MESHI_JOURNAL_KINDS = \["nickname", "keepsake", "thread"\] as const/.test(lib)) {
    fail("6 owner-text", "the closed kind union changed — new kinds need their own consent argument");
  } else ok();
}

// ── 7. Caps literal, pre-create, refusal not eviction ────────────────────────
{
  if (!/free: \{ keepsakes: 5, thread: 0 \}/.test(lib) || !/pro: \{ keepsakes: 100, thread: 1 \}/.test(lib)) {
    fail("7 caps", "the journal caps changed silently — 5 free / 100 Pro are decisions, not defaults");
  } else ok();
  if (!/KEEPSAKE_MAX = 500/.test(lib) || !/NICKNAME_MAX = 32/.test(lib) || !/THREAD_MAX = 1000/.test(lib) || !/THREAD_TTL_DAYS = 30/.test(lib) || !/RECALL_BUDGET = 3000/.test(lib)) {
    fail("7 caps", "a size/TTL/budget literal drifted — memory is a diary, not a warehouse");
  } else ok();
  const rememberBody = body(lib, "export async function rememberKeepsake");
  const countAt = rememberBody.indexOf(".count(");
  const createAt = rememberBody.indexOf(".create(");
  if (countAt < 0 || createAt < 0 || countAt > createAt) {
    fail("7 caps", "the cap check no longer precedes the create — unbounded storage");
  } else ok();
  if (/deleteMany/.test(rememberBody)) {
    fail("7 caps", "the keepsake write evicts — the companion silently forgets what it promised to keep");
  } else ok();
  const atCap = /message: "([^"]+)"/.exec(rememberBody)?.[1] ?? "";
  if (!atCap || /Pro|MeshPro/.test(atCap)) {
    fail("7 caps", "the at-cap refusal names Pro (or vanished) — Meshi's mouth became a checkout");
  } else ok();
}

// ── 8. Pro via the union; free kernel pinned ─────────────────────────────────
{
  if (!/hasMeshPro\(user\)/.test(/function resolveJournalCaps[\s\S]*?\n\}/.exec(lib)?.[0] ?? "")) {
    fail("8 union", "resolveJournalCaps no longer branches on hasMeshPro — founders and gift recipients lose their journal mid-gift");
  } else ok();
  if (/\.isMeshPro\b/.test(lib)) {
    fail("8 union", "the lib reads the raw isMeshPro column");
  } else ok();
}

// ── 9. Server-side digest only ───────────────────────────────────────────────
{
  if (!/const memoryDigest = await recallJournalDigest\(user\);/.test(chatRoute)) {
    fail("9 server-side", "the chat digest is no longer server-assembled");
  } else ok();
  if (/body\.memoryDigest|context\.memoryDigest/.test(chatRoute)) {
    fail("9 server-side", "the chat route reads a client-supplied digest — any client injects memories the server never stored");
  } else ok();
  if (/memoryDigest/.test(strip(read("src/lib/meshi-shared.ts")))) {
    fail("9 server-side", "memoryDigest leaked onto the client-facing shared types");
  } else ok();
}

// ── 10. No proactive surface, no cache, claims true ──────────────────────────
{
  if (/prisma\.notification|sendPushForNotification|publishMeshiCause|meshi_delivery/.test(lib + memoryRoute)) {
    fail("10 quiet", "the journal grew a notification — a 'Meshi misses you' is the watched-not-known failure");
  } else ok();
  if (/ttl-memo|mesh-cache|memoizeWithTtl/.test(lib)) {
    fail("10 quiet", "the journal is cached — a memoized digest survives withdrawal until TTL");
  } else ok();
  if (/meshi_journal|meshi_memory_note/.test(strip(read("src/lib/notifications.ts")))) {
    fail("10 quiet", "a journal notification type appeared in the notifications plumbing");
  } else ok();
  const meshpro = read("src/app/(app)/meshpro/page.tsx");
  const card = /const unlocks[\s\S]*?\];/.exec(meshpro)?.[0] ?? "";
  if (!/Meshi's journal|Meshi&apos;s journal/.test(card) || !/resolveJournalCaps/.test(card)) {
    fail("10 quiet", "the journal card or its enforcedIn pointer is gone from /meshpro");
  } else ok();
  if (!/anything you didn't type|anything you didn&apos;t type/.test(meshpro)) {
    fail("10 quiet", "the card's owner-typed promise sentence is gone — an advertised promise nothing states");
  } else ok();
  if (!/resolveJournalCaps/.test(read("src/lib/meshi-memory.ts"))) {
    fail("10 quiet", "the enforcedIn symbol no longer exists in the lib");
  } else ok();
  if (!/deletes every entry immediately and permanently/.test(read("src/app/privacy/page.tsx"))) {
    fail("10 quiet", "the privacy page no longer states delete-on-withdrawal");
  } else ok();
}

if (failures.length) {
  console.error(`\nmeshi-memory: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`meshi-memory: all ${checks} assertions passed — owner-typed, fail-closed, one reader, and off truly means deleted.`);
