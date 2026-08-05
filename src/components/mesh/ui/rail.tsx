// The right rail — the mesh's toolbar. Extracted from the old mesh-scene.tsx;
// its share affordance now rides the ONE useShare() flow, its
// ownership-dependent labels come from meshCopy (ViewerCaps), and it gains a
// "Help & shortcuts" button so tips/shortcuts are finally reopenable.

"use client";

import Link from "next/link";
import { Check, CircleHelp, History, Inbox, List, LocateFixed, PenLine, Search, Share2, Smile } from "lucide-react";
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

/**
 * The same key, when the control is a DESTINATION rather than a layer.
 *
 * Every other rail control opens something over the canvas and stays on /mesh,
 * so a <button> is honest for them. The inbox is a different page, and a page
 * you navigate to is a link: middle-click, cmd-click, "open in new tab" and the
 * browser's own hover preview all come free, and none of them can be recovered
 * from an onClick that calls router.push. It renders identically to RailButton —
 * a link that looks like a key is fine; a key that is secretly a link is not.
 */
function RailLink({
  label,
  href,
  children,
}: {
  label: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      // The canvas underneath treats a pointerdown as the start of a drag. Every
      // other rail control stops it for the same reason: without this, reaching
      // for the rail pans the world out from under you.
      onPointerDown={(e) => e.stopPropagation()}
      className="mesh-rail-btn mesh-glass mesh-ctl ds-focus-ring flex h-11 items-center rounded-full px-3 text-[var(--text-secondary)]"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{children}</span>
      <span className="mesh-rail-label text-xs font-medium">{label}</span>
    </Link>
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
      {/* THE ONE INBOX — every DM, mention, reply and comment from every
          connected platform, in one queue.

          It lives here because this is where its only door has ever been. The
          inbox was built alongside a tile-layout /mesh whose one link to it was
          a node in that layout; when this canvas came back, the tiles went, and
          /inbox became a page with a working read, a working view, and no way
          in — reachable only by typing the URL. That is not a broken build and
          nothing else in the toolchain notices it, which is exactly why
          reachability:check exists and why it failed.

          The mesh is the picture of your presence; the inbox is the queue that
          picture is telling you about. Sitting next to Compose makes the rail's
          top pair the two things you came here to DO, with everything below
          them being ways to look. Owner-only by capability, the same shape the
          emote handler uses: it is YOUR inbox, so it has no meaning standing on
          someone else's mesh, and none at all in the guest-open Global view. */}
      {viewer.isOwner && (
        <RailLink label="Inbox" href="/inbox">
          <Inbox size={16} />
        </RailLink>
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
