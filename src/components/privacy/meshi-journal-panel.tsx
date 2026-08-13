"use client";

import { useEffect, useState } from "react";
import { BookOpen, Trash2 } from "lucide-react";
import { getMeshiJournalOverview } from "@/lib/actions";

type Overview = Awaited<ReturnType<typeof getMeshiJournalOverview>>;

async function journalAction(body: Record<string, string>) {
  const res = await fetch("/api/meshi/memory", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Something went wrong");
  }
}

/**
 * MESHI'S JOURNAL — the review surface. Sits beside the "Meshi memory" read
 * rule because they are two different promises: the rule governs what Meshi
 * may READ and send to the provider; the journal is what Meshi may KEEP.
 * Every stored byte is listed here, individually deletable, and the off
 * switch says exactly what it does: deletes now, permanently.
 */
export function MeshiJournalPanel() {
  const [overview, setOverview] = useState<Overview>(null);
  const [loaded, setLoaded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setOverview(await getMeshiJournalOverview());
    } catch {
      setError("Could not load the journal.");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function run(body: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      await journalAction(body);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!loaded || overview === null && !loaded) return null;

  const granted = overview?.granted === true;
  const entries = granted && overview.granted ? overview.entries : [];
  const kindLabel = (kind: string) => (kind === "nickname" ? "Your name" : kind === "thread" ? "Where you left off" : "Keepsake");

  return (
    <section className="mesh-surface rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Meshi&apos;s journal</h2>
        </div>
        {granted ? (
          confirming ? (
            <span className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-[var(--text-secondary)]">
                Deletes {entries.length === 1 ? "its 1 page" : `all ${entries.length} pages`} now, permanently.
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => run({ action: "forget-all" })}
                className="font-semibold text-[var(--ds-danger)] underline underline-offset-2"
              >
                Delete the journal
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="font-semibold text-[var(--text-secondary)] underline underline-offset-2"
              >
                Keep it
              </button>
            </span>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(true)}
              className="text-xs font-semibold text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)]"
            >
              Turn off &amp; delete
            </button>
          )
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => run({ action: "grant" })}
            className="text-xs font-semibold text-[var(--accent-text)] underline underline-offset-2"
          >
            Keep a journal
          </button>
        )}
      </div>

      <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
        Only what you dictate — &ldquo;remember that…&rdquo; in chat — ever gets written. Nothing is
        inferred, nothing is watched. Turning it off deletes every page, not hides them.
      </p>

      {granted && overview.granted && overview.paused && (
        <p className="mt-3 rounded-lg border border-[var(--ds-warning-border)] bg-[var(--ds-warning-bg)] px-3 py-2 text-xs font-semibold text-[var(--ds-warning)]">
          Paused by your Meshi memory rule: nothing here is read or sent anywhere while that rule is
          off. The pages stay yours to review and delete.
        </p>
      )}

      {granted && (
        <ul className="mt-3 grid gap-1.5">
          {entries.length === 0 && (
            <li className="text-xs text-[var(--text-muted)]">Empty — nothing has been written yet.</li>
          )}
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3 rounded-lg border border-[var(--ds-border)] px-3 py-2">
              <span className="min-w-0 text-xs leading-5 text-[var(--text-secondary)]">
                <span className="mr-2 font-semibold text-[var(--text-muted)]">{kindLabel(entry.kind)}</span>
                {entry.value}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => run({ action: "forget-entry", entryId: entry.id })}
                aria-label="Delete this memory"
                className="shrink-0 text-[var(--text-muted)] transition-colors hover:text-[var(--ds-danger)]"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-2 text-xs font-semibold text-[var(--ds-danger)]">{error}</p>}
    </section>
  );
}
