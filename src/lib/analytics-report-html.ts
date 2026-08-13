// THE DOCUMENT ITSELF — one self-contained HTML string.
//
// Not a React page: an (app)-group page inherits the shell, the nav, the
// theme machinery — everything a print-clean artifact must not carry. A
// single string is also what the gate can hold to account: "no <script",
// "no external asset", "@media print" are assertable on a string and mean
// nothing asserted on a component tree. Browser Save-as-PDF is the PDF
// story; a headless renderer would be a ~300MB dependency for what
// @media print does free.
//
// The palette is deliberately its own: ink on paper, committed to a single
// printable look. App tokens don't exist here because the app doesn't.

import type { AnalyticsReport, ReportMetricRow } from "./analytics-report";
import type { FormatFinding, TimingFinding } from "./pro-analytics";

function esc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function n(value: number) {
  return value.toLocaleString("en-US");
}

function deltaCell(row: ReportMetricRow) {
  if (row.delta == null) return `<td class="delta muted">—</td>`;
  const sign = row.delta > 0 ? "+" : "";
  const pct = row.pct == null ? "" : ` <span class="pct">(${sign}${row.pct}%)</span>`;
  const tone = row.delta > 0 ? "up" : row.delta < 0 ? "down" : "flat";
  return `<td class="delta ${tone}">${sign}${n(row.delta)}${pct}</td>`;
}

function timingSection(timing: TimingFinding) {
  if (timing.status === "insufficient") {
    return `<p class="finding muted">Not enough dated posts this period for timing to mean anything — ${n(timing.have)} of the ${n(timing.need)} needed. The report says so rather than guessing.</p>`;
  }
  return `<p class="finding">Posts landed best in the <strong>${esc(timing.bucketLabel.toLowerCase())}</strong> on ${timing.dayType === "weekend" ? "weekends" : "weekdays"} — ${timing.lift >= 0 ? "+" : ""}${timing.lift}% vs the period average, from ${n(timing.sampleSize)} posts in that slot${timing.confidence === "tentative" ? " (small sample — read as a lean, not a law)" : ""}.</p>`;
}

