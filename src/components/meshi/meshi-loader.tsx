"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { MeshiMascot, type MeshiMood, type MeshiProp } from "./meshi-mascot";
import {
  getMeshiPrefsStatic,
  MESHI_PREFERENCES_EVENT,
  type MeshiPreferences,
} from "@/hooks/use-meshi-preferences";

// ── Shared: read the user's own Meshi appearance without side effects ──

const DEFAULT_PREFS: MeshiPreferences = {
  color: "blue",
  hat: "none",
  face: "happy",
  hair: "none",
  accessory: "none",
  eye: "regular",
  badge: "none",
  outfit: "none",
  enabled: true,
  appLogo: "default",
  appLogoColor: "blue",
  title: "",
};

let cachedClientPrefs: MeshiPreferences | null = null;

function subscribeToPrefs(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    cachedClientPrefs = null;
    onChange();
  };
  window.addEventListener("storage", handler);
  window.addEventListener(MESHI_PREFERENCES_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(MESHI_PREFERENCES_EVENT, handler);
  };
}

function getClientPrefs(): MeshiPreferences {
  if (!cachedClientPrefs) cachedClientPrefs = getMeshiPrefsStatic();
  return cachedClientPrefs;
}

// ── Contextual flavour per loading mode ───────────────────────

export type MeshiLoaderMode =
  | "default"
  | "mesh-building"
  | "message-writing"
  | "secure"
  | "search"
  | "social"
  | "creator";

interface ModeCfg {
  mood: MeshiMood;
  prop: MeshiProp;
  /** Colours the motes weave in, so each context feels distinct. */
  palette: string[];
}

const MODE: Record<MeshiLoaderMode, ModeCfg> = {
  default: { mood: "happy", prop: "none", palette: ["#6366f1", "#22d3ee", "#a855f7", "#ec4899"] },
  "mesh-building": { mood: "excited", prop: "compass", palette: ["#6366f1", "#22d3ee", "#38bdf8", "#a855f7", "#818cf8"] },
  "message-writing": { mood: "love", prop: "envelope", palette: ["#f472b6", "#fb7185", "#c084fc", "#f9a8d4"] },
  secure: { mood: "cool", prop: "shield", palette: ["#34d399", "#22d3ee", "#60a5fa", "#4ade80"] },
  search: { mood: "searching", prop: "magnifying-glass", palette: ["#fbbf24", "#f59e0b", "#22d3ee", "#a855f7"] },
  social: { mood: "excited", prop: "megaphone", palette: ["#f472b6", "#22d3ee", "#818cf8", "#4ade80", "#fbbf24"] },
  creator: { mood: "happy", prop: "paintbrush", palette: ["#a855f7", "#ec4899", "#22d3ee", "#fbbf24"] },
};

// ── The loader: Meshi weaving a live constellation ────────────
//
// Progress is legible through the *animation itself* — motes fly in from the
// dark and lock into a web around Meshi one by one, strands drawing out to
// connect each as it settles. When the web is whole, the page is ready. No
// bars, no percentages, no checklists — you read "how far" from how much of
// the constellation has formed.

interface MeshiLoaderProps {
  title: string;
  subtitle?: string;
  mode?: MeshiLoaderMode;
  className?: string;
  /** Fill the viewport height (public/entry surfaces). */
  fullHeight?: boolean;
}

// Fixed mote layout — deterministic so SSR and client agree.
const MOTES = [
  { a: -90, d: 0.06 },
  { a: -25, d: 0.20 },
  { a: 38, d: 0.34 },
  { a: 96, d: 0.48 },
  { a: 156, d: 0.62 },
  { a: 214, d: 0.78 },
];

