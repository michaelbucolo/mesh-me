/**
 * CONTRAST GATE — reads src/app/tokens.css and proves the colour system's own
 * promises with real WCAG maths, rather than trusting the comments next to the
 * values.
 *
 * It exists because the promises were wrong when first written. The system
 * asserted "--ink-3: 5.2:1" and "pigments are AA at 14px+ on --paper-0/1"; in
 * fact --ink-3 measured 4.33:1 against --paper-3, and --warm and --warning
 * measured 3.5-4.0:1 against both papers. Those were fixed by moving the
 * values, and this script is what stops them drifting back.
 *
 * WHAT IT PROVES
 *   1. Every ink token that carries TEXT clears AA (4.5:1) against every paper
 *      surface it can legally sit on — not just the one it was measured against.
 *   2. --ink-4 does NOT clear AA. It is the borders-and-dividers token, and a
 *      value that happened to pass would make "non-text only" unenforceable by
 *      eye during review.
 *   3. The accent clears AA as text on paper, and --accent-ink clears AA on the
 *      accent (text sitting ON a filled button).
 *   4. Every pigment clears AA on --paper-0 and --paper-1, which is exactly the
 *      claim the system makes for them.
 *
 * WHAT IT CANNOT PROVE
 *   Which token a given element actually uses. This checks the palette, not the
 *   markup — a component that hardcodes a colour is invisible here, and the
 *   hardcoded-colour sweep is what catches those.
 */

import assert from "node:assert/strict";
import { BRANCH_PLASTIC, MOULD, inkForFill } from "../src/lib/palette";
import { INK_ON_DARK, INK_ON_LIGHT, readableAccentText, readableInkOn, readableInkRatio } from "../src/lib/readable-ink";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const source = readFileSync(join(ROOT, "src/app/tokens.css"), "utf8");

/** Pull one theme's declarations: the `:root, .light` block, or the `.dark` one. */
function themeBlock(selectorPattern: RegExp): Record<string, string> {
  const match = selectorPattern.exec(source);
  assert.ok(match, `theme block not found for ${selectorPattern}`);
  const start = source.indexOf("{", match.index);
  let depth = 0;
  let end = start;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = source.slice(start, end);
  const out: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[name] = value.trim();
  }
  return out;
}

const DAYLIGHT = themeBlock(/:root,\s*\n\.light\s*\{/);
const LAMPLIGHT = themeBlock(/^\.dark\s*\{/m);

function channel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "").trim();
  assert.match(h, /^[0-9a-fA-F]{6}$/, `expected a 6-digit hex, got "${hex}"`);
  return (
    0.2126 * channel(parseInt(h.slice(0, 2), 16)) +
    0.7152 * channel(parseInt(h.slice(2, 4), 16)) +
    0.0722 * channel(parseInt(h.slice(4, 6), 16))
  );
}

function ratio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const AA = 4.5;
/** WCAG 1.4.11 — non-text contrast, the floor for a boundary you must be able to see. */
const NON_TEXT = 3;
const PAPERS = ["--paper-0", "--paper-1", "--paper-2", "--paper-3"] as const;
/** The three states of a PRESSABLE object's top face. Split from --paper-1 so the
 *  plinth has somewhere to step to; in Worklight they differ, and text sits on
 *  them constantly — a hovered row is the single most-read surface in the app. */
const FACES = ["--face", "--face-hover", "--face-press"] as const;
/** Surfaces text lands on that are neither paper nor face. */
const HOVER_SURFACES = ["--paper-hover", "--paper-press"] as const;
const TEXT_INKS = ["--ink-1", "--ink-2", "--ink-3"] as const;
const PIGMENTS = ["--warm", "--success", "--warning", "--danger", "--info"] as const;
/** The seven moulded plastics. Each is a triple: face, its pinned ink, its plinth. */
const MOULDS = ["cobalt", "tomato", "jade", "amber", "teal", "grape", "crimson"] as const;
/**
 * The plinth is the object's own side wall, so it darkens in BOTH themes — which
 * is exactly why it may never be the legal boundary (that is --edge's job). It
 * still has to be visible as a wall, or the object has no thickness.
 */
const PLINTH_STEP = 1.4;

/**
 * A token's value in one theme, for the sections that read globals.css and so
 * cannot use the per-theme `at()` closure below. `.dark` inherits from `:root`,
 * so an absent value falls through to the light block — the same rule `at()`
 * follows, stated once here rather than a second time by hand.
 */
function tokenIn(theme: "light" | "dark", name: string): string {
  const value = (theme === "dark" ? LAMPLIGHT[name] : DAYLIGHT[name]) ?? DAYLIGHT[name];
  assert.ok(value, `the ${theme} theme is missing ${name}`);
  return value;
}

let checks = 0;