function formatSection(formats: FormatFinding) {
  if (formats.status === "insufficient") {
    return `<p class="finding muted">Not enough posts this period to compare formats — ${n(formats.have)} of the ${n(formats.need)} needed.</p>`;
  }
  const rows = formats.rows
    .map((row) => `<tr><td>${esc(row.postType)}</td><td class="num">${n(row.averageScore)}</td><td class="num">${n(row.count)}</td></tr>`)
    .join("");
  return `<table><thead><tr><th>Format</th><th class="num">Avg. engagement</th><th class="num">Posts</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderReportHtml(
  report: AnalyticsReport,
  owner: { displayName: string; username: string },
): string {
  const kindLabel = report.period.kind === "month" ? "Monthly report" : "Annual report";
  const composed = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(report.composedAt);

  const totalsRows = report.totals
    .map((row) => `<tr><td>${esc(row.label)}</td><td class="num">${n(row.current)}</td><td class="num muted">${row.previous == null ? "—" : n(row.previous)}</td>${deltaCell(row)}</tr>`)
    .join("");

  const platformRows = report.platforms
    .map((p) => `<tr><td>${esc(p.platformName)}</td><td class="num">${n(p.posts)}</td><td class="num">${n(p.views)}</td><td class="num">${n(p.likes)}</td><td class="num">${n(p.comments)}</td><td class="num">${n(p.shares)}</td><td class="num">${p.followersGained - p.followersLost >= 0 ? "+" : ""}${n(p.followersGained - p.followersLost)}</td></tr>`)
    .join("");

  const topPostRows = report.topPosts
    .map((post, index) => `<tr><td class="num muted">${index + 1}</td><td>${esc(post.title)}</td><td>${esc(post.platformName)}</td><td class="num">${n(post.score)}</td><td class="num">${n(post.views)}</td><td class="num">${n(post.likes)}</td><td class="num">${n(post.comments)}</td></tr>`)
    .join("");

  const previousNote = report.previousState === "incomplete"
    ? `<p class="note">No complete prior period exists for this account, so the comparison column is empty rather than invented.</p>`
    : "";

  const net = report.netFollowerChange;
  const coverage = report.coverage;
  const coverageNote = [
    coverage.readable.length
      ? `Counts cover ${coverage.readable.map((p) => esc(p.name)).join(", ")}.`
      : "No connected platform could contribute content this period.",
    coverage.unreadable.length
      ? `${coverage.unreadable.map((p) => esc(p.name)).join(", ")} ${coverage.unreadable.length === 1 ? "does" : "do"} not let content be read out, so nothing from there is counted.`
      : "",
  ].filter(Boolean).join(" ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>The Mesh Report — ${esc(report.period.label)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; margin: 0; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    background: #f4f2ec;
    color: #1c1a17;
    padding: 48px 16px;
    line-height: 1.55;
  }
  .sheet {
    max-width: 760px;
    margin: 0 auto;
    background: #fffdf8;
    border: 1px solid #d8d2c4;
    padding: 56px 56px 40px;
  }
  header { border-bottom: 2px solid #1c1a17; padding-bottom: 20px; margin-bottom: 28px; }
  .eyebrow { font-family: Helvetica, Arial, sans-serif; font-size: 12px; font-variant-caps: all-small-caps; letter-spacing: 0.02em; color: #6d675c; }
  h1 { font-size: 34px; font-weight: 600; margin-top: 6px; }
  .who { margin-top: 8px; font-size: 15px; color: #45413a; }
  h2 { font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-variant-caps: all-small-caps; letter-spacing: 0.02em; color: #6d675c; margin: 30px 0 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #e6e0d2; vertical-align: top; }
  th { font-family: Helvetica, Arial, sans-serif; font-size: 12px; font-variant-caps: all-small-caps; letter-spacing: 0.02em; color: #6d675c; font-weight: 600; }
  .num, .delta { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .muted { color: #8a8375; }
  .delta.up { color: #21633a; }
  .delta.down { color: #8a3226; }
  .delta.flat { color: #6d675c; }
  .pct { font-size: 12px; color: inherit; }
  .finding { font-size: 15px; margin: 6px 0; }
  .note { font-size: 13px; color: #6d675c; font-style: italic; margin-top: 8px; }
  .net { font-size: 15px; margin-top: 10px; }
  footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #d8d2c4; font-size: 12px; color: #6d675c; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  @media print {
    body { background: #ffffff; padding: 0; }
    .sheet { border: 0; max-width: none; padding: 24px 8px; }
  }
</style>
</head>
<body>
<main class="sheet">
  <header>
    <p class="eyebrow">${esc(kindLabel)} · Mesh.me</p>
    <h1>${esc(report.period.label)}</h1>
    <p class="who">${esc(owner.displayName)} · @${esc(owner.username)} — composed ${esc(composed)}. Contains only this account's own data.</p>
  </header>

  <h2>The period, against the one before</h2>
  <table>
    <thead><tr><th>Metric</th><th class="num">This period</th><th class="num">Previous</th><th class="num">Change</th></tr></thead>
    <tbody>${totalsRows}</tbody>
  </table>
  <p class="net">Net follower change: <strong>${net.current >= 0 ? "+" : ""}${n(net.current)}</strong>${net.previous == null ? "" : ` (previous period ${net.previous >= 0 ? "+" : ""}${n(net.previous)})`}.</p>
  ${previousNote}

  ${report.platforms.length ? `<h2>By platform</h2>
  <table>
    <thead><tr><th>Platform</th><th class="num">Posts</th><th class="num">Views</th><th class="num">Likes</th><th class="num">Comments</th><th class="num">Shares</th><th class="num">Net followers</th></tr></thead>
    <tbody>${platformRows}</tbody>
  </table>` : ""}

  ${report.topPosts.length ? `<h2>Top posts of the period</h2>
  <table>
    <thead><tr><th class="num">#</th><th>Post</th><th>Platform</th><th class="num">Score</th><th class="num">Views</th><th class="num">Likes</th><th class="num">Comments</th></tr></thead>
    <tbody>${topPostRows}</tbody>
  </table>` : ""}

  <h2>What worked</h2>
  ${timingSection(report.timing)}
  ${formatSection(report.formats)}

  <h2>Audience</h2>
  <p class="finding">${n(report.multiPlatformCount)} ${report.multiPlatformCount === 1 ? "person" : "people"} found following on two or more platforms — a lower bound from the synced sample, reported as a count and nothing more.</p>

  <footer>
    <span>${esc(coverageNote)}</span>
    <span>Engagement weighs a view at 1, a like at 8, a comment at 12, a share at 15 — the same scale as the dashboard.</span>
  </footer>
</main>
</body>
</html>`;
}
