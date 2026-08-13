/**
 * THE LONG VIEW — lifetime depth that stays honest, bounded, and quiet.
 *
 * The failure shapes this gate exists to catch:
 *
 *   - THE UNBOUNDED SCAN: "lifetime" quietly becoming a raw event-table read
 *     on every page view. Reads are month-grouped aggregates or hard-limited;
 *     the fold runs once per user per UTC day.
 *   - ZERO WHERE NOTHING WAS MEASURED: a month before a metric existed
 *     rendering as silence. Untracked is a TYPED state — `?? 0` cannot erase
 *     it, and the legend says so on the surface.
 *   - THE WARM CACHE PAST A LAPSE: consent and plan adjudicate BEFORE the
 *     memo, so a lapsed or withdrawn account can never hit a cached answer.
 *   - FREE SHRINKING BY A BYTE: the 14-day charts and 30-day metrics are
 *     load-bearing free-tier promises; the lifetime loader must be invisible
 *     to the dashboard and to free accounts.
 *   - THE DRESSED-UP MILESTONE: month-precision facts wearing day-precision
 *     clothes. Milestones carry a month key, never a Date.
 *
 * WHAT THIS CANNOT PROVE: real query latency (the bounds are structural);
 * the at-rest DateTime encoding (verified once against the live DB — the
 * loader's runtime canary cross-checks every fold thereafter).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  composeLifetime,
  evidenceStart,
  foldEras,
  foldMonthly,
  lifetimeMonthKeys,
  thresholdMilestones,
} from "../src/lib/analytics-eras";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const loader = strip(read("src/lib/analytics-lifetime.ts"));
const dashboard = strip(read("src/lib/analytics-dashboard.ts"));
const shelf = strip(read("src/components/analytics/lifetime-shelf.tsx"));
const page = strip(read("src/app/(app)/analytics/page.tsx"));
const meshproPage = strip(read("src/app/(app)/meshpro/page.tsx"));

// ── 1. Symbols + the one decider ─────────────────────────────────────────────
{
  if (typeof evidenceStart !== "function" || typeof lifetimeMonthKeys !== "function" ||
      typeof foldMonthly !== "function" || typeof foldEras !== "function" || typeof composeLifetime !== "function") {
    fail("1 symbols", "a pure export vanished — the truth tables below have no subject");
  } else ok();
  if (!/export async function getLifetimeAnalytics/.test(loader)) {
    fail("1 symbols", "getLifetimeAnalytics left the loader");
  } else ok();
  if (!/lifetime:\s*isPro/.test(dashboard)) {
    fail("1 symbols", "analyticsWindow lost its lifetime leg — the /meshpro card's enforcedIn pointer no longer decides this sentence");
  } else ok();
}

// ── 2. Adjudication order: consent → plan → memo ─────────────────────────────
{
  const entry = loader.slice(loader.indexOf("export async function getLifetimeAnalytics"));
  const entryBody = entry.slice(0, entry.indexOf("\n}"));
  const consentAt = entryBody.indexOf("hasAnalyticsConsent(");
  const planAt = entryBody.indexOf("analyticsWindow(hasMeshPro(user)).lifetime");
  const loadAt = entryBody.indexOf("loadLifetime(");
  if (consentAt < 0 || planAt < 0 || loadAt < 0 || !(consentAt < planAt && planAt < loadAt)) {
    fail("2 order", "the entry no longer adjudicates consent, then plan, then memo — a lapsed account could hit a warm cache");
  } else ok();
  if ((loader.match(/loadLifetime\(user\)/g) ?? []).length !== 1) {
    fail("2 order", "loadLifetime is invoked from more than one place — a second door could skip the adjudication");
  } else ok();
}

// ── 3. Free untouched, to the byte ───────────────────────────────────────────
{
  if (!/CHART_DAYS_FREE = 14/.test(dashboard) || !/METRIC_WINDOW_DAYS_FREE = 30/.test(dashboard)) {
    fail("3 free", "a free window literal moved — nothing free shrinks, ever");
  } else ok();
  if (!/analyticsWindow\(hasMeshPro\(user\)\)/.test(dashboard)) {
    fail("3 free", "the dashboard no longer asks the one decider");
  } else ok();
  if (/analytics-lifetime/.test(dashboard)) {
    fail("3 free", "the dashboard references the lifetime loader — the daily path must not grow lifetime weight");
  } else ok();
  if (!/user\.isMeshPro \? getLifetimeAnalytics\(\) : Promise\.resolve\(null\)/.test(page)) {
    fail("3 free", "the page fetches the long view outside the explicit plan condition — free accounts must never even ask");
  } else ok();
}

// ── 4. Bounded reads only, executed ──────────────────────────────────────────
{
  const findManyBlocks = loader.match(/findMany\(\{[\s\S]*?\}\)/g) ?? [];
  for (const block of findManyBlocks) {
    if (!/take:\s*\d+/.test(block)) {
      fail("4 bounded", `a findMany in the loader has no take: — an unbounded event read\n${block.slice(0, 120)}`);
    } else ok();
  }
  const rawBlocks = loader.match(/\$queryRaw[\s\S]*?`/g)?.length ?? 0;
  const rawStatements = loader.split("$queryRaw").slice(1);
  for (const statement of rawStatements) {
    const sql = statement.slice(0, statement.indexOf("`,") > 0 ? statement.indexOf("`,") : statement.length);
    // A grouped statement must bucket by month/year (rows out ≤ the axis); a
    // non-grouped one is bounded by its LIMIT alone (the top-5 shape).
    if (/GROUP BY/.test(sql) && !/strftime\('%Y(-%m)?'/.test(sql)) {
      fail("4 bounded", "a grouped raw statement lost its month/year bucket — raw event rows would cross the wire");
    } else ok();
    if (!/LIMIT \d+/.test(sql)) {
      fail("4 bounded", "a raw statement lost its LIMIT");
    } else ok();
    if (/PlatformPost/.test(sql) && !/isNsfw/.test(sql)) {
      fail("4 bounded", "a platform-post statement dropped the isNsfw predicate — the safety filter must survive the SQL translation");
    } else ok();
  }
  if (rawBlocks === 0) {
    fail("4 bounded", "the loader has no raw month-grouped statements at all — the aggregation moved somewhere unseen");
  } else ok();

  const epoch = lifetimeMonthKeys(new Date(0), new Date("2026-08-13T12:00:00Z"));
  if (epoch.keys.length > 264 || epoch.keys[0] !== "2005-01" || !epoch.clamped) {
    fail("4 bounded", `an epoch-zero start stretched the axis: len=${epoch.keys.length} first=${epoch.keys[0]}`);
  } else ok();
  const future = lifetimeMonthKeys(new Date("2030-01-01T00:00:00Z"), new Date("2026-08-13T12:00:00Z"));
  if (future.keys.length !== 0) {
    fail("4 bounded", "a future start mints slots instead of an empty axis");
  } else ok();
}

// ── 5. Untracked is not zero, executed ───────────────────────────────────────
{
  const keys = ["2020-01", "2020-02", "2020-03", "2020-04"];
  const points = foldMonthly(keys, [{ month: "2020-03", value: 4 }, { month: "1999-12", value: 9 }], "2020-03");
  const pre = points.find((p) => p.month === "2020-01");
  const trackedEmpty = points.find((p) => p.month === "2020-04");
  if (!pre || !("state" in pre) || pre.state !== "untracked") {
    fail("5 untracked", "a pre-inception month composed as a number — the measurement gap became silence");
  } else ok();
  if (JSON.stringify(points).includes('"month":"2020-01","value"')) {
    fail("5 untracked", "the serialized payload carries a value for an untracked month");
  } else ok();
  if (!trackedEmpty || !("value" in trackedEmpty) || trackedEmpty.value !== 0) {
    fail("5 untracked", "a tracked-but-empty month is not a real 0");
  } else ok();
  if (points.some((p) => p.month === "1999-12")) {
    fail("5 untracked", "an unknown month key was slotted instead of dropped");
  } else ok();
  if (!/They read as untracked, not as zero\./.test(shelf)) {
    fail("5 untracked", "the shelf lost the untracked legend — the pixel no longer says what the type says");
  } else ok();
}

// ── 6. Attribution + precision ───────────────────────────────────────────────
{
  if (!/as the platforms report it today/.test(shelf)) {
    fail("6 precision", "the attribution footnote is gone — present-day totals credited to publish months would read as historical measurements");
  } else ok();
  const keys = ["2021-01", "2021-02", "2021-03"];
  const milestones = thresholdMilestones(keys, [
    { month: "2021-01", value: 60 },
    { month: "2021-02", value: 50 },
    { month: "2021-03", value: 900 },
  ]);
  const hundred = milestones.find((m) => m.threshold === 100);
  const thousand = milestones.find((m) => m.threshold === 1000);
  if (!hundred || hundred.monthKey !== "2021-02" || !thousand || thousand.monthKey !== "2021-03") {
    fail("6 precision", `threshold crossings resolve to the wrong month: ${JSON.stringify(milestones)}`);
  } else ok();
  if (milestones.some((m) => Object.values(m as Record<string, unknown>).some((v) => v instanceof Date))) {
    fail("6 precision", "a milestone carries a Date — month precision dressed as a day");
  } else ok();
}

// ── 7. Score parity with the dashboard ───────────────────────────────────────
{
  for (const source of [loader, dashboard]) {
    if (!/\* 8/.test(source) || !/\* 12/.test(source) || !/\* 15/.test(source)) {
      fail("7 parity", "the 8/12/15 engagement weights drifted between lifetime and dashboard — one account, two scales");
    } else ok();
  }
  if (!/likeCount \* 8 \+ pp\.commentCount \* 12 \+ pp\.shareCount \* 15/.test(loader)) {
    fail("7 parity", "the lifetime SQL score no longer matches the house scale");
  } else ok();
  // EVERY scoring site, not at-least-one: a drift in a single statement means
  // two lists on the same page rank the same post differently.
  if (/likeCount \* (?!8[^\d])\d+/.test(loader) || /commentCount \* (?!12[^\d])\d+/.test(loader) || /shareCount \* (?!15[^\d])\d+/.test(loader)) {
    fail("7 parity", "a scoring statement drifted from 8/12/15 while another kept it — one account, two scales on one page");
  } else ok();
}

// ── 8. Staleness disclosed, cache isolated ───────────────────────────────────
{
  if (!/ttlMs: 24 \* 60 \* 60 \* 1000/.test(loader)) {
    fail("8 cache", "the memo is no longer a day — either page views got expensive or staleness got dishonest");
  } else ok();
  if (!/key: \(user\) => `\$\{user\.id\}:\$\{utcDayKey\(\)\}`/.test(loader)) {
    fail("8 cache", "the memo key lost its user.id prefix or its UTC-day component — cross-user or stale-forever");
  } else ok();
  if (!/recounts daily/.test(shelf) || !/\{counted\}/.test(shelf)) {
    fail("8 cache", "the shelf no longer discloses when it counted");
  } else ok();
  const composed = composeLifetime({
    now: new Date("2026-08-13T12:00:00Z"), keys: ["2026-08"], clamped: false, undatedCount: 0,
    spineRows: [{ month: "2026-08", value: 1 }], spineTrackedFrom: "2026-08",
    series: [{ key: "gone", label: "Gone", trackedFrom: null, reason: null, rows: [] }],
    platformPerYear: new Map(), bestPostPerYear: new Map(), firsts: [], topPosts: [],
  });
  if (!composed.computedAt) {
    fail("8 cache", "the payload lost computedAt");
  } else ok();
  if (composed.series.length !== 0) {
    fail("8 cache", "a never-tracked series composed an all-null husk instead of being omitted");
  } else ok();
}

// ── 9. Read-only slice ───────────────────────────────────────────────────────
{
  const eras = strip(read("src/lib/analytics-eras.ts"));
  if (/\.create\(|\.update\(|\.upsert\(|\.delete\(|executeRaw/.test(loader + eras)) {
    fail("9 read-only", "a lifetime module writes — this slice is a READ of history, never a writer");
  } else ok();
  if (/model Lifetime/i.test(read("prisma/schema.prisma"))) {
    fail("9 read-only", "a lifetime table appeared — the fold is cheap enough to never persist");
  } else ok();
}

// ── 10. The verb stays quiet ─────────────────────────────────────────────────
{
  if (/\bLock\b|Unlock|blur|countdown|uppercase/.test(shelf)) {
    fail("10 quiet", "the shelf grew a tease or a transform — /meshpro is the sales surface, this is not");
  } else ok();
  if (!/user\.isMeshPro && lifetime && \(/.test(page)) {
    fail("10 quiet", "LifetimeShelf no longer mounts inside the explicit plan condition");
  } else ok();
  if (!/\{user\.isMeshPro &&[\s\S]{0,200}<ReportShelf/.test(page)) {
    fail("10 quiet", "the ReportShelf canary broke — analytics-report-check §9's mount law regressed");
  } else ok();
  if (/Unlock/.test(strip(read("src/components/analytics/pro-insights.tsx")))) {
    fail("10 quiet", "ProInsights grew an Unlock");
  } else ok();
}

// ── 11. Card, code, and coverage-honest copy agree ───────────────────────────
{
  const memoryCard = meshproPage.slice(meshproPage.indexOf('title: "A longer memory"'), meshproPage.indexOf('title: "A longer memory"') + 500);
  if (!/day one/.test(memoryCard)) {
    fail("11 card", "the memory card no longer sells the long view while analytics-lifetime.ts delivers it");
  } else ok();
  if (/aura|audience overlap|exportable reports/.test(memoryCard)) {
    fail("11 card", "the card body picked up a banned phrase");
  } else ok();
  const inventoryCard = strip(read("src/components/analytics/content-inventory-card.tsx"));
  if (!/The first post we can see:/.test(inventoryCard)) {
    fail("11 card", "the free inventory lost its first-post fact line");
  } else ok();
  const firstSeenBlock = inventoryCard.slice(inventoryCard.indexOf("The first post we can see"), inventoryCard.indexOf("The first post we can see") + 400);
  if (/everywhere|all your|every |across all|complete history/.test(firstSeenBlock)) {
    fail("11 card", "the first-post line claims completeness — 'we can see' is the honest scope");
  } else ok();
}

if (failures.length) {
  console.error(`\nanalytics-lifetime: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`analytics-lifetime: all ${checks} assertions passed — the long view is bounded, honestly gapped, cached per person per day, and invisible to free accounts.`);
