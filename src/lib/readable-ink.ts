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

/** The ratio `readableInkOn` achieves — used by the gate, and by nothing else. */
export function readableInkRatio(fill: string): number {
  const l = relativeLuminance(fill);
  return Math.max(
    contrast(l, relativeLuminance(INK_ON_LIGHT)),
    contrast(l, relativeLuminance(INK_ON_DARK)),
  );
}
