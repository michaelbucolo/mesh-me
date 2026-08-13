"use client";

// WRITE ONCE, PUBLISH EVERYWHERE — THE SURFACE.
//
// The whole value is in what this tells you BEFORE you press post. `plan.ts`
// knows what each platform refuses; this shows those verdicts live, per target,
// while you are still typing — so the composer never lets a post half-land and
// send you off to check five apps to find out which ones took it.
//
// Two things it deliberately does NOT do:
//
//   It does not count characters against the most generous platform. The
//   counter tracks the TIGHTEST selected limit, because a green "100 left" that
//   silently means "…on Threads, but X already refused this" is worse than no
//   counter at all.
//
//   It does not say "Posted" for anything it has not seen land. mesh.me posts
//   for real; every external platform currently reports "skipped — posting here
//   is not connected yet", because delivery needs a stored credential that does
//   not exist. The report shows that per platform rather than rounding it up.
//   Claiming success for a post that did not go is the specific lie this
//   product cannot afford — it is the reason people keep the other apps.

import Link from "next/link";
import { useMemo, useState } from "react";
import { PlatformLogo } from "@/components/platform/platform-logo";
import { planPublish, ruleFor, tightestLimit } from "@/lib/compose/plan";
import { publishEverywhere } from "@/lib/compose/publish-action";
import { reportLines } from "@/lib/compose/report-lines";
import { schedulePost } from "@/lib/compose/schedule-actions";

const INK = "#f2f4f8";
const INK_DIM = "#8b93a7";
const BRAND = "#3b82f6";
const WARN = "#f87171";

export type ComposerTarget = {
  platform: string;
  /** Your handle there, when we know it. */
  handle: string | null;
  /** False for platforms you have not connected — shown, but not selectable. */
  connected: boolean;
};

