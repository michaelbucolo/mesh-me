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
// Worklight constants rather than throwing. Those fallbacks are the only
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
  /**
   * THE EDGE. The 1px boundary every pressable object in the DOM carries, and
   * the reason a theme-invariant plastic is legal on either mat. The canvas
   * never had it: a node's rim was `tint(node.color, 0.72)`, a LIGHTER version
   * of its own fill, so on the cream mat a pale orb was outlined in something
   * paler still. Measured, all eight node colours sat between 1.60 and 2.94
   * against --paper-0 in Daylight — every one of them under the 3:1 floor WCAG
   * 1.4.11 sets for a non-text object. tokens.css states the rule outright:
   * "an object without --edge is a WCAG 1.4.11 bug, not a style choice."
   */
  edge: string;
  /** Hairline dividers — the atlas contour ink. Carries its own alpha. */
  rule: string;
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

/**
 * Worklight. The fallback, and the values the parity tests compare against.
 *
 * These were the OLD WARM RAMP — #1a1714 paper, #8fb0e0 accent, #8cbe97 success
 * — kept verbatim long after tokens.css went true-neutral black. A fallback
 * that disagrees with the file it is standing in for is not a fallback, it is a
 * second palette waiting for a DOM-less render to reveal it, and the mesh
 * render-parity tests were comparing against the brown the theme no longer is.
 * Every value below is now the literal that tokens.css declares under `.dark`.
 */
const WORKLIGHT: PaintTheme = {
  paper0: "#000000",
  paper1: "#1c1c1e",
  paper2: "#2c2c2e",
  ink1: "#ffffff",
  ink2: "#d1d1d1",
  ink3: "#a8a8a8",
  ink4: "#5a5a5a",
  edge: "#8e8e8e",
  rule: "rgba(84, 84, 88, 0.65)",
  inkInverse: "#000000",
  accent: "#409cff",
  accentLine: "rgba(64,156,255,.38)",
  warm: "#f486b0",
  success: "#5fcb98",
  warning: "#f3be55",
  danger: "#f58279",
  shadow: "rgba(0,0,0,.75)",
  dark: true,
};

/** Daylight. Likewise the literals tokens.css declares under `:root, .light`. */
const DAYLIGHT: PaintTheme = {
  paper0: "#f2f2f7",
  paper1: "#ffffff",
  paper2: "#e9e9ee",
  ink1: "#000000",
  ink2: "#48484a",
  ink3: "#636366",
  ink4: "#aeaeb2",
  edge: "#78787d",
  rule: "rgba(60, 60, 67, 0.29)",
  inkInverse: "#ffffff",
  accent: "#0056d6",
  accentLine: "rgba(0,86,214,.30)",
  warm: "#992756",
  success: "#155839",
  warning: "#754c08",
  danger: "#9e2c23",
  shadow: "rgba(40,32,22,.26)",
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
  edge: "--edge",
  rule: "--rule",
  inkInverse: "--ink-inverse",
  accent: "--accent",
  accentLine: "--accent-line",
  warm: "--warm",
  success: "--success",
  warning: "--warning",
  danger: "--danger",
  shadow: "--canvas-shadow",
};

let cached: PaintTheme = WORKLIGHT;
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
  const base = isDark ? WORKLIGHT : DAYLIGHT;
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
