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
import { readFileSync } from "node:fs";
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

  // 2. --ink-4 must stay below AA, so "non-text only" is visible in review.
  const inkFour = ratio(at("--ink-4"), at("--paper-0"));
  assert.ok(
    inkFour < AA,
    `${theme}: --ink-4 is ${inkFour.toFixed(2)}:1 on --paper-0, which passes AA.\n` +
      "  --ink-4 is the borders-and-dividers token. If it reads as legible text,\n" +
      "  nothing stops it being used as text. Keep it decorative, or promote it.",
  );
  checks += 1;

  // 3. The accent, both as text and as a surface under text.
  const accentOnPaper = ratio(at("--accent"), at("--paper-0"));
  assert.ok(accentOnPaper >= AA, `${theme}: --accent on --paper-0 is ${accentOnPaper.toFixed(2)}:1`);
  const inkOnAccent = ratio(at("--accent-ink"), at("--accent"));
  assert.ok(inkOnAccent >= AA, `${theme}: --accent-ink on --accent is ${inkOnAccent.toFixed(2)}:1`);
  checks += 2;

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

  // 8a. The RECESS reads as a recess.
  //
  // --plinth-tray is the inner lip of a sunken group, and every input in the
  // product sits in one. It is the one plinth that must INVERT in dark: a dark
  // recess cannot get darker, so its lip goes up instead of down. The original
  // dark value measured 1.05:1 against the well — invisible — which is why this
  // is asserted separately from the moulds rather than assumed to follow.
  const trayStep = ratio(at("--plinth-tray"), at("--paper-2"));
  assert.ok(
    trayStep >= PLINTH_STEP,
    `${theme}: --plinth-tray against --paper-2 is ${trayStep.toFixed(2)}:1, below ${PLINTH_STEP}:1.\n` +
      "  Every input in the product sits in this recess. Below this step it is not a recess, it\n" +
      "  is a flat patch of a slightly different colour. In dark the lip must go UP, not down —\n" +
      "  a dark well has nowhere darker to go.",
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

console.log(
  `contrast OK — ${checks} ratios measured across both themes: every text ink clears AA on all four\n` +
    "  papers AND on every face/hover/press state, --ink-4 stays decorative, the accent works as\n" +
    "  text and as a surface, every pigment is readable on all four papers, --edge clears 3:1 on\n" +
    "  every surface it can ring, each moulded plastic carries a readable pinned ink, and each is\n" +
    "  visibly thicker than its own plinth.\n" +
    "  Does NOT cover: colours hardcoded in components — only the palette itself.",
);
