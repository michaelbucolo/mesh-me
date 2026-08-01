"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";
import { PlatformLogo } from "@/components/platform/platform-logo";

/** One connected account orbiting the identity at the centre. */
export type HubAccount = {
  id: string;
  platform: string;
  name: string;
  /** Brand fill — the thread and ring tint. Never a ground under text. */
  tint: string;
  /** Live + syncing — draws the energy stream flowing into your one account. */
  synced: boolean;
};

type HubIdentity = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

// Ring radius as a share of the (square) hub box. A FULL ring needs a wider
// one: at twelve accounts on a 240px box, 37% put adjacent nodes 40px apart
// for 32px marks, and they touched — measured, four overlapping pairs. The
// circumference grows with the radius, so the crowded case gets the room and
// the common case (two or three accounts) keeps the tighter, calmer circle.
function ringRadius(count: number): number {
  return count > 8 ? 41 : 37;
}

function ringPositions(count: number): { x: number; y: number; angle: number }[] {
  if (count === 0) return [];
  const r = ringRadius(count);
  return Array.from({ length: count }, (_, i) => {
    // Start at the top and go clockwise; a lone account sits neatly up top.
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    return { x: 50 + r * Math.cos(angle), y: 50 + r * Math.sin(angle), angle };
  });
}

/**
 * The "One Mesh" — your mesh.me identity as a glowing central node with every
 * connected account orbiting it, each tied back by a living string. Synced
 * accounts stream little sparks of energy inward, so the whole picture reads as
 * "all of these are one account." Falls back to a calm static layout under
 * reduced-motion.
 *
 * The satellites were brand MONOGRAMS — "IG", "YT", "TT" on a coloured disc —
 * which is a picture of a spreadsheet, not of your accounts. They are the real
 * marks now, the same ones the grid and the mesh canvas draw, so the ring is
 * legible at a glance and matches what you tapped to get here.
 */
export function OneMeshHub({
  identity,
  accounts,
  justConnectedPlatform = null,
}: {
  identity: HubIdentity;
  accounts: HubAccount[];
  /** Platform id just connected this visit — its node threads in with a flourish. */
  justConnectedPlatform?: string | null;
}) {
  const reduce = useReducedMotion();
  const positions = ringPositions(accounts.length);
  const justIndex = justConnectedPlatform
    ? accounts.findIndex((a) => a.platform.toLowerCase() === justConnectedPlatform.toLowerCase())
    : -1;
  const initials =
    (identity.displayName
      .split(/\s+/)
      .map((p) => p.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join("") || identity.username.charAt(0) || "M").toUpperCase();

  // SIZED FOR WHAT IT SHOWS, NOT FOR HOW IMPORTANT IT FEELS.
  //
  // This was a 26rem square. With two accounts on it that is most of a phone
  // screen spent on a diagram with two dots in it, and the logo grid — the part
  // of the page you came to use — started below the fold. The ring is a crown
  // on the grid, not a stage; it gets the space a crown needs.
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[15rem] sm:max-w-[18rem]">
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
          const isNew = i === justIndex;
          return (
            <line
              key={`string-${acct.id}`}
              x1={pos.x}
              y1={pos.y}
              x2="50"
              y2="50"
              /* Each thread carries its platform's own colour, so the ring
                 reads as several distinct services arriving at one identity
                 rather than one service drawn several times. */
              stroke={acct.tint}
              strokeOpacity={isNew ? 0.9 : acct.synced ? 0.55 : 0.28}
              strokeWidth={isNew ? 1 : acct.synced ? 0.7 : 0.5}
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
                stroke={acct.synced ? acct.tint : "var(--accent)"}
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

      {/* A just-connected account threads in with a one-shot pulse ring so the
          new platform is unmistakable the moment you land back from OAuth. */}
      {justIndex >= 0 && positions[justIndex] && (
        reduce ? (
          <span
            className="pointer-events-none absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--accent)]"
            style={{ left: `${positions[justIndex].x}%`, top: `${positions[justIndex].y}%` }}
            aria-hidden="true"
          />
        ) : (
          <motion.span
            key={`arrival-${justConnectedPlatform}`}
            className="pointer-events-none absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${positions[justIndex].x}%`,
              top: `${positions[justIndex].y}%`,
              border: "2px solid var(--accent)",
            }}
            initial={{ scale: 0.5, opacity: 0.7 }}
            animate={{ scale: [0.5, 2.1], opacity: [0.7, 0] }}
            transition={{ duration: 1.2, ease: "easeOut", repeat: 2, repeatDelay: 0.15 }}
            aria-hidden="true"
          />
        )
      )}

      {/* Satellite account nodes. */}
      {positions.map((pos, i) => {
        const acct = accounts[i];
        const isNew = i === justIndex;
        return (
          <motion.div
            key={`node-${acct.id}`}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, zIndex: isNew ? 2 : 1 }}
            initial={reduce ? false : { opacity: 0, left: "50%", top: "50%", scale: isNew ? 0.2 : 0.4 }}
            animate={{ opacity: 1, left: `${pos.x}%`, top: `${pos.y}%`, scale: 1 }}
            transition={
              isNew
                ? { duration: 0.7, delay: reduce ? 0 : 0.1, ease: [0.34, 1.56, 0.64, 1] }
                : { duration: 0.6, delay: reduce ? 0 : 0.15 + i * 0.07, ease: [0.16, 1, 0.3, 1] }
            }
          >
            {/* No name under the node any more. The mark IS the name, and at
                twelve accounts the labels overlapped each other into an
                unreadable band around the ring. The accessible name rides on
                the mark, and the grid below spells every platform out. */}
            <span
              className={`flex size-8 items-center justify-center rounded-full bg-[var(--ds-surface)] sm:size-10 ${
                isNew ? "ring-2 ring-[var(--accent)]" : ""
              }`}
              style={{ boxShadow: `0 0 0 1px ${acct.tint}66, 0 1px 4px rgb(0 0 0 / 0.22)` }}
              title={acct.name}
            >
              <PlatformLogo platform={acct.platform} size={28} className="h-auto w-[72%]" />
            </span>
          </motion.div>
        );
      })}
      </motion.div>

      {/* The mesh.me identity at the core — the AVATAR ONLY.
          The username and "one mesh.me account" used to sit right under it,
          inside the ring. That reads fine with two accounts and is a collision
          with a full one: measured at twelve, the eyebrow ran straight through
          the LinkedIn, Twitch and Instagram nodes. Text stacked below a centre
          point grows downward into the exact band the lower arc occupies, so
          there is no size that fixes it — the caption belongs outside the
          circle, and the line under the hub carries the handle now. */}
      <motion.div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
        initial={reduce ? false : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          className="relative flex size-16 items-center justify-center rounded-full border-2 border-[var(--accent)] bg-[var(--ds-surface)] shadow-[0_0_22px_2px_color-mix(in_srgb,var(--accent)_24%,transparent)] sm:size-20"
        >
          {identity.avatarUrl ? (
            <Avatar src={identity.avatarUrl} alt={identity.username} size="md" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-full bg-[var(--accent)]/15 text-lg font-semibold text-[var(--accent-text)] sm:size-16 sm:text-xl">
              {initials}
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
