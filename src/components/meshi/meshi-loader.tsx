"use client";

import { useSyncExternalStore } from "react";
import {
  getMeshiPrefsStatic,
  MESHI_PREFERENCES_EVENT,
} from "@/hooks/use-meshi-preferences";

// ── The loader: a tiny moment of joy, painted instantly ─────────────────────
//
// Everything here is plain CSS animation — no framer-motion, no lazy chunks,
// no simulated progress. The moment a route starts loading you get a bouncing
// Meshi with real squash-and-stretch, motes swinging around it in orbit, and
// one short playful line. Reduced-motion users get a calm, static Meshi (the
// global reduced-motion rules collapse the keyframes).

type MeshiLoaderMode =
  | "default"
  | "mesh-building"
  | "message-writing"
  | "secure"
  | "search"
  | "social"
  | "creator";

/** Colours the orbiting motes wear, so each context feels distinct. */
const MODE_PALETTE: Record<MeshiLoaderMode, string[]> = {
  default: ["#6366f1", "#22d3ee", "#a855f7", "#ec4899", "#4ade80"],
  "mesh-building": ["#6366f1", "#22d3ee", "#38bdf8", "#a855f7", "#818cf8"],
  "message-writing": ["#f472b6", "#fb7185", "#c084fc", "#f9a8d4", "#e879f9"],
  secure: ["#34d399", "#22d3ee", "#60a5fa", "#4ade80", "#2dd4bf"],
  search: ["#fbbf24", "#f59e0b", "#22d3ee", "#a855f7", "#fb923c"],
  social: ["#f472b6", "#22d3ee", "#818cf8", "#4ade80", "#fbbf24"],
  creator: ["#a855f7", "#ec4899", "#22d3ee", "#fbbf24", "#f472b6"],
};

// Matches the mascot's COLOR_THEMES primaries so the loading Meshi is *your*
// Meshi, in your colour, without importing the full mascot.
const MESHI_COLOR: Record<string, string> = {
  blue: "#3b82f6",
  purple: "#8b5cf6",
  pink: "#ec4899",
  green: "#22c55e",
  orange: "#f97316",
  cyan: "#06b6d4",
  gold: "#eab308",
  rainbow: "#ec4899",
  crimson: "#dc2626",
  midnight: "#6366f1",
  rose: "#f43f5e",
  emerald: "#059669",
  arctic: "#7dd3fc",
  obsidian: "#94a3b8",
};

let cachedColor: string | null = null;

function subscribeToPrefs(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    cachedColor = null;
    onChange();
  };
  window.addEventListener("storage", handler);
  window.addEventListener(MESHI_PREFERENCES_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(MESHI_PREFERENCES_EVENT, handler);
  };
}

function getMeshiColor(): string {
  if (!cachedColor) {
    cachedColor = MESHI_COLOR[getMeshiPrefsStatic().color] ?? MESHI_COLOR.blue;
  }
  return cachedColor;
}

function getServerMeshiColor(): string {
  return MESHI_COLOR.blue;
}

interface MeshiLoaderProps {
  title: string;
  mode?: MeshiLoaderMode;
  className?: string;
  /** Fill the viewport height (public/entry surfaces). */
  fullHeight?: boolean;
  /** Drop the opaque background so the loader can layer over a custom backdrop. */
  transparent?: boolean;
}

export function MeshiLoader({
  title,
  mode = "default",
  className = "",
  fullHeight = false,
  transparent = false,
}: MeshiLoaderProps) {
  const color = useSyncExternalStore(subscribeToPrefs, getMeshiColor, getServerMeshiColor);
  const palette = MODE_PALETTE[mode] ?? MODE_PALETTE.default;

  return (
    <div
      className={`relative flex min-h-full min-w-0 flex-1 flex-col items-center justify-center overflow-hidden px-6 ${
        transparent ? "" : "bg-[var(--bg-primary)]"
      } ${fullHeight ? "h-dvh" : ""} ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{title}</span>

      <div className="meshi-load-stage" aria-hidden>
        {/* Orbiting motes — a little solar system around Meshi. The whole ring
            spins; each mote counter-scales in with a staggered pop. */}
        <div className="meshi-load-orbit">
          {palette.map((c, i) => (
            <span
              key={i}
              className="meshi-load-mote-arm"
              style={{ transform: `rotate(${(360 / palette.length) * i}deg)` }}
            >
              <span
                className="meshi-load-mote"
                style={{ background: c, boxShadow: `0 0 12px ${c}88`, animationDelay: `${i * 0.12}s` }}
              />
            </span>
          ))}
        </div>

        {/* Soft ground shadow that breathes with the bounce */}
        <span className="meshi-load-shadow" style={{ background: `${color}33` }} />

        {/* Meshi — squash-and-stretch bounce, blinking, in your colour */}
        <div className="meshi-load-bounce">
          <svg viewBox="-24 -24 48 48" className="meshi-load-body" style={{ filter: `drop-shadow(0 6px 18px ${color}55)` }}>
            <rect x="-19" y="-19" width="38" height="38" rx="15" fill={color} />
            <rect x="-19" y="-19" width="38" height="19" rx="15" fill="#ffffff" opacity="0.12" />
            <g className="meshi-load-eyes">
              <ellipse cx="-6.5" cy="-1" rx="3" ry="4.6" fill="#0b0d1a" />
              <ellipse cx="6.5" cy="-1" rx="3" ry="4.6" fill="#0b0d1a" />
              <circle cx="-5.6" cy="-2.6" r="1.1" fill="#ffffff" />
              <circle cx="7.4" cy="-2.6" r="1.1" fill="#ffffff" />
            </g>
            <path d="M -4.6 7 Q 0 11 4.6 7" fill="none" stroke="#0b0d1a" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <h2 className="meshi-load-title mt-4 text-center text-base font-semibold text-[var(--text-primary)]">
        {title}
      </h2>
    </div>
  );
}