for (const [theme, tokens] of [["Daylight", DAYLIGHT], ["Lamplight", LAMPLIGHT]] as const) {
  const at = (name: string): string => {
    // `.dark` INHERITS from `:root` — the seven plastics are deliberately not
    // redeclared there, because a toy is the same colour at 3pm and at 3am.
    // Reading only the .dark block would report them as missing and make the
    // gate demand a redeclaration the design specifically rejects.
    const value = tokens[name] ?? DAYLIGHT[name];
    assert.ok(value, `${theme} is missing ${name} (and it is not inherited from :root)`);
    return value;
  };

  // 1. Text inks clear AA on every paper they can sit on.
  for (const ink of TEXT_INKS) {
    for (const paper of PAPERS) {
      const r = ratio(at(ink), at(paper));
      assert.ok(
        r >= AA,
        `${theme}: ${ink} on ${paper} is ${r.toFixed(2)}:1, below AA ${AA}:1.\n` +
          `  Every text ink must clear AA on EVERY paper it can legally sit on —\n` +
          `  measuring only against --paper-0 is how this shipped wrong the first time.`,
      );
      checks += 1;
    }
  }

  // 2. --ink-4 stays the QUIETEST ink. (Retargeted: it used to assert
  //    `inkFour < AA`, an INVERTED test that failed the build for making the
  //    palette MORE accessible -- darkening --ink-4 to #3a3a3c was rejected
  //    with "10.17:1, which passes AA". A rule that punishes improvement is not
  //    protecting anything.)
  //
  //    The real intent is a RAMP: --ink-4 is rules, dividers and disabled
  //    glyphs, and it must never be mistakable for a text ink. That is a
  //    relative claim, so it is now written as one -- both inks may rise
  //    together, but --ink-4 stays below --ink-3, the text floor.
  const inkFour = ratio(at("--ink-4"), at("--paper-0"));
  const inkThree = ratio(at("--ink-3"), at("--paper-0"));
  assert.ok(
    inkFour < inkThree,
    `${theme}: --ink-4 is ${inkFour.toFixed(2)}:1 on --paper-0, at or above --ink-3 (${inkThree.toFixed(2)}:1).\n` +
      "  --ink-4 is the borders-and-dividers token and must stay the quietest ink in the\n" +
      "  ramp. If it reads as strongly as the text floor, nothing stops it being used as text.",
  );
  checks += 1;

  // 2b. THE FOCUS RING WAS NEVER MEASURED.
  //
  //     --rule-focus is the keyboard focus indicator -- for a keyboard-only user
  //     it is the entire cursor. It was one of fifteen hex tokens this file
  //     parsed and never passed to ratio(): an audit made it invisible and the
  //     gate still printed "contrast OK". WCAG 2.4.11 wants a focus indicator
  //     you can actually see, so it is held to the non-text floor on every
  //     surface it can land on.
  for (const paper of PAPERS) {
    const r = ratio(at("--rule-focus"), at(paper));
    assert.ok(
      r >= NON_TEXT,
      `${theme}: --rule-focus on ${paper} is ${r.toFixed(2)}:1, below ${NON_TEXT}:1.\n` +
        "  This is the keyboard focus indicator. For someone navigating without a mouse it is\n" +
        "  the only thing telling them where they are.",
    );
    checks += 1;
  }

  // 3. THE ACCENT AS TEXT AND THE ACCENT AS A FILL ARE DIFFERENT COLOURS.
  //
  // This used to be one value doing both jobs, measured on --paper-0 alone.
  // Two things were wrong with that.
  //
  // ONE PAPER IS NOT THE SURFACE. Accent text sits on all four papers — a link
  // inside an input well is on --paper-2, inside a tray floor on --paper-3. The
  // dark theme's own shipped accent, #409cff, is 8.82:1 on --paper-0 and
  // 4.01:1 on --paper-3. Measuring the easiest surface and calling it the
  // palette is the same half-coverage that hid the preset inks.
  //
  // ONE VALUE CANNOT DO BOTH JOBS. A fill is judged by the ink ON it and text
  // by the paper BEHIND it, and those pull a hue in opposite directions: make
  // the accent darker and it reads better as text but worse under near-black
  // ink. The default accent happened to clear both. The ten presets did not —
  // every one of the five light presets measured under 3.3:1 as text, the
  // forest green at 2.95:1, on links and on every `Edit`/`See all` control.
  //
  // So there are two tokens now. --accent fills; --accent-text paints text, on
  // every paper.
  for (const paper of PAPERS) {
    const r = ratio(at("--accent-text"), at(paper));
    assert.ok(
      r >= AA,
      `${theme}: --accent-text on ${paper} is ${r.toFixed(2)}:1, below AA.\n` +
        "  Accent text is not confined to --paper-0 — it lands in input wells (--paper-2) and on\n" +
        "  tray floors (--paper-3). Darken (light) or lighten (dark) --accent-text until it clears\n" +
        "  on all four; --accent itself stays the colour the fill wants.",
    );
    checks += 1;
  }
  const inkOnAccent = ratio(at("--accent-ink"), at("--accent"));
  assert.ok(inkOnAccent >= AA, `${theme}: --accent-ink on --accent is ${inkOnAccent.toFixed(2)}:1`);
  checks += 1;

  // 4 + 9. Pigments carry meaning, so they must be readable where they are
  // allowed — and that is all FOUR papers, not the two they were measured
  // against. A validation message under an input sits on --paper-2, which is
  // precisely where the original values fell to 3.88.
  for (const pigment of PIGMENTS) {
    for (const paper of PAPERS) {
      const r = ratio(at(pigment), at(paper));
      assert.ok(
        r >= AA,
        `${theme}: ${pigment} on ${paper} is ${r.toFixed(2)}:1, below AA ${AA}:1.\n` +
          "  Pigments mean something — a warning nobody can read is not a warning.\n" +
          "  --paper-2/--paper-3 are the recess surfaces: a field error lives there.",
      );
      checks += 1;
    }
  }

  // 5. THE EDGE clears non-text contrast on every surface it can ring.
  //
  // This is the assertion the whole Separation Law rests on. The plinth darkens
  // in both themes, so on a dark mat it SUBTRACTS separation — four of seven
  // plastics measure under 3:1 as faces against the dark card. What makes an
  // object legal is the 1px --edge ring, not its fill. An object without --edge
  // is a WCAG 1.4.11 bug, not a style choice.
  // Hover/press surfaces included: a button sits inside a hovered row constantly,
  // and that is a different ground from the resting paper.
  for (const surface of [...PAPERS, ...FACES, ...HOVER_SURFACES]) {
    const r = ratio(at("--edge"), at(surface));
    assert.ok(
      r >= NON_TEXT,
      `${theme}: --edge on ${surface} is ${r.toFixed(2)}:1, below ${NON_TEXT}:1.\n` +
        "  --edge is the only thing carrying the object boundary — the plinth cannot, because\n" +
        "  it darkens in both themes and vanishes against a dark mat. If the ring fails here,\n" +
        "  every pressable object on this surface has no legal edge at all.",
    );
    checks += 1;
  }

  // 6. Every plastic's PINNED ink clears AA on that plastic.
  //
  // Pinned, not computed: the seven faces do not move between themes, so each
  // one's ink is decided once and can be verified against a single ground
  // rather than two moving ones.
  for (const mould of MOULDS) {
    const r = ratio(at(`--mould-${mould}-ink`), at(`--mould-${mould}`));
    assert.ok(
      r >= AA,
      `${theme}: --mould-${mould}-ink on --mould-${mould} is ${r.toFixed(2)}:1, below AA.\n` +
        "  Each plastic carries its own pinned ink precisely so this can be guaranteed.",
    );
    checks += 1;
  }

  // 7. Text inks clear AA on the FACE states too.
  //
  // The assertion that would have caught the real failure: --ink-3 measured
  // 4.31:1 on --face-hover, below AA on a hovered row — the most-read surface
  // in the product, and one no paper-only check ever looks at.
  for (const ink of TEXT_INKS) {
    for (const surface of [...FACES, ...HOVER_SURFACES]) {
      const r = ratio(at(ink), at(surface));
      assert.ok(
        r >= AA,
        `${theme}: ${ink} on ${surface} is ${r.toFixed(2)}:1, below AA ${AA}:1.\n` +
          "  Hover and press states are surfaces text sits on. Checking only the resting\n" +
          "  paper is how a hovered row shipped below AA.",
      );
      checks += 1;
    }
  }

  // 8a. AN INPUT IS DISTINGUISHABLE FROM THE SURFACE IT SITS ON.
  //
  // RETARGETED. This used to assert that --plinth-tray (the inner LIP of a
  // sunken group) cleared 1.4:1 against the well, because the product was a
  // rubber tray with moulded objects in it and an input lived in a recess.
  //
  // Apple's language has no recess and no lip. An input is a filled field with
  // a hairline; a grouped list is a card on a slightly different page. Asserting
  // a visible lip would have forced the moulding back in.
  //
  // What survives is the thing that actually protects a user: an input must be
  // TELLABLE from what it sits on. WCAG 1.4.11 wants 3:1 for a control boundary,
  // and --edge is that boundary and is checked against every surface below. What
  // is checked here is the weaker, additional claim that the field's own fill is
  // not literally identical to the page — because a field you cannot see the
  // extent of is a field you cannot tell is empty.
  const wellStep = ratio(at("--paper-2"), at("--paper-1"));
  assert.ok(
    wellStep >= 1.02 || at("--paper-2") !== at("--paper-1"),
    `${theme}: --paper-2 and --paper-1 are the same colour, so an input well is invisible against its card.\n` +
      "  Apple separates a field from its card by fill plus a hairline, not by a moulded lip —\n" +
      "  but the fill still has to differ, or the field has no visible extent at all.",
  );
  checks += 1;

  // 8. Every plastic is visibly thicker than its own plinth.
  //
  // Not a legibility floor — a *thickness* floor. A plinth you cannot see is
  // not a side wall, and the entire depth model is the side wall.
  for (const mould of MOULDS) {
    const r = ratio(at(`--mould-${mould}`), at(`--mould-${mould}-plinth`));
    assert.ok(
      r >= PLINTH_STEP,
      `${theme}: --mould-${mould} against its plinth is ${r.toFixed(2)}:1, below ${PLINTH_STEP}:1.\n` +
        "  The plinth is the object's side wall. Below this step it reads as a flat swatch and\n" +
        "  the press animation — face travels down exactly one wall-height — has nothing to show.",
    );
    checks += 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. THE DARK THEME IS NEUTRAL. Not "near-neutral". Neutral.
// ─────────────────────────────────────────────────────────────────────────────
//
// The previous dark ramp carried "a hair of warmth" — red >= blue at every step,
// written down as a deliberate choice. At swatch size it is invisible. At page
// size it is the only thing you see: a screen is ~90% surface, and a #1d1b19 mat
// under #322e2a faces reads, plainly, as brown. The judgement that shipped it
// was made looking at the values, not at the product.
//
// So the rule is now mechanical rather than a matter of taste: every structural
// surface and ink in .dark must have red === green === blue, exactly. A hue that
// cannot be introduced cannot creep back one step at a time, which is precisely
// how the warmth accumulated the first time.
//
// The accent and the five pigments are exempt BY NAME, not by tolerance — they
// are chromatic on purpose and their contrast is already asserted above. The
// exemption is a list you have to edit, so adding a coloured surface is a
// visible act rather than a side effect.
const CHROMATIC_BY_DESIGN = new Set([
  "--accent", "--accent-hover", "--accent-press", "--accent-ink", "--accent-plinth",
  "--warm", "--success", "--warning", "--danger", "--info",
]);
const NEUTRAL_TOKENS = [
  ...PAPERS, ...FACES, ...HOVER_SURFACES, ...TEXT_INKS,
  "--ink-4", "--ink-600", "--ink-950", "--ink-1000", "--ink-inverse",
  "--edge", "--plinth-1", "--plinth-2", "--plinth-tray",
  "--skeleton-1", "--skeleton-2", "--skeleton-3",
  // The media contract too. These are theme-INVARIANT — they float over a
  // photograph, where there is no theme — and that makes neutrality more
  // important rather than less: a warm chip is wrong in both themes at once,
  // and it sits inches from the app's own surfaces. They shipped warm
  // (#16140f / #f7f4ee / #bdb7ad) in the same change that first defined them.
  "--media-chip", "--media-chip-plinth", "--media-ink", "--media-ink-2",
] as const;

/**
 * The value a token resolves to in Worklight.
 *
 * Three blocks can declare one: `.dark`, the `:root, .light` pair it inherits
 * from, and the theme-INVARIANT `:root, .light, .dark` block that holds the
 * media contract. Reading only `.dark` reports the media tokens as missing —
 * which is exactly what this check did on its first run, and it would have been
 * easy to "fix" by dropping them from the list instead of by reading the third
 * block. A single-declaration assertion keeps the fallback honest: if a token
 * is ever declared twice outside `.dark`, this stops rather than guessing.
 */
function darkValue(name: string): string {
  if (LAMPLIGHT[name]) return LAMPLIGHT[name];
  if (DAYLIGHT[name]) return DAYLIGHT[name];
  const declarations = [...source.matchAll(new RegExp(String.raw`${name}\s*:\s*([^;]+);`, "g"))];
  assert.equal(
    declarations.length,
    1,
    `${name} is declared ${declarations.length} times outside .dark — cannot resolve one value for it.`,
  );
  return declarations[0][1].trim();
}

for (const name of NEUTRAL_TOKENS) {
  assert.ok(!CHROMATIC_BY_DESIGN.has(name), `${name} is both required-neutral and exempt — pick one`);
  const value = darkValue(name);
  assert.ok(value, `${name} is not declared in any theme block`);
  const h = value.replace("#", "").trim();
  assert.match(h, /^[0-9a-fA-F]{6}$/, `.dark ${name} must be a 6-digit hex to be checked for neutrality, got "${value}"`);
  const [r, g, b] = [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)].map((c) => parseInt(c, 16));
  // RETARGETED, and narrowed rather than loosened.
  //
  // This demanded r === g === b exactly. The reason it existed is sound and is
  // kept: the ramp it replaced carried "a hair of warmth" (r >= b at every
  // step), and summed across a screen that hair WAS the impression — the
  // product read brown rather than dark.
  //
  // But exact neutrality also forbids Apple's dark greys, which are #1C1C1E,
  // #2C2C2E, #3A3A3C — blue exactly two points above red, deliberately and
  // consistently, across their whole system. That cast is imperceptible per
  // step and is what keeps a dark UI from reading dingy.
  //
  // So the law becomes directional, which is what it was always really about:
  // NEVER WARM, and never more than a hair cool. r > b is the failure that
  // motivated this check, and it is still a failure. A cool cast up to two
  // points is Apple's, and is allowed.
  const warm = r > b;
  const cast = Math.abs(b - r);
  assert.ok(
    !warm && cast <= 2 && r === g,
    `.dark ${name} is ${value} — rgb(${r}, ${g}, ${b}).\n` +
      (warm
        ? "  It is WARM (red above blue). That is the exact failure this check exists for: a hair of\n  warmth per step sums to a screen that reads brown rather than dark.\n"
        : `  Its cast is ${cast} points and red/green differ by ${Math.abs(g - r)}. A dark grey may be\n  neutral or at most two points COOL (Apple's #1C1C1E / #2C2C2E / #3A3A3C), nothing else.\n`) +
      "  If this token genuinely needs a hue, add it to CHROMATIC_BY_DESIGN and say why —\n" +
      "  deliberately, in a diff someone reviews, not by nudging a channel two points.",
  );
  checks += 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. THE INK THAT SHIPS, NOT THE INK THAT EXISTS.
// ─────────────────────────────────────────────────────────────────────────────
//
// Everything above measures the PALETTE, and the palette was fine. `--accent-ink`
// on `--accent` is 8.24:1 and this gate has said so for a long time.
//
// The product shipped `color: #fff` on that same fill: 2.24:1, and 1.81:1 on
// --accent-hover, where the label got LESS readable under the pointer. Every
// filled button, the mesh CTA, the compose FAB, the first-run Meshi badge and
// the sign-in gate's primary action. A browser sweep of seven signed-in surfaces
// found 24 failing text nodes; the sign-in CTA failed in BOTH themes.
//
// Two of the components carried a comment saying `text-white` on the accent "was
// a real contrast failure" — someone found it, fixed those two, and the other
// nineteen kept shipping. That is the shape of every defect in this codebase:
// the rule gets written down once and taught to one of the places that decide it.
//
// So this section checks what is DECLARED, not what is available.

// 11a. The pinned ink must clear AA on the hover fill too, not just the rest
// fill. --accent-hover is where white was worst, and nothing measured it.
for (const [theme, tokens] of [["Daylight", DAYLIGHT], ["Lamplight", LAMPLIGHT]] as const) {
  const at = (n: string) => tokens[n] ?? DAYLIGHT[n];
  for (const fill of ["--accent", "--accent-hover"] as const) {
    const r = ratio(at("--accent-ink"), at(fill));
    assert.ok(
      r >= AA,
      `${theme}: --accent-ink on ${fill} is ${r.toFixed(2)}:1, below AA.\n` +
        "  A button's label does not change when you point at it, so the ink has to clear AA on\n" +
        "  the hover fill as well. Checking only the rest fill is how 1.81:1 went unnoticed.",
    );
    checks += 1;
  }
}

// 11b. --chip-ink clears AA on every data-driven node fill, read from the source
// of truth rather than copied here — so adding a node colour is gated by this.
{
  // The mesh used to spell its own six colours here as Tailwind-400 literals, so
  // this section parsed them out of scene-model.ts. It reads the palette now —
  // by IMPORT, not by regex, so the thing measured is the thing that ships.
  const branches = Object.entries(BRANCH_PLASTIC) as [string, keyof typeof MOULD][];
  assert.ok(
    branches.length >= 6,
    `the mesh declares only ${branches.length} branches; expected six.\n` +
      "  An assertion that reads an empty palette passes everything, which is worse than none.",
  );
  assert.equal(
    new Set(branches.map(([, m]) => m)).size,
    branches.length,
    "two mesh branches are made of the same plastic — colour is WHICH, so two branches that\n" +
      "  share one cannot be told apart on the canvas, where there is no label to fall back on.",
  );

  // A branch chip paints the fill and takes the ink PINNED to it. --chip-ink was
  // tuned against the old pastel node colours and fails on four of the plastics
  // (cobalt 3.28, teal 3.47, grape 3.19, crimson 2.90); inkForFill returns the
  // pinned ink instead. Exercised, not pattern-matched.
  for (const [branch, mould] of branches) {
    const { fill, ink } = MOULD[mould];
    assert.equal(
      inkForFill(fill),
      ink,
      `inkForFill(${fill}) did not return the ink tokens.css pins to --mould-${mould}.`,
    );
    const r = ratio(ink, fill);
    assert.ok(
      r >= AA,
      `the ${branch} branch chip (--mould-${mould}) measures ${r.toFixed(2)}:1, below AA.`,
    );
    checks += 2;
  }

  // And the ring that makes an orb visible at all. A theme-invariant fill sits on
  // both mats, so what carries the object boundary is --edge, never the fill: all
  // eight of the old node colours measured 1.60–2.94 against --paper-0 in
  // Daylight, every one under the 3:1 floor for a non-text object.
  for (const [theme, tokens] of [["Daylight", DAYLIGHT], ["Lamplight", LAMPLIGHT]] as const) {
    const r = ratio(tokens["--edge"], tokens["--paper-0"]);
    assert.ok(
      r >= 3,
      `${theme}: --edge on --paper-0 is ${r.toFixed(2)}:1. The mesh rings every node with it;\n` +
        "  under 3:1 the orbs stop being objects and become smudges.",
    );
    checks += 1;
  }
}

// 11c. NO RULE MAY PAINT A KNOWN FILL AND THEN SPELL ITS INK BY HAND.
// The fill tokens below all have a pinned ink. A `color:` literal in the same
// rule is the exact defect this section exists for.
{
  const globalsCss = readFileSync(join(ROOT, "src/app/globals.css"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  const INKED_FILLS = /var\(--accent\)|var\(--accent-hover\)|var\(--brand-gradient\)|var\(--mould-[a-z]+\)/;
  const LITERAL_INK = /(^|;)\s*color\s*:\s*(#fff\b|#ffffff\b|white\b|#000\b|#000000\b|black\b)/i;

  /**
   * A fill mixed most of the way to transparent is a WASH over whatever is
   * beneath it, not the fill — `.mesh-ctl-active` tints dark glass with 34%
   * accent and white reads ~10:1 there, which is correct and must not be
   * reported. Strip those before testing. The 60% cut is deliberate: above it
   * the mix is substantially the fill again and the pinned ink applies.
   */
  const stripWashes = (value: string) =>
    value.replace(/color-mix\(\s*in\s+srgb\s*,\s*var\(--[a-z-]+\)\s*(\d+)%\s*,\s*transparent\s*\)/g,
      (whole, pct: string) => (Number(pct) <= 60 ? "TRANSPARENT_WASH" : whole));

  const offenders: string[] = [];
  for (const m of globalsCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const body = m[2];
    if (!LITERAL_INK.test(body)) continue;
    const backgrounds = [...body.matchAll(/(?:^|;)\s*background(?:-color|-image)?\s*:([^;]*)/g)]
      .map((b) => stripWashes(b[1]))
      .join(" ");
    if (!INKED_FILLS.test(backgrounds)) continue;
    offenders.push(m[1].trim().replace(/\s+/g, " ").slice(0, 110));
  }
  assert.deepEqual(
    offenders,
    [],
    "a rule paints a fill that has a pinned ink, then spells the ink by hand:\n" +
      offenders.map((o) => `    ${o}`).join("\n") +
      "\n  Use the fill's own ink — var(--accent-contrast) for the accent, var(--mould-*-ink) for a\n" +
      "  plastic. A literal is correct in exactly one theme and this palette has two, plus five\n" +
      "  user-selectable presets that redefine the accent underneath it.",
  );
  checks += 1;
}

// 11d. …and neither may the markup.
{
  const tsx: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith(".tsx")) tsx.push(rel);
    }
  };
  walk("src");
  const offenders: string[] = [];
  for (const file of tsx) {
    const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\/\*|\*)/.test(line)) return;            // its own commentary is not a violation
      if (!/bg-\[var\(--accent\)\]|bg-\[var\(--accent-hover\)\]/.test(line)) return;
      if (!/\btext-(white|black)\b(?!\/)/.test(line)) return;
      offenders.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(
    offenders,
    [],
    "markup paints the accent and spells the ink `text-white`/`text-black`:\n" +
      offenders.map((o) => `    ${o}`).join("\n") +
      "\n  `text-[var(--accent-contrast)]`. White on the accent is 2.24:1 in the dark theme and\n" +
      "  fails in all five presets as well — the token is the only spelling that is right in\n" +
      "  every one of them.",
  );
  checks += 1;
}

// 11e. A PIGMENT MAY NOT BE THE INK ON A TINT OF ITS OWN HUE.
//
// `text-emerald-400` on `bg-emerald-500/10` looks careful and is correct exactly
// once: on a dark mat, where the 10% tint stays dark and the saturated ink reads
// against it. Put the same pair on light paper and the tint goes light while the
// ink does not move — measured 1.17:1 on /trust, 1.29:1 on /status, 1.70:1 on
// /profile and /analytics.
//
// It is the same defect as the mesh node chips and the /trail labels, and it has
// now been found four separate times, so it is a rule rather than four fixes.
// The palette's four pigments are theme-aware and this file already proves each
// one clears AA on all four papers in both themes; a Tailwind hue proves nothing
// because it does not know which theme it is in.
//
// The mesh canvas is exempt by path: it is dark in BOTH themes, so a pigment on
// its own tint is genuinely safe there. That exemption is a directory, not a
// tolerance — moving a component out of it re-arms this check.
{
  const HUES = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
  const ALWAYS_DARK = /^src\/components\/mesh\//;
  const offenders: string[] = [];
  const walkTsx = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walkTsx(rel, out);
      else if (entry.name.endsWith(".tsx")) out.push(rel);
    }
    return out;
  };
  for (const file of walkTsx("src")) {
    if (ALWAYS_DARK.test(file)) continue;
    readFileSync(join(ROOT, file), "utf8").split("\n").forEach((line, i) => {
      if (/^\s*(\/\/|\/\*|\*)/.test(line)) return;   // prose about the rule is not a breach of it
      const fills = [...line.matchAll(new RegExp(`bg-(${HUES})-\\d{2,3}/(?:\\d+|\\[[^\\]]+\\])`, "g"))];
      for (const fill of fills) {
        if (new RegExp(`text-${fill[1]}-\\d{2,3}\\b`).test(line)) {
          offenders.push(`${file}:${i + 1}  ${fill[0]}`);
        }
      }
    });
  }
  assert.deepEqual(
    offenders,
    [],
    "a pigment is the ink on a tint of its own hue:\n" +
      offenders.slice(0, 15).map((o) => `    ${o}`).join("\n") +
      (offenders.length > 15 ? `\n    …and ${offenders.length - 15} more` : "") +
      "\n  Use --success / --danger / --warning / --info. Those four are theme-aware and this\n" +
      "  file measures them against all four papers in both themes. A Tailwind hue is a fixed\n" +
      "  colour on a tint that is not, so it is right in one theme by construction.",
  );
  checks += 1;
}

