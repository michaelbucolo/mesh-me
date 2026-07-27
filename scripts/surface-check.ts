/**
 * SURFACE GATE — `npm run surface:check`
 *
 * One law, and the product was breaking it everywhere:
 *
 *     A CARD IS LIGHTER THAN THE PAGE IT SITS ON.
 *
 * That is the whole reason a card reads as an object rather than a rectangle.
 * The mat is `--paper-0`; the card is `--paper-1`; `--paper-2` is the RECESS,
 * the surface you sink things INTO. Painting a card `--paper-2` does not make it
 * subtle, it makes it a hole.
 *
 * ── WHAT WAS ACTUALLY WRONG ──────────────────────────────────────────────────
 *
 * Measured in a real browser against the built app, six signed-in surfaces:
 * 81 cards, 59 of them (73%) rendering darker than the mat. Not because anyone
 * chose that — because one legacy de-glassing block force-painted fourteen card
 * classes `background: var(--bg-secondary) !important`, and `--bg-secondary`
 * resolves to `--paper-2`.
 *
 * The design system's own card rule said `--paper-1` and had said so for a long
 * time. It carried no `!important`, so it never painted a single pixel. The
 * comment four lines above it in the same file names the exact hazard — an
 * override that "has to be beaten" — and then the next rule forgets it.
 *
 * That is this codebase's oldest failure mode, in its purest form yet:
 *
 *     TWO PLACES STATE ONE FACT. ONLY ONE OF THEM IS EVER TAUGHT THE RULE.
 *
 * ── WHAT THIS GATE HOLDS ─────────────────────────────────────────────────────
 *
 * It does not check that the app looks good. It checks the four mechanical
 * facts that made it look bad, each one of which is invisible in review:
 *
 *   1. The paper scale still orders mat < card, in BOTH themes, computed from
 *      the hex values rather than trusted from the comments.
 *   2. No card class is force-painted by an `!important` background anywhere.
 *   3. The card rule names the whole vocabulary, not the three classes someone
 *      happened to have open.
 *   4. `.plate` is actually used in markup. It was defined, documented, and
 *      referenced by line number in a CSS comment — and had zero call sites.
 *      A container idiom nothing applies is not a design system, it is a note.
 *
 * ── WHAT THIS CANNOT PROVE ───────────────────────────────────────────────────
 *
 * It reads CSS text and class strings. It cannot see a surface painted from a
 * component prop, an inline style computed at runtime, or a third-party frame.
 * It proves the system's own rules are reachable — not that every pixel obeys.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** Blank comments while preserving offsets, so a gate never reads its own prose
 *  — or the file's — as product code. Six gates have been fooled that way. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

const globalsRaw = read("src/app/globals.css");
const globals = stripComments(globalsRaw);
const tokens = stripComments(read("src/app/tokens.css"));

// ── 1. THE PAPER SCALE STILL ORDERS MAT < CARD ───────────────────────────────
//
// Computed, not asserted from the comments. Both themes: the dark palette lives
// under `.dark` in tokens.css, the light one under `:root`/`.light`. If someone
// retargets `--paper-1` darker than `--paper-0` again, every card in the product
// inverts and nothing else in the build would notice.

function relLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const chan = (i: number) => {
    const v = parseInt(full.slice(i * 2, i * 2 + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(0) + 0.7152 * chan(1) + 0.0722 * chan(2);
}

/** Every `--paper-N: #hex` in source order. Later wins, same as the cascade. */
function paperScale(): Array<Record<string, string>> {
  const blocks: Array<Record<string, string>> = [];
  // Split on top-level selector openings so `.dark { … }` and `:root { … }`
  // stay separate; a single flat scan would let one theme's values answer for
  // the other's.
  for (const block of tokens.split(/\n(?=[.:][a-zA-Z])/)) {
    const found: Record<string, string> = {};
    for (const m of block.matchAll(/--paper-([0-3]):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) {
      found[`paper-${m[1]}`] = m[2];
    }
    if (Object.keys(found).length >= 3) blocks.push(found);
  }
  return blocks;
}

const scales = paperScale();
assert.ok(
  scales.length >= 2,
  `expected a --paper-* scale for each theme in tokens.css, found ${scales.length}.\n` +
    "  Both themes have to satisfy the ordering; checking one proves nothing about the other.",
);

for (const scale of scales) {
  const mat = scale["paper-0"];
  const card = scale["paper-1"];
  const recess = scale["paper-2"];
  assert.ok(mat && card && recess, `a --paper-* block is missing 0/1/2: ${JSON.stringify(scale)}`);

  const lMat = relLuminance(mat);
  const lCard = relLuminance(card);
  const lRecess = relLuminance(recess);
  const dark = lMat < 0.5;

  if (dark) {
    assert.ok(
      lCard > lMat,
      `dark theme: --paper-1 (${card}, L=${lCard.toFixed(4)}) is not lighter than --paper-0 ` +
        `(${mat}, L=${lMat.toFixed(4)}).\n` +
        "  A card must be lighter than the mat. If it is darker it is a hole, and every\n" +
        "  card in the product reads as sunken — which is exactly what 'flat and cheap' is.",
    );
    // RETARGETED. This demanded the recess be DARKER than the mat in dark mode
    // too. On Apple's dark ramp the page is true black (#000) and every surface
    // above it goes UP -- #1c1c1e card, #2c2c2e field. There is nowhere darker
    // than black to go, which tokens.css already said in prose ("a dark well has
    // nowhere darker to go") while this gate asserted the opposite.
    //
    // The claim worth keeping is not the DIRECTION, it is the DISTINCTION: a
    // field must be tellable from the page it sits on. In dark that separation
    // is upward.
    assert.ok(
      lRecess !== lMat,
      `dark theme: --paper-2 (${recess}, L=${lRecess.toFixed(4)}) is the same luminance as --paper-0 ` +
        `(${mat}, L=${lMat.toFixed(4)}).\n` +
        "  A field with the same fill as the page behind it has no visible extent -- you cannot\n" +
        "  see where it starts, or that it is empty.",
    );
  } else {
    assert.ok(
      lCard > lMat,
      `light theme: --paper-1 (${card}) must still be lighter than --paper-0 (${mat}); ` +
        `L=${lCard.toFixed(4)} vs ${lMat.toFixed(4)}.`,
    );
    assert.ok(
      lRecess < lMat,
      `light theme: --paper-2 (${recess}) must still be darker than --paper-0 (${mat}); ` +
        `L=${lRecess.toFixed(4)} vs ${lMat.toFixed(4)}.`,
    );
  }
}

// ── 2. THE ALIASES POINT AT THE RIGHT PAPER ──────────────────────────────────
//
// 101 surfaces are painted through the alias names rather than the paper names.
// `--bg-card` must be the card and `--bg-secondary` must be the recess, or the
// ordering proved above is true of tokens nothing reads.

const ALIASES: Array<[string, string]> = [
  ["--bg-primary", "--paper-0"],
  ["--bg-card", "--paper-1"],
  ["--bg-elevated", "--paper-1"],
  ["--bg-secondary", "--paper-2"],
];
for (const [alias, paper] of ALIASES) {
  const re = new RegExp(`^\\s*${alias}:\\s*var\\((--paper-[0-3])\\)`, "m");
  const m = re.exec(tokens);
  assert.ok(m, `${alias} is no longer defined as a var(--paper-*) alias in tokens.css.`);
  assert.equal(
    m![1],
    paper,
    `${alias} resolves to ${m![1]}, expected ${paper}.\n` +
      "  These four names carry the surface material for the whole product. Retargeting one\n" +
      "  is a palette-wide change that no visual diff of a single page would reveal.",
  );
}

// ── 3. NO CARD CLASS IS FORCE-PAINTED ────────────────────────────────────────
//
// The defect, stated exactly. An `!important` background on any of these beats
// the card rule no matter where the card rule sits, because specificity and
// order both lose to origin-importance. There is no "later so it wins" fix; the
// only fix is that nothing shouts.

const CARD_CLASSES = [
  "glass",
  "glass-card",
  "glass-panel",
  "glass-surface",
  "glass-dropdown",
  "mesh-surface",
  "mesh-panel",
  "mesh-stat-card",
  "simple-card",
  "theme-card",
  "premium-surface",
  "app-command-bar",
  "app-route-guide",
  "insta-story-rail",
];
// Deliberately absent: `.feed-composer-card` and `.insta-post-card`. The
// composer is a TRAY — you type into it, it is a recess, `--paper-2` is correct.
// The feed post is edge-to-edge `.leaf` on phones by design. Neither is a card,
// and listing them here would gate them into being one.

/** Every rule as [selector, body], comments already blanked. */
function rules(css: string): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selector: m[1].trim(), body: m[2] });
  }
  return out;
}

