// THE LONG VIEW'S PURE HALF — months, eras, firsts, and honest gaps.
//
// No prisma, no session, no plan checks (the analytics-report.ts pattern):
// the loader queries, this module composes, and the gate truth-tables it on
// fixtures. Two laws carry the whole design:
//
//   ONE MONTH AXIS. Every series' slots derive from one resolve
//   (lifetimeMonthKeys) — the analyticsWindow slot law at month grain. A
//   corrupt or out-of-range timestamp cannot mint a slot: it is excluded
//   from the axis and the firsts, counted in totals as undated.
//
//   UNTRACKED IS NOT ZERO. A month before a metric existed composes as a
//   typed state, not a number — `?? 0` cannot erase it, and the difference
//   between "you were silent" and "nobody was measuring" stays visible all
//   the way to the pixel.

const LIFETIME_MONTH_FLOOR = "2005-01";
const LIFETIME_MONTHS_CAP = 264;

export type LifetimePoint =
  | { month: string; value: number }
  | { month: string; state: "untracked" };

export type UntrackedReason = "not-tracked-yet" | "pre-mesh";

type LifetimeSeries = {
  key: string;
  label: string;
  /** First month this metric was actually measured; months before it compose
   *  as untracked. Null = never tracked — the composer omits the row. */
  trackedFrom: string | null;
  reason: UntrackedReason | null;
  points: LifetimePoint[];
};

export type LifetimeEra = {
  year: number;
  partial: "first" | "last" | null;
  posts: number;
  /** Named only above the characterization floor — below it, counts only. */
  dominantPlatform: string | null;
  bestMonth: string | null;
  bestPost: { label: string; score: number } | null;
};

export type LifetimeMilestone = { threshold: number; monthKey: string };

/** Month precision cannot be dressed as a day: milestones carry a month key,
 *  never a Date. */
const MILESTONE_THRESHOLDS = [100, 500, 1000, 5000, 10000, 50000];

/** Below this many posts in a year, an era shows counts and claims nothing. */
const ERA_CHARACTER_FLOOR = 12;
const ERA_DOMINANCE = 0.4;

export function monthKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Day one is the earliest CREDIBLE evidence — imported history genuinely
 *  predates signup, so the account's own createdAt is only the fallback. */
export function evidenceStart(accountCreatedAt: Date, earliestCredibleImport: Date | null): Date {
  if (!earliestCredibleImport) return accountCreatedAt;
  return earliestCredibleImport.getTime() < accountCreatedAt.getTime() ? earliestCredibleImport : accountCreatedAt;
}

/**
 * THE one month axis. Clamped to [LIFETIME_MONTH_FLOOR, current month] and
 * hard-capped at LIFETIME_MONTHS_CAP slots — an epoch-zero or future
 * timestamp cannot stretch the chart; `clamped` surfaces one quiet line.
 */
export function lifetimeMonthKeys(start: Date, now: Date): { keys: string[]; clamped: boolean } {
  let startKey = monthKeyOf(start);
  const endKey = monthKeyOf(now);
  let clamped = false;
  if (startKey < LIFETIME_MONTH_FLOOR) {
    startKey = LIFETIME_MONTH_FLOOR;
    clamped = true;
  }
  if (startKey > endKey) return { keys: [], clamped };

  const keys: string[] = [];
  let [year, month] = startKey.split("-").map(Number);
  while (keys.length < LIFETIME_MONTHS_CAP) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (key > endKey) break;
    keys.push(key);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  if (keys[keys.length - 1] !== endKey) clamped = true;
  return { keys, clamped };
}

/**
 * Fold month-bucketed rows onto the axis. Unknown month keys are DROPPED,
 * never slotted; months before `trackedFrom` compose as untracked; tracked
 * months with no row are a real 0 — true silence, not a measurement gap.
 */
export function foldMonthly(
  keys: readonly string[],
  rows: ReadonlyArray<{ month: string; value: number }>,
  trackedFrom: string | null,
): LifetimePoint[] {
  const byMonth = new Map<string, number>();
  for (const row of rows) {
    if (!keys.includes(row.month)) continue;
    byMonth.set(row.month, (byMonth.get(row.month) ?? 0) + row.value);
  }
  return keys.map((month) => {
    if (trackedFrom !== null && month < trackedFrom) return { month, state: "untracked" as const };
    return { month, value: byMonth.get(month) ?? 0 };
  });
}

/**
 * Eras are UTC calendar years, first and last labeled partial. A year is
 * characterized (dominant platform named) only above the floor and only when
 * one platform genuinely dominates — below that, counts speak alone.
 */
