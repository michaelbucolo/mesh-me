/**
 * THE CONTEXT BAR — one slot that answers "whose world am I standing in?".
 *
 * ── WHAT WAS THERE ───────────────────────────────────────────────────────────
 *
 * Two unrelated components at two anchors, for one question:
 *
 *   - `MeshModeTabs` — a Mesh|Global pill floating at `left-1/2 top-20`, dead
 *     centre. Photographed at 1440×900 it sat on top of a post card, and at
 *     390×844 it sat on top of two. The centre of the canvas is where your own
 *     node lives; it is the last place chrome belongs.
 *   - `MeshVisitingHeader` — THREE separate pills in a row at `left-3 top-20`:
 *     a Back button, a "@x's mesh" label, and a View-profile link. Three
 *     objects, three shadows, three edges, to say one thing.
 *
 * They were mutually exclusive already (you see the switch on your own mesh,
 * the header on someone else's) — which is the tell that they were always one
 * control with two states, drawn twice.
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * One tray, top-left, that morphs:
 *
 *   own mesh / global   [ Mesh | Global ]
 *   visiting            [ ‹ ][ AR  @alex's mesh  › ]
 *
 * Same position, same material, same footprint. Below it, and only below it,
 * the ambient marquee — so every word of chrome on this surface reads down one
 * left-hand column and the world keeps its middle.
 *
 * ── WHAT THIS CANNOT DO ──────────────────────────────────────────────────────
 *
 * It does not decide what you may see. `show` and `viewedUser` are handed down
 * from a payload the server already filtered; this draws the answer, it never
 * computes it.
 */

"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

function initialsOf(displayName: string | null, username: string): string {
  const source = (displayName || username).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function MeshContextBar({
  show,
  isGlobal,
  viewedUser,
  onMesh,
  onGlobal,
  onBack,
}: {
  /** The Mesh|Global switch: your own mesh or the Global view. Never while
   *  visiting a specific person — that state draws the visiting card instead. */
  show: boolean;
  isGlobal: boolean;
  viewedUser: { username: string; displayName: string | null; avatarUrl?: string | null } | null;
  onMesh: () => void;
  onGlobal: () => void;
  onBack: () => void;
}) {
  if (viewedUser) {
    const name = viewedUser.displayName || `@${viewedUser.username}`;
    return (
      <div className="mesh-context lg-regular lg-sm absolute z-30 flex items-center gap-1.5 p-1.5">
        <button
          type="button"
          onClick={onBack}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Back to your mesh"
          className="key ds-focus-ring flex h-9 w-9 shrink-0 items-center justify-center text-[var(--text-secondary)]"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        {/* One key, not a label plus a link: the whole card IS the way to their
            profile, which is the only thing anyone ever wanted from it. */}
        <Link
          href={`/profile/${viewedUser.username}`}
          onPointerDown={(e) => e.stopPropagation()}
          className="key ds-focus-ring flex h-9 min-w-0 items-center gap-2 pl-1.5 pr-2 text-[var(--text-primary)]"
        >
          {viewedUser.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatars are remote and already sized; next/image adds a loader round-trip for a 24px glyph.
            <img src={viewedUser.avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--paper-3)] text-[0.625rem] font-semibold text-[var(--text-secondary)]"
            >
              {initialsOf(viewedUser.displayName, viewedUser.username)}
            </span>
          )}
          <span className="min-w-0 truncate text-xs font-semibold">{name}&apos;s mesh</span>
          <ChevronRight size={14} className="shrink-0 text-[var(--text-tertiary)]" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  if (!show) return null;

  // URL-driven (router.push, not local state) so the load keys off the prop,
  // the prefetch keeps URL parity, and back/refresh behave.
  return (
    <div
      className="mesh-context lg-regular lg-sm absolute z-30 flex items-center gap-1.5 p-1.5"
      role="group"
      aria-label="Which mesh"
    >
      <button
        type="button"
        onClick={onMesh}
        onPointerDown={(e) => e.stopPropagation()}
        aria-pressed={!isGlobal}
        className={`key ds-focus-ring h-9 px-3.5 text-xs font-semibold ${
          !isGlobal ? "key-selected" : "text-[var(--text-secondary)]"
        }`}
      >
        Mesh
      </button>
      <button
        type="button"
        onClick={onGlobal}
        onPointerDown={(e) => e.stopPropagation()}
        aria-pressed={isGlobal}
        className={`key ds-focus-ring h-9 px-3.5 text-xs font-semibold ${
          isGlobal ? "key-selected" : "text-[var(--text-secondary)]"
        }`}
      >
        Global
      </button>
    </div>
  );
}
