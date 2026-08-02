"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Bring your history with you.
 *
 * Every platform here is legally obliged to hand you an export and none of them
 * will help you read it. This is the half that reads it — in your own browser,
 * on a thread this component can kill, sending only the posts it recovered.
 *
 * ── THE ARCHIVE NEVER LEAVES THE DEVICE ─────────────────────────────────────
 *
 * Not a limitation dressed up as a principle. A Meta export runs to gigabytes
 * and is mostly media; uploading it would need object storage, a body limit
 * nobody has, and a copy of somebody's entire life sitting on a server. What
 * gets sent is the text of the posts, in batches, and nothing else.
 */

/** Must match MAX_POSTS_PER_REQUEST on the server. */
const BATCH_SIZE = 500;

/**
 * How long a read may run before the thread is killed.
 *
 * The point of the Worker is that terminate() works when nothing else does, and
 * a Worker nobody ever terminates is just a slower main thread. Ten minutes is
 * far beyond any real archive and far short of leaving a runaway to eat a
 * phone's memory until the OS steps in.
 */
const READ_TIMEOUT_MS = 10 * 60 * 1000;

type IncomingPost = { publishedAtMs: number; text: string; mediaPaths: string[] };

type Stage =
  | { kind: "idle" }
  | { kind: "reading"; detail: string }
  | { kind: "uploading"; done: number; total: number }
  | { kind: "unrecognised"; reason: string }
  | { kind: "failed"; reason: string }
  | {
      kind: "finished";
      added: number;
      alreadyPresent: number;
      repaired: number;
      failed: number;
      dropped: number;
      unreadable: number;
      refused: number;
      textRepairs: number;
      platforms: string[];
    };

