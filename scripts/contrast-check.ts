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
  assert.ok(
    r === g && g === b,
    `.dark ${name} is ${value} — rgb(${r}, ${g}, ${b}), which carries a hue.\n` +
      "  Every structural surface and ink in the dark theme must be a true grey (r === g === b).\n" +
      "  The previous ramp allowed 'a hair of warmth' at each step; summed across a full screen\n" +
      "  that hair is the entire impression, and the product read as brown rather than as dark.\n" +
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
  const sceneModel = readFileSync(join(ROOT, "src/components/mesh/scene/scene-model.ts"), "utf8");
  const nodeFills = [...new Set([...sceneModel.matchAll(/color:\s*"(#[0-9a-fA-F]{6})"/g)].map((m) => m[1]))];
  assert.ok(
    nodeFills.length >= 6,
    `parsed only ${nodeFills.length} node colours out of scene-model.ts; expected the branch palette.\n` +
      "  An assertion that reads an empty palette passes everything, which is worse than none.",
  );
  const chipInk = (LAMPLIGHT["--chip-ink"] ?? DAYLIGHT["--chip-ink"]);
  assert.ok(chipInk, "--chip-ink is not declared in tokens.css");
  for (const fill of nodeFills) {
    const r = ratio(chipInk, fill);
    assert.ok(
      r >= AA,
      `--chip-ink on the node fill ${fill} is ${r.toFixed(2)}:1, below AA.\n` +
        "  These fills are theme-invariant and saturated. White measured 1.92–3.53 on the eight\n" +
        "  that shipped — it failed on every one. If a new node colour cannot carry --chip-ink,\n" +
        "  the colour is the thing to change.",
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

// 11f. EVERY PLATFORM BRAND FILL CAN CARRY A LEGIBLE GLYPH.
//
// These eighteen colours are not ours — #1db954 is Spotify's green whether it
// suits the palette or not. The component defaulted every glyph to white and
// carried one hand-written override, for Snapchat, whose yellow made the problem
// impossible to miss. The other seventeen were decided by whoever noticed:
// Spotify measured 2.59:1, SoundCloud 3.21:1, Reddit 3.44:1.
//
// `readableInkOn` derives the ink instead of listing exceptions. This reads the
// brand map FROM ITS OWN SOURCE and checks the derived ink on each fill, so
// adding a platform whose colour cannot carry either black or white fails the
// build rather than shipping a glyph nobody can read.
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
  // The rule that ACTUALLY broke is that the component stopped deriving the ink and
  // hardcoded one. That is what this checks.
  const glyphInk = /color:\s*brand\s*\?\s*readableInkOn\(brand\.bg\)/;
  assert.match(
    clientSrc,
    glyphInk,
    "the platform glyph no longer derives its ink from the brand fill.\n" +
      "  It used to read `brand.fg ?? \"#ffffff\"`, with exactly one hand-written override —\n" +
      "  Snapchat, whose yellow made the problem impossible to miss. The other seventeen were\n" +
      "  whatever white happened to give: Spotify 2.59:1, SoundCloud 3.21:1, Reddit 3.44:1.\n" +
      "  Use readableInkOn(fill). A list of exceptions is wrong in the one way that matters —\n" +
      "  the next platform added gets the default, and nobody measures the default.",
  );
  // And the derivation itself has to still pick the better of the two.
  const inkSrc = readFileSync(join(ROOT, "src/lib/readable-ink.ts"), "utf8");
  assert.match(
    inkSrc,
    /onLight\s*>=\s*onDark\s*\?\s*INK_ON_LIGHT\s*:\s*INK_ON_DARK/,
    "readableInkOn no longer returns the higher-contrast of the two inks.",
  );
  checks += brands.length;
}

console.log(
  `contrast OK — ${checks} ratios measured across both themes: every text ink clears AA on all four\n` +
    "  papers AND on every face/hover/press state, --ink-4 stays decorative, the accent works as\n" +
    "  text and as a surface, every pigment is readable on all four papers, --edge clears 3:1 on\n" +
    "  every surface it can ring, each moulded plastic carries a readable pinned ink, and each is\n" +
    "  visibly thicker than its own plinth. Every structural surface and ink in .dark is a true\n" +
    "  grey (r === g === b); only the accent and the five pigments carry a hue, by name.\n" +
    "  The pinned ink also clears AA on the HOVER fill, --chip-ink clears it on every node\n" +
    "  colour in scene-model.ts, and no rule or className paints an inked fill and then spells\n" +
    "  its ink `#fff`/`text-white` by hand.\n" +
    "  Does NOT cover: an ink applied through a prop, a runtime-computed style, or a fill this\n" +
    "  file does not know is a fill. The browser sweep in the PR is what confirms the rendered\n" +
    "  result; this keeps the known failures from coming back.",
);
