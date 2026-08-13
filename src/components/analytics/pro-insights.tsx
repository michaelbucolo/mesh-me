"use client";

// THE PART THAT SAYS "NOT YET" IS THE PART THAT MAKES THE REST WORTH READING.
//
// Every finding here arrives as a discriminated union from lib/pro-analytics:
// either a result WITH the sample it came from, or an explicit `insufficient`
// carrying how much data exists and how much is needed. Both are rendered.
//
// The temptation is to hide the second case — show the four platforms that have
// an answer and quietly drop the rest. That reads better and is worse: someone
// who cannot see that TikTok is missing assumes TikTok was considered. Naming
// what could not be computed is what makes the computed part trustworthy.

import { motion } from "framer-motion";
import Link from "next/link";
import { Clock, Crown, Layers, TrendingDown, TrendingUp } from "lucide-react";
import type { FormatFinding, ProAnalytics, TimingFinding } from "@/lib/pro-analytics";

const CARD =
  "rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-4";

/** Rows fade in one after another rather than all at once. */
const stagger = (i: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, delay: Math.min(i, 8) * 0.045, ease: [0.22, 1, 0.36, 1] as const },
});

function Insufficient({ have, need, unit }: { have: number; need: number; unit: string }) {
  return (
    <p className="text-xs text-[var(--text-muted)]">
      Not enough yet — {have} {unit}
      {have === 1 ? "" : ""} of the {need} needed before this means anything.
    </p>
  );
}

function TimingRow({ platformName, finding, index }: { platformName: string; finding: TimingFinding; index: number }) {
  return (
    <motion.div {...stagger(index)} className="flex flex-col gap-1 border-b border-[var(--mesh-border)] py-2.5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-[var(--mesh-text)]">{platformName}</span>
        {finding.status === "ok" && (
          <span className={`text-xs font-semibold ${finding.lift >= 0 ? "text-[var(--success)]" : "text-[var(--text-muted)]"}`}>
            {finding.lift >= 0 ? "+" : ""}
            {finding.lift}% vs your average
          </span>
        )}
      </div>
      {finding.status === "ok" ? (
        <>
          <p className="text-sm text-[var(--mesh-text-secondary)]">
            {finding.dayType === "weekend" ? "Weekends" : "Weekdays"}, {finding.bucketLabel.toLowerCase()}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            From {finding.sampleSize} posts in that slot
            {finding.confidence === "tentative" ? " — still thin, treat as a hint" : ""}
          </p>
        </>
      ) : (
        <Insufficient have={finding.have} need={finding.need} unit="posts" />
      )}
    </motion.div>
  );
}