export function MeshiLoader({
  title,
  subtitle,
  mode = "default",
  className = "",
  fullHeight = false,
}: MeshiLoaderProps) {
  const prefs = useSyncExternalStore(subscribeToPrefs, getClientPrefs, () => DEFAULT_PREFS);
  const cfg = MODE[mode] ?? MODE.default;

  // Simulated weave progress (0→~1). Eases toward completion and slows as it
  // approaches, the way indeterminate work feels — always advancing, never a
  // hard bar. Real completion just unmounts us mid-weave.
  const [p, setP] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef<number>(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setP(0.7);
      return;
    }
    start.current = performance.now();
    const tick = (now: number) => {
      const t = (now - start.current) / 1000;
      // Asymptotic ease: ~0.63 at 1s, ~0.86 at 2s, ~0.95 at 3s, never quite 1.
      setP(1 - Math.exp(-t / 1.05));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  const motes = useMemo(
    () =>
      MOTES.map((m, i) => {
        const rad = (m.a * Math.PI) / 180;
        return {
          key: i,
          threshold: m.d,
          color: cfg.palette[i % cfg.palette.length],
          // Locked resting position on the web.
          lx: 50 + Math.cos(rad) * 33,
          ly: 50 + Math.sin(rad) * 33,
          // Where it drifts in from (further out along the same ray).
          fx: 50 + Math.cos(rad) * 62,
          fy: 50 + Math.sin(rad) * 62,
        };
      }),
    [cfg.palette],
  );

  return (
    <div
      className={`relative flex min-h-full min-w-0 flex-1 flex-col items-center justify-center overflow-hidden bg-[var(--bg-primary)] px-6 ${
        fullHeight ? "h-dvh" : ""
      } ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{title}</span>

      {/* The weaving web */}
      <div className="relative h-[280px] w-[280px] max-w-full">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          aria-hidden
        >
          <defs>
            <radialGradient id="meshi-loader-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Ambient core glow behind Meshi */}
          <circle cx="50" cy="50" r="30" fill="url(#meshi-loader-core)" />

          {motes.map((m) => {
            // How settled this mote is (0 = still incoming, 1 = fully woven in).
            const local = Math.max(0, Math.min(1, (p - m.threshold) / 0.16));
            const x = m.fx + (m.lx - m.fx) * local;
            const y = m.fy + (m.ly - m.fy) * local;
            const connected = local > 0.02;
            // Strand travels out from the core as the mote settles.
            const sx = 50 + (x - 50) * local;
            const sy = 50 + (y - 50) * local;
            return (
              <g key={m.key}>
                {connected && (
                  <line
                    x1="50"
                    y1="50"
                    x2={sx}
                    y2={sy}
                    stroke={m.color}
                    strokeWidth={0.5}
                    strokeLinecap="round"
                    opacity={0.15 + local * 0.4}
                  />
                )}
                {/* Bright leading tip while the strand is still drawing out */}
                {connected && local < 1 && (
                  <circle cx={sx} cy={sy} r={0.9} fill="#ffffff" opacity={0.8 * (1 - local)} />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={connected ? 1.8 + local * 0.9 : 1.4}
                  fill={m.color}
                  opacity={0.35 + local * 0.6}
                />
                {local > 0.98 && (
                  <circle cx={x} cy={y} r={2.7} fill="none" stroke={m.color} strokeWidth={0.35} opacity={0.4} />
                )}
              </g>
            );
          })}
        </svg>

        {/* Hero Meshi at the heart of the web */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <MeshiMascot
                size={92}
                mood={cfg.mood}
                prop={cfg.prop}
                color={prefs.color}
                hat={prefs.hat}
                hair={prefs.hair}
                accessory={prefs.accessory}
                eyeStyle={prefs.eye}
                badge={prefs.badge}
                outfit={prefs.outfit}
                animate
                bouncy
              />
            </motion.div>
          </motion.div>
        </div>
      </div>

      <motion.h2
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="mt-2 text-center text-lg font-semibold text-[var(--text-primary)]"
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-1 max-w-sm text-center text-sm text-[var(--text-muted)]"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}
