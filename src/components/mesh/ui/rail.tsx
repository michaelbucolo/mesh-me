// The right rail — the mesh's toolbar. Extracted from the old mesh-scene.tsx;
// its share affordance now rides the ONE useShare() flow, its
// ownership-dependent labels come from meshCopy (ViewerCaps), and it gains a
// "Help & shortcuts" button so tips/shortcuts are finally reopenable.

"use client";

import { Check, CircleHelp, History, List, LocateFixed, PenLine, Search, Share2, Smile } from "lucide-react";
import type { ViewerCaps } from "../core/viewer";
import type { MeshCopy } from "./copy";
import { useShare } from "./use-share";

function RailButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      // A labeled control, not a mystery icon: on touch the label is always
      // shown (no hover to reveal it); with a mouse it stays a tidy icon that
      // expands its label on hover/focus. Comfortable 44px touch target.
      className="mesh-rail-btn mesh-glass mesh-ctl ds-focus-ring flex h-11 items-center rounded-full px-3 text-[var(--text-secondary)]"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{children}</span>
      <span className="mesh-rail-label text-xs font-medium">{label}</span>
    </button>
  );
}

export function MeshRail({
  viewer,
  copy,
  canCompose,
  shareUsername,
  showRewind,
  onCompose,
  onSearch,
  onList,
  onRewind,
  onHelp,
  onRecenter,
  onEmote,
}: {
  viewer: ViewerCaps;
  copy: MeshCopy;
  /** Own mesh with a loaded profile — the only place compose exists. */
  canCompose: boolean;
  /** The mesh owner's username for the canonical share link (null = self URL fallback). */
  shareUsername: string | null;
  showRewind: boolean;
  onCompose: () => void;
  onSearch: () => void;
  onList: () => void;
  onRewind: () => void;
  onHelp: () => void;
  onRecenter: () => void;
  /** Open the emote wheel anchored by the rail. Only provided when the
   * viewer may broadcast presence — no capability, no button (Global's rail
   * simply never grows a social affordance). */
  onEmote?: (anchor: { x: number; y: number }) => void;
}) {
  const { copied, share } = useShare();

  return (
    <div
      data-testid="mesh-action-bar"
      role="toolbar"
      aria-label="Mesh actions"
      className="absolute right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col items-end gap-2"
    >
      {canCompose && (
        <RailButton label={copy.composeLabel} onClick={onCompose}>
          <PenLine size={16} />
        </RailButton>
      )}
      <RailButton label={copy.searchLabel} onClick={onSearch}>
        <Search size={16} />
      </RailButton>
      <RailButton label="Explore as a list" onClick={onList}>
        <List size={16} />
      </RailButton>
      {onEmote && (
        <RailButton
          label="React"
          onClick={(e) => {
            // Anchor the wheel just left of the rail button that opened it.
            const r = e.currentTarget.getBoundingClientRect();
            onEmote({ x: r.left - 96, y: r.top + r.height / 2 });
          }}
        >
          <Smile size={16} />
        </RailButton>
      )}
      <RailButton
        label={copied ? "Link copied" : copy.shareLabel}
        onClick={() => {
          // Share a canonical link to this world. Recipients still pass the
          // server's mesh-visibility checks — a link is an invitation, not a
          // bypass.
          const url = viewer.isGlobal
            ? `${window.location.origin}/mesh?view=global`
            : shareUsername
              ? `${window.location.origin}/mesh?user=${encodeURIComponent(shareUsername)}`
              : window.location.href;
          share({
            title: copy.shareTitle,
            text: copy.shareText,
            url,
            dialogTitle: "Share this mesh",
          });
        }}
      >
        {copied ? <Check size={16} /> : <Share2 size={16} />}
      </RailButton>
      {showRewind && (
        <RailButton label="Rewind time" onClick={onRewind}>
          <History size={16} />
        </RailButton>
      )}
      <RailButton label="Help & shortcuts" onClick={onHelp}>
        <CircleHelp size={16} />
      </RailButton>
      <RailButton label="Recenter" onClick={onRecenter}>
        <LocateFixed size={16} />
      </RailButton>
    </div>
  );
}