export function foldEras(
  keys: readonly string[],
  postsPerMonth: ReadonlyArray<{ month: string; value: number }>,
  platformPerYear: ReadonlyMap<number, ReadonlyMap<string, number>>,
  bestPostPerYear: ReadonlyMap<number, { label: string; score: number }>,
): LifetimeEra[] {
  if (keys.length === 0) return [];
  const monthTotals = new Map(postsPerMonth.filter((r) => keys.includes(r.month)).map((r) => [r.month, r.value]));
  const firstYear = Number(keys[0].slice(0, 4));
  const lastYear = Number(keys[keys.length - 1].slice(0, 4));

  const eras: LifetimeEra[] = [];
  for (let year = firstYear; year <= lastYear; year += 1) {
    const yearKeys = keys.filter((k) => k.startsWith(`${year}-`));
    const posts = yearKeys.reduce((sum, k) => sum + (monthTotals.get(k) ?? 0), 0);
    let bestMonth: string | null = null;
    let bestMonthValue = 0;
    for (const k of yearKeys) {
      const value = monthTotals.get(k) ?? 0;
      if (value > bestMonthValue) {
        bestMonthValue = value;
        bestMonth = k;
      }
    }

    let dominantPlatform: string | null = null;
    if (posts >= ERA_CHARACTER_FLOOR) {
      const platforms = platformPerYear.get(year);
      if (platforms) {
        let total = 0;
        let top: { platform: string; count: number } | null = null;
        for (const [platform, count] of platforms) {
          total += count;
          if (!top || count > top.count) top = { platform, count };
        }
        if (top && total > 0 && top.count / total >= ERA_DOMINANCE) dominantPlatform = top.platform;
      }
    }

    eras.push({
      year,
      partial: year === firstYear && !keys[0].endsWith("-01") ? "first" : year === lastYear ? "last" : null,
      posts,
      dominantPlatform,
      bestMonth,
      bestPost: bestPostPerYear.get(year) ?? null,
    });
  }
  return eras;
}

/** Where the running total first crossed each threshold, at month precision. */
export function thresholdMilestones(
  keys: readonly string[],
  postsPerMonth: ReadonlyArray<{ month: string; value: number }>,
): LifetimeMilestone[] {
  const byMonth = new Map(postsPerMonth.map((r) => [r.month, r.value]));
  const milestones: LifetimeMilestone[] = [];
  let cumulative = 0;
  let next = 0;
  for (const month of keys) {
    cumulative += byMonth.get(month) ?? 0;
    while (next < MILESTONE_THRESHOLDS.length && cumulative >= MILESTONE_THRESHOLDS[next]) {
      milestones.push({ threshold: MILESTONE_THRESHOLDS[next], monthKey: month });
      next += 1;
    }
  }
  return milestones;
}

/** The longest unbroken run of posting months — derived free from the
 *  buckets; day-level streaks stay dead. */
function longestMonthStreak(
  keys: readonly string[],
  postsPerMonth: ReadonlyArray<{ month: string; value: number }>,
): { months: number; from: string; to: string } | null {
  const byMonth = new Map(postsPerMonth.map((r) => [r.month, r.value]));
  let best: { months: number; from: string; to: string } | null = null;
  let runStart: string | null = null;
  let runLength = 0;
  for (const month of keys) {
    if ((byMonth.get(month) ?? 0) > 0) {
      runStart ??= month;
      runLength += 1;
      if (!best || runLength > best.months) best = { months: runLength, from: runStart, to: month };
    } else {
      runStart = null;
      runLength = 0;
    }
  }
  return best;
}

export type LifetimePayload = {
  computedAt: string;
  startKey: string | null;
  clamped: boolean;
  undatedCount: number;
  spine: LifetimePoint[];
  series: LifetimeSeries[];
  eras: LifetimeEra[];
  firsts: Array<{ label: string; at: Date }>;
  milestones: LifetimeMilestone[];
  streak: { months: number; from: string; to: string } | null;
  topPosts: Array<{ label: string; platform: string; score: number }>;
};

/**
 * The composer: one axis in, one payload out. Series with a null trackedFrom
 * are omitted entirely — an all-null husk row tells nobody anything.
 */
export function composeLifetime(input: {
  now: Date;
  keys: readonly string[];
  clamped: boolean;
  undatedCount: number;
  spineRows: ReadonlyArray<{ month: string; value: number }>;
  spineTrackedFrom: string | null;
  series: ReadonlyArray<{
    key: string;
    label: string;
    trackedFrom: string | null;
    reason: UntrackedReason | null;
    rows: ReadonlyArray<{ month: string; value: number }>;
  }>;
  platformPerYear: ReadonlyMap<number, ReadonlyMap<string, number>>;
  bestPostPerYear: ReadonlyMap<number, { label: string; score: number }>;
  firsts: Array<{ label: string; at: Date }>;
  topPosts: Array<{ label: string; platform: string; score: number }>;
}): LifetimePayload {
  const spine = foldMonthly(input.keys, input.spineRows, input.spineTrackedFrom);
  return {
    computedAt: input.now.toISOString(),
    startKey: input.keys[0] ?? null,
    clamped: input.clamped,
    undatedCount: input.undatedCount,
    spine,
    series: input.series
      .filter((s) => s.trackedFrom !== null)
      .map((s) => ({
        key: s.key,
        label: s.label,
        trackedFrom: s.trackedFrom,
        reason: s.reason,
        points: foldMonthly(input.keys, s.rows, s.trackedFrom),
      })),
    eras: foldEras(input.keys, [...input.spineRows], input.platformPerYear, input.bestPostPerYear),
    firsts: input.firsts,
    milestones: thresholdMilestones(input.keys, [...input.spineRows]),
    streak: longestMonthStreak(input.keys, [...input.spineRows]),
    topPosts: input.topPosts,
  };
}
