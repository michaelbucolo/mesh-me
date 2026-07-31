"use client";

// THE DESK — the DOM half of the Loom Desk (FINAL-SPEC §3–§4, slice 1).
//
// /mesh is a dashboard whose hero panel is the living mesh. These modules are
// readouts OF the loom, fed from state the scene already holds in React —
// the scene model, the presence roster, the unseen marks — never from new
// endpoints. Slice 1 ships them as honest readouts; the cross-highlight bus
// and deep-link tray arrive in a later slice.

import { PenSquare, RefreshCw, Search, Sparkles, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { SceneModel, SceneNode } from "../scene/scene-model";
import type { RemotePresence } from "../live/roster";
import type { MarqueeItem } from "./chrome";
import { formatRelativeTime } from "@/lib/utils";

function greetingFor(hour: number): string {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function firstName(name: string | null | undefined, fallback: string): string {
  const n = (name || "").trim();
  return n ? n.split(/\s+/)[0] : fallback;
}

/** Where a visitor is, as a person would say it. */
function whereLabel(p: RemotePresence): string {
  if (p.surface === "mesh") return "here on the mesh";
  const route = (p.activeRoute || "").split("?")[0];
  if (route.startsWith("/messages")) return "in MeChat";
  if (route.startsWith("/flow")) return "in Flow";
  if (route.startsWith("/feed")) return "in the feed";
  if (route.startsWith("/explore")) return "exploring";
  return "on mesh.me";
}

// ---------------------------------------------------------------------------
// TODAY STRIP — greeting · tray (the one ambient slot, inline now) · actions
// ---------------------------------------------------------------------------

export function MeshTodayStrip({
  ownerName,
  isOwner,
  isGlobal,
  canPost,
  marquee,
  unseenTotal,
  onCompose,
  onSearch,
  onSync,
}: {
  ownerName: string | null;
  isOwner: boolean;
  isGlobal: boolean;
  canPost: boolean;
  marquee: MarqueeItem | null;
  unseenTotal: number;
  onCompose: () => void;
  onSearch: () => void;
  onSync?: () => Promise<void> | void;
}) {
  const [syncing, setSyncing] = useState(false);
  // Sampled once per mount (lazy init keeps render pure): a greeting that
  // flips mid-session is churn, not accuracy.
  const [mountedAt] = useState(() => new Date());
  const heading = isGlobal
    ? "The Commons"
    : isOwner
      ? `${greetingFor(mountedAt.getHours())}, ${firstName(ownerName, "you")}`
      : `${firstName(ownerName, "Their")}’s mesh`;
  const dateLine = useMemo(
    () => mountedAt.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
    [mountedAt],
  );

  return (
    <header className="mesh-desk-strip" data-testid="mesh-today-strip">
      <div className="min-w-0">
        <h1 className="truncate font-[family-name:var(--font-display)] text-[1.375rem] font-semibold leading-tight text-[var(--mesh-text)] md:text-[1.625rem]">
          {heading}
        </h1>
        <p className="font-mono text-micro text-[var(--mesh-text-muted)]">{dateLine}</p>
      </div>

      {/* THE TRAY — the marquee's priority-queue slot, woven into the strip
          instead of floating over the world. Same one-at-a-time contract. */}
      <div className="mesh-tray min-w-0 flex-1" role="status">
        {marquee?.kind === "catchup" ? (
          <button
            type="button"
            onClick={marquee.onStart}
            className="key ds-focus-ring flex max-w-full items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
          >
            <Sparkles size={13} aria-hidden="true" />
            <span className="truncate">
              Catch up on {marquee.count === 1 ? "1 new thing" : `${marquee.count} new things`}
            </span>
          </button>
        ) : marquee ? (
          <div className="plate flex max-w-full items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">
            {marquee.kind === "presence" ? (
              <UserRound size={13} aria-hidden="true" />
            ) : (
              <Sparkles size={13} aria-hidden="true" />
            )}
            <span className="truncate">
              {marquee.kind === "presence"
                ? marquee.text
                : marquee.count === 1
                  ? "Something new just arrived"
                  : `${marquee.count} new things just arrived`}
            </span>
          </div>
        ) : unseenTotal > 0 ? (
          <div className="plate flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
            {unseenTotal === 1 ? "1 new thing since your last visit" : `${unseenTotal} new things since your last visit`}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onSearch}
          aria-label="Search your mesh"
          title="Search (/)"
          className="key ds-focus-ring hidden h-9 w-9 items-center justify-center text-[var(--mesh-text-secondary)] sm:inline-flex"
        >
          <Search size={16} aria-hidden="true" />
        </button>
        {isOwner && onSync && (
          <button
            type="button"
            aria-label="Sync your platforms now"
            title="Sync now"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true);
              try {
                await onSync();
              } finally {
                setSyncing(false);
              }
            }}
            className="key ds-focus-ring inline-flex h-9 w-9 items-center justify-center text-[var(--mesh-text-secondary)] disabled:opacity-60"
          >
            <RefreshCw size={16} aria-hidden="true" className={syncing ? "motion-safe:animate-spin" : undefined} />
          </button>
        )}
        {canPost && (
          <button
            type="button"
            onClick={onCompose}
            className="ds-focus-ring inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--accent-ink)]"
          >
            <PenSquare size={15} aria-hidden="true" />
            Create
          </button>
        )}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// RIGHT RAIL — Active Now · Latest Across Platforms · Your Pulse
// ---------------------------------------------------------------------------

function moduleTitle(title: string, aside?: string) {
  return (
    <div className="flex items-baseline justify-between px-4 pt-3 pb-1.5">
      <h2 className="text-[0.8125rem] font-semibold text-[var(--mesh-text-secondary)]">{title}</h2>
      {aside ? <span className="font-mono text-micro text-[var(--mesh-text-muted)]">{aside}</span> : null}
    </div>
  );
}

export function MeshActiveNow({
  presences,
  onJump,
}: {
  presences: RemotePresence[];
  onJump: (userId: string) => void;
}) {
  const live = presences.filter((p) => p.isOnline);
  return (
    <section className="mesh-desk-module" aria-label="Active now">
      {moduleTitle("Active now", live.length ? String(live.length) : undefined)}
      {live.length === 0 ? (
        <p className="px-4 pb-3 text-xs text-[var(--mesh-text-muted)]">
          Quiet right now — your people will show up here.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5 px-2 pb-2">
          {live.slice(0, 5).map((p) => (
            <li key={p.userId}>
              <button
                type="button"
                onClick={() => onJump(p.userId)}
                className="ds-focus-ring flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left hover:bg-[var(--mesh-panel-hover)]"
              >
                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--paper-2)] text-xs font-semibold text-[var(--mesh-text)]">
                  {p.displayName.charAt(0).toUpperCase()}
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--paper-1)] bg-[var(--success)]"
                    aria-hidden="true"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--mesh-text)]">{p.displayName}</span>
                  <span className="block truncate text-micro text-[var(--mesh-text-muted)]">{whereLabel(p)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MeshLatest({
  model,
  onOpen,
}: {
  model: SceneModel | null;
  onOpen: (node: SceneNode) => void;
}) {
  const rows = useMemo(() => {
    const nodes = model ? [...model.nodes.values()] : [];
    return nodes
      .filter((n) => (n.kind === "post" || n.kind === "activity") && (n.content || n.label))
      .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0) || a.id.localeCompare(b.id))
      .slice(0, 4);
  }, [model]);

  return (
    <section className="mesh-desk-module min-h-0 flex-1" aria-label="Latest across platforms">
      {moduleTitle("Latest")}
      {rows.length === 0 ? (
        <p className="px-4 pb-3 text-xs text-[var(--mesh-text-muted)]">
          Connect a platform to pull your latest in.
        </p>
      ) : (
        <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
          {rows.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onOpen(n)}
                className="ds-focus-ring flex w-full items-start gap-2.5 rounded-[10px] px-2 py-2 text-left hover:bg-[var(--mesh-panel-hover)]"
              >
                <span
                  className="mt-0.5 h-8 w-1 shrink-0 rounded-full"
                  style={{ background: n.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    {/* Byline, not a repeat of the body: the node's label is
                        often just its truncated text, which duplicated the
                        two-line body below it. */}
                    {n.sublabel && n.sublabel !== n.content ? (
                      <span className="min-w-0 truncate text-xs font-semibold text-[var(--mesh-text)]">{n.sublabel}</span>
                    ) : null}
                    {n.createdAtMs ? (
                      <span className="shrink-0 font-mono text-micro text-[var(--mesh-text-muted)]">
                        {formatRelativeTime(new Date(n.createdAtMs))}
                      </span>
                    ) : null}
                    {n.isNew ? (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                    ) : null}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[0.8125rem] leading-snug text-[var(--mesh-text-secondary)]">
                    {n.content || n.label || ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MeshPulse({
  model,
  unseenTotal,
}: {
  model: SceneModel | null;
  unseenTotal: number;
}) {
  // Lazy init, not Date.now() in render: the week boundary holding still for
  // the life of the mount is exactly what a daily-glance stat wants.
  const [weekAgoMs] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000);
  const stats = useMemo(() => {
    const nodes = model ? [...model.nodes.values()] : [];
    const weekAgo = weekAgoMs;
    const postsThisWeek = nodes.filter(
      (n) => (n.kind === "post" || n.kind === "activity") && (n.createdAtMs ?? 0) >= weekAgo,
    ).length;
    const people = nodes.filter((n) => n.kind === "person").length;
    return { postsThisWeek, people };
  }, [model, weekAgoMs]);

  return (
    <section className="mesh-desk-module" aria-label="Your pulse">
      {moduleTitle("Your pulse")}
      <dl className="grid grid-cols-3 gap-2 px-4 pb-3">
        <div>
          <dd className="font-[family-name:var(--font-display)] text-[1.375rem] font-semibold leading-none text-[var(--mesh-text)]">
            {unseenTotal}
          </dd>
          <dt className="mt-1 text-micro text-[var(--mesh-text-muted)]">new for you</dt>
        </div>
        <div>
          <dd className="font-[family-name:var(--font-display)] text-[1.375rem] font-semibold leading-none text-[var(--mesh-text)]">
            {stats.postsThisWeek}
          </dd>
          <dt className="mt-1 text-micro text-[var(--mesh-text-muted)]">posts this week</dt>
        </div>
        <div>
          <dd className="font-[family-name:var(--font-display)] text-[1.375rem] font-semibold leading-none text-[var(--mesh-text)]">
            {stats.people}
          </dd>
          <dt className="mt-1 text-micro text-[var(--mesh-text-muted)]">people woven in</dt>
        </div>
      </dl>
    </section>
  );
}
