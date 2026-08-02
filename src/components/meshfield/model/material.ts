// ONE MATERIAL FOR EVERYTHING IS WHY IT LOOKED CHEAP.
//
// The surface this replaces drew every element as the same grey rounded
// rectangle at the same elevation: a person, a nine-day-old video and an
// unanswered message were visually identical objects. There was no hierarchy to
// read, so there was nothing to look at first, so the eye picked at random and
// the surface felt like noise.
//
// The fix is not "more colours". It is that colour has to MEAN something, and
// mean exactly one thing, consistently:
//
//   WARMTH AND PRESENCE ARE URGENCY.  PLATFORM IDENTITY IS A WHISPER.
//
// A node that wants you is warm, bright against the field, and glows. A node
// that is merely context is cool, dim and flat. Where a thing came from is
// present — you can tell a YouTube node from a Reddit one — but it is a small
// rotation of hue, never a change in how loud the node is.
//
// ── THE ARC, AND WHY IT NEVER DOUBLES BACK ──────────────────────────────────
//
// The four bands walk ONE arc of the wheel, ember to deep blue, and never turn
// around. That is what makes the warm/cool split readable as a split: the two
// inner bands are things to ACT on and share a family, the two outer bands are
// things to BROWSE and share another. If the arc doubled back, an outer band
// would borrow the inner band's warmth and the split would stop being visible.
//
// ── WHY THE TINT RE-SOLVES LIGHTNESS, AS MEASURED RATHER THAN AS ASSUMED ────
//
// Platform tint rotates hue. Rotating hue at a fixed HSL lightness does NOT
// preserve how bright a colour looks: relative luminance weights green at
// 0.7152 and blue at 0.0722, a factor of ten. So the tint rotates hue and then
// RE-SOLVES lightness to land back on the band's exact target luminance.
//
// The first version of this comment justified that by claiming a naive tint
// would push a node clean out of its band and into the next one. Measured, that
// is FALSE, and it is recorded here rather than quietly corrected because the
// weaker true statement is the one worth knowing:
//
//   Naive tint spreads a band's loudness by 17-20x more than the shipped
//   version does — 10.06:1 to 11.70:1 across the sixteen platforms in dark
//   `needsYou`, against 10.86-10.95 shipped. In fill luminance that is 0.475
//   against 0.561, an 18% difference, plainly visible with the two nodes side
//   by side. The bands still do not cross, because they are centred far enough
//   apart to absorb it.
//
// So the failure is not "urgency is misread across bands". It is that WITHIN a
// band, two things of identical urgency look different amounts of urgent, and
// which one looks louder is decided by where its platform's logo happens to sit
// on the colour wheel. That is the promise at the top of this file breaking in
// the small rather than in the large.
//
// It also leaves no headroom. In the light theme a naively tinted `happening`
// band spans 0.886 of contrast while the gap to `fresh` is only 0.507 — the
// band is wider than the space between it and its neighbour, and stays clear
// only because the centres are far apart. Any future band added between them
// collapses it. The re-solve makes the separation structural instead, the same
// way the geometry stacks its bands outward rather than computing each one
// independently and hoping.
//
// The effect concentrates in the two inner bands, which is convenient: they are
// saturated, so hue rotation moves their luminance a lot, and they are also the
// bands where being wrong about urgency actually costs something. The outer two
// carry little chroma and barely move either way.

import { contrast, fromHsl, relativeLuminance, readableInkOn, toHsl } from "@/lib/readable-ink";
import { PLATFORM_COLORS } from "@/lib/palette";
import type { Ring } from "./rings";

export type MeshTheme = "dark" | "light";

export type Material = {
  /** The node body. */
  fill: string;
  /** Text drawn on the body. Clears WCAG AA on `fill`, in both themes. */
  ink: string;
  /** The node's edge, so a dim node still has a shape. */
  rim: string;
  /** Halo strength, 0..1. Only urgency glows. */
  glow: number;
};

/**
 * The mesh's own backdrop.
 *
 * Deliberately NOT `--paper-0`. The mesh is a world rather than a page, and it
 * gets its own ground: a near-black with a faint blue cast in the dark theme so
 * the warm bands have something to be warm against, and a cool off-white in the
 * light theme for the same reason inverted. Reusing the page's mat would have
 * put a warm grey-beige behind an ember node, which mutes the one signal this
 * whole module exists to carry.
 */
export const MESH_BACKDROP: Readonly<Record<MeshTheme, string>> = Object.freeze({
  dark: "#07070b",
  light: "#eef0f6",
});

/**
 * Hue per band, degrees, walking one arc from ember to deep blue.
 *
 * The gap between `happening` and `fresh` is the widest by far, and that is the
 * point: it is the boundary between "act on this" and "this is just context".
 */
const HUE: Readonly<Record<Ring, number>> = Object.freeze({
  needsYou: 12,
  happening: 34,
  fresh: 178,
  field: 232,
});

/** Saturation per band. Chroma falls outward, so context cannot shout. */
const SATURATION: Readonly<Record<Ring, number>> = Object.freeze({
  needsYou: 0.82,
  happening: 0.74,
  fresh: 0.44,
  field: 0.26,
});

