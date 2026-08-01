// TRANSLUCENCY WRITTEN IN A COMPONENT IS STILL TRANSLUCENCY.
//
// scripts/glass-check.ts proves an opacity floor for every material declared in
// tokens.css and globals.css. It reads those two files and nothing else. So a
// surface built out of Tailwind utilities in a .tsx file — `bg-black/70
// backdrop-blur text-white/85` — is a translucent surface that no proof has
// ever looked at, and there are dozens of them.
//
// This was found the way these things always get found: by hand. Five Flow
// surfaces had to be composited on a calculator to answer "is this readable
// over a white video frame". They all passed. That is not the point. The point
// is that answering took a calculator, so the next one will not get asked.
//
// ── WHAT MAKES THE COMPONENT CASE DIFFERENT ─────────────────────────────────
//
// The material in tokens.css has an opaque ink on a translucent fill, so one
// composite gives the answer. Components routinely write BOTH translucent:
//
//     bg-black/50 ... text-white/85
//
// which composites twice — the fill over unknown media, then the ink over that
// result. The ink's own alpha pulls it back TOWARD the surface it is sitting
// on, so contrast collapses faster than either number suggests. Those lane
// arrows measure 3.34:1 against a 3:1 floor. Read as "50% black behind an
// almost-white glyph" they sound comfortable. They are not; they are 0.34 from
// failing, and nothing would have said so.
//
// ── AND WHY IT REPORTS WHAT IT CANNOT MEASURE ───────────────────────────────
//
// Tailwind classes can name a colour this cannot resolve — an arbitrary value,
// a token that resolves differently per theme, a class assembled at runtime.
// A checker that silently skips those is worse than none, because the count of
// things it "passed" would include everything it could not read.
//
// So unmeasurable surfaces are COUNTED and frozen. The floor is enforced on
// what can be resolved, and the number that cannot be is a ratchet: it may
// fall, never rise. New translucency has to be written in a form this can
// measure, or it fails.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/** WCAG 1.4.3 for text, 1.4.11 for the icons and boundaries beside it. */
const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

/**
 * Surfaces whose className cannot be resolved to two literal colours. This is
 * a RATCHET, not an allowlist: it may only ever go down. Raising it is how a
 * new unmeasured translucent surface would get in, which is the thing being
 * prevented.
 */
const UNMEASURED_BUDGET = 18;

let checks = 0;
const failures: string[] = [];
const fail = (detail: string) => failures.push(detail);

// ── colour maths (same model as glass-check.ts: gamma-encoded sRGB) ──────────

