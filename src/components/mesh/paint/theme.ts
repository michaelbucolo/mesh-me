// THE BRIDGE between the design tokens and the canvas.
//
// Every colour in paint/ used to be a hardcoded literal — `#0c1226` skies,
// `rgba(13,17,30,.94)` cards, `#eef2ff` labels, `#6e8bff` verification dots.
// That is why the mesh stayed outer space while the DOM around it became
// paper: the token file could not reach it. A person looking at /mesh saw a
// cold blue-black void framed by warm walnut chrome, which is most of why the
// product reads as lifeless — the main surface never got the redesign.
//
// This module reads the resolved custom properties off the document root once
// per theme change and hands the canvas the same values the DOM is using. One
// place to change a colour, and the mesh moves with everything else.
//
// It MUST work without a DOM: scripts/mesh-render-parity.ts renders both
// engines in Node against a recording context, so `read()` falls back to the
// Lamplight constants rather than throwing. Those fallbacks are the only
// colour literals left in paint/, and they exist so the contract tests have
// something deterministic to compare.

export interface PaintTheme {
  /** Page / card / sunken surfaces. */
  paper0: string;
  paper1: string;
  paper2: string;
  /** Primary / secondary / tertiary ink. */
  ink1: string;
  ink2: string;
  ink3: string;
  /** Non-text only: hairlines, dividers, disabled marks. */
  ink4: string;
  /** Text sitting ON an accent fill. */
  inkInverse: string;
  accent: string;
  accentLine: string;
  /** Affection: hearts, strum, the warm pigment. */
  warm: string;
  success: string;
  warning: string;
  danger: string;
  /** Contact shadow beneath a node. Warm-black, never neutral. */
  shadow: string;
  /** True when the lamplit (dark) theme is active. */
  dark: boolean;
}

/** Lamplight. The fallback, and the values the parity tests compare against. */
const LAMPLIGHT: PaintTheme = {
  paper0: "#1a1714",
  paper1: "#211d19",
  paper2: "#141210",
  ink1: "#f2ede4",
  ink2: "#c0b8ab",
  ink3: "#948c80",
  ink4: "#6e6559",
  inkInverse: "#141210",
  accent: "#8fb0e0",
  accentLine: "rgba(143,176,224,.26)",
  warm: "#e08a5f",
  success: "#8cbe97",
  warning: "#e0b252",
  danger: "#e0827a",
  shadow: "rgba(0,0,0,.55)",
  dark: true,
};

/** Daylight. */
const DAYLIGHT: PaintTheme = {
  paper0: "#fbf8f2",
  paper1: "#fffdf8",
  paper2: "#f4efe6",
  ink1: "#1b1a17",
  ink2: "#4a463f",
  ink3: "#6b655b",
  ink4: "#948c7f",
  inkInverse: "#fffdf8",
  accent: "#2f4b7c",
  accentLine: "rgba(47,75,124,.22)",
  warm: "#b05939",
  success: "#4a7c59",
  warning: "#976925",
  danger: "#a8443a",
  shadow: "rgba(38,32,24,.22)",
  dark: false,
};

const TOKEN_OF: Record<Exclude<keyof PaintTheme, "dark">, string> = {
  paper0: "--paper-0",
  paper1: "--paper-1",
  paper2: "--paper-2",
  ink1: "--ink-1",
  ink2: "--ink-2",
  ink3: "--ink-3",
  ink4: "--ink-4",
  inkInverse: "--ink-inverse",
  accent: "--accent",
  accentLine: "--accent-line",
  warm: "--warm",
  success: "--success",
  warning: "--warning",
  danger: "--danger",
  shadow: "--canvas-shadow",
};

let cached: PaintTheme = LAMPLIGHT;
let cachedKey = "";

/**
 * The theme the canvas should paint with. Cheap to call every frame: the
 * expensive `getComputedStyle` read happens only when the theme class on the
 * root element actually changed.
 */
export function paintTheme(): PaintTheme {
  if (typeof document === "undefined") return cached;
  const root = document.documentElement;
  const key = root.className + "|" + (root.dataset.meshMode ?? "");
  if (key === cachedKey) return cached;

  const isDark = !root.classList.contains("light");
  const base = isDark ? LAMPLIGHT : DAYLIGHT;
  const cs = getComputedStyle(root);
  const next: PaintTheme = { ...base, dark: isDark };
  for (const [field, token] of Object.entries(TOKEN_OF) as [Exclude<keyof PaintTheme, "dark">, string][]) {
    const value = cs.getPropertyValue(token).trim();
    if (value) next[field] = value;
  }
  cached = next;
  cachedKey = key;
  return cached;
}
