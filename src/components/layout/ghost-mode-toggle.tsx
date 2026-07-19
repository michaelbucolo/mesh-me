"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Hydration-safe "have we mounted on the client yet?" — false during SSR and
// the first client paint, true thereafter. Avoids setState-in-effect.
const emptySubscribe = () => () => {};
import { motion, useReducedMotion } from "framer-motion";
import { Ghost } from "lucide-react";
import { playSound } from "@/lib/sound";

const STORAGE_KEY = "meshGhostMode";

/**
 * One-tap Ghost Mode. While active, both presence heartbeats carry
 * ghostMode:true, which every consumer (mesh cursors, "Active now",
 * profile live badge, contact presence) already filters out. The control
 * itself is the persistent indicator: it stays visibly lit while ghosting.
 */
export function GhostModeToggle({ compact = false }: { compact?: boolean }) {
  const prefersReducedMotion = useReducedMotion();
  const [ghost, setGhost] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  // Motion is only enabled after mount so SSR output (static icon) matches the
  // first client paint — avoids a hydration mismatch on the icon subtree.
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  // Bumped every time we dematerialize (toggle ON) so the after-images re-key.
  const [burst, setBurst] = useState(0);
  const [dematerializing, setDematerializing] = useState(false);
  const burstTimer = useRef<number | null>(null);

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
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // best-effort persistence
    }
    // Same-tab listeners (the mesh turns your Meshi into a ghost) react now.
    try {
      window.dispatchEvent(new Event("meshGhostModeChanged"));
    } catch {
      // best-effort broadcast
    }
    // Take effect immediately instead of waiting for the next heartbeat.
    void fetch("/api/mesh/presence", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ surface: "feed", ghostMode: next }),
    }).catch(() => {});
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 transition ${
        compact ? "h-9 justify-center" : "h-9"
      } ${
        ghost
          ? "border-violet-400/50 bg-violet-500/20 text-violet-300"
          : "border-[var(--mesh-border)] bg-[var(--mesh-panel)] text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text)]"
      }`}
    >
      <span className="relative inline-flex h-[15px] w-[15px] items-center justify-center" aria-hidden="true">
        {/* Dematerialize burst: a soft ripple + drifting violet after-images */}
        {motionEnabled && dematerializing && (
          <>
            <motion.span
              key={`ripple-${burst}`}
              className="pointer-events-none absolute inset-0 rounded-full border border-violet-400/60"
              initial={{ opacity: 0.5, scale: 0.5 }}
              animate={{ opacity: 0, scale: 2.6 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            />
            {[0, 1, 2].map((i) => (
              <motion.span
                key={`afterimage-${burst}-${i}`}
                className="pointer-events-none absolute inset-0 flex items-center justify-center text-violet-300"
                initial={{ opacity: 0.55, y: 0, scale: 1 }}
                animate={{ opacity: 0, y: -10 - i * 4, scale: 1.15 + i * 0.08 }}
                transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.06 }}
              >
                <Ghost size={15} />
              </motion.span>
            ))}
          </>
        )}

        {/* Resting icon */}
        {motionEnabled ? (
          ghost ? (
            // Lit + spectral breathing float
            <motion.span
              key="ghost-lit"
              className="inline-flex"
              initial={{ scale: 0.7, opacity: 0.3 }}
              animate={{ scale: 1, opacity: 1, y: [0, -1.6, 0] }}
              transition={{
                scale: { type: "spring", stiffness: 360, damping: 20 },
                opacity: { duration: 0.25 },
                y: { duration: 2.8, repeat: Infinity, ease: "easeInOut" },
              }}
            >
              <Ghost size={15} />
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
              <Ghost size={15} />
            </motion.span>
          )
        ) : (
          <Ghost size={15} />
        )}
      </span>
      {!compact && <span className="text-xs font-semibold">{ghost ? "Ghosting" : "Ghost"}</span>}
    </button>
  );
}