function channel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  assert.match(full, /^[0-9a-fA-F]{6}$/, `expected a hex colour, got "${hex}"`);
  return [0, 1, 2].map((i) => parseInt(full.slice(i * 2, i * 2 + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const toHex = (v: number[]) =>
  `#${v.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("")}`;

function composite(fill: string, alpha: number, backdrop: string): string {
  const f = rgb(fill);
  const b = rgb(backdrop);
  return toHex(f.map((v, i) => alpha * v + (1 - alpha) * b[i]));
}

/** Every backdrop that matters — the grey ramp plus the saturated corners. */
const BACKDROPS: string[] = [];
for (let v = 0; v <= 255; v += 5) BACKDROPS.push(toHex([v, v, v]));
for (const c of [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255], [255, 0, 255]]) {
  BACKDROPS.push(toHex(c));
}

/**
 * The worst contrast a translucent ink achieves on a translucent fill, over
 * every backdrop — compositing TWICE, which is the whole reason this exists.
 */
function worstCompound(
  fill: string,
  fillAlpha: number,
  ink: string,
  inkAlpha: number,
): { r: number; backdrop: string } {
  let worst = Infinity;
  let where = BACKDROPS[0];
  for (const b of BACKDROPS) {
    const surface = composite(fill, fillAlpha, b);
    const text = composite(ink, inkAlpha, surface);
    const r = ratio(text, surface);
    if (r < worst) {
      worst = r;
      where = b;
    }
  }
  return { r: worst, backdrop: where };
}

// ── reading Tailwind ────────────────────────────────────────────────────────

/** The colour words this can resolve to a literal without guessing. */
const NAMED: Record<string, string> = { black: "#000000", white: "#ffffff" };

type Colour = { hex: string; alpha: number } | null;

/**
 * `bg-black/70` -> #000000 at 0.70. `text-white` -> #ffffff at 1.
 *
 * Anything else — an arbitrary value, a CSS variable whose literal depends on
 * the theme, a class built at runtime — returns null and is counted as
 * unmeasured rather than assumed safe.
 */
function readColour(classes: string, prefix: "bg" | "text"): Colour {
  const m = new RegExp(`(?:^|\\s)${prefix}-(black|white)(?:/(\\d{1,3}))?(?:\\s|$)`).exec(classes);
  if (!m) return null;
  const alpha = m[2] === undefined ? 1 : Number(m[2]) / 100;
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) return null;
  return { hex: NAMED[m[1]], alpha };
}

/** An element carrying an icon rather than a text node is judged at 1.4.11. */
function looksIconOnly(classes: string): boolean {
  // Rounded-full paddings with no type scale are the icon-button shape used
  // throughout: `rounded-full ... p-2` and never a `text-xs`/`text-sm` size.
  return /(?:^|\s)rounded-full(?:\s|$)/.test(classes) && !/(?:^|\s)text-(xs|sm|base|lg|xl)(?:\s|$)/.test(classes);
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "generated" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

// ── the sweep ───────────────────────────────────────────────────────────────

let measured = 0;
let unmeasured = 0;
const unmeasuredAt: string[] = [];

for (const file of [...walk(join(ROOT, "src"))].filter((f) => /\.tsx$/.test(f))) {
  const src = readFileSync(file, "utf8");
  const rel = file.slice(ROOT.length + 1);

  for (const m of src.matchAll(/className=\{?["`]([^"`]*)["`]/g)) {
    const classes = m[1];
    // Only translucent surfaces are in scope. `backdrop-blur` is the marker
    // that something behind this element is meant to show through.
    if (!/(?:^|\s)backdrop-blur/.test(classes)) continue;

    const line = src.slice(0, m.index).split("\n").length;
    const fill = readColour(classes, "bg");
    const ink = readColour(classes, "text");

    if (!fill || !ink) {
      unmeasured += 1;
      unmeasuredAt.push(`${rel}:${line}`);
      continue;
    }

    // A fully opaque fill cannot fail, and blur behind it does nothing —
    // still measured, so the count is honest.
    const floor = looksIconOnly(classes) ? AA_NON_TEXT : AA_TEXT;
    const { r, backdrop } = worstCompound(fill.hex, fill.alpha, ink.hex, ink.alpha);
    measured += 1;

    if (r < floor) {
      fail(
        `${rel}:${line} — ${fill.hex} at ${fill.alpha} under ${ink.hex} at ${ink.alpha} is ` +
          `${r.toFixed(2)}:1 over a ${backdrop} backdrop, below ${floor}:1.\n` +
          "    Both the fill AND the ink are translucent here, so they composite twice and the\n" +
          "    ink is pulled toward the surface it sits on. Raise the fill's alpha, or make the\n" +
          "    ink opaque — an opaque ink on a translucent fill only composites once.",
      );
    } else {
      checks += 1;
    }
  }
}

if (unmeasured > UNMEASURED_BUDGET) {
  fail(
    `${unmeasured} translucent surfaces could not be resolved to literal colours, budget is ${UNMEASURED_BUDGET}.\n` +
      "    This budget is a ratchet and only ever goes down. A new translucent surface has to be\n" +
      "    written so its fill and ink resolve — `bg-black/70 text-white` rather than a token or an\n" +
      "    arbitrary value — or it is translucency nothing has measured.\n" +
      `    New since the budget was set:\n${unmeasuredAt.slice(UNMEASURED_BUDGET).map((u) => `      ${u}`).join("\n")}`,
  );
} else {
  checks += 1;
}

if (failures.length) {
  console.error(`component-glass FAILED — ${failures.length} problem(s):\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(
  `component-glass OK — ${checks} assertions. ${measured} translucent surfaces in components composited\n` +
    "  twice (fill over media, then ink over that) against 58 backdrops spanning the full luminance\n" +
    `  ramp and the six saturated corners. ${unmeasured} could not be resolved to literal colours and\n` +
    `  are frozen at a budget of ${UNMEASURED_BUDGET}, which only ever goes down.\n` +
    "  Does NOT cover: surfaces whose colours come from theme tokens — those are the unmeasured ones,\n" +
    "  and glass-check.ts proves the tokens themselves but not this compounding.",
);