export function ArchiveImportCard() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopWorker = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  // Leaving the page must not leave a thread inflating an archive behind it.
  useEffect(() => stopWorker, [stopWorker]);

  const upload = useCallback(
    async (platform: string, posts: IncomingPost[], extra: { unreadable: number; refused: number; textRepairs: number }) => {
      const totals = { added: 0, alreadyPresent: 0, repaired: 0, failed: 0, dropped: 0 };
      const batches = Math.max(1, Math.ceil(posts.length / BATCH_SIZE));

      for (let i = 0; i < batches; i += 1) {
        const slice = posts.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        if (slice.length === 0) break;
        setStage({ kind: "uploading", done: i, total: batches });

        const response = await fetch("/api/portability/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, posts: slice }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          // Batches already sent are already saved. Saying so matters: the
          // identity design means picking up again costs nothing and duplicates
          // nothing, and somebody who does not know that will not try.
          setStage({
            kind: "failed",
            reason:
              (body.error ?? "The import stopped partway.") +
              (i > 0 ? ` ${i * BATCH_SIZE} posts were already saved — importing the same file again will carry on rather than duplicate them.` : ""),
          });
          return;
        }

        const result = (await response.json()) as typeof totals;
        totals.added += result.added ?? 0;
        totals.alreadyPresent += result.alreadyPresent ?? 0;
        totals.repaired += result.repaired ?? 0;
        totals.failed += result.failed ?? 0;
        totals.dropped += result.dropped ?? 0;
      }

      setStage({ kind: "finished", ...totals, ...extra, platforms: [platform] });
      // The history section above reads on the server; refresh so it reflects
      // what just landed rather than what was there when the page loaded.
      router.refresh();
    },
    [router],
  );

  const onFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      stopWorker();
      setStage({ kind: "reading", detail: "Opening the archive" });

      const worker = new Worker(new URL("./archive-import.worker.ts", import.meta.url));
      workerRef.current = worker;

      // THE WATCHDOG. This is the line that makes the Worker worth having.
      timerRef.current = setTimeout(() => {
        stopWorker();
        setStage({
          kind: "failed",
          reason:
            "This archive took too long to read, so it was stopped before it could use up the memory this tab needs. Nothing was saved. If it is a very large export, try the smaller per-year download the platform offers.",
        });
      }, READ_TIMEOUT_MS);

      worker.onerror = () => {
        stopWorker();
        setStage({ kind: "failed", reason: "The archive reader stopped unexpectedly. Nothing was saved." });
      };

      worker.onmessage = (event: MessageEvent) => {
        const data = event.data as Record<string, unknown>;

        if (data.type === "progress") {
          setStage({
            kind: "reading",
            detail:
              data.stage === "listed"
                ? `Found ${Number(data.entries ?? 0).toLocaleString()} files — looking for your posts`
                : "Opening the archive",
          });
          return;
        }

        if (data.type === "unrecognised") {
          stopWorker();
          setStage({ kind: "unrecognised", reason: String(data.reason ?? "") });
          return;
        }

        if (data.type === "error") {
          stopWorker();
          setStage({ kind: "failed", reason: String(data.message ?? "This file could not be read.") });
          return;
        }

        if (data.type === "done") {
          stopWorker();
          const posts = (data.posts ?? []) as IncomingPost[];
          const platforms = (data.platforms ?? []) as string[];
          const platform = platforms[0];

          if (!platform || posts.length === 0) {
            setStage({
              kind: "unrecognised",
              reason:
                "We recognised this archive but found no posts we could read in it. That may be what it holds — some exports carry only settings and messages.",
            });
            return;
          }

          void upload(platform, posts, {
            unreadable: Array.isArray(data.unreadable) ? data.unreadable.length : 0,
            refused: Array.isArray(data.refused) ? data.refused.length : 0,
            textRepairs: Number(data.textRepairs ?? 0),
          });
        }
      };

      worker.postMessage({ type: "start", file });
    },
    [stopWorker, upload],
  );

  const busy = stage.kind === "reading" || stage.kind === "uploading";

  return (
    <section
      aria-labelledby="archive-import-heading"
      className="mx-auto mt-6 w-full max-w-5xl rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 sm:p-6"
    >
      <h2 id="archive-import-heading" className="text-base font-semibold text-[var(--ds-text)]">
        Bring your history with you
      </h2>
      <p className="mt-1 text-xs leading-5 text-[var(--ds-text-muted)]">
        Instagram, Facebook, Threads, Snapchat, LinkedIn and Pinterest all have to give you a copy of
        your data, and none of them help you read it. Download the ZIP they send and open it here.
        It is read on this device — only the posts come across, never the archive.
      </p>

      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-raised)] px-4 py-2 text-sm font-medium text-[var(--ds-text)] hover:bg-[var(--ds-surface-hover)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2">
        <input
          type="file"
          accept=".zip,application/zip"
          className="sr-only"
          disabled={busy}
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
        />
        {busy ? "Working…" : "Choose an archive"}
      </label>

      {busy ? (
        <button
          type="button"
          onClick={() => {
            stopWorker();
            setStage({ kind: "idle" });
          }}
          className="ml-2 rounded-xl px-3 py-2 text-sm text-[var(--ds-text-muted)] underline"
        >
          Stop
        </button>
      ) : null}

      <div aria-live="polite" className="mt-3 text-xs leading-5">
        {stage.kind === "reading" ? <p className="text-[var(--ds-text-muted)]">{stage.detail}…</p> : null}

        {stage.kind === "uploading" ? (
          <p className="text-[var(--ds-text-muted)]">
            Saving your posts — batch {stage.done + 1} of {stage.total}.
          </p>
        ) : null}

        {stage.kind === "unrecognised" ? (
          <p className="text-[var(--ds-text-muted)]">{stage.reason}</p>
        ) : null}

        {stage.kind === "failed" ? <p className="text-[var(--ds-danger)]">{stage.reason}</p> : null}

        {stage.kind === "finished" ? (
          <div className="text-[var(--ds-text)]">
            <p className="font-medium">
              {stage.added > 0
                ? `${stage.added.toLocaleString()} ${stage.added === 1 ? "post" : "posts"} imported.`
                : "Nothing new to import — everything in this archive was already here."}
            </p>
            {/* Every number that is not zero gets said. A total on its own would
                be a smaller truth than the one available. */}
            <ul className="mt-1 space-y-0.5 text-[var(--ds-text-muted)]">
              {stage.alreadyPresent > 0 ? (
                <li>{stage.alreadyPresent.toLocaleString()} were already imported and were left alone.</li>
              ) : null}
              {stage.repaired > 0 ? (
                <li>{stage.repaired.toLocaleString()} were recovered from an import that did not finish last time.</li>
              ) : null}
              {stage.textRepairs > 0 ? (
                <li>{stage.textRepairs.toLocaleString()} captions had their accents and emoji repaired.</li>
              ) : null}
              {stage.dropped > 0 ? (
                <li>{stage.dropped.toLocaleString()} entries had no usable date and were skipped rather than guessed at.</li>
              ) : null}
              {stage.unreadable > 0 ? (
                <li>{stage.unreadable.toLocaleString()} files in the archive could not be read.</li>
              ) : null}
              {stage.refused > 0 ? (
                <li>{stage.refused.toLocaleString()} files were too large to open safely.</li>
              ) : null}
              {stage.failed > 0 ? <li>{stage.failed.toLocaleString()} posts could not be saved.</li> : null}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
