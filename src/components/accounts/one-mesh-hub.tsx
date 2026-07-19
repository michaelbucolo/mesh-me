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
      {/* The whole satellite ring — strings, pulses and nodes — breathes gently
          once it has assembled, so the mesh reads as alive rather than static. */}
      <motion.div
        className="absolute inset-0"
        style={{ transformOrigin: "50% 50%" }}
        initial={false}
        animate={reduce ? undefined : { scale: [1, 1.035, 1] }}
        transition={reduce ? undefined : { duration: 7.5, delay: 1.1, repeat: Infinity, ease: "easeInOut" }}
      >
      {/* Strings + energy live behind the nodes. */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="one-mesh-core" cx="50%" cy="50%" r="50%">
            {/* Periwinkle core bleeding out into brand cyan. */}
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
            <stop offset="55%" stopColor="var(--mesh-cyan)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--mesh-cyan)" stopOpacity="0" />
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
        {/* Light pulses flowing along every string toward the one account. */}
        {!reduce &&
          positions.map((pos, i) => {
            const acct = accounts[i];
            return (
              <motion.line
                key={`pulse-${acct.id}`}
                x1={pos.x}
                y1={pos.y}
                x2="50"
                y2="50"
                stroke={acct.synced ? "var(--mesh-cyan)" : "var(--accent)"}
                strokeWidth={acct.synced ? 1 : 0.7}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="0.14 1"
                style={{ filter: "drop-shadow(0 0 1.4px currentColor)" }}
                initial={{ strokeDashoffset: 1.14, opacity: acct.synced ? 0.95 : 0.45 }}
                animate={{ strokeDashoffset: 0 }}
                transition={{
                  duration: acct.synced ? 1.9 : 2.8,
                  delay: 0.9 + i * 0.26,
                  repeat: Infinity,
                  repeatDelay: acct.synced ? 0.4 : 1.1,
                  ease: "linear",
                }}
              />
            );
          })}
      </svg>

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
      </motion.div>

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
            "0 0 0 0 rgba(110,139,255,0.0)",
            "0 0 22px 4px rgba(110,139,255,0.32)",
            "0 0 30px 7px rgba(52,228,234,0.26)",
            "0 0 0 0 rgba(52,228,234,0.0)",
          ] }}
          transition={reduce ? undefined : { duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
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
