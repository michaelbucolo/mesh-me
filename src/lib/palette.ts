/**
 * THE SEVEN PLASTICS, on the TypeScript side of the wall.
 *
 * tokens.css owns the palette. The canvas cannot read a CSS custom property,
 * so anything painted with `ctx.fillStyle` has always needed a literal — and
 * for the mesh that literal was never the palette. `scene-model.ts` shipped its
 * own six colours, taken straight from Tailwind's 400 ramp:
 *
 *     identities  #c084fc      platforms  #f59e0b      people     #818cf8
 *     communities #ec4899      posts      #34d399      activity   #38bdf8
 *
 * Measured in OKLCH against the plastics the rest of the product is made of,
 * six of the eight mesh colours are NEAR-MISSES rather than alternatives:
 *
 *     mesh posts    #34d399  is 1.7deg from --mould-jade   and 0.148 lighter
 *     mesh mutual   #a78bfa  is 1.0deg from --mould-grape  and 0.179 lighter
 *     mesh self     #a5b4fc  is 2.6deg from --accent (dk)  and 0.032 lighter
 *     mesh platform #f59e0b  is 8.4deg from --mould-amber
 *     mesh people   #818cf8  is 8.6deg from --mould-cobalt
 *     mesh ident.   #c084fc  is  13deg from --mould-grape
 *
 * A colour one degree from another colour and a fifth of the scale lighter does
 * not read as a second colour. It reads as the first colour rendered wrong. Two
 * greens 60deg apart are a decision; two greens 1.7deg apart are a defect, and
 * the mesh is the surface the product is named after.
 *
 * The seventh plastic, crimson, is deliberately absent below: tokens.css
 * reserves it for destruction, and a branch of your own mesh is not that.
 *
 * `--domain-*` in tokens.css already stated which plastic means which part of
 * the product. It had ZERO call sites — nothing in the codebase had ever read
 * it, so it could never look wrong enough for anyone to notice. Same shape as
 * every other defect this week: two places state one fact, and only one of them
 * is ever taught the rule. This module is the one place, and
 * scripts/palette-check.ts fails the build if it and tokens.css disagree.
 */

/** A moulded plastic: the fill, and the ink pinned to it by tokens.css. */
export interface Plastic {
  /** The fill. Theme-invariant — the toys are the same toys at 3pm and 3am. */
  readonly fill: string;
  /** Text/glyphs sitting ON the fill. Pinned per plastic, never derived. */
  readonly ink: string;
  /** The side wall, for anything with thickness. */
  readonly plinth: string;
}

const plastic = (fill: string, ink: string, plinth: string): Plastic => ({ fill, ink, plinth });

/**
 * Mirrors the `--mould-*` triples in tokens.css exactly.
 * scripts/palette-check.ts parses that file and asserts every value here matches.
 */
export const MOULD = {
  cobalt: plastic("#3b5ae0", "#ffffff", "#22369e"),
  tomato: plastic("#ee6238", "#26100a", "#b8421f"),
  jade: plastic("#2e9e70", "#042019", "#186e4c"),
  amber: plastic("#f2b23c", "#2b1e04", "#bc8117"),
  teal: plastic("#157681", "#ffffff", "#0e5860"),
  grape: plastic("#7448d4", "#ffffff", "#4e2c99"),
  crimson: plastic("#b81f3a", "#ffffff", "#84142a"),
} as const;

export type MouldName = keyof typeof MOULD;

/**
 * Which plastic each branch of the mesh is made of.
 *
 * Chosen so that five of the six are the smallest move from what shipped — the
 * point is to land on the palette, not to repaint the mesh for its own sake:
 *
 *     platforms   #f59e0b -> amber    8.4deg
 *     posts       #34d399 -> jade     1.7deg
 *     people      #818cf8 -> cobalt   8.6deg
 *     communities #ec4899 -> grape     62deg  <- tokens.css already said grape
 *     identities  #c084fc -> teal            <- tokens.css: --domain-you is teal
 *     activity    #38bdf8 -> tomato          <- tokens.css: --domain-mesh is tomato
 *
 * Communities moves furthest because it is the one branch tokens.css had
 * already assigned (`--domain-communities: var(--mould-grape)`) and the mesh
 * was painting it pink. Two answers for one question; this deletes the wrong one.
 *
 * Minimum separation between any two branches is 24.2deg of hue (cobalt to
 * grape), so adjacent wedges stay tellable apart.
 */
export const BRANCH_PLASTIC = {
  identities: "teal",
  platforms: "amber",
  people: "cobalt",
  communities: "grape",
  posts: "jade",
  activity: "tomato",
} as const satisfies Record<string, MouldName>;


/**
 * The ink for a fill drawn from this palette.
 *
 * Every chip that paints a node colour behind text used `--chip-ink` (#12131c).
 * That token was tuned against the OLD node colours, which were uniformly
 * pastel. Against the plastics it fails WCAG AA on four of seven — cobalt 3.28,
 * teal 3.47, grape 3.19, crimson 2.90 — because a plastic can be dark, and the
 * old palette never was. The pinned inks clear 5.09 to 8.69 by construction.
 *
 * Falls back to `--chip-ink` for a fill this palette does not own (a platform
 * brand colour reaching one of these chips), which is what those call sites did
 * before and is measured by scripts/contrast-check.ts.
 */
export function inkForFill(fill: string): string {
  const hit = Object.values(MOULD).find((p) => p.fill.toLowerCase() === fill.trim().toLowerCase());
  return hit ? hit.ink : "var(--chip-ink)";
}

/**
 * Platform brand colours — the one set of literals that is not ours to choose:
 * #1db954 is Spotify's green whether it suits us or not. Everything else on
 * the canvas names a plastic; a platform hub names its owner's brand.
 * scripts/palette-check.ts pins this exemption to THIS module — the data
 * layers it scans must import from here rather than spell colours.
 */
export const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E4405F",
  youtube: "#FF0000",
  tiktok: "#69C9D0",
  twitter: "#1DA1F2",
  twitch: "#9146FF",
  spotify: "#1DB954",
  soundcloud: "#FF5500",
  linkedin: "#0A66C2",
  github: "#8B5CF6",
  discord: "#5865F2",
  snapchat: "#FFFC00",
  pinterest: "#E60023",
  reddit: "#FF4500",
  facebook: "#1877F2",
  threads: "#ffffff",
  bluesky: "#0085FF",
};
