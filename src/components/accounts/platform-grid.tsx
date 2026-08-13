"use client";

// THE PAGE IS THE LOGOS NOW.
//
// What this replaced: a search box, a row of category tabs, a wall of
// capability badges, a paragraph of policy notes per platform, and a separate
// "your connections" list that repeated every platform a second time. Twelve
// platforms, rendered twice, wrapped in roughly four hundred lines of chrome —
// to answer a question that is really "which of these are in, and which are
// not."
//
// So the answer is the whole surface: one tile per platform, its real mark, and
// its state legible without reading anything. Merged ones come first and glow
// in their own brand colour; the rest sit ready. Everything a tile cannot say
// in one line moves into the sheet you get by tapping it.
//
// THE CAPTION IS NOT DECORATION. Every tile carries one line under its name and
// it is never empty, because the states this grid can be in are not equally
// good news: "Connect to see" and "Needs setup" have to be as visible as
// "Merged". A grid where only the happy states are labelled is a grid that
// looks like everything works.

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Check, Lock } from "lucide-react";
import { PlatformLogo } from "@/components/platform/platform-logo";
import { cn } from "@/lib/utils";
import { SPRING_PANEL } from "@/lib/motion";

export type TileState = "merged" | "attention" | "open" | "locked";

export type PlatformTile = {
  id: string;
  name: string;
  /** Brand fill. Used only as a halo/ring tint — never as a ground under text. */
  tint: string;
  state: TileState;
  /** One short line under the name. Never empty — see the note above. */
  caption: string;
  /** OAuth start. Present only when tapping the tile should begin a connect. */
  connectHref: string | null;
};

const SPRING = SPRING_PANEL;

/** Corner marker per state. `open` deliberately has none — nothing has happened yet. */
function StateMark({ state }: { state: TileState }) {
  if (state === "merged") {
    return (
      <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-contrast,#fff)]">
        <Check className="size-2.5" strokeWidth={3.5} aria-hidden="true" />
      </span>
    );
  }
  if (state === "attention") {
    return (
      <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-[var(--ds-warning)] text-[var(--paper-0)]">
        <AlertTriangle className="size-2.5" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }
  if (state === "locked") {
    return (
      <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-[var(--ds-surface)] text-[var(--text-muted)] ring-1 ring-[var(--ds-border)]">
        <Lock className="size-2.5" strokeWidth={2.5} aria-hidden="true" />
      </span>
    );
  }
  return null;
}

function TileInner({ tile, isNew, reduce }: { tile: PlatformTile; isNew: boolean; reduce: boolean }) {
  const merged = tile.state === "merged";
  const dimmed = tile.state === "open" || tile.state === "locked";

  return (
    <>
      {/* The brand halo. Only merged platforms carry their own colour: it is how
          you read "this one is in" from across the room, and giving it to every
          tile would spend the signal on nothing. */}
      {merged && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            background: `radial-gradient(circle at 50% 42%, ${tile.tint}38, transparent 68%)`,
          }}
          initial={false}
          animate={reduce ? { opacity: 0.85 } : { opacity: [0.55, 1, 0.55] }}
          transition={reduce ? undefined : { duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* A just-connected platform gets one unmistakable burst. It fires on the
          return trip from OAuth, when the tile has also just re-sorted to the
          front of the grid, so the eye has something to follow. */}
      {isNew && !reduce && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] border-2"
          style={{ borderColor: tile.tint }}
          initial={{ scale: 0.7, opacity: 0.9 }}
          animate={{ scale: [0.7, 1.35], opacity: [0.9, 0] }}
          transition={{ duration: 1.1, ease: "easeOut", repeat: 2, repeatDelay: 0.2 }}
        />
      )}

      <motion.span
        className="relative flex items-center justify-center"
        initial={false}
        animate={{ scale: isNew && !reduce ? [1, 1.16, 1] : 1 }}
        transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <PlatformLogo
          platform={tile.id}
          size={52}
          className={cn(
            "h-auto w-[52%] max-w-[3.25rem] transition-[filter,opacity] duration-300",
            // Unconnected marks rest in a lower key and come up to full colour
            // when you reach for them, so the grid reads as "these are in, these
            // are available" rather than as twelve equally-loud buttons.
            dimmed && "opacity-60 saturate-[0.45] group-hover:opacity-100 group-hover:saturate-100",
            dimmed && "group-focus-visible:opacity-100 group-focus-visible:saturate-100",
            tile.state === "locked" && "opacity-40 saturate-[0.2]",
          )}
        />
      </motion.span>

      <span className="relative mt-2 w-full truncate px-1 text-center text-xs font-semibold text-[var(--text-primary)]">
        {tile.name}
      </span>
      <span
        className={cn(
          "relative w-full truncate px-1 text-center text-[0.6875rem] leading-4",
          merged ? "text-[var(--accent-text)]" : "text-[var(--text-muted)]",
          tile.state === "attention" && "text-[var(--ds-warning)]",
        )}
      >
        {tile.caption}
      </span>

      <StateMark state={tile.state} />
    </>
  );
}