const allRules = rules(globals);
const forced: string[] = [];
for (const { selector, body } of allRules) {
  // Only the exact class token, so `.glass-card` never matches on `.glass`, and
  // a compound like `.feed-x-layout .glass-card` still counts.
  const hits = CARD_CLASSES.filter((c) => new RegExp(`\\.${c}(?![\\w-])`).test(selector));
  if (hits.length === 0) continue;
  if (/(^|;)\s*background(-color)?\s*:[^;]*!important/.test(body)) {
    forced.push(`${selector.replace(/\s+/g, " ").slice(0, 120)}  [${hits.join(", ")}]`);
  }
}
assert.equal(
  forced.length,
  0,
  "a card class is force-painted with an !important background:\n" +
    forced.map((f) => `    ${f}`).join("\n") +
    "\n\n  This is the bug this gate exists for. An !important fill cannot be beaten by the\n" +
    "  card rule at the end of globals.css — that rule is not !important, deliberately, so\n" +
    "  that base styles stay overridable. The last time this happened, 59 of 81 measured\n" +
    "  cards rendered darker than the page and the fix was mistaken for a palette problem\n" +
    "  three separate times. Remove the force; do not out-shout it.",
);

// ── 4. THE CARD RULE COVERS THE WHOLE VOCABULARY ─────────────────────────────
//
// It named three classes while fourteen existed. The other eleven were painted
// by whatever legacy rule happened to reach them.

