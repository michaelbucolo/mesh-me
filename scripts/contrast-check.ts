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
const PAPERS = ["--paper-0", "--paper-1", "--paper-2", "--paper-3"] as const;
const TEXT_INKS = ["--ink-1", "--ink-2", "--ink-3"] as const;
const PIGMENTS = ["--warm", "--success", "--warning", "--danger", "--info"] as const;

let checks = 0;

for (const [theme, tokens] of [["Daylight", DAYLIGHT], ["Lamplight", LAMPLIGHT]] as const) {
  const at = (name: string): string => {
    const value = tokens[name];
    assert.ok(value, `${theme} is missing ${name}`);
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

  // 4. Pigments carry meaning, so they must be readable where they are allowed.
  for (const pigment of PIGMENTS) {
    for (const paper of ["--paper-0", "--paper-1"] as const) {
      const r = ratio(at(pigment), at(paper));
      assert.ok(
        r >= AA,
        `${theme}: ${pigment} on ${paper} is ${r.toFixed(2)}:1, below AA ${AA}:1.\n` +
          "  Pigments mean something — a warning nobody can read is not a warning.",
      );
      checks += 1;
    }
  }
}

console.log(
  `contrast OK — ${checks} ratios measured across both themes: every text ink clears AA on every\n` +
    "  paper, --ink-4 stays decorative, the accent works as text and as a surface, and every\n" +
    "  pigment is readable on --paper-0/1.\n" +
    "  Does NOT cover: colours hardcoded in components — only the palette itself.",
);
