// THE PAPERS a mesh can be laid out on — and the ONE list that names them.
//
// This table lived in paint/shared.ts, next to canvas drawing helpers, which
// meant the settings picker could not import it without pulling the renderer
// into the settings bundle. So the picker kept its own copy, and the two drifted
// exactly as far as you would expect: the renderer shipped papers labelled
// Daylight / Botanical / Kraft / Blueprint / Sunlit, while Settings still
// offered "Midnight / Aurora / Ember / Ocean / Dawn" with outer-space swatches
// (#0c1226, #081726, #071224) that nothing had painted for a long time. A person
// picking "Midnight" expecting a blue-black sky got cream paper.
//
// shared.ts re-exports from here, so the renderer is unchanged; the picker reads
// MESH_PAPERS. scripts/palette-check.ts asserts the free paper matches tokens.css
// and that Settings owns no atmosphere list of its own.

/**
 * Mesh Atmospheres — the sky palette of a mesh. "midnight" is the free
 * default; the rest are MeshPro skies.
 */
export interface AtmosphereSpec {
  id: string;
  label: string;
  pro: boolean;
  /** Vertical wash stops: top → middle → bottom. Light falls from above. */
  bg: [string, string, string];
  /** Ink the labels and hairlines are drawn in on this paper. */
  ink: string;
  /** How much tooth this paper has (0 = smooth, 1 = coarse). */
  grain: number;
}

// PAPERS. The mesh stopped being outer space and became a tabletop: these are
// the surfaces your mesh is laid out on, not skies it floats in.
//
// THE KEYS DO NOT CHANGE. `atmosphereOf()` falls back to `midnight` for any id
// it does not recognise, so renaming a key would silently reset the stored
// `mesh-theme-preset` of every Pro member who picked one. Labels and values
// move; ids are permanent. PAPER_ALIAS below gives new pickers readable names.
// `midnight` IS THE APP'S OWN PAPER, and it is the only one that has to agree
// with the DOM: it is the free default, so it is what almost every mesh is laid
// out on, edge to edge behind the chrome. Its three stops and its ink are now
// --paper-1 / --paper-0 / --paper-2 and --ink-3 exactly, and
// scripts/palette-check.ts fails the build if they drift. The four Pro papers
// below are deliberately NOT tokens — Kraft is meant to be brown and Botanical
// green; those are materials somebody chose, not the app disagreeing with itself.
const ATMOSPHERES: Record<string, AtmosphereSpec> = {
  midnight: { id: "midnight", label: "Daylight", pro: false, bg: ["#fdfbf6", "#efeae1", "#e5dfd4"], ink: "#57535a", grain: 0.035 },
  aurora: { id: "aurora", label: "Botanical", pro: true, bg: ["#f4f6ee", "#e9eee0", "#dce4cf"], ink: "#5f6b52", grain: 0.04 },
  ember: { id: "ember", label: "Kraft", pro: true, bg: ["#f2e6d2", "#e8d9be", "#dbc8a6"], ink: "#7a6244", grain: 0.055 },
  ocean: { id: "ocean", label: "Blueprint", pro: true, bg: ["#e8eef4", "#dae3ee", "#c7d4e4"], ink: "#4e637a", grain: 0.03 },
  dawn: { id: "dawn", label: "Sunlit", pro: true, bg: ["#faf0e4", "#f2e2ce", "#e6d2b8"], ink: "#8a6247", grain: 0.045 },
};

/** The same five papers under one lamp. Chosen by the DOM theme, not stored. */
const ATMOSPHERES_DARK: Record<string, AtmosphereSpec> = {
  // WAS ["#1f1b17", "#1a1714", "#100e0c"] — the warm ramp, kept here after
  // tokens.css went true-neutral black on the explicit instruction that dark
  // mode be black and not brown. r=31 g=27 b=23 is brown by any measure, and it
  // covered the hero surface of the product while every DOM pixel around it was
  // #0a0a0a. --paper-1 / --paper-0 / --paper-2 and --ink-3, gated like the rest.
  midnight: { id: "midnight", label: "Daylight", pro: false, bg: ["#1a1a1a", "#0a0a0a", "#050505"], ink: "#a8a8a8", grain: 0.05 },
  aurora: { id: "aurora", label: "Botanical", pro: true, bg: ["#1b1f18", "#171a14", "#0d0f0b"], ink: "#8a9680", grain: 0.055 },
  ember: { id: "ember", label: "Kraft", pro: true, bg: ["#281f16", "#221a12", "#110c08"], ink: "#b09472", grain: 0.07 },
  ocean: { id: "ocean", label: "Blueprint", pro: true, bg: ["#181f26", "#141a20", "#0b0e11"], ink: "#8fa6bd", grain: 0.045 },
  dawn: { id: "dawn", label: "Sunlit", pro: true, bg: ["#2a211c", "#241c18", "#100c0a"], ink: "#c09272", grain: 0.06 },
};

// A readable-id alias map (midnight->daylight, ember->kraft, ...) belongs here
// when a picker needs one. It is deliberately NOT written yet: an exported map
// nothing reads is just a second source of truth waiting to drift from the
// labels above.

/**
 * Resolve a stored preset id to its paper. `dark` picks the lamplit variant of
 * the SAME paper — a person's chosen paper does not change when the room does,
 * only the light falling on it.
 */
export function atmosphereOf(id?: string | null, dark = true): AtmosphereSpec {
  const table = dark ? ATMOSPHERES_DARK : ATMOSPHERES;
  return (id && table[id]) || table.midnight;
}

/**
 * The papers, in picker order, with a two-colour swatch taken from the paper
 * ITSELF — its mid stop and its ink — rather than hand-written beside it. A
 * swatch that is not derived from the thing it previews is just the drift above
 * waiting to happen again.
 */
export const MESH_PAPERS = (["midnight", "aurora", "ember", "ocean", "dawn"] as const).map((id) => {
  const light = ATMOSPHERES[id];
  const dark = ATMOSPHERES_DARK[id];
  return {
    id,
    label: light.label,
    pro: light.pro,
    swatch: [light.bg[1], light.ink] as [string, string],
    swatchDark: [dark.bg[1], dark.ink] as [string, string],
  };
});