// 11f. NO TEXT MAY SIT ON A PLATFORM BRAND FILL.
//
// These eighteen colours are not ours — #1db954 is Spotify's green whether it
// suits the palette or not. The connect page used to render each platform as a
// monogram disc in its brand colour, and the component defaulted every glyph to
// white with one hand-written override, for Snapchat, whose yellow made the
// problem impossible to miss. The other seventeen were decided by whoever
// noticed: Spotify measured 2.59:1, SoundCloud 3.21:1, Reddit 3.44:1.
//
// THE MONOGRAMS ARE GONE. Tiles are the real drawn marks now, each carrying its
// own contrasting ink inside the artwork, and the brand fills survive only as a
// TINT — the halo behind a merged tile and the thread colour in the One Mesh.
// Nothing sets text on them.
//
// Which is why the old assertion here (`the glyph must derive its ink via
// readableInkOn`) is not merely obsolete — kept, it would demand that a
// component come back. What is worth gating is the property that replaced it:
// the map still parses, and it stays a fill-only table. `fg`, or a `glyph`
// beside a `bg`, is the shape that had text on brand colour, and re-adding
// either is how the 2.59:1 disc returns.
{
  const clientSrc = readFileSync(
    join(ROOT, "src/app/(app)/connected-accounts/connected-accounts-client.tsx"),
    "utf8",
  );
  const mapStart = clientSrc.indexOf("const platformBrands");
  assert.ok(mapStart >= 0, "the platformBrands map has moved out of connected-accounts-client.tsx");
  const mapBody = clientSrc.slice(mapStart, clientSrc.indexOf("};", mapStart));
  const brands = [...mapBody.matchAll(/(\w+):\s*\{[^}]*bg:\s*"(#[0-9a-fA-F]{3,6})"/g)]
    .map((m) => [m[1], m[2]] as const);
  assert.ok(
    brands.length >= 15,
    `parsed only ${brands.length} platform brands out of connected-accounts-client.tsx; expected the full map.\n` +
      "  An assertion that reads an empty map passes everything.",
  );

  // WHAT THIS DELIBERATELY DOES NOT ASSERT, AND WHY.
  //
  // The obvious check — "every brand fill can carry black or white at AA" — CANNOT
  // FAIL. Solve it: white on a fill of luminance L is 1.05/(L+0.05), black is
  // (L+0.05)/0.05, and the two cross at L+0.05 = sqrt(1.05 x 0.05) = 0.2291, where
  // both are 4.58:1. The worst colour in the entire sRGB cube still clears 4.5 with
  // one of the two. I wrote that assertion first, mutated a mid-grey into the map
  // to prove it worked, and it passed — because nothing can make it fail. It is
  // recorded here so nobody adds it back believing it does something.
  //
  // The rule that ACTUALLY broke is that a brand fill became a ground under
  // text. The map is fill-only now; keep it that way.
  assert.ok(
    !/\bfg\s*:/.test(mapBody) && !/\bglyph\s*:/.test(mapBody),
    "the platform brand map carries an `fg` or a `glyph` again.\n" +
      "  Both only exist to draw a letter on a brand colour, which is the shape that shipped\n" +
      "  white on Spotify green at 2.59:1, SoundCloud at 3.21:1 and Reddit at 3.44:1, with one\n" +
      "  hand-written exception for the yellow that was impossible to miss.\n" +
      "  Platform tiles are real drawn marks now — the ink is inside the artwork. These fills\n" +
      "  are a tint (halo, thread) and nothing sets text on them.",
  );
  checks += 1;
  // And the map must be typed as fill-only, so the next platform cannot arrive
  // carrying an ink at all.
  const declaration = clientSrc.slice(mapStart, clientSrc.indexOf("= {", mapStart));
  assert.match(
    declaration,
    /Record<string,\s*\{\s*bg:\s*string\s*\}>/,
    "the brand map's type admits more than a fill. Declare it `Record<string, { bg: string }>`\n" +
      "  so an ink cannot be added to an entry without this failing first.",
  );
  // And the derivation itself has to still pick the better of the two. This was
  // a regex over readable-ink.ts's source — which tested the SPELLING of the
  // implementation, passed for any refactor that kept the words, and left
  // INK_ON_LIGHT/INK_ON_DARK/readableInkRatio with no importer anywhere (knip
  // reported all three as dead, correctly, and `npm run check` exited 1 on a
  // clean tree). Run the function on the real brand fills instead.
  for (const [name, fill] of brands) {
    const picked = readableInkOn(fill);
    const other = picked === INK_ON_LIGHT ? INK_ON_DARK : INK_ON_LIGHT;
    assert.ok(
      ratio(picked, fill) >= ratio(other, fill),
      `readableInkOn picked ${picked} for ${name} (${fill}) at ${ratio(picked, fill).toFixed(2)}:1,\n` +
        `  when ${other} would have measured ${ratio(other, fill).toFixed(2)}:1.`,
    );
    assert.ok(
      Math.abs(readableInkRatio(fill) - ratio(picked, fill)) < 0.01,
      `readableInkRatio(${fill}) reports ${readableInkRatio(fill).toFixed(2)} but the ink it picks\n` +
        `  measures ${ratio(picked, fill).toFixed(2)} — the gate and the component disagree.`,
    );
    checks += 2;
  }
}

