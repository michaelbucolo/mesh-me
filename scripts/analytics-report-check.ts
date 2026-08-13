/**
 * THE MESH REPORT — a closed period, composed honestly, sold without touching
 * what is free.
 *
 * This feature's load-bearing member is a LINE, not a function: rows are
 * yours, composition is ours. The raw numbers (the dashboard, the CSV, the
 * GDPR dump) stay free forever; what MeshPro sells is the labor of closing a
 * period, differencing it against the one before, ranking it, caveating it,
 * and typesetting it into a hand-overable document. Every failure shape below
 * is one side of that line collapsing:
 *
 *   - the composed document leaking to free (the paid claim becomes false);
 *   - a plan test growing on the raw routes (free gets worse to sell Pro);
 *   - another person's identity entering an exportable artifact;
 *   - the comparison quietly becoming wrong (the headline feature lies);
 *   - the artifact phoning home (a "document" that needs the network).
 *
 * WHAT THIS CANNOT PROVE: that the queries return correct rows. It pins the
 * arithmetic (executed on fixtures), the adjudication order, and the fences.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  composeAnalyticsReport,
  reportWindows,
  resolveReportPeriod,
  type ReportPeriod,
  type ReportWindowAggregate,
} from "../src/lib/analytics-report";
import { renderReportHtml } from "../src/lib/analytics-report-html";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const loader = strip(read("src/lib/analytics-report-loader.ts"));
const template = strip(read("src/lib/analytics-report-html.ts"));
const reportRoute = strip(read("src/app/api/analytics/report/route.ts"));
const cardRoute = strip(read("src/app/api/analytics/report/card/route.ts"));
const seriesRoute = strip(read("src/app/api/analytics/series/route.ts"));
const analyticsPage = strip(read("src/app/(app)/analytics/page.tsx"));

const NOW = new Date(Date.UTC(2026, 7, 13));
const OLD_ACCOUNT = new Date(Date.UTC(2024, 0, 15));

function aggregate(overrides: Partial<ReportWindowAggregate> = {}): ReportWindowAggregate {
  return {
    posts: 0, views: 0, likes: 0, comments: 0, shares: 0, engagement: 0,
    followersGained: 0, followersLost: 0, platforms: [], scoredPosts: [],
    ...overrides,
  };
}

const FINDINGS = {
  timing: { status: "insufficient" as const, have: 3, need: 12 },
  formats: { status: "insufficient" as const, have: 3, need: 8 },
};
const EXTRAS = {
  multiPlatformCount: 2,
  coverage: { readable: [{ id: "youtube", name: "YouTube" }], unreadable: [{ id: "snapchat", name: "Snapchat" }] },
  composedAt: NOW,
};

// ── 1. Parser/symbol sanity ──────────────────────────────────────────────────
{
  // The /meshpro card points at this loader symbol; if the symbol vanished,
  // every behavioral check below would silently be checking nothing.
  if (typeof resolveReportPeriod !== "function" || typeof reportWindows !== "function" || typeof composeAnalyticsReport !== "function" || typeof renderReportHtml !== "function") {
    fail("1 symbols", "a core report symbol no longer resolves");
  } else ok();
  if (!/export async function getAnalyticsReport\(/.test(loader)) {
    fail("1 symbols", "getAnalyticsReport is gone from the loader — the /meshpro card's enforcedIn pointer is dangling");
  } else ok();
}

// The queries live in helpers loadReport() fans out to, so the thing to pin
// is the ENTRY POINT's body: getAnalyticsReport is the loader's one exported
// door, and inside it consent → plan → loadReport must hold in that order,
// with loadReport reachable from nowhere else.
const entryBody = loader.slice(loader.indexOf("export async function getAnalyticsReport"));

// ── 2. Consent precedes computation ──────────────────────────────────────────
{
  // A brand-new reader of the same activity the Analytics rule governs;
  // consent-check's own header says it cannot see new analytics readers, so
  // this gate pins it instead.
  const consentAt = entryBody.indexOf("hasAnalyticsConsent(");
  const loadAt = entryBody.indexOf("loadReport(");
  if (consentAt < 0) {
    fail("2 consent", "the entry point no longer checks hasAnalyticsConsent — the analytics-off switch is a lie for the report");
  } else ok();
  if (loadAt < 0 || (consentAt >= 0 && loadAt < consentAt)) {
    fail("2 consent", "the report loads before the consent check in the entry point");
  } else ok();
  // Nothing may reach the queries around the door: the memoized loader is
  // invoked exactly once, inside the guarded entry point.
  const invocations = loader.match(/loadReport\(/g) ?? [];
  if (invocations.length !== 1) {
    fail("2 consent", `loadReport( is invoked ${invocations.length} times — a second call site can bypass the consent/plan door`);
  } else ok();
}

// ── 3. Pro adjudicated before composition; periods must be CLOSED ────────────
{
  const proAt = entryBody.indexOf("isMeshPro");
  const loadAt = entryBody.indexOf("loadReport(");
  if (proAt < 0 || loadAt < 0 || proAt > loadAt) {
    fail("3 adjudication", "the entry point no longer tests isMeshPro before loading — the paid document composes for free accounts");
  } else ok();

  if (resolveReportPeriod("garbage", OLD_ACCOUNT, NOW) !== null || resolveReportPeriod("2026-13", OLD_ACCOUNT, NOW) !== null || resolveReportPeriod("", OLD_ACCOUNT, NOW) !== null) {
    fail("3 adjudication", "resolveReportPeriod accepts garbage");
  } else ok();
  // August 2026 is in progress on the fixture clock; 2026 the year even more so.
  if (resolveReportPeriod("2026-08", OLD_ACCOUNT, NOW) !== null || resolveReportPeriod("2026", OLD_ACCOUNT, NOW) !== null || resolveReportPeriod("2027-01", OLD_ACCOUNT, NOW) !== null) {
    fail("3 adjudication", "resolveReportPeriod accepts an unfinished or future period — the 'closed period' promise ships an open one");
  } else ok();
  if (resolveReportPeriod("2026-07", OLD_ACCOUNT, NOW)?.kind !== "month" || resolveReportPeriod("2025", OLD_ACCOUNT, NOW)?.kind !== "year") {
    fail("3 adjudication", "resolveReportPeriod refuses valid closed periods");
  } else ok();
  // A period that fully ended before the account existed holds nothing.
  if (resolveReportPeriod("2023-06", OLD_ACCOUNT, NOW) !== null) {
    fail("3 adjudication", "resolveReportPeriod accepts a period that ended before the account existed");
  } else ok();
}

// ── 4. Portability stays free ────────────────────────────────────────────────
{
  // The line's free half, greppable: neither raw route may consult the plan.
  if (/isMeshPro|hasMeshPro/.test(seriesRoute)) {
    fail("4 portability", "the free CSV route consults the plan — the raw/composed line collapsed");
  } else ok();
  const dataControls = strip(read("src/app/api/data-controls/route.ts"));
  const getHandler = dataControls.slice(dataControls.indexOf("export async function GET"), dataControls.indexOf("export async function POST"));
  if (!getHandler) fail("4 portability", "could not locate the data-controls GET handler to audit");
  else if (/isMeshPro|hasMeshPro/.test(getHandler)) {
    fail("4 portability", "the GDPR dump grew a plan test — data portability is a right, not a perk");
  } else ok();
}

// ── 5. No third parties in the artifact ──────────────────────────────────────
{
  const marker = "XLEAKX_handle";
  const report = composeAnalyticsReport(
    resolveReportPeriod("2026-07", OLD_ACCOUNT, NOW) as ReportPeriod,
    aggregate({
      posts: 2,
      scoredPosts: [
        { title: "My own post", platformName: "YouTube", postType: "video", publishedAt: new Date(Date.UTC(2026, 6, 3)), score: 10, views: 5, likes: 1, comments: 0 },
      ],
      platforms: [{ platform: "youtube", platformName: "YouTube", posts: 2, views: 5, likes: 1, comments: 0, shares: 0, followersGained: 3, followersLost: 1 }],
    }),
    aggregate(),
    FINDINGS,
    EXTRAS,
  );
  const serialized = JSON.stringify(report);
  if (serialized.includes(marker) || "superfans" in (report as unknown as Record<string, unknown>)) {
    fail("5 privacy", "the composed report carries follower identities or a superfans list — other people's identities in a hand-overable file");
  } else ok();
  // The loader's follower read is for COUNTING: handles only, never a name or
  // a face. (The count is a number in the report; the list never exists.)
  const followerSelect = /platformFollower\.findMany\(\{[\s\S]*?\}\)/.exec(loader)?.[0] ?? "";
  if (!followerSelect) fail("5 privacy", "could not locate the follower count query to audit");
  else if (/displayName|avatarUrl|profileUrl/.test(followerSelect)) {
    fail("5 privacy", "the loader selects follower identity fields — displayName/avatarUrl must never enter this module");
  } else ok();
  // The only displayName the template may know is the OWNER's — the render
  // parameter — never a field read off some other person's row.
  const templateMinusOwner = template
    .replace(/owner\s*:\s*\{ displayName: string; username: string \}/g, "")
    .replace(/owner\.displayName/g, "");
  if (/displayName|avatarUrl|profileUrl|superfans/.test(templateMinusOwner)) {
    fail("5 privacy", "the template renders identity fields beyond the owner's own name");
  } else ok();
}

// ── 6. Comparison is real and windows abut ───────────────────────────────────
{
  const period = resolveReportPeriod("2026-07", OLD_ACCOUNT, NOW) as ReportPeriod;
  const report = composeAnalyticsReport(
    period,
    aggregate({ views: 300, likes: 30 }),
    aggregate({ views: 200, likes: 45 }),
    FINDINGS,
    EXTRAS,
  );
  const views = report.totals.find((row) => row.id === "views");
  const likes = report.totals.find((row) => row.id === "likes");
  if (views?.delta !== 100 || views?.pct !== 50) {
    fail("6 comparison", `an increase differences wrong: delta=${views?.delta}, pct=${views?.pct} — the headline feature is a zero generator`);
  } else ok();
  if (likes?.delta !== -15) {
    fail("6 comparison", `a decrease differences wrong: delta=${likes?.delta}`);
  } else ok();
  if (report.previousState !== "ok") {
    fail("6 comparison", "a real previous aggregate is reported as incomplete");
  } else ok();

  const incomplete = composeAnalyticsReport(period, aggregate({ views: 10 }), null, FINDINGS, EXTRAS);
  if (incomplete.previousState !== "incomplete" || incomplete.totals.some((row) => row.delta !== null)) {
    fail("6 comparison", "a missing prior period fabricates deltas instead of saying so");
  } else ok();

  // Windows abut EXACTLY for every period shape: half-open [start, end),
  // previous.end === current.start — no gap for a day to fall into, no
  // overlap to count one twice. January proves the year boundary.
  for (const param of ["2026-07", "2026-01", "2025"]) {
    const p = resolveReportPeriod(param, OLD_ACCOUNT, NOW) as ReportPeriod;
    const w = reportWindows(p);
    if (w.previous.end.getTime() !== w.current.start.getTime() || w.previous.start.getTime() >= w.previous.end.getTime() || w.current.start.getTime() >= w.current.end.getTime()) {
      fail("6 comparison", `windows for ${param} do not abut cleanly — every delta is quietly wrong`);
    } else ok();
  }
}

// ── 7. Self-contained document ───────────────────────────────────────────────
{
  const period = resolveReportPeriod("2026-07", OLD_ACCOUNT, NOW) as ReportPeriod;
  const html = renderReportHtml(
    composeAnalyticsReport(period, aggregate({ views: 5 }), null, FINDINGS, EXTRAS),
    { displayName: "Alex", username: "alexcreates" },
  );
  if (/<script/i.test(html)) {
    fail("7 artifact", "the report document contains a <script> tag");
  } else ok();
  if (/https?:\/\//i.test(html) || /@import/i.test(html)) {
    fail("7 artifact", "the report document references an external asset — the artifact phones home and breaks offline/print");
  } else ok();
  if (!/@media print/.test(html)) {
    fail("7 artifact", "the print stylesheet is gone — browser Save-as-PDF was the whole PDF story");
  } else ok();
  // Text a person typed is escaped before it becomes markup.
  const hostile = renderReportHtml(
    composeAnalyticsReport(period, aggregate({
      posts: 1,
      scoredPosts: [{ title: `<script>alert(1)</script>`, platformName: "YouTube", postType: "video", publishedAt: null, score: 5, views: 5, likes: 0, comments: 0 }],
    }), null, FINDINGS, EXTRAS),
    { displayName: `<img src=x>`, username: "alexcreates" },
  );
  if (/<script>alert|<img src=x>/.test(hostile)) {
    fail("7 artifact", "user text reaches the document unescaped");
  } else ok();
}

// ── 8. Sample honesty ────────────────────────────────────────────────────────
{
  const period = resolveReportPeriod("2026-07", OLD_ACCOUNT, NOW) as ReportPeriod;
  const html = renderReportHtml(
    composeAnalyticsReport(period, aggregate(), null, FINDINGS, EXTRAS),
    { displayName: "Alex", username: "alexcreates" },
  );
  // BOTH findings render their insufficient state, each with its own words —
  // a shared "Not enough" match would let one branch vanish behind the other.
  if (!/Not enough dated posts/.test(html)) {
    fail("8 honesty", "the timing insufficient branch is gone — three-post astrology in a document a sponsor reads");
  } else ok();
  if (!/to compare formats/.test(html)) {
    fail("8 honesty", "the format insufficient branch is gone");
  } else ok();
  if (!/bestTime|bestFormat/.test(loader) || !/from "\.\/pro-analytics"/.test(loader)) {
    fail("8 honesty", "the loader no longer derives findings from pro-analytics' discriminated helpers");
  } else ok();
}

// ── 9. The verb stays quiet ──────────────────────────────────────────────────
{
  // The shelf mounts under an EXPLICIT plan condition (`pro` from
  // getProAnalytics is populated for free accounts — a null guard is not a
  // plan guard), and no surface shows free users a locked report verb.
  if (!/user\.isMeshPro && \(\s*<div[^>]*>\s*<ReportShelf/.test(analyticsPage.replace(/\n/g, " ").replace(/\s+/g, " ")) &&
      !/\{user\.isMeshPro &&[\s\S]{0,200}<ReportShelf/.test(analyticsPage)) {
    fail("9 quiet", "ReportShelf no longer mounts inside an explicit user.isMeshPro condition");
  } else ok();
  const shelf = strip(read("src/components/analytics/report-shelf.tsx"));
  const proInsights = strip(read("src/components/analytics/pro-insights.tsx"));
  if (/\bLock\b|Unlock/i.test(shelf)) {
    fail("9 quiet", "the report shelf grew a lock — the banned locked-button tease");
  } else ok();
  if (/Unlock/i.test(proInsights)) {
    fail("9 quiet", "the free insights card grew an Unlock — quiet description and a text link are the precedent");
  } else ok();
  if (/report<button|<button[^>]*>[^<]*report/i.test(proInsights)) {
    fail("9 quiet", "the free insights card grew a report button");
  } else ok();
}

// ── 10. Rate limits present ──────────────────────────────────────────────────
{
  if (!/rateLimit\(`report:\$\{user\.id\}`/.test(reportRoute)) {
    fail("10 limits", "the report route lost its rate limit — an unmetered two-period scan");
  } else ok();
  if (!/rateLimit\(`report-card:\$\{user\.id\}`/.test(cardRoute)) {
    fail("10 limits", "the card route lost its rate limit");
  } else ok();
  if (!/rateLimit\(`analytics-series:\$\{user\.id\}`/.test(seriesRoute)) {
    fail("10 limits", "the CSV route lost its rate limit");
  } else ok();
}

// ── 11. No heavy deps ────────────────────────────────────────────────────────
{
  const pkg = JSON.parse(read("package.json")) as { dependencies?: Record<string, string> };
  const heavy = Object.keys(pkg.dependencies ?? {}).filter((name) => /pdf|puppeteer|chromium|chart\.?js|jspdf|canvas/i.test(name));
  if (heavy.length) {
    fail("11 deps", `a heavy rendering dependency landed for what @media print and ImageResponse do free: ${heavy.join(", ")}`);
  } else ok();
}

if (failures.length) {
  console.error(`\nanalytics-report: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`analytics-report: all ${checks} assertions passed — rows stay free, the composed document stays honest, and nothing in it belongs to anyone else.`);
