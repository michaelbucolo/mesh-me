"use client";

import type { CSSProperties } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";
import {
  getMeshiPrefsStatic,
  MESHI_PREFERENCE_DEFAULTS,
  MESHI_PREFERENCES_EVENT,
  type MeshiPreferences,
} from "@/hooks/use-meshi-preferences";
import { MeshiMascot, type MeshiMood, type MeshiProp } from "@/components/meshi/meshi-mascot";

// ── The loader: a tiny moment of joy, painted instantly ─────────────────────
//
// The moment a route starts loading you get YOUR Meshi — the real, canonical
// mascot in your own colour and cosmetics (hat, hair, accessory, …) — doing a
// CSS squash-and-stretch bounce, with a MOTIF around it that mirrors what is
// actually loading: the mesh weaves a constellation, MeChat sorts letters,
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

// ── What Meshi is DOING while each surface loads ────────────────────────────
//
// Not a bounce — a context-relevant ACTION: Meshi holds the prop that fits what
// is loading and moves with the matching calm motion (see the `.la-*` classes).
// Each surface has 8 distinct variants (a different held prop + expression), so
// the same "action" never looks identical twice; a fresh one is picked at mount
// (see the variant index below), so back-to-back loads feel alive, not canned.
type LoaderAction = { prop: MeshiProp; mood: MeshiMood; motion: string };

const LOADER_ACTIONS: Record<MeshiLoaderMode, ReadonlyArray<LoaderAction>> = {
  // Generic app load: a calm, present Meshi — sometimes empty-handed, sometimes
  // holding a small everyday thing.
  default: [
    { prop: "none", mood: "happy", motion: "la-idle" },
    { prop: "none", mood: "cool", motion: "la-idle" },
    { prop: "compass", mood: "happy", motion: "la-idle" },
    { prop: "heart", mood: "love", motion: "la-idle" },
    { prop: "bell", mood: "happy", motion: "la-idle" },
    { prop: "none", mood: "excited", motion: "la-idle" },
    { prop: "notebook", mood: "thinking", motion: "la-idle" },
    { prop: "none", mood: "thinking", motion: "la-idle" },
  ],
  // Mesh: weaving / exploring the constellation.
  "mesh-building": [
    { prop: "compass", mood: "thinking", motion: "la-navigate" },
    { prop: "notebook", mood: "thinking", motion: "la-navigate" },
    { prop: "paper", mood: "cool", motion: "la-navigate" },
    { prop: "compass", mood: "cool", motion: "la-navigate" },
    { prop: "wrench", mood: "thinking", motion: "la-navigate" },
    { prop: "grab", mood: "happy", motion: "la-navigate" },
    { prop: "compass", mood: "searching", motion: "la-navigate" },
    { prop: "notebook", mood: "cool", motion: "la-navigate" },
  ],
  // MeChat: writing your letters.
  "message-writing": [
    { prop: "paper", mood: "love", motion: "la-write" },
    { prop: "envelope", mood: "love", motion: "la-write" },
    { prop: "keyboard", mood: "happy", motion: "la-write" },
    { prop: "paper", mood: "thinking", motion: "la-write" },
    { prop: "envelope", mood: "happy", motion: "la-write" },
    { prop: "keyboard", mood: "love", motion: "la-write" },
    { prop: "notebook", mood: "thinking", motion: "la-write" },
    { prop: "heart", mood: "love", motion: "la-write" },
  ],
  // Secure surfaces: standing guard.
  secure: [
    { prop: "shield", mood: "cool", motion: "la-guard" },
    { prop: "shield", mood: "thinking", motion: "la-guard" },
    { prop: "shield", mood: "happy", motion: "la-guard" },
    { prop: "wrench", mood: "cool", motion: "la-guard" },
    { prop: "keyboard", mood: "cool", motion: "la-guard" },
    { prop: "wrench", mood: "thinking", motion: "la-guard" },
    { prop: "clipboard", mood: "cool", motion: "la-guard" },
    { prop: "shield", mood: "excited", motion: "la-guard" },
  ],
  // Search / explore: peering through the glass.
  search: [
    { prop: "magnifying-glass", mood: "searching", motion: "la-peer" },
    { prop: "magnifying-glass", mood: "thinking", motion: "la-peer" },
    { prop: "magnifying-glass", mood: "cool", motion: "la-peer" },
    { prop: "magnifying-glass", mood: "happy", motion: "la-peer" },
    { prop: "notebook", mood: "searching", motion: "la-peer" },
    { prop: "notebook", mood: "thinking", motion: "la-peer" },
    { prop: "compass", mood: "searching", motion: "la-peer" },
    { prop: "clipboard", mood: "searching", motion: "la-peer" },
  ],
  // Feed / flow: watching and reacting.
  social: [
    { prop: "heart", mood: "love", motion: "la-watch" },
    { prop: "heart", mood: "excited", motion: "la-watch" },
    { prop: "bell", mood: "happy", motion: "la-watch" },
    { prop: "heart", mood: "happy", motion: "la-watch" },
    { prop: "ball", mood: "excited", motion: "la-watch" },
    { prop: "megaphone", mood: "excited", motion: "la-watch" },
    { prop: "heart", mood: "celebrating", motion: "la-watch" },
    { prop: "bell", mood: "excited", motion: "la-watch" },
  ],
  // Creator / Mesh Pro: making something.
  creator: [
    { prop: "paintbrush", mood: "celebrating", motion: "la-craft" },
    { prop: "megaphone", mood: "excited", motion: "la-craft" },
    { prop: "paintbrush", mood: "happy", motion: "la-craft" },
    { prop: "megaphone", mood: "celebrating", motion: "la-craft" },
    { prop: "paintbrush", mood: "cool", motion: "la-craft" },
    { prop: "clipboard", mood: "thinking", motion: "la-craft" },
    { prop: "paintbrush", mood: "love", motion: "la-craft" },
    { prop: "megaphone", mood: "happy", motion: "la-craft" },
  ],
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

let cachedPrefs: MeshiPreferences | null = null;

function subscribeToPrefs(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    cachedPrefs = null;
    onChange();
  };
  window.addEventListener("storage", handler);
  window.addEventListener(MESHI_PREFERENCES_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(MESHI_PREFERENCES_EVENT, handler);
  };
}