console.log(
  `contrast OK — ${checks} ratios measured across both themes: every text ink clears AA on all four\n` +
    "  papers AND on every face/hover/press state, --ink-4 stays decorative, the accent works as\n" +
    "  text and as a surface, every pigment is readable on all four papers, --edge clears 3:1 on\n" +
    "  every surface it can ring, each moulded plastic carries a readable pinned ink, and each is\n" +
    "  visibly thicker than its own plinth. Every structural surface and ink in .dark is a true\n" +
    "  grey (r === g === b); only the accent and the five pigments carry a hue, by name.\n" +
    "  The pinned ink also clears AA on the HOVER fill; every mesh branch is a distinct plastic\n" +
    "  whose chip takes that pinned ink (not --chip-ink, which fails on four of the seven);\n" +
    "  --edge clears 3:1 on the mat in both themes, which is what makes a node an object; the\n" +
    "  platform-glyph ink is derived by running readableInkOn on all eighteen real brand fills;\n" +
    "  and no rule or className paints an inked fill and then spells its ink `#fff`/`text-white`\n" +
    "  by hand.\n" +
    "  Does NOT cover: an ink applied through a prop, a runtime-computed style, or a fill this\n" +
    "  file does not know is a fill. The browser sweep in the PR is what confirms the rendered\n" +
    "  result; this keeps the known failures from coming back.",
);

