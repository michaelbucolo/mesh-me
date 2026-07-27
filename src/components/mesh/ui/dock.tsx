/**
 * THE MESH DOCK — one object, where there used to be a ring of eight.
 *
 * ── WHAT WAS THERE, MEASURED ─────────────────────────────────────────────────
 *
 * `rail.tsx` put eight 46px circles down the right edge: Create, Search, List,
 * React, Share, Rewind, Help, Recenter. Photographed on the running build:
 *
 *   desktop 1440×900 — a 46×440 column, eight identical grey discs, labels
 *     hidden until hover, no grouping, no hierarchy.
 *   phone 390×844 — a 46×408 column. That is 48% of the screen height, down
 *     the edge people hold, sitting on top of the world it is meant to steer.
 *
 * Three things were wrong, and only one of them was the size:
 *
 * 1. NO HIERARCHY. Create — the single action that makes a mesh yours — was
 *    drawn exactly like Recenter. Eight equal discs mean the eye has to read
 *    all eight to find one, every time.
 *
 * 2. TWO OF THEM WERE ALREADY ON SCREEN. The app top bar carries a "Search
 *    your Mesh" field and a Share button (app-shell.tsx:236, :261). The rail
 *    carried a magnifier and a share glyph 200px away, doing something subtly
 *    different, looking identical. The recurring failure of this codebase —
 *    two places state one fact — rendered as pixels.
 *
 * 3. WRONG MATERIAL. Every other control in the product is a moulded `.key`
 *    with an --edge, a mould line and a side wall. The rail was `.mesh-glass`
 *    paper pills. The mesh did not look like a hard part of mesh.me; it looked
 *    like a graph widget someone embedded.
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * A tray of keys in the bottom-right, in reading order:
 *
 *     [ Find ] [ List ] [ Center ] [ ⋯ ]   [ N ]   [ ✎ Create ]
 *
 * Navigate · overflow · the New pill when something is waiting · then the
 * primary, moulded from the mesh's own plastic and last so it lands under the
 * thumb. Rare things (React, Rewind, Share, Help) live behind the one ⋯.
 *
 * Five visible controls, one of them obviously the important one, in a single
 * horizontal object that leaves the entire right edge to the world.
 *
 * ── WHAT THIS CANNOT DO ──────────────────────────────────────────────────────
 *
 * It cannot make the mesh worth steering. A dock is the handle; whether there
 * is anything in the world to find is decided upstream by supply and by the
 * scene, not here.
 */

"use client";

import { Check, ChevronRight, CircleHelp, Crosshair, History, LayoutList, MoreHorizontal, PenLine, Search, Share2, Smile } from "lucide-react";
import { useEffect, useRef } from "react";
import type { BranchKey } from "../scene/scene-model";
import type { UnseenBranchCount } from "../scene/seen-marks";
import type { ViewerCaps } from "../core/viewer";
import type { MeshCopy } from "./copy";
import { useShare } from "./use-share";

const BRANCH_LABELS: Partial<Record<BranchKey, string>> = {
  posts: "Your posts",
  people: "People",
  platforms: "Platforms",
};

/**
 * A dock key. Icon always; the label rides alongside on wide screens and is the
 * accessible name everywhere, so nothing here is ever a mystery glyph to a
 * screen reader the way the old hover-only rail labels were.
 */