export function ComposerView({ targets, queueCount = 0 }: { targets: ComposerTarget[]; queueCount?: number }) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  // mesh.me starts selected: your own mesh is the one place a post always has
  // a home, so the default is never "nowhere".
  const [selected, setSelected] = useState<string[]>(["mesh"]);
  const [sending, setSending] = useState(false);
  // The report from the last publish. Kept whole rather than reduced to a
  // boolean, because "which of these actually went" is the question the whole
  // surface exists to answer.
  const [report, setReport] = useState<{ summary: string; lines: string[] } | null>(null);
  // Schedule-for-later: the panel is inline and quiet; wall→instant conversion
  // happens HERE, in the browser, with the target date's own zone rules
  // (DST-correct) — the server receives a UTC instant plus the IANA name and
  // does no zone arithmetic ever.
  const [scheduling, setScheduling] = useState(false);
  const [whenLocal, setWhenLocal] = useState("");
  const [queued, setQueued] = useState<string | null>(null);

  async function post() {
    setSending(true);
    setReport(null);
    setQueued(null);
    try {
      const res = await publishEverywhere({ text, title, targets: selected });
      if ("error" in res) {
        setReport({ summary: res.error, lines: [] });
        return;
      }
      // Every outcome is shown, not just the failures: a person who posted to
      // four places wants to see four confirmations, and one who posted to
      // three of four needs to know which one is missing.
      setReport({ summary: res.summary, lines: reportLines(res) });
      if (res.posted.length > 0) setText("");
    } finally {
      setSending(false);
    }
  }

  function presetLocal(daysAhead: number, hour: number): string {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    d.setHours(hour, 0, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function schedule() {
    if (!whenLocal) return;
    setSending(true);
    setReport(null);
    setQueued(null);
    try {
      const instant = new Date(whenLocal);
      const res = await schedulePost({
        text,
        title,
        targets: selected,
        scheduledForIso: instant.toISOString(),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (res && "error" in res && res.error) {
        setReport({ summary: res.error, lines: [] });
        return;
      }
      const spoken = instant.toLocaleString(undefined, {
        weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      });
      const places = selected.map((p) => ruleFor(p)?.label ?? p).join(" and ");
      setQueued(`Queued for ${spoken} — ${places}.`);
      setScheduling(false);
      setWhenLocal("");
      setText("");
    } finally {
      setSending(false);
    }
  }

  const plan = useMemo(
    () => planPublish({ text, media: [], title }, selected),
    [text, title, selected],
  );

  const limit = tightestLimit(selected);
  const used = text.length;
  const over = limit !== null && used > limit;

  // A title field only appears when something selected actually needs one —
  // an always-visible field for a Reddit rule is clutter for everyone else.
  const needsTitle = selected.some((p) => ruleFor(p)?.needsTitle);

  function toggle(platform: string) {
    setSelected((s) => (s.includes(platform) ? s.filter((p) => p !== platform) : [...s, platform]));
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 py-6 sm:px-6" data-testid="composer">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold" style={{ color: INK }}>
          Post everywhere
        </h1>
        {/* The queue's door lives on the compose surface — a second segment,
            not a sixth tab. The count is the affordance the queue exists. */}
        <Link href="/compose/queue" className="text-sm font-medium underline-offset-4 hover:underline" style={{ color: INK_DIM }}>
          Queue{queueCount > 0 ? ` (${queueCount})` : ""}
        </Link>
      </div>
      <p className="mt-1 text-sm" style={{ color: INK_DIM }}>
        Write once. Each platform tells you now if it will not take it.
      </p>

      {needsTitle && (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          data-testid="composer-title"
          className="mt-5 w-full rounded-xl px-3.5 py-2.5 outline-none"
          style={{ background: "#0e1626", border: "1px solid #ffffff14", color: INK, fontSize: 15 }}
        />
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's happening?"
        rows={6}
        data-testid="composer-text"
        className="mt-3 w-full resize-y rounded-xl px-3.5 py-3 outline-none"
        style={{ background: "#0e1626", border: "1px solid #ffffff14", color: INK, fontSize: 15.5, lineHeight: 1.5 }}
      />

      <div className="mt-2 flex items-center justify-between">
        <span style={{ color: INK_DIM, fontSize: 12.5 }}>
          {/* Naming the platform the limit belongs to: "180 left" means nothing
              without knowing which platform is doing the limiting. */}
          {limit === null
            ? "Pick somewhere to post"
            : over
              ? `${used - limit} over the ${tightestLabel(selected)} limit`
              : `${limit - used} left on ${tightestLabel(selected)}`}
        </span>
      </div>

      <h2 className="mt-6 text-sm font-medium" style={{ color: INK }}>
        Where it goes
      </h2>

      <ul className="mt-2 flex flex-col gap-1.5">
        {targets.map((t) => {
          const rule = ruleFor(t.platform);
          const on = selected.includes(t.platform);
          const verdict = plan.targets.find((p) => p.platform === t.platform);
          const selectable = t.connected && !!rule?.publishable;

          return (
            <li key={t.platform}>
              <button
                type="button"
                onClick={() => selectable && toggle(t.platform)}
                disabled={!selectable}
                aria-pressed={on}
                data-testid="composer-target"
                data-platform={t.platform}
                data-selected={on ? "1" : "0"}
                data-ok={verdict ? (verdict.ok ? "1" : "0") : ""}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed"
                style={{
                  background: on ? "#ffffff0f" : "transparent",
                  border: `1px solid ${on ? (verdict?.ok ? `${BRAND}66` : `${WARN}66`) : "#ffffff12"}`,
                  opacity: selectable ? 1 : 0.5,
                }}
              >
                <PlatformLogo platform={t.platform} size={20} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium" style={{ color: INK, fontSize: 14 }}>
                    {rule?.label ?? t.platform}
                    {t.handle && (
                      <span className="ml-1.5 font-normal" style={{ color: INK_DIM, fontSize: 12.5 }}>
                        {t.handle}
                      </span>
                    )}
                  </span>

                  {/* The reason, in the row, at the moment it becomes true. */}
                  {!t.connected ? (
                    <span className="block truncate" style={{ color: INK_DIM, fontSize: 12 }}>
                      Not connected
                    </span>
                  ) : !rule?.publishable ? (
                    <span className="block truncate" style={{ color: INK_DIM, fontSize: 12 }}>
                      Nothing to post to here
                    </span>
                  ) : on && verdict && !verdict.ok ? (
                    <span className="block truncate" style={{ color: WARN, fontSize: 12 }}>
                      {verdict.problems[0]?.message}
                    </span>
                  ) : null}
                </span>

                {on && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 font-semibold"
                    style={{
                      background: verdict?.ok ? `${BRAND}22` : `${WARN}22`,
                      color: verdict?.ok ? BRAND : WARN,
                      fontSize: 11,
                    }}
                  >
                    {verdict?.ok ? "Ready" : "Blocked"}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={post}
          disabled={!plan.canPublish || sending}
          data-testid="composer-publish"
          className="rounded-full px-5 py-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: BRAND, color: "#04060c", fontSize: 14.5 }}
        >
          {sending ? "Posting…" : plan.ready.length <= 1 ? "Post" : `Post to ${plan.ready.length}`}
        </button>

        <button
          type="button"
          onClick={() => setScheduling((s) => !s)}
          disabled={!plan.canPublish || sending}
          data-testid="composer-schedule-toggle"
          aria-expanded={scheduling}
          className="rounded-full px-4 py-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "#ffffff0f", border: "1px solid #ffffff14", color: INK, fontSize: 14 }}
        >
          Schedule
        </button>

        {/* Blocked targets are named on the button's doorstep, not discovered
            afterwards in another app. */}
        {plan.blocked.length > 0 && (
          <span style={{ color: WARN, fontSize: 12.5 }} data-testid="composer-blocked">
            {plan.blocked.length === 1 ? "1 platform will be skipped" : `${plan.blocked.length} platforms will be skipped`}
          </span>
        )}
      </div>

      {scheduling && (
        <div className="mt-3 rounded-xl px-3.5 py-3" data-testid="composer-schedule-panel" style={{ background: "#0e1626", border: "1px solid #ffffff14" }}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setWhenLocal(presetLocal(0, 19))}
              className="rounded-full px-3 py-1.5 font-medium"
              style={{ background: "#ffffff0f", color: INK, fontSize: 12.5 }}
            >
              This evening 7:00 PM
            </button>
            <button
              type="button"
              onClick={() => setWhenLocal(presetLocal(1, 9))}
              className="rounded-full px-3 py-1.5 font-medium"
              style={{ background: "#ffffff0f", color: INK, fontSize: 12.5 }}
            >
              Tomorrow 9:00 AM
            </button>
            <input
              type="datetime-local"
              value={whenLocal}
              onChange={(e) => setWhenLocal(e.target.value)}
              aria-label="Pick a time"
              data-testid="composer-schedule-when"
              className="rounded-lg px-2.5 py-1.5 outline-none"
              style={{ background: "#070b14", border: "1px solid #ffffff14", color: INK, fontSize: 13, colorScheme: "dark" }}
            />
          </div>
          <div className="mt-2.5 flex items-center gap-3">
            <button
              type="button"
              onClick={schedule}
              disabled={!whenLocal || sending}
              data-testid="composer-schedule-confirm"
              className="rounded-full px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: BRAND, color: "#04060c", fontSize: 13.5 }}
            >
              Queue it
            </button>
            <span style={{ color: INK_DIM, fontSize: 12 }}>
              Times are your local time ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
            </span>
          </div>
        </div>
      )}

      {queued && (
        <p className="mt-3 text-sm" data-testid="composer-queued" style={{ color: INK }}>
          {queued}{" "}
          <Link href="/compose/queue" className="underline underline-offset-4" style={{ color: BRAND }}>
            See the queue
          </Link>
        </p>
      )}

      {report && (
        <div className="mt-5 rounded-xl px-3.5 py-3" data-testid="composer-report" style={{ background: "#0e1626", border: "1px solid #ffffff14" }}>
          <p className="font-medium" style={{ color: INK, fontSize: 14 }}>
            {report.summary}
          </p>
          {report.lines.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {report.lines.map((line) => (
                <li key={line} style={{ color: INK_DIM, fontSize: 12.5 }}>
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function tightestLabel(selected: readonly string[]): string {
  const limit = tightestLimit(selected);
  if (limit === null) return "";
  const rule = selected
    .map(ruleFor)
    .find((r) => r?.publishable && r.maxChars === limit);
  return rule?.label ?? "";
}
