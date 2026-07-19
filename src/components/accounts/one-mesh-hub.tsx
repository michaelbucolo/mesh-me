"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";

/** One connected account, pre-resolved to its brand monogram by the caller. */
export type HubAccount = {
  id: string;
  platform: string;
  name: string;
  glyph: string;
  bg: string;
  fg?: string;
  /** Live + syncing — draws the energy stream flowing into your one account. */
  synced: boolean;
};

type HubIdentity = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

// Ring radius as a share of the (square) hub box.
const R = 37;

function ringPositions(count: number): { x: number; y: number; angle: number }[] {
  if (count === 0) return [];
  return Array.from({ length: count }, (_, i) => {
    // Start at the top and go clockwise; a lone account sits neatly up top.
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    return { x: 50 + R * Math.cos(angle), y: 50 + R * Math.sin(angle), angle };
  });
}

/**
 * The "One Mesh" — your mesh.me identity as a glowing central node with every
 * connected account orbiting it, each tied back by a living string. Synced
 * accounts stream little sparks of energy inward, so the whole picture reads as
 * "all of these are one account." Falls back to a calm static layout under
 * reduced-motion. All hand-drawn — brand monograms, never platform logos/emoji.
 */
export function OneMeshHub({
  identity,
  accounts,
}: {
  identity: HubIdentity;
  accounts: HubAccount[];
}) {
  const reduce = useReducedMotion();
  const positions = ringPositions(accounts.length);
  const initials =
    (identity.displayName
      .split(/\s+/)
      .map((p) => p.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join("") || identity.username.charAt(0) || "M").toUpperCase();

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[26rem]">
      {/* Strings + energy live behind the nodes. */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="one-mesh-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="70%" stopColor="var(--accent)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Soft aura behind the center. */}
        <circle cx="50" cy="50" r="30" fill="url(#one-mesh-core)" />
        {positions.map((pos, i) => {
          const acct = accounts[i];
          return (
            <line
              key={`string-${acct.id}`}
              x1={pos.x}
              y1={pos.y}
              x2="50"
              y2="50"
              stroke="var(--accent)"
              strokeOpacity={acct.synced ? 0.5 : 0.22}
              strokeWidth={acct.synced ? 0.7 : 0.5}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* Energy streaming inward on each synced string. */}
      {!reduce &&
        positions.map((pos, i) => {
          const acct = accounts[i];
          if (!acct.synced) return null;
          return (
            <motion.span
              key={`spark-${acct.id}`}
              className="absolute h-1.5 w-1.5 rounded-full"
              style={{
                background: "var(--accent)",
                boxShadow: "0 0 6px var(--accent)",
                marginLeft: "-3px",
                marginTop: "-3px",
              }}
              initial={{ left: `${pos.x}%`, top: `${pos.y}%`, opacity: 0 }}
              animate={{ left: "50%", top: "50%", opacity: [0, 1, 1, 0] }}
              transition={{
                duration: 2.1,
                delay: i * 0.28,
                repeat: Infinity,
                repeatDelay: 0.6,
                ease: "easeIn",
              }}
            />
          );
        })}

      {/* Satellite account nodes. */}
      {positions.map((pos, i) => {
        const acct = accounts[i];
        return (
          <motion.div
            key={`node-${acct.id}`}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            initial={reduce ? false : { opacity: 0, left: "50%", top: "50%", scale: 0.4 }}
            animate={{ opacity: 1, left: `${pos.x}%`, top: `${pos.y}%`, scale: 1 }}
            transition={{ duration: 0.6, delay: reduce ? 0 : 0.15 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
          >
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold shadow-sm ring-2 ring-[var(--ds-surface)]"
              style={{ backgroundColor: acct.bg, color: acct.fg ?? "#ffffff" }}
              title={acct.name}
            >
              {acct.glyph}
            </span>
            <span className="max-w-[5rem] truncate text-[10px] font-semibold text-[var(--text-muted)]">
              {acct.name}
            </span>
          </motion.div>
        );
      })}

      {/* The mesh.me identity at the core. */}
      <motion.div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
        initial={reduce ? false : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-[var(--accent)] bg-[var(--ds-surface)] shadow-lg"
          animate={reduce ? undefined : { boxShadow: [
            "0 0 0 0 rgba(99,102,241,0.0)",
            "0 0 22px 4px rgba(99,102,241,0.28)",
            "0 0 0 0 rgba(99,102,241,0.0)",
          ] }}
          transition={reduce ? undefined : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        >
          {identity.avatarUrl ? (
            <Avatar src={identity.avatarUrl} alt={identity.username} size="lg" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)]/15 text-xl font-black text-[var(--accent)]">
              {initials}
            </span>
          )}
        </motion.div>
        <div className="mt-2 flex flex-col items-center">
          <span className="text-sm font-bold text-[var(--text-primary)]">@{identity.username}</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            one mesh.me account
          </span>
        </div>
      </motion.div>
    </div>
  );
}