// getSnapshot must return a STABLE reference or useSyncExternalStore loops
// ("The result of getSnapshot should be cached"). getMeshiPrefsStatic() builds a
// fresh object each call, so cache it and rebuild only when the prefs event fires.
function getPrefsSnapshot(): MeshiPreferences {
  if (!cachedPrefs) cachedPrefs = getMeshiPrefsStatic();
  return cachedPrefs;
}

// Server + first-hydration snapshot: a stable constant matching what the server
// renders (storage is unreadable there). useSyncExternalStore re-renders with the
// real prefs immediately after hydration, so there is no mismatch.
function getServerPrefsSnapshot(): MeshiPreferences {
  return MESHI_PREFERENCE_DEFAULTS;
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
  const prefs = useSyncExternalStore(subscribeToPrefs, getPrefsSnapshot, getServerPrefsSnapshot);
  const color = MESHI_COLOR[prefs.color] ?? MESHI_COLOR.blue;
  const palette = MODE_PALETTE[mode] ?? MODE_PALETTE.default;
  const actions = LOADER_ACTIONS[mode] ?? LOADER_ACTIONS.default;
  // Pick a fresh variant AFTER mount (never during SSR, so the server and client
  // markup match). Variant 0 — a sensible canonical action for the surface —
  // paints first, then a random sibling is chosen so back-to-back loads differ.
  const [variant, setVariant] = useState(0);
  useEffect(() => {
    setVariant(Math.floor(Math.random() * actions.length));
  }, [actions]);
  const action = actions[variant % actions.length];
  const reducedMotion = useReducedMotion();

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
        {/* Ambient depth: parallax stars + a soft aura in the mode's palette */}
        <div className="meshi-load-starfield">
          <span className="meshi-load-stars" />
          <span className="meshi-load-stars-near" />
        </div>
        <span
          className="meshi-load-aura"
          style={{ ["--aura-1" as string]: palette[0], ["--aura-2" as string]: palette[2] } as MotifStyle}
        />

        {/* The motif — mirrors what's actually loading. */}
        <Motif mode={mode} palette={palette} />

        {/* Soft ground shadow, breathing gently on its own. */}
        <span className="meshi-load-shadow" style={{ background: `${color}33` }} />

        {/* Meshi — the real high-fidelity mascot, in your colour + cosmetics,
            actually DOING the thing that's loading: it holds the surface's prop
            (with its grip hands) and moves with the matching calm `.la-*` motion
            instead of bouncing. The mascot supplies the canonical face + blink. */}
        <div
          className={`meshi-load-actor ${reducedMotion ? "" : action.motion}`}
          style={{ filter: `drop-shadow(0 6px 18px ${color}55)` }}
        >
          <MeshiMascot
            size={74}
            mood={action.mood}
            prop={action.prop}
            color={prefs.color}
            hat={prefs.hat}
            hair={prefs.hair}
            accessory={prefs.accessory}
            eyeStyle={prefs.eye}
            badge={prefs.badge}
            outfit={prefs.outfit}
            animate={!reducedMotion}
          />
        </div>
      </div>

      <h2 className="meshi-load-title mt-4 text-center text-base font-semibold text-[var(--text-primary)]">
        {title}
      </h2>

      <span
        className="meshi-load-progress"
        style={{ ["--pf" as string]: color } as MotifStyle}
        aria-hidden
      />
    </div>
  );
}
