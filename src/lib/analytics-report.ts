// THE MESH REPORT — A CLOSED PERIOD, SET ON ONE PAGE.
//
// The dashboard is one rolling window that changes every day; a REPORT is a
// document: a month or a year that has fully ended, differenced against the
// period immediately before it, ranked, caveated, and typeset. The same
// numbers a day later must produce the same document — that is what makes it
// something you can hand to a sponsor, a manager, or your future self.
//
// This module is PURE on purpose: no prisma, no plan flag, no session. The
// loader (analytics-report-loader.ts) owns consent, the MeshPro adjudication,
// and the queries; this file owns the arithmetic, so the gate script can
// execute it directly against fixtures — deltas both directions, abutting
// windows, the insufficient states — without a database in the room.

import type { FormatFinding, TimingFinding } from "./pro-analytics";

// ── Periods ─────────────────────────────────────────────────────────────────

export type ReportPeriod =
  | { kind: "month"; year: number; month: number; param: string; label: string }
  | { kind: "year"; year: number; param: string; label: string };

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Parse `?period=2026-07` (month) or `?period=2025` (year) into a CLOSED
 * period, or null. Three refusals, each load-bearing:
 *  - garbage / impossible months: not a period at all;
 *  - a period whose end is still in the future: an in-progress period makes
 *    the artifact unstable — the "same" report would change daily, which is a
 *    dashboard, not a document;
 *  - a period that ended before the account existed: nothing could be in it.
 */
export function resolveReportPeriod(
  raw: string | null | undefined,
  accountCreatedAt: Date,
  now: Date = new Date(),
): ReportPeriod | null {
  const value = (raw ?? "").trim();

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(value);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    if (month < 1 || month > 12) return null;
    const end = new Date(Date.UTC(year, month, 1));
    if (end.getTime() > now.getTime()) return null;
    if (end.getTime() <= accountCreatedAt.getTime()) return null;
    return { kind: "month", year, month, param: value, label: `${MONTH_LABELS[month - 1]} ${year}` };
  }

  if (/^\d{4}$/.test(value)) {
    const year = Number(value);
    const end = new Date(Date.UTC(year + 1, 0, 1));
    if (end.getTime() > now.getTime()) return null;
    if (end.getTime() <= accountCreatedAt.getTime()) return null;
    return { kind: "year", year, param: value, label: String(year) };
  }

  return null;
}

export type ReportWindow = { start: Date; end: Date };
export type ReportWindows = { current: ReportWindow; previous: ReportWindow };

/**
 * Half-open [start, end) UTC windows for the period and the one immediately
 * before it. They ABUT exactly: previous.end === current.start — no gap for a
 * day's rows to fall into, no overlap for them to be counted twice. The gate
 * asserts this for every period shape.
 */
export function reportWindows(period: ReportPeriod): ReportWindows {
  if (period.kind === "month") {
    const start = new Date(Date.UTC(period.year, period.month - 1, 1));
    const end = new Date(Date.UTC(period.year, period.month, 1));
    const previousStart = new Date(Date.UTC(period.year, period.month - 2, 1));
    return { current: { start, end }, previous: { start: previousStart, end: start } };
  }
  const start = new Date(Date.UTC(period.year, 0, 1));
  const end = new Date(Date.UTC(period.year + 1, 0, 1));
  const previousStart = new Date(Date.UTC(period.year - 1, 0, 1));
  return { current: { start, end }, previous: { start: previousStart, end: start } };
}

// ── Aggregates in, document out ─────────────────────────────────────────────

/** One window's worth of the user's own activity, as the loader hands it over. */
export type ReportWindowAggregate = {
  posts: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  /** Weighted engagement, on the shared dashboard scale. */
  engagement: number;
  followersGained: number;
  followersLost: number;
  platforms: {
    platform: string;
    platformName: string;
    posts: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    followersGained: number;
    followersLost: number;
  }[];
  /** The user's OWN posts, scored — feeds top-5 and the findings. */
  scoredPosts: {
    title: string;
    platformName: string;
    postType: string;
    publishedAt: Date | null;
    score: number;
    views: number;
    likes: number;
    comments: number;
  }[];
};

export type ReportMetricRow = {
  id: string;
  label: string;
  current: number;
  /** null when there is no complete prior period to difference against. */
  previous: number | null;
  delta: number | null;
  /** Percent change vs previous; null when previous is 0 or missing. */
  pct: number | null;
};

export type AnalyticsReport = {
  period: ReportPeriod;
  /** "ok" = deltas are real; "incomplete" = no complete prior period exists. */
  previousState: "ok" | "incomplete";
  totals: ReportMetricRow[];
  netFollowerChange: { current: number; previous: number | null };
  platforms: ReportWindowAggregate["platforms"];
  topPosts: ReportWindowAggregate["scoredPosts"];
  timing: TimingFinding;
  formats: FormatFinding;
  /** People found following on 2+ platforms — a number, never the list. */
  multiPlatformCount: number;
  coverage: { readable: { id: string; name: string }[]; unreadable: { id: string; name: string }[] };
  composedAt: Date;
};

function metricRow(id: string, label: string, current: number, previous: number | null): ReportMetricRow {
  const delta = previous == null ? null : current - previous;
  return {
    id,
    label,
    current,
    previous,
    delta,
    pct: previous == null || previous === 0 ? null : Math.round(((current - previous) / previous) * 100),
  };
}

/**
 * Compose the document from two window aggregates. `previous` is null when no
 * complete prior period exists (the previous window predates the account) —
 * the report then SAYS so instead of faking a zero baseline.
 *
 * Findings ride the same discriminated honesty as the Pro insights: bestTime /
 * bestFormat stay silent below their sample floors, and the template renders
 * the insufficient branch as plainly as a result.
 */
export function composeAnalyticsReport(
  period: ReportPeriod,
  current: ReportWindowAggregate,
  previous: ReportWindowAggregate | null,
  findings: { timing: TimingFinding; formats: FormatFinding },
  extras: {
    multiPlatformCount: number;
    coverage: AnalyticsReport["coverage"];
    composedAt: Date;
  },
): AnalyticsReport {
  return {
    period,
    previousState: previous ? "ok" : "incomplete",
    totals: [
      metricRow("posts", "Posts published", current.posts, previous ? previous.posts : null),
      metricRow("views", "Views", current.views, previous ? previous.views : null),
      metricRow("likes", "Likes", current.likes, previous ? previous.likes : null),
      metricRow("comments", "Comments", current.comments, previous ? previous.comments : null),
      metricRow("shares", "Shares", current.shares, previous ? previous.shares : null),
      metricRow("engagement", "Engagement (weighted)", current.engagement, previous ? previous.engagement : null),
      metricRow("followersGained", "Followers gained", current.followersGained, previous ? previous.followersGained : null),
      metricRow("followersLost", "Followers lost", current.followersLost, previous ? previous.followersLost : null),
    ],
    netFollowerChange: {
      current: current.followersGained - current.followersLost,
      previous: previous ? previous.followersGained - previous.followersLost : null,
    },
    platforms: [...current.platforms].sort((a, b) => b.views + b.likes - (a.views + a.likes)),
    topPosts: [...current.scoredPosts].sort((a, b) => b.score - a.score).slice(0, 5),
    timing: findings.timing,
    formats: findings.formats,
    multiPlatformCount: extras.multiPlatformCount,
    coverage: extras.coverage,
    composedAt: extras.composedAt,
  };
}