const TILE_CLASS =
  "group ds-focus-ring relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[var(--ds-radius-lg)] border p-3 text-left transition-colors";

export function PlatformGrid({
  tiles,
  justConnected,
  onOpen,
}: {
  tiles: PlatformTile[];
  /** Platform id returned from OAuth this visit — its tile bursts once. */
  justConnected: string | null;
  onOpen: (platformId: string) => void;
}) {
  const reduce = useReducedMotion() ?? false;

  return (
    <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
      {tiles.map((tile, index) => {
        const isNew = justConnected === tile.id;
        const merged = tile.state === "merged";
        // Tapping a logo you have not merged yet should start merging it. There
        // is no state to manage and nothing to confirm, so a sheet in front of
        // the one obvious action would be a toll booth. Every other state has
        // something to say or something to do, and opens the sheet.
        const connectsOnTap = tile.state === "open" && Boolean(tile.connectHref);

        const shell = cn(
          TILE_CLASS,
          merged
            ? "border-[var(--accent)]/45 bg-[var(--ds-surface)]"
            : tile.state === "attention"
              ? "border-[var(--ds-warning,#d97706)]/45 bg-[var(--ds-surface)]"
              : tile.state === "locked"
                ? "border-dashed border-[var(--ds-border)] bg-[var(--bg-primary)]/40"
                : "border-dashed border-[var(--ds-border)] bg-[var(--ds-surface)] hover:border-[var(--accent)]/50",
        );

        const label = connectsOnTap
          ? `Connect ${tile.name}`
          : merged
            ? `${tile.name} — merged. Open details`
            : `${tile.name} — ${tile.caption}. Open details`;

        return (
          <motion.li
            key={tile.id}
            layout={!reduce}
            className="aspect-square"
            initial={reduce ? false : { opacity: 0, scale: 0.86, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={
              reduce
                ? { duration: 0 }
                : { ...SPRING, delay: Math.min(index * 0.035, 0.35) }
            }
          >
            <motion.div
              className="h-full w-full"
              whileHover={reduce ? undefined : { y: -4, scale: 1.04 }}
              whileTap={reduce ? undefined : { scale: 0.95 }}
              transition={SPRING}
            >
              {connectsOnTap && tile.connectHref ? (
                <Link href={tile.connectHref} prefetch={false} className={shell} aria-label={label}>
                  <TileInner tile={tile} isNew={isNew} reduce={reduce} />
                </Link>
              ) : (
                <button type="button" onClick={() => onOpen(tile.id)} className={shell} aria-label={label}>
                  <TileInner tile={tile} isNew={isNew} reduce={reduce} />
                </button>
              )}
            </motion.div>
          </motion.li>
        );
      })}
    </ul>
  );
}
