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
//   It does not say "Posted" for anything it has not seen land. Delivery to an
//   external platform is a queued job, and the button and the result say
//   "queued" until something actually confirms otherwise. Claiming success on
//   the strength of having enqueued work is the specific lie this product
//   cannot afford — it is the reason people keep the other apps installed.

import { useMemo, useState } from "react";
import { PlatformLogo } from "@/components/platform/platform-logo";
import { planPublish, ruleFor, tightestLimit } from "@/lib/compose/plan";

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

export function ComposerView({ targets }: { targets: ComposerTarget[] }) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  // mesh.me starts selected: your own mesh is the one place a post always has
  // a home, so the default is never "nowhere".
  const [selected, setSelected] = useState<string[]>(["mesh"]);

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
      <h1 className="text-2xl font-semibold" style={{ color: INK }}>
        Post everywhere
      </h1>
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

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          disabled={!plan.canPublish}
          data-testid="composer-publish"
          className="rounded-full px-5 py-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: BRAND, color: "#04060c", fontSize: 14.5 }}
        >
          {plan.ready.length <= 1 ? "Post" : `Post to ${plan.ready.length}`}
        </button>

        {/* Blocked targets are named on the button's doorstep, not discovered
            afterwards in another app. */}
        {plan.blocked.length > 0 && (
          <span style={{ color: WARN, fontSize: 12.5 }} data-testid="composer-blocked">
            {plan.blocked.length === 1 ? "1 platform will be skipped" : `${plan.blocked.length} platforms will be skipped`}
          </span>
        )}
      </div>
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
