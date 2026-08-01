"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Lock } from "lucide-react";
import type { AchievementView } from "@/lib/achievements/award";
import { recordAchievements, setActiveTitle } from "@/lib/achievements/actions";

// EVERYTHING, INCLUDING WHAT YOU HAVE NOT DONE.
//
// The unearned entries are not filler. A board showing only what you already
// have cannot tell you what is worth doing next, and hiding a requirement until
// you meet it turns a published threshold back into a surprise — which is the
// exact mechanic this feature is built to avoid. So every milestone is listed,
// with its real number, whether or not you are near it.
//
// ── WHY THIS IS PRIVATE ─────────────────────────────────────────────────────
//
// The board renders on your own profile only. "Connected six platforms" is a
// fact about your other accounts, and publishing it by default would leak how
// much of someone's life is wired up here. The single public element is the
// title you deliberately choose to wear — one thing, opted into, changeable,
// removable.

function ProgressBar({ have, threshold }: { have: number; threshold: number }) {
  const pct = threshold <= 0 ? 100 : Math.min(100, Math.round((have / threshold) * 100));
  return (
    <div
      className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--mesh-border)]"
      role="progressbar"
      aria-valuenow={have}
      aria-valuemin={0}
      aria-valuemax={threshold}
      aria-label={`${have} of ${threshold}`}
    >
      <div className="h-full rounded-full bg-[var(--accent-text)] transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function MilestonesBoard({
  achievements,
  currentTitle,
}: {
  achievements: AchievementView[];
  currentTitle: string | null;
}) {
  const [title, setTitle] = useState(currentTitle);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  // Record the crossing on the way in. What is DISPLAYED comes from live counts
  // on the server, so this changes nothing on screen — it writes down when each
  // milestone was reached, which is the only thing a UserAchievement row adds.
  // Failure is silent because a missing timestamp is not worth an error message.
  useEffect(() => {
    void recordAchievements();
  }, []);

  const earned = achievements.filter((a) => a.earned);
  // Only a milestone you have actually earned can be worn, and the server
  // checks this again — a title is shown to other people, so the client's
  // opinion about what you earned is not the deciding one.
  const wearable = earned.filter((a) => a.title);

  function wear(next: string | null) {
    setError("");
    startTransition(async () => {
      const result = await setActiveTitle(next);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setTitle(next);
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-base font-semibold text-[var(--mesh-text)]">Milestones</h2>
        <p className="mt-1 text-sm text-[var(--mesh-text-secondary)]">
          {earned.length} of {achievements.length} reached. Every number here is fixed and visible from the start — nothing is
          random, and nothing expires if you take a week off.
        </p>
        <p className="mt-1 text-xs text-[var(--mesh-text-secondary)]">
          Only you can see this list. A title you choose to wear is the one part other people see.
        </p>
      </header>

      {wearable.length > 0 && (
        <section className="rounded-2xl border border-[var(--mesh-border)] p-4">
          <h3 className="text-sm font-semibold text-[var(--mesh-text)]">Wear a title</h3>
          <p className="mt-1 text-xs text-[var(--mesh-text-secondary)]">Shown next to your name. Optional, and you can take it off.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => wear(null)}
              aria-pressed={title === null}
              className={`ds-focus-ring min-h-11 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                title === null
                  ? "border-[var(--accent-text)] text-[var(--accent-text)]"
                  : "border-[var(--mesh-border)] text-[var(--mesh-text-secondary)]"
              }`}
            >
              None
            </button>
            {wearable.map((a) => (
              <button
                key={a.slug}
                type="button"
                disabled={pending}
                onClick={() => wear(a.title)}
                aria-pressed={title === a.title}
                className={`ds-focus-ring min-h-11 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  title === a.title
                    ? "border-[var(--accent-text)] text-[var(--accent-text)]"
                    : "border-[var(--mesh-border)] text-[var(--mesh-text-secondary)]"
                }`}
              >
                {a.title}
              </button>
            ))}
          </div>
          {error && <p className="mt-2 text-xs text-[var(--mesh-danger,#dc2626)]">{error}</p>}
        </section>
      )}

      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        {achievements.map((a) => (
          <li
            key={a.slug}
            className={`rounded-2xl border p-4 ${
              a.earned ? "border-[var(--accent-text)]/40" : "border-[var(--mesh-border)]"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${
                  a.earned ? "bg-[var(--accent-text)]/15 text-[var(--accent-text)]" : "bg-[var(--mesh-border)] text-[var(--mesh-text-secondary)]"
                }`}
              >
                {a.earned ? <Check size={16} /> : <Lock size={14} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--mesh-text)]">{a.name}</p>
                <p className="mt-0.5 text-xs text-[var(--mesh-text-secondary)]">{a.description}</p>
                {a.earned ? (
                  <p className="mt-2 text-xs font-semibold text-[var(--accent-text)]">
                    Reached{a.unlockedAt ? ` ${new Date(a.unlockedAt).toLocaleDateString()}` : ""}
                  </p>
                ) : (
                  <>
                    <ProgressBar have={a.have} threshold={a.threshold} />
                    <p className="mt-1.5 text-xs tabular-nums text-[var(--mesh-text-secondary)]">
                      {a.have} of {a.threshold}
                    </p>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
