// THE LONG VIEW — every month since the first post, honestly gapped.
//
// This shelf renders only inside the page's explicit isMeshPro condition
// (free accounts get no locked version of it at all — the /meshpro page is
// the sales surface). Its one design law: untracked is not zero. Months
// before a metric existed draw as a hatched band with a legend that says so,
// because the difference between "you were silent" and "nobody was
// measuring" is the difference between a memory and a lie.

import type { LifetimePayload } from "@/lib/analytics-eras";

const CARD = "rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5";

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, 15)).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function LifetimeShelf({ lifetime }: { lifetime: LifetimePayload }) {
  const spineValues = lifetime.spine.filter((p): p is { month: string; value: number } => "value" in p);
  const maxValue = Math.max(1, ...spineValues.map((p) => p.value));
  const deep = lifetime.spine.length > 12;
  const untrackedSeries = lifetime.series.filter((s) => s.points.some((p) => "state" in p));
  const counted = new Date(lifetime.computedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <section className={CARD} data-testid="lifetime-shelf">
      <p className="text-micro font-semibold text-[var(--accent-text)]">MeshPro</p>
      <h2 className="mt-0.5 text-lg font-semibold text-[var(--mesh-text)]">The long view</h2>
      <p className="mt-1 text-sm text-[var(--mesh-text-secondary)]">
        Every month since your first post, back to the beginning. Counted {counted}; recounts daily.
      </p>

      {deep ? (
        <div className="mt-4 overflow-x-auto pb-1">
          <div className="flex h-28 items-end gap-px" style={{ minWidth: Math.max(320, lifetime.spine.length * 5) }}>
            {lifetime.spine.map((point) =>
              "value" in point ? (
                <div
                  key={point.month}
                  title={`${monthLabel(point.month)} — ${point.value} post${point.value === 1 ? "" : "s"}`}
                  className="flex-1 rounded-t-sm bg-[var(--accent-primary,#3b82f6)]"
                  style={{ height: `${Math.max(2, Math.round((point.value / maxValue) * 100))}%`, minWidth: 3, opacity: point.value === 0 ? 0.18 : 0.9 }}
                />
              ) : (
                <div
                  key={point.month}
                  title={`${monthLabel(point.month)} — untracked`}
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: "100%", minWidth: 3,
                    background: "repeating-linear-gradient(135deg, var(--mesh-border) 0 2px, transparent 2px 5px)",
                  }}
                />
              ),
            )}
          </div>
          <div className="mt-1 flex justify-between text-micro text-[var(--mesh-text-muted)]">
            <span>{lifetime.startKey ? monthLabel(lifetime.startKey) : ""}</span>
            <span>now</span>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--mesh-text-secondary)]">
          Your whole life already fits on these charts — the long view grows as you do.
        </p>
      )}

      {untrackedSeries.length > 0 && (
        <p className="mt-2 text-micro leading-snug text-[var(--mesh-text-muted)]">
          Months before {untrackedSeries[0].trackedFrom ? monthLabel(untrackedSeries[0].trackedFrom) : "tracking began"} predate
          tracking for some metrics. They read as untracked, not as zero.
        </p>
      )}

      {(lifetime.firsts.length > 0 || lifetime.milestones.length > 0 || lifetime.streak || lifetime.topPosts.length > 0) && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {lifetime.firsts.map((first) => (
            <p key={first.label} className="rounded-lg bg-[var(--mesh-panel)] px-3 py-2 text-sm text-[var(--mesh-text-secondary)]">
              <span className="font-semibold text-[var(--mesh-text)]">{first.label}</span>{" "}
              — {new Date(first.at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          ))}
          {lifetime.milestones.map((milestone) => (
            <p key={milestone.threshold} className="rounded-lg bg-[var(--mesh-panel)] px-3 py-2 text-sm text-[var(--mesh-text-secondary)]">
              <span className="font-semibold text-[var(--mesh-text)]">Post {milestone.threshold.toLocaleString()}</span>{" "}
              — {monthLabel(milestone.monthKey)}
            </p>
          ))}
          {lifetime.streak && lifetime.streak.months > 1 && (
            <p className="rounded-lg bg-[var(--mesh-panel)] px-3 py-2 text-sm text-[var(--mesh-text-secondary)]">
              <span className="font-semibold text-[var(--mesh-text)]">{lifetime.streak.months} months posting without a gap</span>{" "}
              — {monthLabel(lifetime.streak.from)} to {monthLabel(lifetime.streak.to)}
            </p>
          )}
          {lifetime.topPosts[0] && (
            <p className="rounded-lg bg-[var(--mesh-panel)] px-3 py-2 text-sm text-[var(--mesh-text-secondary)]">
              <span className="font-semibold text-[var(--mesh-text)]">All-time best</span>{" "}
              — “{lifetime.topPosts[0].label}” on {lifetime.topPosts[0].platform}
            </p>
          )}
        </div>
      )}

      {deep && lifetime.eras.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {lifetime.eras.map((era) => (
            <div key={era.year} className="min-w-44 shrink-0 rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-panel)] px-3.5 py-3">
              <p className="text-sm font-semibold text-[var(--mesh-text)]">
                {era.year}
                {era.partial ? <span className="ml-1 font-normal text-[var(--mesh-text-muted)]">partial</span> : null}
              </p>
              <p className="mt-0.5 text-sm text-[var(--mesh-text-secondary)]">
                {era.posts} post{era.posts === 1 ? "" : "s"}
                {era.dominantPlatform ? ` · mostly ${era.dominantPlatform}` : ""}
                {era.bestMonth ? ` · best month ${monthLabel(era.bestMonth).split(" ")[0]}` : ""}
              </p>
              {era.bestPost && (
                <p className="mt-1 truncate text-micro text-[var(--mesh-text-muted)]" title={era.bestPost.label}>
                  best: “{era.bestPost.label}”
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-micro leading-snug text-[var(--mesh-text-muted)]">
        Engagement is counted against the month a post was published, as the platforms report it today.
        {lifetime.undatedCount > 0 && ` ${lifetime.undatedCount} imported item${lifetime.undatedCount === 1 ? "" : "s"} carried unreliable dates and count in totals only.`}
        {lifetime.clamped && " Some very old or out-of-range dates were clamped to keep the axis honest."}
      </p>
    </section>
  );
}