/**
 * Target relative luminance per band, per theme.
 *
 * Not "brighter inward" — that is only true in the dark theme. The invariant
 * that holds in BOTH is that CONTRAST AGAINST THE BACKDROP falls outward, so on
 * light paper the inner bands go darker while meaning exactly the same thing.
 * Stating it as luminance per theme rather than as one rule is what makes the
 * light theme a real design instead of an inversion that happens to compile.
 *
 * ── THE LIGHT THEME IS NOT THE DARK ONE UPSIDE DOWN ────────────────────────
 *
 * The first version of this table gave the light theme the same generous
 * contrast range as the dark one, putting `needsYou` at 5.40:1. Rendered and
 * looked at, that is a brick — it reads as ERROR rather than as someone wants
 * you. Measured against the things it was accidentally imitating:
 *
 *     Apple system red   #FF3B30   3.11:1 on this paper
 *     Material error     #B3261E   5.74:1
 *     what I had built             5.40:1
 *
 * An attention colour and an error colour are different colours, and 5.40 was
 * squarely the second one. `needsYou` now sits at 3.11:1, deliberately the same
 * weight as the system alert colour people already read as "this wants you, it
 * is not broken".
 *
 * That has a consequence worth stating plainly rather than hiding: light paper
 * physically cannot spread four bands as far as black can. Above a paper
 * luminance of 0.87 the whole usable range is roughly 3.1:1 down to the 1.6:1
 * visibility floor, where the dark theme has 10.9:1 down to 1.8:1. So the ratio
 * between the loudest and quietest band is ~6x in dark and ~1.9x in light, and
 * the gate holds each theme to what its paper can actually do. Loosening one
 * number to make a design pass would be cheating; recording that the two media
 * have different ranges is just true.
 */
const LUMINANCE: Readonly<Record<MeshTheme, Record<Ring, number>>> = Object.freeze({
  dark: { needsYou: 0.52, happening: 0.32, fresh: 0.14, field: 0.045 },
  light: { needsYou: 0.246, happening: 0.319, fresh: 0.411, field: 0.519 },
});

/** Halo strength per band. Only things that want you are allowed to glow. */
const GLOW: Readonly<Record<Ring, number>> = Object.freeze({
  needsYou: 1,
  happening: 0.62,
  fresh: 0.28,
  field: 0,
});

/**
 * How far a platform may rotate its band's hue, in degrees.
 *
 * Small on purpose. Enough that eighteen platforms are distinguishable side by
 * side; not enough for a platform to borrow the neighbouring band's identity.
 * The arc between the two closest bands is 26 degrees, so a rotation of 7 in
 * either direction cannot cross it.
 */
const TINT_ARC = 7;

/**
 * Lightness that produces `target` relative luminance for a given hue and
 * saturation.
 *
 * Binary search rather than algebra: relative luminance is piecewise over the
 * sRGB transfer curve and HSL lightness folds three channels together, so there
 * is no clean inverse. It is strictly increasing in lightness and spans 0 to 1
 * at every hue and saturation, which is what makes the search total — any
 * target in range is reachable from any hue, so no band can ever fail to hit
 * its mark and quietly fall into the next band's range.
 */
function atLuminance(hue: number, saturation: number, target: number): string {
  let lo = 0;
  let hi = 1;
  let hex = fromHsl(hue / 360, saturation, 0.5);
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    hex = fromHsl(hue / 360, saturation, mid);
    if (relativeLuminance(hex) < target) lo = mid;
    else hi = mid;
  }
  return hex;
}

/**
 * A platform's rotation within the arc.
 *
 * Derived from where the brand's own colour sits on the wheel and squeezed into
 * `TINT_ARC`, so the platforms keep their relative order — YouTube's red and
 * Bluesky's blue land on opposite sides of their band, the way they do on the
 * wheel — while none of them gets loud enough to matter. An unknown platform
 * gets no rotation rather than a guess.
 */
function rotationFor(platform: string | null): number {
  if (!platform) return 0;
  const brand = PLATFORM_COLORS[platform.toLowerCase()];
  if (!brand) return 0;
  const [h] = toHsl(brand);
  return (h * 2 - 1) * TINT_ARC;
}

/**
 * The material for a node.
 *
 * Pure: band and platform and theme in, colours out. No element, no DOM, no
 * token lookup — which is what lets the gate check the whole palette as
 * arithmetic instead of photographing it.
 */
export function materialFor(ring: Ring, platform: string | null, theme: MeshTheme): Material {
  const target = LUMINANCE[theme][ring];
  const hue = HUE[ring] + rotationFor(platform);
  const fill = atLuminance(hue, SATURATION[ring], target);
  const ink = readableInkOn(fill);

  // The rim moves a third of the way from the body toward its own ink. In the
  // dark theme that lifts the edge out of the ground; in the light theme it
  // darkens it. Either way a dim outer node still has a shape, which is the
  // thing that stops the field reading as smudges.
  const rim = atLuminance(hue, SATURATION[ring], target + (relativeLuminance(ink) - target) * 0.33);

  return { fill, ink, rim, glow: GLOW[ring] };
}

/**
 * How hard a band pushes against the backdrop. Exposed because it is the
 * quantity the whole module is ordered by, and the gate checks the ordering.
 */
export function contrastOnBackdrop(material: Material, theme: MeshTheme): number {
  return contrast(relativeLuminance(material.fill), relativeLuminance(MESH_BACKDROP[theme]));
}