function DockKey({
  label,
  shortLabel,
  icon,
  onClick,
  primary,
  expanded,
  badge,
  keyRef,
}: {
  /** The accessible name. Always the full, unambiguous one — "Create on your
   *  mesh", not "Create" — because a screen reader gets no surrounding canvas
   *  to disambiguate from. */
  label: string;
  /** What the primary key PRINTS, when it prints anything. The full label is
   *  three words wide and pushed the dock to 395px on desktop; next to a pen
   *  glyph, on the mesh, "Create" is not ambiguous. */
  shortLabel?: string;
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** The one action moulded from the mesh's plastic. At most one per dock. */
  primary?: boolean;
  /** Drives aria-expanded for the two keys that own popovers. */
  expanded?: boolean;
  badge?: number;
  keyRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={keyRef}
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      aria-haspopup={expanded === undefined ? undefined : "menu"}
      onClick={onClick}
      // The canvas listens for pointerdown to pan and to deselect. Without this
      // every dock press also dragged the world a pixel and dropped the
      // selection out from under the thing you just opened.
      onPointerDown={(e) => e.stopPropagation()}
      className={`mesh-dock-key key ds-focus-ring relative flex h-11 min-w-11 items-center justify-center gap-2 px-3 text-sm font-semibold ${
        primary ? "key-lit mesh-dock-key-primary" : "text-[var(--text-secondary)]"
      }`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
        {icon}
      </span>
      {primary && shortLabel && <span className="mesh-dock-label hidden sm:inline">{shortLabel}</span>}
      {badge != null && badge > 0 && (
        <span
          // font-semibold, not font-bold: scripts/type-check.ts caps weight at
          // 600 across the product, and a 4px-tall badge does not get to be the
          // exception. Its emphasis comes from the amber plastic under it.
          className="mesh-new-mark mesh-dock-badge absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center px-1 text-[0.625rem] font-semibold tabular-nums"
          aria-hidden="true"
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

/** A popover that hangs above the dock. Its open/closed state belongs to the
 *  chrome stack, not to this file — Esc must close the topmost layer, and a
 *  popover with private state would not be in that ordering. */
function DockPopover({
  label,
  onDismiss,
  children,
}: {
  label: string;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // Pointerdown, not click: the canvas pans on pointerdown, so waiting for
    // click leaves the popover open through the start of a drag.
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onDismiss();
    };
    // Deferred: the very press that opened this is still travelling.
    const id = window.setTimeout(() => window.addEventListener("pointerdown", onDown), 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [onDismiss]);
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      className="mesh-dock-pop plate absolute bottom-full right-0 mb-2 flex w-56 flex-col gap-0.5 p-1.5"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function PopRow({
  label,
  icon,
  onClick,
  trailing,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="mesh-dock-pop-row ds-focus-ring flex h-10 w-full items-center gap-2.5 px-2.5 text-left text-sm font-medium text-[var(--text-secondary)]"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

export function MeshDock({
  viewer,
  copy,
  canCompose,
  shareUsername,
  showRewind,
  unseen,
  moreOpen,
  newOpen,
  onToggleMore,
  onToggleNew,
  onCloseMore,
  onCloseNew,
  onCompose,
  onSearch,
  onList,
  onRewind,
  onHelp,
  onRecenter,
  onEmote,
  onFocusBranch,
  onMarkSeen,
}: {
  viewer: ViewerCaps;
  copy: MeshCopy;
  /** Own mesh with a loaded profile — the only place compose exists. */
  canCompose: boolean;
  /** The mesh owner's username for the canonical share link (null = self URL). */
  shareUsername: string | null;
  showRewind: boolean;
  /** Unseen-per-branch. Empty (or absent) hides the New key entirely. */
  unseen: UnseenBranchCount[];
  moreOpen: boolean;
  newOpen: boolean;
  onToggleMore: () => void;
  onToggleNew: () => void;
  onCloseMore: () => void;
  onCloseNew: () => void;
  onCompose: () => void;
  onSearch: () => void;
  onList: () => void;
  onRewind: () => void;
  onHelp: () => void;
  onRecenter: () => void;
  /** Only provided when the viewer may broadcast presence — no capability, no
   *  row (Global's dock simply never grows a social affordance). */
  onEmote?: (anchor: { x: number; y: number }) => void;
  onFocusBranch: (branch: BranchKey) => void;
  onMarkSeen: (branch: BranchKey) => void;
}) {
  const { copied, share } = useShare();
  const moreRef = useRef<HTMLButtonElement | null>(null);
  const unseenTotal = unseen.reduce((sum, u) => sum + u.count, 0);

  const shareThisMesh = () => {
    // A canonical link to this world. Recipients still pass the server's
    // mesh-visibility checks — a link is an invitation, not a bypass.
    const url = viewer.isGlobal
      ? `${window.location.origin}/mesh?view=global`
      : shareUsername
        ? `${window.location.origin}/mesh?user=${encodeURIComponent(shareUsername)}`
        : window.location.href;
    share({ title: copy.shareTitle, text: copy.shareText, url, dialogTitle: "Share this mesh" });
  };

  return (
    <div
      data-testid="mesh-action-bar"
      role="toolbar"
      aria-label="Mesh actions"
      className="mesh-dock lg-regular lg-sm absolute z-30 flex items-center gap-1.5 p-1.5"
    >
      <DockKey label={copy.searchLabel} icon={<Search size={17} />} onClick={onSearch} />
      <DockKey label="Explore as a list" icon={<LayoutList size={17} />} onClick={onList} />
      <DockKey label="Recenter the view" icon={<Crosshair size={17} />} onClick={onRecenter} />

      <div className="relative">
        <DockKey
          label="More actions"
          icon={<MoreHorizontal size={17} />}
          onClick={onToggleMore}
          expanded={moreOpen}
          keyRef={moreRef}
        />
        {moreOpen && (
          <DockPopover label="More mesh actions" onDismiss={onCloseMore}>
            {onEmote && (
              <PopRow
                label="React"
                icon={<Smile size={15} />}
                onClick={() => {
                  // Anchor the wheel where the ⋯ key is, so it opens from the
                  // control that summoned it rather than from a fixed corner.
                  const r = moreRef.current?.getBoundingClientRect();
                  onCloseMore();
                  if (r) onEmote({ x: r.left - 96, y: r.top - 40 });
                }}
              />
            )}
            <PopRow
              label={copied ? "Link copied" : copy.shareLabel}
              icon={copied ? <Check size={15} /> : <Share2 size={15} />}
              onClick={shareThisMesh}
            />
            {showRewind && (
              <PopRow
                label="Rewind time"
                icon={<History size={15} />}
                onClick={() => {
                  onCloseMore();
                  onRewind();
                }}
              />
            )}
            <PopRow
              label="Help & shortcuts"
              icon={<CircleHelp size={15} />}
              onClick={() => {
                onCloseMore();
                onHelp();
              }}
            />
          </DockPopover>
        )}
      </div>

      {/* What piled up while you were away. Absent entirely when nothing is
          waiting — an empty "0 new" is noise wearing a badge. */}
      {unseenTotal > 0 && (
        <div className="relative">
          <DockKey
            label={`${unseenTotal} new — see where`}
            icon={<span className="text-xs font-semibold tabular-nums">{unseenTotal > 99 ? "99+" : unseenTotal}</span>}
            onClick={onToggleNew}
            expanded={newOpen}
          />
          {newOpen && (
            <DockPopover label="What's new, by branch" onDismiss={onCloseNew}>
              {/* `.mesh-eyebrow`, not `uppercase tracking-wide` — small-caps is
                  this product's ONE labelling device, and hand-rolling a second
                  one out of transform + tracking is how a HUD voice gets in.
                  scripts/type-check.ts owns that rule; it caught this. */}
              <p className="mesh-eyebrow px-2.5 pb-1 pt-1.5">New since your last visit</p>
              {unseen.map(({ branch, count }) => (
                <PopRow
                  key={branch}
                  label={`${BRANCH_LABELS[branch] ?? branch} · ${count} new`}
                  icon={<ChevronRight size={15} />}
                  onClick={() => {
                    onCloseNew();
                    onFocusBranch(branch);
                  }}
                  trailing={
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Mark ${BRANCH_LABELS[branch] ?? branch} seen`}
                      title="Mark seen"
                      className="mesh-dock-seen ds-focus-ring flex h-6 w-6 shrink-0 items-center justify-center text-[var(--text-tertiary)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkSeen(branch);
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        e.stopPropagation();
                        onMarkSeen(branch);
                      }}
                    >
                      <Check size={13} />
                    </span>
                  }
                />
              ))}
            </DockPopover>
          )}
        </div>
      )}

      {canCompose && (
        <DockKey
          label={copy.composeLabel}
          shortLabel="Create"
          icon={<PenLine size={17} />}
          onClick={onCompose}
          primary
        />
      )}
    </div>
  );
}
