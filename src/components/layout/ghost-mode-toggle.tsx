"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EyeOff } from "lucide-react";
import { setGhostMode } from "@/lib/actions";
import { broadcastGhostMode, GHOST_EVENT, GHOST_STORAGE_KEY, readGhostMode } from "@/lib/ghost-mode";
import { playSound } from "@/lib/sound";

// Hydration-safe "have we mounted on the client yet?" — false during SSR and
// the first client paint, true thereafter. Avoids setState-in-effect.
const emptySubscribe = () => () => {};

/**
 * One-tap Ghost Mode. While active, presence heartbeats carry ghostMode:true —
 * which every consumer (mesh cursors, "Active now", profile live badge, contact
 * presence) already filters out — and the account setting is the authoritative
 * signal server-side. Ghost Mode is persisted per-account (`initialGhost`), so it
 * follows the user across devices; the control itself stays visibly lit while on.
 */
export function GhostModeToggle({ compact = false, initialGhost = false }: { compact?: boolean; initialGhost?: boolean }) {
  const prefersReducedMotion = useReducedMotion();
  const [ghost, setGhost] = useState(initialGhost);

  // The account value is the source of truth. Sync the per-device localStorage
  // (which the mesh scene and heartbeats read) to it on mount, so Ghost Mode
  // reflects the account state on every device — not just the one you toggled on.
  useEffect(() => {
    try {
      if ((localStorage.getItem(GHOST_STORAGE_KEY) === "true") !== initialGhost) {
        localStorage.setItem(GHOST_STORAGE_KEY, String(initialGhost));
        window.dispatchEvent(new Event(GHOST_EVENT));
      }
    } catch {
      // best-effort sync
    }
  }, [initialGhost]);

  // Stay in lockstep with the other Ghost control (the Settings toggle): when
  // either flips, both reflect it live without a reload.
  useEffect(() => {
    const sync = () => setGhost(readGhostMode());
    window.addEventListener(GHOST_EVENT, sync);
    return () => window.removeEventListener(GHOST_EVENT, sync);
  }, []);

  // Motion is only enabled after mount so SSR output (static icon) matches the
  // first client paint — avoids a hydration mismatch on the icon subtree.
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  // Bumped every time we dematerialize (toggle ON) so the after-images re-key.
  const [burst, setBurst] = useState(0);
  const [dematerializing, setDematerializing] = useState(false);
  const burstTimer = useRef<number | null>(null);

  // Clear the pending dematerialize timer on unmount.
  useEffect(() => () => {
    if (burstTimer.current !== null) window.clearTimeout(burstTimer.current);
  }, []);

  const toggle = () => {
    const next = !ghost;
    setGhost(next);
    if (next && !prefersReducedMotion) {
      setBurst((value) => value + 1);
      setDematerializing(true);
      if (burstTimer.current !== null) window.clearTimeout(burstTimer.current);
      burstTimer.current = window.setTimeout(() => setDematerializing(false), 760);
    }
    playSound(next ? "ghost" : "pop");
    // localStorage + same-tab event + an immediate presence heartbeat.
    broadcastGhostMode(next);
    // Persist to the account so Ghost Mode follows the user to other devices.
    void setGhostMode(next).catch(() => {});
  };

  const motionEnabled = mounted && !prefersReducedMotion;

  return (
    <button
      type="button"
      onClick={toggle}
      suppressHydrationWarning
      aria-pressed={ghost}
      aria-label={ghost ? "Ghost Mode is on — tap to become visible" : "Turn on Ghost Mode"}
      title={ghost ? "Ghost Mode on: others can't see you live" : "Ghost Mode: hide your live presence"}
      /* ON is state, not a call to action (tone reset R4): the neutral
         selected key. The grape plastic this once wore was the only purple
         fill in the chrome — a per-feature hue, which the color budget
         forbids. The eye-off glyph replaces the cartoon ghost so the control
         reads stroke-matched next to the bell (#26). */
      className={`key inline-flex items-center gap-1.5 ${
        compact ? "h-11 w-11 justify-center px-0" : "h-11 px-3"
      } ${
        ghost
          ? "key-selected"
          : "text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text)]"
      }`}
    >
      <span className="relative inline-flex h-[15px] w-[15px] items-center justify-center" aria-hidden="true">
        {/* Dematerialize burst: a soft ripple + drifting violet after-images */}
        {motionEnabled && dematerializing && (
          <>
            {/* The burst plays on the way ON, by which point the face is already
                grape — so the ripple and the after-images are drawn in the
                plastic's own PINNED ink (tokens.css:92), not in a violet from
                Tailwind's palette that would have vanished into the fill. */}
            <motion.span
              key={`ripple-${burst}`}
              className="pointer-events-none absolute inset-0 rounded-full border border-[var(--text-secondary)] opacity-60"
              initial={{ opacity: 0.5, scale: 0.5 }}
              animate={{ opacity: 0, scale: 2.6 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            />
            {[0, 1, 2].map((i) => (
              <motion.span
                key={`afterimage-${burst}-${i}`}
                className="pointer-events-none absolute inset-0 flex items-center justify-center text-[var(--text-secondary)]"
                initial={{ opacity: 0.55, y: 0, scale: 1 }}
                animate={{ opacity: 0, y: -10 - i * 4, scale: 1.15 + i * 0.08 }}
                transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.06 }}
              >
                <EyeOff size={15} />
              </motion.span>
            ))}
          </>
        )}

        {/* Resting icon */}
        {motionEnabled ? (
          ghost ? (
            // Lands lit. The `y: [0, -1.6, 0]` float on `repeat: Infinity` is
            // deleted: it moved forever with nothing happening, which is the
            // definition of ambient motion. The material says "on" now.
            <motion.span
              key="ghost-lit"
              className="inline-flex"
              initial={{ scale: 0.7, opacity: 0.3 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                scale: { type: "spring", stiffness: 360, damping: 20 },
                opacity: { duration: 0.25 },
              }}
            >
              <EyeOff size={15} />
            </motion.span>
          ) : (
            // Quick re-materialize when becoming visible again
            <motion.span
              key="ghost-plain"
              className="inline-flex"
              initial={{ scale: 0.7, opacity: 0.4 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 440, damping: 24 }}
            >
              <EyeOff size={15} />
            </motion.span>
          )
        ) : (
          <EyeOff size={15} />
        )}
      </span>
      {!compact && <span className="text-xs font-semibold">{ghost ? "Ghosting" : "Ghost"}</span>}
    </button>
  );
}
