/**
 * The ink for a fill this design system does not own.
 *
 * Platform brand colours are given to us: #1db954 is Spotify's green whether it
 * suits us or not, and there are eighteen of them. `connected-accounts-client`
 * defaulted every glyph to white and carried a single hand-written `fg` override
 * for Snapchat, whose yellow made the problem obvious. The other seventeen were
 * decided by whoever noticed. Measured, three of them failed WCAG AA:
 *
 *     Spotify     #1db954   white 2.59:1
 *     SoundCloud  #ff5500   white 3.21:1
 *     Reddit      #ff4500   white 3.44:1
 *
 * A hardcoded map of exceptions is the wrong shape, because the next platform
 * added gets whatever the default is and nobody measures it. So the ink is
 * DERIVED: pick whichever of white or black contrasts better with the fill.
 * Across the eighteen brands that ships shipped today the worst case is Discord
 * at 4.61:1, and every one clears AA.
 *
 * Black rather than --chip-ink here: on the mid-tone brands (#1877f2, #ff0000)
 * --chip-ink lands at 4.37 and 4.62, and pure black takes them to 4.96 and 5.25.
 * --chip-ink exists for the mesh's own node palette, which is uniformly pastel
 * and never approaches that boundary; a brand colour can be any lightness at all,
 * so the ink for one has to go all the way.
 *
 * scripts/contrast-check.ts asserts this function clears AA on every fill in the
 * brand map, reading the map from its own source — so adding a platform whose
 * colour cannot carry either ink fails the build rather than shipping.
 */

// ── THE COLOUR MATHS IS MODULE-PRIVATE AGAIN ────────────────────────────────
//
// relativeLuminance, contrast, toHsl and fromHsl were exported for exactly one
// outside reader: components/meshfield/model/material.ts, the ring field's
// colour model, and the gate that tested it. Both are gone — /mesh is the
// canvas scene again — and every remaining call is inside this file.
//
// They are unexported rather than left public "for later", for the same reason
// this repo already states in meshpro-claims-check.ts about analyticsWindow: an
// export with no reader is a dead export, knip rightly rejects it, and keeping
// one alive to satisfy something outside the module is the tail wagging the
// dog. The published surface of this file is the four functions that answer a
// question a caller actually has — which ink, which accent, what ratio — not
// the arithmetic underneath them.

/** Relative luminance, WCAG 2.x. Accepts `#rgb` and `#rrggbb`. */
function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const channel = (i: number) => {
    const v = parseInt(full.slice(i * 2, i * 2 + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** WCAG contrast ratio between two relative luminances. */
function contrast(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export const INK_ON_LIGHT = "#000000";
export const INK_ON_DARK = "#ffffff";

/**
 * The more readable of black and white on `fill`.
 *
 * `fill` must be a hex string; anything else returns white, which is what the
 * call site did before this existed and is the safe answer for the dark brands
 * that make up most of the map.
 */
export function readableInkOn(fill: string): string {
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(fill.trim())) return INK_ON_DARK;
  const l = relativeLuminance(fill);
  const onLight = contrast(l, relativeLuminance(INK_ON_LIGHT));
  const onDark = contrast(l, relativeLuminance(INK_ON_DARK));
  return onLight >= onDark ? INK_ON_LIGHT : INK_ON_DARK;
}

/**
 * THE SAME COLOUR CANNOT BE A FILL AND A LABEL.
 *
 * `readableInkOn` answers "what ink goes ON this fill". This answers the other
 * half: "what does this colour become when it IS the ink". They are different
 * questions with opposite answers — a fill is judged by the ink on top of it and
 * text by the paper behind it, so brightening a hue helps one and hurts the
 * other. The five accent presets shipped one value doing both jobs and every one
 * of them measured under 3.3:1 as text, the forest green at 2.63:1.
 *
 * The palette pins these per preset. This derives one for a colour the palette
 * cannot know in advance: the accent a user picks in Settings.
 *
 * Hue and saturation are preserved and only lightness moves, away from the
 * background, until AA clears — so the result still reads as the colour that was
 * chosen. Returns `accent` unchanged when it already clears.
 */
export function readableAccentText(accent: string, background: string): string {
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(accent.trim())) return accent;
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(background.trim())) return accent;

  const bg = relativeLuminance(background);
  if (contrast(relativeLuminance(accent), bg) >= AA_TEXT) return accent;

  // Move away from the background: darken on light paper, lighten on dark.
  const [h, s, l0] = toHsl(accent);
  const step = bg > 0.179 ? -0.004 : 0.004;
  for (let i = 1; i <= 250; i += 1) {
    const l = l0 + step * i;
    if (l < 0 || l > 1) break;
    const candidate = fromHsl(h, s, l);
    if (contrast(relativeLuminance(candidate), bg) >= AA_TEXT) return candidate;
  }
  // Nothing in the hue clears it, so fall back to the ink that always can.
  return bg > 0.179 ? INK_ON_LIGHT : INK_ON_DARK;
}

/** A little headroom over 4.5, so rounding never lands a shipped value under AA. */
const AA_TEXT = 4.6;

/** sRGB hex to HSL, all three components in 0..1. */
function toHsl(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 1, 2].map((i) => parseInt(full.slice(i * 2, i * 2 + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue / 6, s, l];
}

/** HSL back to sRGB hex, all three components in 0..1. */
function fromHsl(h: number, s: number, l: number): string {
  const f = (p: number, q: number, t0: number) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const hex = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, "0");
  if (s === 0) return `#${hex(l)}${hex(l)}${hex(l)}`;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return `#${hex(f(p, q, h + 1 / 3))}${hex(f(p, q, h))}${hex(f(p, q, h - 1 / 3))}`;
}

/** The ratio `readableInkOn` achieves — used by the gate, and by nothing else. */
export function readableInkRatio(fill: string): number {
  const l = relativeLuminance(fill);
  return Math.max(
    contrast(l, relativeLuminance(INK_ON_LIGHT)),
    contrast(l, relativeLuminance(INK_ON_DARK)),
  );
}
