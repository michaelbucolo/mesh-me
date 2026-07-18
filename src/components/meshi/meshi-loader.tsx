"use client";

import type { CSSProperties } from "react";
import { useSyncExternalStore } from "react";
import {
  getMeshiPrefsStatic,
  MESHI_PREFERENCES_EVENT,
} from "@/hooks/use-meshi-preferences";

// ── The loader: a tiny moment of joy, painted instantly ─────────────────────
//
// Everything here is plain CSS animation — no framer-motion, no lazy chunks,
// no simulated progress. The moment a route starts loading you get a bouncing
// Meshi with real squash-and-stretch, and around it a MOTIF that mirrors what
// is actually loading: the mesh weaves a constellation, MeChat sorts letters,
// search sweeps a magnifying glass, and so on. Reduced-motion users get a calm,
// static Meshi (the global reduced-motion rules collapse the keyframes).

type MeshiLoaderMode =
  | "default"
  | "mesh-building"
  | "message-writing"
  | "secure"
  | "search"
  | "social"
  | "creator";

/** Colours the motif wears, so each context feels distinct. */
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

type MotifStyle = CSSProperties & Record<string, string | number>;

// ── Per-mode motifs — the animation relates to what's loading ───────────────

function OrbitMotif({ palette }: { palette: string[] }) {
  // Default: a little solar system — motes swinging around Meshi in orbit.
  return (
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
  );
}

function ConstellationMotif({ palette }: { palette: string[] }) {
  // Mesh: strands draw out from the centre to nodes that pop in — the web
  // weaving itself into being, the same idea as the real mesh forming.
  return (
    <div className="meshi-load-constellation">
      {palette.map((c, i) => (
        <span
          key={i}
          className="meshi-load-carm"
          style={{ transform: `rotate(${(360 / palette.length) * i}deg)` }}
        >
          <span
            className="meshi-load-strand"
            style={{ background: `linear-gradient(to top, transparent, ${c})`, animationDelay: `${i * 0.16}s` }}
          />
          <span
            className="meshi-load-cnode"
            style={{ background: c, boxShadow: `0 0 9px ${c}`, animationDelay: `${i * 0.16}s` }}
          />
        </span>
      ))}
    </div>
  );
}

function LettersMotif({ palette }: { palette: string[] }) {
  // MeChat: envelopes rise past Meshi and settle — Meshi sorting your letters.
  const letters = [
    { rot: "-9deg", dx: "-20px", delay: "0s" },
    { rot: "5deg", dx: "0px", delay: "0.6s" },
    { rot: "-3deg", dx: "20px", delay: "1.2s" },
  ];
  return (
    <div className="meshi-load-letters">
      {letters.map((l, i) => (
        <span
          key={i}
          className="meshi-load-letter"
          style={{ background: palette[i % palette.length], "--r": l.rot, "--dx": l.dx, animationDelay: l.delay } as MotifStyle}
        />
      ))}
    </div>
  );
}

function SearchMotif({ palette }: { palette: string[] }) {
  // Search: a magnifying glass sweeps around Meshi while a scan pulse expands.
  const c = palette[0];
  return (
    <div className="meshi-load-search">
      <span className="meshi-load-scan" style={{ borderColor: c }} />
      <span className="meshi-load-glass-arm">
        <span className="meshi-load-glass" style={{ borderColor: c, color: c }} />
      </span>
    </div>
  );
}

function SocialMotif({ palette }: { palette: string[] }) {
  // Social: little companions slide in from the edges and gather round Meshi.
  const buddies = [
    { fx: "-64px", fy: "-40px" },
    { fx: "64px", fy: "-34px" },
    { fx: "-58px", fy: "44px" },
    { fx: "60px", fy: "46px" },
  ];
  return (
    <div className="meshi-load-social">
      {buddies.map((b, i) => (
        <span
          key={i}
          className="meshi-load-buddy"
          style={{ background: palette[i % palette.length], "--fx": b.fx, "--fy": b.fy, animationDelay: `${i * 0.25}s` } as MotifStyle}
        />
      ))}
    </div>
  );
}

function ShieldMotif({ palette }: { palette: string[] }) {
  // Secure: a shield settles around Meshi with a shimmer sweep — safe & sound.
  const c = palette[0];
  return (
    <div className="meshi-load-secure">
      <span className="meshi-load-shield" style={{ borderColor: c, ["--shield" as string]: c } as MotifStyle} />
    </div>
  );
}

function SparklesMotif({ palette }: { palette: string[] }) {
  // Creator: sparkles twinkle around Meshi — a little polish and shine.
  const sparks = [
    { x: "20%", y: "24%", s: 1 },
    { x: "78%", y: "30%", s: 0.7 },
    { x: "30%", y: "74%", s: 0.85 },
    { x: "72%", y: "70%", s: 1.05 },
    { x: "50%", y: "16%", s: 0.6 },
  ];
  return (
    <div className="meshi-load-creator">
      {sparks.map((s, i) => (
        <span
          key={i}
          className="meshi-load-spark"
          style={{ left: s.x, top: s.y, background: palette[i % palette.length], "--s": s.s, animationDelay: `${i * 0.32}s` } as MotifStyle}
        />
      ))}
    </div>
  );
}

function Motif({ mode, palette }: { mode: MeshiLoaderMode; palette: string[] }) {
  switch (mode) {
    case "mesh-building":
      return <ConstellationMotif palette={palette} />;
    case "message-writing":
      return <LettersMotif palette={palette} />;
    case "search":
      return <SearchMotif palette={palette} />;
    case "social":
      return <SocialMotif palette={palette} />;
    case "secure":
      return <ShieldMotif palette={palette} />;
    case "creator":
      return <SparklesMotif palette={palette} />;
    default:
      return <OrbitMotif palette={palette} />;
  }
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

      <div className="meshi-load-stage" data-mode={mode} aria-hidden>
        {/* The motif — mirrors what's actually loading. */}
        <Motif mode={mode} palette={palette} />

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
