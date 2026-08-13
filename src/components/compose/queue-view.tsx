"use client";

// THE QUEUE'S TWO HALVES: promises still waiting, and how kept ones went.
//
// Upcoming rows carry Edit-adjacent verbs (Reschedule · Send now · Cancel)
// and announce a future skip BEFORE it happens. Past rows render the stored
// report's summary VERBATIM and expand through the one shared renderer
// (report-lines.ts) — the honesty contract cannot fork per surface. Lateness
// is disclosed, never hidden: "Went out 9:07 (scheduled 9:00)."

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PlatformLogo } from "@/components/platform/platform-logo";
import { ruleFor } from "@/lib/compose/plan";
import type { PublishReport } from "@/lib/compose/publish";
import { reportLines } from "@/lib/compose/report-lines";
import {
  cancelScheduled,
  deleteScheduled,
  editScheduled,
  rescheduleScheduled,
  retryFailedLegs,
  sendScheduledNow,
} from "@/lib/compose/schedule-actions";

const INK = "#f2f4f8";
const INK_DIM = "#8b93a7";
const BRAND = "#3b82f6";
const WARN = "#f87171";

export type QueueRow = {
  id: string;
  text: string;
  title: string | null;
  targets: string[];
  scheduledForIso: string;
  tz: string | null;
  status: string;
  firedAtIso: string | null;
  report: PublishReport | null;
};

function spokenTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function spokenClock(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function QueueView({ rows, reachable }: { rows: QueueRow[]; reachable: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [whenLocal, setWhenLocal] = useState("");
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const reachableSet = new Set(reachable);
  const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const upcoming = rows.filter((r) => r.status === "queued" || r.status === "retrying" || r.status === "firing");
  const past = rows
    .filter((r) => r.status === "done" || r.status === "missed" || r.status === "canceled")
    .sort((a, b) => b.scheduledForIso.localeCompare(a.scheduledForIso));

  function run(task: () => Promise<{ error?: string } | object>, after?: () => void) {
    startTransition(async () => {
      setNotice(null);
      const result = await task();
      if (result && typeof result === "object" && "error" in result && result.error) {
        setNotice(String(result.error));
        return;
      }
      if (result && typeof result === "object" && "summary" in result) {
        setNotice(String((result as { summary: string }).summary));
      }
      after?.();
      router.refresh();
    });
  }

  return (
    <div className="mt-4">
      {notice && (
        <p className="mb-3 rounded-xl px-3.5 py-2.5 text-sm" style={{ background: "#0e1626", border: "1px solid #ffffff14", color: INK }}>
          {notice}
        </p>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <p className="text-sm" style={{ color: INK_DIM }}>
          Nothing waiting. Write something and give it a time.
        </p>
      )}

      {upcoming.length > 0 && (
        <>
          <h2 className="text-sm font-medium" style={{ color: INK }}>Waiting</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {upcoming.map((row) => {
              const willSkip = row.targets.filter((t) => !reachableSet.has(t));
              return (
                <li key={row.id} className="rounded-xl px-3.5 py-3" data-testid="queue-upcoming" style={{ background: "#0e1626", border: "1px solid #ffffff14" }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium" style={{ color: INK, fontSize: 14 }}>
                      {spokenTime(row.scheduledForIso)}
                    </span>
                    {row.tz && row.tz !== viewerTz && (
                      <span style={{ color: INK_DIM, fontSize: 12 }}>scheduled in {row.tz}</span>
                    )}
                    {row.status === "retrying" && (
                      <span style={{ color: WARN, fontSize: 12 }}>retrying</span>
                    )}
                    {row.status === "firing" && (
                      <span style={{ color: INK_DIM, fontSize: 12 }}>sending now</span>
                    )}
                    <span className="ml-auto flex items-center gap-1">
                      {row.targets.map((t) => (
                        <PlatformLogo key={t} platform={t} size={16} />
                      ))}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm" style={{ color: INK_DIM }}>{row.text}</p>
                  {willSkip.length > 0 && (
                    <p className="mt-1.5" style={{ color: WARN, fontSize: 12.5 }}>
                      {willSkip.map((t) => ruleFor(t)?.label ?? t).join(", ")} disconnected — this will be skipped there unless you reconnect.
                    </p>
                  )}

                  {row.status !== "firing" && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {row.status === "queued" && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => {
                            setEditingId(editingId === row.id ? null : row.id);
                            setEditText(row.text);
                            setConfirmCancelId(null);
                          }}
                          className="rounded-full px-3 py-1.5 font-medium"
                          style={{ background: "#ffffff0f", color: INK, fontSize: 12.5 }}
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          setReschedulingId(reschedulingId === row.id ? null : row.id);
                          setWhenLocal("");
                          setConfirmCancelId(null);
                        }}
                        className="rounded-full px-3 py-1.5 font-medium"
                        style={{ background: "#ffffff0f", color: INK, fontSize: 12.5 }}
                      >
                        Reschedule
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => run(() => sendScheduledNow(row.id))}
                        className="rounded-full px-3 py-1.5 font-medium"
                        style={{ background: "#ffffff0f", color: INK, fontSize: 12.5 }}
                      >
                        Send now
                      </button>
                      {confirmCancelId === row.id ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => run(() => cancelScheduled(row.id), () => setConfirmCancelId(null))}
                          className="rounded-full px-3 py-1.5 font-semibold"
                          style={{ background: `${WARN}22`, color: WARN, fontSize: 12.5 }}
                        >
                          Really cancel?
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setConfirmCancelId(row.id)}
                          className="rounded-full px-3 py-1.5 font-medium"
                          style={{ background: "transparent", color: INK_DIM, fontSize: 12.5 }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  )}

                  {editingId === row.id && (
                    <div className="mt-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        aria-label="Edit this post"
                        className="w-full resize-y rounded-lg px-2.5 py-2 outline-none"
                        style={{ background: "#070b14", border: "1px solid #ffffff14", color: INK, fontSize: 13.5, lineHeight: 1.5 }}
                      />
                      <button
                        type="button"
                        disabled={isPending || !editText.trim()}
                        onClick={() =>
                          run(
                            () => editScheduled(row.id, { text: editText, title: row.title ?? undefined, targets: row.targets }),
                            () => setEditingId(null),
                          )
                        }
                        className="mt-1.5 rounded-full px-3 py-1.5 font-semibold disabled:opacity-40"
                        style={{ background: BRAND, color: "#04060c", fontSize: 12.5 }}
                      >
                        Save changes
                      </button>
                    </div>
                  )}
                  {reschedulingId === row.id && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        type="datetime-local"
                        value={whenLocal}
                        onChange={(e) => setWhenLocal(e.target.value)}
                        aria-label="New time for this post"
                        className="rounded-lg px-2.5 py-1.5 outline-none"
                        style={{ background: "#070b14", border: "1px solid #ffffff14", color: INK, fontSize: 13, colorScheme: "dark" }}
                      />
                      <button
                        type="button"
                        disabled={isPending || !whenLocal}
                        onClick={() =>
                          run(
                            () => rescheduleScheduled(row.id, new Date(whenLocal).toISOString(), viewerTz),
                            () => setReschedulingId(null),
                          )
                        }
                        className="rounded-full px-3 py-1.5 font-semibold disabled:opacity-40"
                        style={{ background: BRAND, color: "#04060c", fontSize: 12.5 }}
                      >
                        Move it
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mt-6 text-sm font-medium" style={{ color: INK }}>Sent and settled</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {past.map((row) => {
              const late =
                row.firedAtIso &&
                new Date(row.firedAtIso).getTime() - new Date(row.scheduledForIso).getTime() > 90_000;
              const failedLegs = row.report?.outcomes.some((o) => o.state === "failed") ?? false;
              return (
                <li key={row.id} className="rounded-xl px-3.5 py-3" data-testid="queue-past" style={{ background: "#0e1626", border: "1px solid #ffffff14" }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium" style={{ color: INK, fontSize: 14 }}>
                      {spokenTime(row.scheduledForIso)}
                    </span>
                    <span style={{ color: row.status === "done" ? INK_DIM : WARN, fontSize: 12 }}>
                      {row.status === "done" ? (late && row.firedAtIso ? `went out ${spokenClock(row.firedAtIso)} (scheduled ${spokenClock(row.scheduledForIso)})` : "sent") : row.status}
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                      {row.targets.map((t) => (
                        <PlatformLogo key={t} platform={t} size={16} />
                      ))}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm" style={{ color: INK_DIM }}>{row.text}</p>
                  {row.report && (
                    <p className="mt-1.5 text-sm" style={{ color: INK }}>{row.report.summary}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {row.report && (
                      <button
                        type="button"
                        onClick={() => setOpenReportId(openReportId === row.id ? null : row.id)}
                        className="rounded-full px-3 py-1.5 font-medium"
                        style={{ background: "#ffffff0f", color: INK, fontSize: 12.5 }}
                      >
                        {openReportId === row.id ? "Close report" : "Report"}
                      </button>
                    )}
                    {(row.status === "missed" || row.status === "canceled") && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          setReschedulingId(reschedulingId === row.id ? null : row.id);
                          setWhenLocal("");
                        }}
                        className="rounded-full px-3 py-1.5 font-medium"
                        style={{ background: "#ffffff0f", color: INK, fontSize: 12.5 }}
                      >
                        Reschedule
                      </button>
                    )}
                    {row.status === "done" && failedLegs && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => run(() => retryFailedLegs(row.id))}
                        className="rounded-full px-3 py-1.5 font-medium"
                        style={{ background: "#ffffff0f", color: INK, fontSize: 12.5 }}
                      >
                        Retry failed
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => run(() => deleteScheduled(row.id))}
                      className="rounded-full px-3 py-1.5 font-medium"
                      style={{ background: "transparent", color: INK_DIM, fontSize: 12.5 }}
                    >
                      Remove
                    </button>
                  </div>
                  {openReportId === row.id && row.report && (
                    <ul className="mt-2 flex flex-col gap-0.5">
                      {reportLines(row.report).map((line) => (
                        <li key={line} style={{ color: INK_DIM, fontSize: 12.5 }}>{line}</li>
                      ))}
                    </ul>
                  )}
                  {reschedulingId === row.id && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        type="datetime-local"
                        value={whenLocal}
                        onChange={(e) => setWhenLocal(e.target.value)}
                        aria-label="New time for this post"
                        className="rounded-lg px-2.5 py-1.5 outline-none"
                        style={{ background: "#070b14", border: "1px solid #ffffff14", color: INK, fontSize: 13, colorScheme: "dark" }}
                      />
                      <button
                        type="button"
                        disabled={isPending || !whenLocal}
                        onClick={() =>
                          run(
                            () => rescheduleScheduled(row.id, new Date(whenLocal).toISOString(), viewerTz),
                            () => setReschedulingId(null),
                          )
                        }
                        className="rounded-full px-3 py-1.5 font-semibold disabled:opacity-40"
                        style={{ background: BRAND, color: "#04060c", fontSize: 12.5 }}
                      >
                        Queue it again
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
