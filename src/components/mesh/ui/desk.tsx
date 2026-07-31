"use client";

// THE HUD — the ledger over the full-screen world.
//
// The first cut of the redo framed the mesh inside a page grid of dashboard
// modules ("the Loom Desk"), and the verdict was immediate: the mesh is not a
// widget on a page. It is FULL SCREEN — a way of exploring the internet and
// expressing your presence — and the glance layer must ride OVER the world,
// not box it in. So the desk's modules (Active Now · Latest · Your Pulse) and
// the one ambient tray fold into a single collapsible HUD at the right edge,
// fed from state the scene already holds in React — the scene model, the
// presence roster, the unseen marks — never from new endpoints.

import { ChevronRight, PanelRight, RefreshCw, Sparkles, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { SceneModel, SceneNode } from "../scene/scene-model";
import type { RemotePresence } from "../live/roster";
import type { MarqueeItem } from "./chrome";
import { formatRelativeTime } from "@/lib/utils";

const HUD_OPEN_KEY = "mesh-hud-open";

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

function sectionTitle(title: string, aside?: string) {
  return (
    <div className="flex items-baseline justify-between px-3 pt-2.5 pb-1">
      <h2 className="text-xs font-semibold text-[var(--text-secondary)]">{title}</h2>
      {aside ? <span className="font-mono text-micro text-[var(--text-muted)]">{aside}</span> : null}
    </div>
  );
}

function ActiveNowSection({
  presences,
  onJump,
}: {
  presences: RemotePresence[];
  onJump: (userId: string) => void;
}) {
  const live = presences.filter((p) => p.isOnline);
  return (
    <section aria-label="Active now">
      {sectionTitle("Active now", live.length ? String(live.length) : undefined)}
      {live.length === 0 ? (
        <p className="px-3 pb-2 text-xs text-[var(--text-muted)]">Quiet right now.</p>
      ) : (
        <ul className="flex flex-col gap-0.5 px-1.5 pb-1.5">
          {live.slice(0, 5).map((p) => (
            <li key={p.userId}>
              <button
                type="button"
                onClick={() => onJump(p.userId)}
                className="ds-focus-ring flex w-full items-center gap-2 rounded-[10px] px-1.5 py-1 text-left hover:bg-[var(--paper-2)]"
              >
                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--paper-2)] text-xs font-semibold text-[var(--text-primary)]">
                  {p.displayName.charAt(0).toUpperCase()}
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-[var(--paper-1)] bg-[var(--success)]"
                    aria-hidden="true"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-[var(--text-primary)]">{p.displayName}</span>
                  <span className="block truncate text-micro text-[var(--text-muted)]">{whereLabel(p)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LatestSection({
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

  if (rows.length === 0) return null;
  return (
    <section aria-label="Latest across platforms" className="border-t border-[var(--rule)]">
      {sectionTitle("Latest")}
      <ul className="flex flex-col gap-0.5 px-1.5 pb-1.5">
        {rows.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onOpen(n)}
              className="ds-focus-ring flex w-full items-start gap-2 rounded-[10px] px-1.5 py-1.5 text-left hover:bg-[var(--paper-2)]"
            >
              <span className="mt-0.5 h-7 w-1 shrink-0 rounded-full" style={{ background: n.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  {n.sublabel && n.sublabel !== n.content ? (
                    <span className="min-w-0 truncate text-micro font-semibold text-[var(--text-primary)]">{n.sublabel}</span>
                  ) : null}
                  {n.createdAtMs ? (
                    <span className="shrink-0 font-mono text-micro text-[var(--text-muted)]">
                      {formatRelativeTime(new Date(n.createdAtMs))}
                    </span>
                  ) : null}
                  {n.isNew ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" /> : null}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-[var(--text-secondary)]">
                  {n.content || n.label || ""}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PulseSection({
  model,
  unseenTotal,
  onSync,
}: {
  model: SceneModel | null;
  unseenTotal: number;
  onSync?: () => Promise<void> | void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [weekAgoMs] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000);
  const stats = useMemo(() => {
    const nodes = model ? [...model.nodes.values()] : [];
    const postsThisWeek = nodes.filter(
      (n) => (n.kind === "post" || n.kind === "activity") && (n.createdAtMs ?? 0) >= weekAgoMs,
    ).length;
    const people = nodes.filter((n) => n.kind === "person").length;
    return { postsThisWeek, people };
  }, [model, weekAgoMs]);

  return (
    <section aria-label="Your pulse" className="border-t border-[var(--rule)]">
      {sectionTitle("Your pulse")}
      <dl className="grid grid-cols-3 gap-1.5 px-3">
        {(
          [
            [unseenTotal, "new for you"],
            [stats.postsThisWeek, "this week"],
            [stats.people, "people"],
          ] as const
        ).map(([value, label]) => (
          <div key={label}>
            <dd className="font-[family-name:var(--font-display)] text-lg font-semibold leading-none text-[var(--text-primary)]">
              {value}
            </dd>
            <dt className="mt-0.5 text-micro text-[var(--text-muted)]">{label}</dt>
          </div>
        ))}
      </dl>
      {onSync ? (
        <div className="px-3 pb-2.5 pt-1.5">
          <button
            type="button"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true);
              try {
                await onSync();
              } finally {
                setSyncing(false);
              }
            }}
            className="ds-focus-ring inline-flex items-center gap-1.5 text-micro font-semibold text-[var(--accent-text)] disabled:opacity-60"
          >
            <RefreshCw size={11} aria-hidden="true" className={syncing ? "motion-safe:animate-spin" : undefined} />
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      ) : (
        <div className="pb-2.5" />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// THE HUD — one collapsible ledger, right edge, over the world.
// ---------------------------------------------------------------------------

export function MeshHud({
  isOwner,
  isGlobal,
  marquee,
  unseenTotal,
  presences,
  model,
  defaultOpen,
  onJumpToUser,
  onOpenNode,
  onSync,
}: {
  isOwner: boolean;
  isGlobal: boolean;
  marquee: MarqueeItem | null;
  unseenTotal: number;
  presences: RemotePresence[];
  model: SceneModel | null;
  /** Coarse-pointer surfaces start collapsed — the world comes first there. */
  defaultOpen: boolean;
  onJumpToUser: (userId: string) => void;
  onOpenNode: (node: SceneNode) => void;
  onSync?: () => Promise<void> | void;
}) {
  // `choice` holds only EXPLICIT decisions (stored or made this mount);
  // otherwise the surface default applies at render time. Derived, not
  // synced: the pointer-coarseness feeding defaultOpen resolves after first
  // render, and deriving means the HUD follows it with no effect churn.
  const [choice, setChoice] = useState<boolean | null>(() => {
    try {
      const raw = localStorage.getItem(HUD_OPEN_KEY);
      if (raw != null) return raw === "1";
    } catch {
      // Storage unavailable — fall through to the surface default.
    }
    return null;
  });
  const open = choice ?? defaultOpen;
  const toggle = () => {
    const next = !open;
    setChoice(next);
    try {
      localStorage.setItem(HUD_OPEN_KEY, next ? "1" : "0");
    } catch {
      // Storage unavailable.
    }
  };

  // THE TRAY — the marquee's one-item priority queue, riding the HUD header.
  const tray =
    marquee?.kind === "catchup" ? (
      <button
        type="button"
        onClick={marquee.onStart}
        className="key ds-focus-ring flex max-w-full items-center gap-1.5 px-2.5 py-1 text-micro font-semibold text-[var(--text-primary)]"
      >
        <Sparkles size={11} aria-hidden="true" />
        <span className="truncate">{marquee.count === 1 ? "1 new thing" : `${marquee.count} new things`}</span>
      </button>
    ) : marquee ? (
      <div className="plate flex max-w-full items-center gap-1.5 px-2.5 py-1 text-micro font-semibold text-[var(--text-secondary)]">
        {marquee.kind === "presence" ? <UserRound size={11} aria-hidden="true" /> : <Sparkles size={11} aria-hidden="true" />}
        <span className="truncate">
          {marquee.kind === "presence"
            ? marquee.text
            : marquee.count === 1
              ? "Something new arrived"
              : `${marquee.count} new arrived`}
        </span>
      </div>
    ) : unseenTotal > 0 ? (
      <div className="plate flex items-center gap-1.5 px-2.5 py-1 text-micro font-semibold text-[var(--text-secondary)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
        {unseenTotal} new
      </div>
    ) : null;

  if (!open) {
    return (
      <div className="mesh-hud mesh-hud-closed absolute z-30 flex items-center gap-1.5">
        <div className="mesh-tray min-w-0">{tray}</div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={false}
          aria-label="Open the mesh ledger"
          title="What's happening"
          className="key ds-focus-ring inline-flex h-9 w-9 shrink-0 items-center justify-center text-[var(--text-secondary)]"
        >
          <PanelRight size={15} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <aside className="mesh-hud lg-regular lg-sm absolute z-30 flex flex-col overflow-hidden" aria-label="Mesh ledger">
      <div className="flex items-center gap-1.5 border-b border-[var(--rule)] p-1.5">
        <div className="mesh-tray min-w-0 flex-1">{tray}</div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded
          aria-label="Collapse the mesh ledger"
          className="key ds-focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center text-[var(--text-secondary)]"
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {!isGlobal && <ActiveNowSection presences={presences} onJump={onJumpToUser} />}
        <LatestSection model={model} onOpen={onOpenNode} />
        {isOwner && <PulseSection model={model} unseenTotal={unseenTotal} onSync={onSync} />}
      </div>
    </aside>
  );
}