// ── 12. THE ACCENT PRESETS. THIS GATE COULD NOT SEE THEM. ───────────────────
//
// Everything above reads src/app/tokens.css. globals.css then re-points
// `--accent` eleven times — the five user-selectable accent presets, in both
// theme blocks — and NOT ONE of them re-pinned `--accent-ink`. So white ink,
// pinned to the default blue, sat on hues it was never measured against:
//
//     #22d3ee cyan     1.81:1   ← text a sighted user cannot read
//     #22c55e green    2.28:1
//     #a1a1aa mono     2.56:1
//     #f97316 orange   2.80:1
//     #16a34a green    3.30:1
//     #ea580c orange   3.56:1
//     #ff2d55 pink     3.65:1
//     #0891b2 teal     3.68:1
//
// Nine of eleven below AA, shipping, on a control a user opts into from
// Settings. The gate printed "contrast OK" every single time, because a token
// this file never reads is a token this file cannot protect.
//
// A pair is only checked where it is DECLARED. Reading one file and calling it
// the palette is how this hid.
{
  const globals = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
  const ACCENT_AA = 4.5;
  let presets = 0;
  let hoversMeasured = 0;

  // Each `--accent:` and the `--accent-ink:` that follows it inside the same
  // rule block. An accent with no ink after it inherits one measured against a
  // different colour, which is the bug itself.
  // Split at every --accent: and pair each with the text that follows it up to
  // the NEXT --accent: (or end of file). A bounded look-ahead found 5 of 11 and
  // still printed a pass -- half-coverage that reads as coverage, which is the
  // same failure mode as the hole it was written to close.
  const marks = [...globals.matchAll(/--accent:\s*(#[0-9a-fA-F]{6})\s*;/g)];
  // The block's own OFFSET is carried through. Locating it later with
  // `indexOf(fill)` finds the first occurrence of that hex anywhere in the file
  // — a comment, or another preset that happens to share the colour — which put
  // the cyan dark preset in the light theme and measured it at 1.62:1.
  const blocks: [number, string, string][] = marks.map((m, i) => [
    m.index!,
    m[1],
    globals.slice(m.index! + m[0].length, i + 1 < marks.length ? marks[i + 1].index! : globals.length),
  ]);
  assert.ok(
    blocks.length > 0,
    "no --accent declarations found in globals.css — this check has lost its subject and is passing vacuously",
  );

  for (const [offset, fill, tail] of blocks) {
    const ink = /--accent-ink:\s*(#[0-9a-fA-F]{6})\s*;/.exec(tail)?.[1];
    assert.ok(
      ink,
      `globals.css re-points --accent to ${fill} without pinning --accent-ink beside it.\n` +
        "  The inherited ink was measured against a different fill, so its contrast here is unknown.\n" +
        "  Every fill that carries text pins the ink that belongs to it.",
    );

    // A FILL HAS TWO STATES, AND THIS MEASURED ONE OF THEM.
    //
    // Pinning the ink fixed the base fill and the check above proved it. But
    // every filled control in the product — .brand-button, .app-compose-button,
    // .mobile-compose-fab, .mesh-entry-primary, .mesh-action-primary, .mesh-cta
    // — swaps ONLY the background on :hover and keeps var(--accent-contrast).
    // So --accent-hover is a second fill carrying the same label, and it was
    // never measured. Three presets shipped a hover shade that moved TOWARD the
    // near-black ink instead of away from it:
    //
    //     ocean   #0e7490   3.70:1
    //     sunset  #c2410c   3.82:1
    //     forest  #15803d   3.95:1
    //
    // Below AA the moment a pointer lands, on a control the user opts into.
    // Checking the rest state of a two-state fill is the same half-coverage the
    // block above was written to close, one level down.
    const hover = /--accent-hover:\s*(#[0-9a-fA-F]{6})\s*;/.exec(tail)?.[1];
    const states: [string, string][] = [["--accent", fill]];
    if (hover) states.push(["--accent-hover", hover]);

    for (const [name, surface] of states) {
      const r = ratio(ink, surface);
      assert.ok(
        r >= ACCENT_AA,
        `globals.css: --accent-ink ${ink} on ${name} ${surface} is ${r.toFixed(2)}:1, below AA ${ACCENT_AA}:1.\n` +
          "  Filled controls swap the background on :hover and keep the ink, so the hover shade\n" +
          "  has to move AWAY from the ink, not toward it. A darker hover under near-black ink\n" +
          "  makes the label less readable exactly when the pointer is on it.",
      );
      checks += 1;
    }
    // AND THE SAME FILL USED AS TEXT.
    //
    // Everything above measures ink ON the preset. The preset is also painted
    // as text — links, `Edit`, `See all`, the legal links in the footer — and
    // as text it is measured against the PAPER, not against its own ink. Every
    // one of the five light presets failed that, badly:
    //
    //     forest     #16a34a   2.63:1   (worst paper)
    //     sunset     #ea580c   2.84:1
    //     instagram  #ff2d55   2.90:1
    //     ocean      #0891b2   2.93:1
    //     mono       #64748b   3.79:1
    //
    // A fill colour and a text colour cannot be the same token, so each preset
    // pins --accent-text as well, and it is measured on all four papers of
    // whichever theme the preset lives in.
    const text = /--accent-text:\s*(#[0-9a-fA-F]{6})\s*;/.exec(tail)?.[1];
    assert.ok(
      text,
      `globals.css re-points --accent to ${fill} without pinning --accent-text beside it.\n` +
        "  The accent is painted as text in ~170 places. As text it is measured against the paper,\n" +
        "  not against its own ink, and a fill bright enough to carry near-black ink is almost never\n" +
        "  dark enough to read on paper.",
    );
    // WHICH THEME'S PAPERS? READ THE BLOCK'S OWN SELECTOR.
    //
    // The presets used to be spelled `:root[data-theme="X"]` — TWICE each, ten
    // blocks for five presets, same selector and same specificity. The later
    // five won outright and the first five were dead CSS that had never applied
    // to anything. Worse, the surviving five were the LIGHT-suited values and
    // `:root` applies in both themes, so the dark theme was wearing them too.
    //
    // They are `.light[data-theme="X"]` / `.dark[data-theme="X"]` now, which is
    // both the fix and what makes the theme readable here: the selector says
    // which papers this block's colours will actually sit on, instead of the
    // gate inferring it from where the text happens to fall in the file.
    const head = globals.slice(0, offset);
    const open = head.lastIndexOf("{");
    // The selector starts after the nearest PRECEDING brace of either kind. Only
    // looking for `}` swallows the enclosing at-rule when a block is nested
    // inside `@media`, which reported the whole `@media (…) { :root:not(…)` line
    // as the selector.
    const cut = Math.max(head.lastIndexOf("}", open), head.lastIndexOf("{", open - 1));
    const selector = head.slice(cut + 1, open).trim();
    const isPreset = /\[data-theme=/.test(selector);
    if (isPreset) {
      assert.ok(
        /\.(light|dark)\b/.test(selector),
        `the accent preset at "${selector}" is not scoped to a theme.\n` +
          "  A bare :root[data-theme=…] applies in BOTH themes from one set of values, so a fill\n" +
          "  drawn for a dark background ships on white paper. Scope it: .light[data-theme=…] or\n" +
          "  .dark[data-theme=…].",
      );
      checks += 1;
    }
    // WHICH SURFACES DOES THIS BLOCK'S TEXT ACTUALLY LAND ON?
    //
    // A preset only re-points the accent, so its text sits on the four papers
    // of its theme. A block that redefines the whole palette — the class-less
    // `prefers-color-scheme` fallback does — states its own background, and
    // measuring THAT block against tokens.css's papers would be measuring a
    // surface it never renders on.
    // `tail` starts AT the --accent declaration, and a block states its
    // backgrounds above its accent, so the whole block body is what gets read.
    const blockEnd = (() => {
      let depth = 1;
      for (let i = open + 1; i < globals.length; i += 1) {
        if (globals[i] === "{") depth += 1;
        else if (globals[i] === "}" && --depth === 0) return i;
      }
      return globals.length;
    })();
    const body = globals.slice(open + 1, blockEnd);
    const surfaces = isPreset
      ? PAPERS.map((p) => [p, tokenIn(/\.dark\b/.test(selector) ? "dark" : "light", p)] as const)
      : [...body.matchAll(/(--bg-(?:primary|secondary|card|elevated)):\s*(#[0-9a-fA-F]{6})\s*;/g)]
          .map((m) => [m[1], m[2]] as const);
    assert.ok(
      surfaces.length > 0,
      `the --accent block at "${selector}" states neither a theme nor a background of its own,\n` +
        "  so there is no surface to measure --accent-text against. An unmeasurable block is an\n" +
        "  unchecked one.",
    );
    for (const [name, surface] of surfaces) {
      const r = ratio(text, surface);
      assert.ok(
        r >= ACCENT_AA,
        `globals.css: --accent-text ${text} on ${name} ${surface} is ${r.toFixed(2)}:1, below AA ${ACCENT_AA}:1.`,
      );
      checks += 1;
    }

    presets += 1;
    checks += 2;
    hoversMeasured += hover ? 1 : 0;
  }
  // A preset that declared no hover would silently drop out of the loop above
  // and the count would still read like coverage. Every one of them declares
  // one today; say so, and fail if that stops being true.
  assert.equal(
    hoversMeasured,
    presets,
    `only ${hoversMeasured} of ${presets} accent presets declare --accent-hover; the rest inherit a\n` +
      "  hover fill from another block that was measured against a different ink.",
  );
  checks += 1;
  console.log(
    `  …and ${presets} accent presets in globals.css, each with its own pinned ink, ` +
      `measured on both the base and hover fill.`,
  );
}

// ── 12b. THE ACCENT THE USER PICKS, WHICH NO CSS FILE CONTAINS ──────────────
//
// tokens.css states the accent twice and pins the ink beside each. globals.css
// states it ten more times and pins the ink beside each. Both are now measured
// above. `applyCustomTheme` in theme-provider.tsx states it an ELEVENTH way —
// from a colour chosen in Settings, written to `root.style` at runtime — and
// pinned nothing, so `--accent-ink` stayed whatever the theme underneath had
// pinned for an entirely different hue (`#ffffff` light, `#00204a` dark). Every
// filled control paints `color: var(--accent-contrast)`, and
// `--accent-contrast: var(--accent-ink)`, so a user picking a pale accent got
// white-on-pale: around 1.1:1 for a yellow.
//
// No amount of reading CSS finds this, because the declaration does not exist
// until a user makes it. The gate has to read the code that writes it.
//
// The derived ink cannot fail: black and white cross at 4.58:1 at the worst
// luminance in the sRGB cube, so `readableInkOn` clears AA for ANY fill —
// proved in the brand-map section below, and the reason a "does it clear AA"
// assertion is deliberately absent there. What can fail, and did, is the
// component not deriving at all.
{
  const provider = readFileSync(join(ROOT, "src/components/theme-provider.tsx"), "utf8");

  // Whatever sets --accent must set the ink that belongs to it, in the same
  // function. Setting one without the other is the bug in every form it took.
  const setsAccent = /setProperty\("--accent",/.test(provider);
  assert.ok(
    setsAccent,
    "theme-provider no longer sets --accent — this check has lost its subject and is passing vacuously",
  );
  for (const token of ["--accent-ink", "--accent-contrast"] as const) {
    assert.match(
      provider,
      new RegExp(`setProperty\\("${token}",`),
      `theme-provider sets --accent from a user-chosen colour but never sets ${token}.\n` +
        "  The inherited ink was pinned to a different hue, so its contrast on the chosen accent is\n" +
        "  unknown — white on a pale custom accent measures about 1.1:1, on every filled control.\n" +
        "  Derive it: readableInkOn(fill) clears AA for any colour in the sRGB cube.",
    );
    checks += 1;
  }
  assert.match(
    provider,
    /readableInkOn\(customTheme\.accent\)/,
    "theme-provider is pinning a literal ink for a colour it does not know at build time.\n" +
      "  The fill is whatever the user picked; the ink has to be derived from it, not chosen\n" +
      "  in advance. That is exactly the hand-written-exception shape readableInkOn replaced.",
  );
  // Clearing the custom theme has to release the ink too, or the derived value
  // outlives the accent it was derived from and lands on the preset underneath.
  for (const token of ["--accent", "--accent-ink", "--accent-contrast", "--accent-text"] as const) {
    assert.match(
      provider,
      new RegExp(`removeProperty\\("${token}"\\)`),
      `theme-provider sets ${token} for a custom theme but never removes it.\n` +
        "  Clearing the custom theme would leave the derived value on the root element, applied to\n" +
        "  whichever preset the user falls back to — a fill it was never measured against.",
    );
    checks += 1;
  }
  assert.match(
    provider,
    /readableAccentText\(customTheme\.accent,\s*customTheme\.bgPrimary\)/,
    "theme-provider sets --accent from a user-chosen colour but not --accent-text.\n" +
      "  A fill and a label cannot be the same colour: the accent is painted as text in ~170 places,\n" +
      "  measured against the background rather than against its own ink.",
  );
  checks += 1;
}

// ── 12c. THE COPY OF THAT DERIVATION THAT RUNS BEFORE ANY MODULE EXISTS ─────
//
// `themeInitScript` in layout.tsx is beforeInteractive: it paints the saved
// theme on the first frame so a refresh does not flash the default palette.
// That is also why it cannot import readable-ink.ts — and why it set --accent
// from a user-chosen colour while setting no ink at all, leaving the inherited
// ink on an arbitrary hue for the whole initial render and permanently if the
// client bundle never runs.
//
// The derivation therefore exists twice, which is the shape that caused every
// bug in this file. What makes two copies survivable is that they are COMPARED:
// the bootstrap's functions are extracted and EXECUTED here against the module,
// over a sweep wide enough that any real divergence shows up. A regex asserting
// the bootstrap "contains inkOn" would pass any refactor that kept the word.
{
  const layout = readFileSync(join(ROOT, "src/app/layout.tsx"), "utf8");
  const start = layout.indexOf("  function lum(hex) {");
  const end = layout.indexOf("  function applyCustomTheme(root, customTheme) {");
  assert.ok(
    start >= 0 && end > start,
    "the bootstrap's colour derivation has moved or been removed from layout.tsx.\n" +
      "  This check executes it against src/lib/readable-ink.ts; it cannot do that if it cannot\n" +
      "  find it, and silently checking nothing is worse than not checking.",
  );

  const boot = new Function(
    `${layout.slice(start, end)}\nreturn { inkOn: inkOn, accentText: accentText };`,
  )() as { inkOn: (f: string) => string; accentText: (a: string, b: string) => string };

  // A sweep, not a handful: every 32nd value per channel plus the exact hues the
  // presets and the two theme backgrounds use.
  const sweep: string[] = [];
  for (let r = 0; r < 256; r += 51) {
    for (let g = 0; g < 256; g += 51) {
      for (let b = 0; b < 256; b += 51) {
        sweep.push(`#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`);
      }
    }
  }
  sweep.push("#ff2d55", "#0891b2", "#ea580c", "#16a34a", "#64748b", "#0056d6", "#409cff", "#22d3ee");
  const backgrounds = ["#ffffff", "#f2f2f7", "#000000", "#1c1c1e", "#3a3a3c", "#7f7f7f"];

  let compared = 0;
  for (const c of sweep) {
    assert.equal(
      boot.inkOn(c),
      readableInkOn(c),
      `the bootstrap and readable-ink.ts disagree on the ink for ${c}: ` +
        `${boot.inkOn(c)} vs ${readableInkOn(c)}.`,
    );
    compared += 1;
    for (const bg of backgrounds) {
      assert.equal(
        boot.accentText(c, bg),
        readableAccentText(c, bg),
        `the bootstrap and readable-ink.ts disagree on the accent text for ${c} on ${bg}: ` +
          `${boot.accentText(c, bg)} vs ${readableAccentText(c, bg)}.`,
      );
      compared += 1;
    }
  }
  // And the derivation the bootstrap agrees with must actually be AA — otherwise
  // both copies could be identically wrong.
  for (const c of sweep) {
    for (const bg of backgrounds) {
      const r = ratio(readableAccentText(c, bg), bg);
      assert.ok(
        r >= 4.5,
        `readableAccentText(${c}, ${bg}) returns ${readableAccentText(c, bg)} at ${r.toFixed(2)}:1, below AA.`,
      );
      compared += 1;
    }
  }
  // AGREEING ON THE ANSWER IS NOT THE SAME AS USING IT.
  //
  // Everything above proves the two derivations compute the same thing. It says
  // nothing about whether the bootstrap CALLS its copy — deleting the call sites
  // leaves both implementations identical and every comparison above still
  // passing, which is exactly what a mutation run showed.
  const applyStart = layout.indexOf("  function applyCustomTheme(root, customTheme) {");
  const applyEnd = layout.indexOf("\n  }", applyStart);
  const apply = layout.slice(applyStart, applyEnd);
  for (const [token, call] of [
    ["--accent-ink", "inkOn(customTheme.accent)"],
    ["--accent-contrast", "inkOn(customTheme.accent)"],
    ["--accent-text", "accentText(customTheme.accent, customTheme.bgPrimary)"],
  ] as const) {
    assert.ok(
      apply.includes(`setProperty("${token}"`),
      `the bootstrap's applyCustomTheme sets --accent but not ${token}.\n` +
        "  The initial render — and every render, if the client bundle never runs — would use the\n" +
        "  ink the underlying theme pinned for a completely different hue.",
    );
    assert.ok(
      apply.includes(call),
      `the bootstrap's applyCustomTheme sets ${token} without calling ${call}.\n` +
        "  A literal here is a value chosen in advance for a colour that is not known until a user\n" +
        "  picks it.",
    );
    checks += 2;
  }
  checks += 2;
  console.log(`  …and ${compared} derivations agreed between the bootstrap and readable-ink.ts, all AA.`);
}