const cardRule = allRules.find(
  (r) => /(^|;|\s)background:\s*var\(--paper-1\)/.test(r.body) && /\.glass-card(?![\w-])/.test(r.selector),
);
assert.ok(
  cardRule,
  "no rule in globals.css paints .glass-card `background: var(--paper-1)`.\n" +
    "  That rule is the card idiom. Without it the card vocabulary has no fill of its own.",
);

const missing = CARD_CLASSES.filter((c) => !new RegExp(`\\.${c}(?![\\w-])`).test(cardRule!.selector));
assert.equal(
  missing.length,
  0,
  `the card rule does not name: ${missing.join(", ")}.\n` +
    "  Every class in the card vocabulary shares one fill, or the product ships two card\n" +
    "  systems that differ by a few percent of luminance — which is what 'inconsistent'\n" +
    "  means when someone says the UI feels inconsistent.",
);

// ── 5. THE PLATE IS APPLIED, NOT JUST DECLARED ───────────────────────────────
//
// `.plate` was defined in globals.css, documented at length, and referenced by
// file-and-line in a CSS comment claiming four surfaces used it. Markup uses: 0.
// The comment described a change that was never made. Nothing in the build could
// tell the difference between an idiom and a note about an idiom — so this can.

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) tsxFiles(rel, out);
    else if (entry.name.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

// `plate` as a whole word inside a className string — so `.plate-raised`,
// `template`, and a stray `plate` in prose all fail to count.
const PLATE_IN_CLASSNAME = /className=(?:"[^"]*|'[^']*|\{?`[^`]*)\bplate\b/g;
const markupPlates = tsxFiles("src").reduce(
  (n, f) => n + [...read(f).matchAll(PLATE_IN_CLASSNAME)].length,
  0,
);

const MIN_PLATES = 15;
assert.ok(
  markupPlates >= MIN_PLATES,
  `.plate appears in ${markupPlates} className strings, expected at least ${MIN_PLATES}.\n` +
    "  A container idiom with no call sites is decoration. If a surface was deliberately\n" +
    "  moved off `.plate`, move the floor with it in the same commit — do not lower it to\n" +
    "  whatever today's number happens to be.",
);

// `.plate-raised` only works as a modifier if it is declared after `.plate`;
// both are single-class selectors, so order is the entire mechanism.
const iPlate = globals.search(/^\.plate\s*\{/m);
const iRaised = globals.search(/^\.plate-raised\s*\{/m);
assert.ok(iPlate >= 0, "`.plate` is no longer declared in globals.css.");
assert.ok(iRaised >= 0, "`.plate-raised` is no longer declared in globals.css.");
assert.ok(
  iRaised > iPlate,
  `.plate-raised is declared at offset ${iRaised}, before .plate at ${iPlate}.\n` +
    "  Equal specificity means the later rule wins. Declared first, the modifier silently\n" +
    "  does nothing and every floating panel drops to the resting shadow.",
);

// ── 6. THE DE-GLASSING KILLS BLUR AND NOTHING ELSE ───────────────────────────
//
// The block is still wanted — glass is matte paper in this system. What it must
// never do again is carry paint. Anchored on the two backdrop-filter kills that
// are its actual purpose.

const deGlass = allRules.find(
  (r) =>
    /backdrop-filter:\s*none\s*!important/.test(r.body) &&
    /\.glass-card(?![\w-])/.test(r.selector) &&
    /\.mesh-surface(?![\w-])/.test(r.selector),
);
assert.ok(
  deGlass,
  "the de-glassing block (backdrop-filter: none !important across the card classes) is gone.\n" +
    "  Removing it re-enables real backdrop blur on ~86 surfaces, which this system decided\n" +
    "  against on cost grounds. If that decision is being reversed, say so here.",
);
for (const prop of ["background", "background-color", "border-color", "box-shadow"]) {
  assert.ok(
    !new RegExp(`(^|;)\\s*${prop}\\s*:`).test(deGlass!.body),
    `the de-glassing block declares \`${prop}\` again.\n` +
      "  It exists to remove blur. Every time it has also carried material, the material has\n" +
      "  been wrong and has silently outranked the design system for months.",
  );
}

console.log(
  `surface: ok — ${scales.length} paper scales ordered, ${CARD_CLASSES.length} card classes on one fill, ` +
    `${markupPlates} .plate call sites, 0 forced backgrounds`,
);