function FormatRow({ platformName, finding, index }: { platformName: string; finding: FormatFinding; index: number }) {
  return (
    <motion.div {...stagger(index)} className="flex flex-col gap-1.5 border-b border-[var(--mesh-border)] py-2.5 last:border-b-0">
      <span className="text-sm font-semibold text-[var(--mesh-text)]">{platformName}</span>
      {finding.status === "ok" ? (
        <div className="flex flex-col gap-1">
          {finding.rows.slice(0, 4).map((row) => {
            const top = finding.rows[0].averageScore || 1;
            return (
              <div key={row.postType} className="flex items-center gap-2">
                <span className="w-16 shrink-0 truncate text-xs text-[var(--mesh-text-secondary)]">{row.postType}</span>
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--mesh-border)]">
                  <motion.div
                    className="h-full rounded-full bg-[var(--accent)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(3, Math.round((row.averageScore / top) * 100))}%` }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-xs tabular-nums text-[var(--text-muted)]">{row.count}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <Insufficient have={finding.have} need={finding.need} unit="posts" />
      )}
    </motion.div>
  );
}

export function ProInsights({ data }: { data: ProAnalytics }) {
  if (!data.isMeshPro) {
    return (
      <section className={`${CARD} flex flex-col items-start gap-2`}>
        <div className="flex items-center gap-2">
          <Crown className="size-4 text-[var(--accent-text)]" aria-hidden />
          <h2 className="text-sm font-semibold text-[var(--mesh-text)]">Cross-platform insights</h2>
        </div>
        <p className="text-sm text-[var(--mesh-text-secondary)]">
          MeshPro reads the last {data.windowDays} days across every connected platform and works out when your
          posts land best, which formats carry, and where your audience is actually moving — and sets a month
          of it on one page you can keep.
        </p>
        <Link href="/meshpro" className="text-sm font-semibold text-[var(--accent-text)] underline underline-offset-4">
          See MeshPro
        </Link>
      </section>
    );
  }

  const hasAnything = data.timing.length > 0 || data.momentum.some((m) => m.hasData);
  if (!hasAnything) {
    return (
      <section className={`${CARD} flex flex-col gap-2`}>
        <h2 className="text-sm font-semibold text-[var(--mesh-text)]">Cross-platform insights</h2>
        <p className="text-sm text-[var(--mesh-text-secondary)]">
          Nothing to read yet. Once a connected platform has synced some posts, this works out when to post,
          what to post, and where your audience is going.
        </p>
      </section>
    );
  }

  const movers = data.momentum.filter((m) => m.hasData);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {data.timing.length > 0 && (
        <section className={CARD}>
          <div className="mb-1 flex items-center gap-2">
            <Clock className="size-4 text-[var(--accent-text)]" aria-hidden />
            <h2 className="text-sm font-semibold text-[var(--mesh-text)]">When to post</h2>
          </div>
          <p className="mb-2 text-xs text-[var(--text-muted)]">
            Your own posts over {data.windowDays} days, grouped by day-part. Times are UTC.
          </p>
          {data.timing.map((row, i) => (
            <TimingRow key={row.platform} platformName={row.platformName} finding={row.finding} index={i} />
          ))}
        </section>
      )}

      {data.formats.length > 0 && (
        <section className={CARD}>
          <div className="mb-1 flex items-center gap-2">
            <Layers className="size-4 text-[var(--accent-text)]" aria-hidden />
            <h2 className="text-sm font-semibold text-[var(--mesh-text)]">What carries</h2>
          </div>
          <p className="mb-2 text-xs text-[var(--text-muted)]">
            Average engagement by format. The number on the right is how many posts it is based on.
          </p>
          {data.formats.map((row, i) => (
            <FormatRow key={row.platform} platformName={row.platformName} finding={row.finding} index={i} />
          ))}
        </section>
      )}

      {movers.length > 0 && (
        <section className={`${CARD} lg:col-span-2`}>
          <div className="mb-1 flex items-center gap-2">
            <TrendingUp className="size-4 text-[var(--accent-text)]" aria-hidden />
            <h2 className="text-sm font-semibold text-[var(--mesh-text)]">Where your audience is going</h2>
          </div>
          {data.concentration.largestPlatform && data.concentration.largestShare >= 50 && (
            <p className="mb-2 text-xs text-[var(--mesh-text-secondary)]">
              {data.concentration.largestShare}% of your audience sits on one platform. That is worth knowing
              before its algorithm changes.
            </p>
          )}
          <div className="flex flex-col">
            {movers.map((m, i) => (
              <motion.div
                key={m.platform}
                {...stagger(i)}
                className="flex items-center justify-between gap-3 border-b border-[var(--mesh-border)] py-2.5 last:border-b-0"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-[var(--mesh-text)]">{m.platformName}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {m.followers.toLocaleString()} followers · {m.audienceShare}% of your audience
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {m.netFollowerChange >= 0 ? (
                    <TrendingUp className="size-3.5 text-[var(--success)]" aria-hidden />
                  ) : (
                    <TrendingDown className="size-3.5 text-[var(--danger)]" aria-hidden />
                  )}
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      m.netFollowerChange >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
                    }`}
                  >
                    {m.netFollowerChange >= 0 ? "+" : ""}
                    {m.netFollowerChange.toLocaleString()}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {data.platformsWithoutData.length > 0 && (
        <p className="text-xs text-[var(--text-muted)] lg:col-span-2">
          No data synced yet for {data.platformsWithoutData.join(", ")} — those are not included above.
        </p>
      )}
    </div>
  );
}
