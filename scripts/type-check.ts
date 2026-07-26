/**
 * TYPE GATE — the three rules that keep the product's voice human rather than
 * heads-up-display.
 *
 * These are cheap to state and expensive to hold, because every one of them is
 * a thing a designer reaches for by reflex when a label needs to feel
 * "official": set it in caps, space it out, and make it bold. Doing all three
 * is how an interface starts to read like instrumentation.
 *
 *   1. NO `text-transform: uppercase`, and no Tailwind `uppercase`.
 *      The only labelling device is the small-caps eyebrow (.mesh-eyebrow),
 *      which gives a section a lead-in while the letters keep their lowercase
 *      shapes and their rhythm.
 *
 *   2. NO weight above 600.
 *      Hierarchy comes from the serif and from size. 425 `font-bold` classes
 *      and 48 CSS declarations above 600 were removed to get here.
 *
 *   3. NO tracking above +0.02em, and that ceiling is reserved for the eyebrow.
 *      Wide tracking on lowercase text is the single loudest HUD signal there
 *      is; 73 `tracking-*` utilities were removed to get here.
 *
 * WHAT THIS CANNOT PROVE
 *   Inline styles computed at runtime, and anything a third-party stylesheet
 *   injects. It reads source text — the browser probe in the PR is what
 *   confirmed the rendered result (max weight 600, zero uppercase elements,
 *   max tracking 0.02em across two themes).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
// `git ls-files` still lists a file that has been deleted but not yet staged,
// so a gate run mid-refactor would die on ENOENT instead of reporting anything.
// This reads source text: a file that is gone has no text to read.
const files = execFileSync("git", ["ls-files", "src"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".css"))
  .filter((f) => existsSync(join(ROOT, f)));

/**
 * Blank comments while preserving BOTH offsets and line breaks, so prose about
 * a rule is not a violation of it and reported line numbers still point at the
 * right line. (Replacing a block comment with plain spaces eats its newlines
 * and drifts every line number after it.)
 */
function stripComments(text: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  return text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^\s*\/\/[^\n]*/gm, blank);
}

/**
 * Files that legitimately carry these strings outside the product's own UI,
 * pinned by exact count so a new one has to be justified rather than absorbed.
 */
const EXEMPT: { file: string; count: number; why: string }[] = [
  {
    file: "src/lib/actions.ts",
    count: 2,
    why: "transactional email HTML — mail clients do not load the design system, so the CTA needs its own weight",
  },
  {
    file: "src/lib/security.ts",
    count: 1,
    why: "the password-strength error message names the character classes a password needs",
  },
];

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

const violations: string[] = [];
const exemptByFile = new Map(EXEMPT.map((e) => [e.file, e]));
const exemptHits = new Map<string, number>();

for (const file of files) {
  const raw = readFileSync(join(ROOT, file), "utf8");
  const source = stripComments(raw);

  // 1. Uppercase, in CSS or as a Tailwind utility.
  for (const match of source.matchAll(/text-transform:\s*uppercase|(?<![\w-])uppercase(?![\w-])/g)) {
    violations.push(
      `${file}:${lineOf(source, match.index)} uses uppercase.\n` +
        "    The small-caps eyebrow is the only labelling device — use .mesh-eyebrow.",
    );
  }

  // 2. Weight above 600, declared or as a utility.
  for (const match of source.matchAll(/font-weight:\s*(\d{3})/g)) {
    if (Number(match[1]) > 600) {
      violations.push(
        `${file}:${lineOf(source, match.index)} sets font-weight ${match[1]}, above the 600 ceiling.`,
      );
    }
  }
  for (const match of source.matchAll(/(?<![\w-])font-(bold|extrabold|black)(?![\w-])/g)) {
    violations.push(
      `${file}:${lineOf(source, match.index)} uses font-${match[1]} (700+). ` +
        "Use font-semibold; hierarchy comes from the serif and from size.",
    );
  }

  // 3. Tracking above the ceiling.
  for (const match of source.matchAll(/letter-spacing:\s*(0?\.\d+)em/g)) {
    if (Number(match[1]) > 0.02) {
      violations.push(
        `${file}:${lineOf(source, match.index)} sets letter-spacing ${match[1]}em, above the +0.02em ceiling.`,
      );
    }
  }
  for (const match of source.matchAll(/(?<![\w-])tracking-\[(\d*\.?\d+)em\]/g)) {
    if (Number(match[1]) > 0.02) {
      violations.push(
        `${file}:${lineOf(source, match.index)} uses tracking-[${match[1]}em], above the +0.02em ceiling.`,
      );
    }
  }
  for (const match of source.matchAll(/(?<![\w-])tracking-(wide|wider|widest)(?![\w-])/g)) {
    violations.push(
      `${file}:${lineOf(source, match.index)} uses tracking-${match[1]}. ` +
        "Wide tracking on lowercase text is the loudest HUD signal there is.",
    );
  }
}

const real: string[] = [];
for (const v of violations) {
  const file = v.slice(0, v.indexOf(":"));
  if (exemptByFile.has(file)) {
    exemptHits.set(file, (exemptHits.get(file) ?? 0) + 1);
  } else {
    real.push(v);
  }
}

assert.equal(
  real.length,
  0,
  `type contract violated (${real.length}):\n  ` + real.slice(0, 25).join("\n  "),
);

// Exemptions are pinned: a new violation in an already-listed file still fails.
for (const entry of EXEMPT) {
  assert.equal(
    exemptHits.get(entry.file) ?? 0,
    entry.count,
    `${entry.file}: expected ${entry.count} exempt occurrence(s) (${entry.why}), ` +
      `found ${exemptHits.get(entry.file) ?? 0}.\n` +
      "  A new one needs its own justification, or the file no longer needs the exemption.",
  );
}

// The eyebrow must exist, or rule 1 has nowhere to send anyone.
const globals = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
assert.match(
  globals,
  /\.mesh-eyebrow[^{]*\{[^}]*font-variant-caps:\s*all-small-caps/,
  ".mesh-eyebrow must set font-variant-caps: all-small-caps — it is the replacement for every uppercase label.",
);

// The three families must actually be loaded, not merely named.
const layout = readFileSync(join(ROOT, "src/app/layout.tsx"), "utf8");
for (const family of ["Fraunces", "Instrument_Sans", "IBM_Plex_Mono"]) {
  assert.match(
    layout,
    new RegExp(`\\b${family}\\s*\\(`),
    `${family} must be loaded through next/font in layout.tsx.\n` +
      "  This product shipped for months with `--font-inter` pointing at a system stack that\n" +
      "  never loaded Inter, so every machine rendered a different typeface. Name it and load it.",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NO ARBITRARY FONT SIZES. THE SCALE IS THE SCALE.
// ─────────────────────────────────────────────────────────────────────────────
//
// The scale's smallest step was --t-caption at 0.78125rem (12.5px), and 199 of
// the 202 arbitrary sizes in the product were BELOW it: 8, 8.5, 9, 9.5, 10,
// 10.5, 11 and 11.5px. Eight distinct sizes, none on any scale — which is not
// eight decisions, it is one decision made eight times by different people, and
// it is most of why a page reported eleven font sizes.
//
// The scale gained the step it was actually missing (--fs-micro, 0.6875rem) and
// every one of those sites collapsed onto it. This keeps them collapsed.
// THE MICRO FLOOR SURVIVES THE RESPONSIVE ROOT DOWNSCALE.
//
// --fs-micro is 0.6875rem because 11px is the legibility floor for meta text,
// and collapsing the old 8-11.5px values onto it was justified as an
// accessibility improvement. But globals.css deliberately drops the rem base to
// 13.5px on cover screens (<=320px), and every rem follows it — so the token
// computed to 9.28px there, BELOW several values it replaced, on the one class
// of device where legibility is hardest. The claim and the behaviour disagreed.
//
// Whenever the root font size is overridden, --fs-micro must be re-pinned in
// the same query so it still lands on 11px. Caught by an external reviewer, not
// by me: the token read correctly in isolation and only failed in combination.
const rootOverrides = [...globals.matchAll(/@media[^{]*\{[\s\S]*?html\s*\{[^}]*font-size:\s*([0-9.]+)px/g)];
for (const [, rootPx] of rootOverrides) {
  const root = Number(rootPx);
  const scoped = globals.slice(globals.indexOf(`font-size: ${rootPx}px`));
  const pinned = /--fs-micro:\s*([0-9.]+)rem/.exec(scoped.slice(0, 1200));
  assert.ok(
    pinned,
    `globals.css overrides the root font size to ${rootPx}px but does not re-pin --fs-micro in the\n` +
      `  same query. At that root the token computes to ${(0.6875 * root).toFixed(2)}px — below the 11px\n` +
      "  floor it exists to guarantee, and below several of the fixed sizes it replaced.",
  );
  const computed = Number(pinned[1]) * root;
  assert.ok(
    Math.abs(computed - 11) < 0.25,
    `--fs-micro is re-pinned to ${pinned[1]}rem at a ${rootPx}px root, computing to ${computed.toFixed(2)}px.\n` +
      "  The floor is 11px. Pin it so it lands there.",
  );
}

// THE NAMED STEPS ARE ON THE SCALE TOO.
//
// The section above has banned `text-[13px]` for a while, and the ban held. It
// was also, on its own, close to cosmetic: `text-[Npx]` is the size nobody
// writes. `text-sm` is the size everybody writes — 513 sites — and Tailwind's
// stock value for it is 14px, which is not on this scale and never was. Same
// for `text-xs` at 12px, 417 sites. A browser sweep of seven signed-in surfaces
// found 367 of 653 text nodes rendering at a size the system does not contain.
//
// A rule called THE SCALE IS THE SCALE that only inspects the rare spelling is
// the recurring failure in this codebase wearing a different hat: two places
// state one fact, one of them is taught the rule.
//
// globals.css retargets the ten `--text-*` steps that Tailwind compiles into
// every `text-*` utility. This holds them against the scale itself, parsed from
// tokens.css — so a new step has to be a real step, and moving the scale moves
// the assertion with it rather than against it.
const tokensCss = stripComments(readFileSync(join(ROOT, "src/app/tokens.css"), "utf8"));

/** Every font-size the scale actually contains, in rem, from its own source. */
const scaleSizes = new Set<string>();
for (const m of tokensCss.matchAll(/--t-[a-z0-9]+:\s*[^;]*?([0-9.]+)rem\s*\//g)) scaleSizes.add(m[1]);
for (const m of tokensCss.matchAll(/--fs-[a-z0-9]+:\s*([0-9.]+)rem/g)) scaleSizes.add(m[1]);
assert.ok(
  scaleSizes.size >= 10,
  `parsed only ${scaleSizes.size} sizes out of the --t-*/--fs-* scale in tokens.css; expected the full set.\n` +
    "  If the scale changed shape, this parse has to change with it — an assertion that silently\n" +
    "  reads an empty scale passes everything, which is worse than no assertion at all.",
);

const TAILWIND_STEPS = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl"];
const offScale: string[] = [];
for (const step of TAILWIND_STEPS) {
  const declared = new RegExp(`^\\s*--text-${step}:\\s*([0-9.]+)rem`, "m").exec(globals);
  assert.ok(
    declared,
    `globals.css does not retarget --text-${step}.\n` +
      "  Tailwind compiles `text-" + step + "` to `font-size: var(--text-" + step + ")`. Leaving one step\n" +
      "  undeclared hands it back to the framework default, which is how 14px and 12px became the\n" +
      "  product's two most common text sizes without anyone choosing them.",
  );
  if (!scaleSizes.has(declared![1])) {
    offScale.push(`--text-${step}: ${declared![1]}rem (${Number(declared![1]) * 16}px)`);
  }
}
assert.deepEqual(
  offScale,
  [],
  "Tailwind text steps are set to sizes the scale does not contain:\n" +
    offScale.map((o) => `    ${o}`).join("\n") +
    `\n  Scale steps available (rem): ${[...scaleSizes].sort((a, b) => Number(a) - Number(b)).join(", ")}\n` +
    "  Pick one. Adding a step to the scale to justify a utility is a design decision and belongs\n" +
    "  in tokens.css with a reason, not here as a number that happens to match.",
);

// AND THE CSS DOESN'T GET TO SPELL A SIZE EITHER.
//
// Retargeting the ten utility steps moved 337 of the 394 off-scale text nodes
// onto the scale. The 56 that stayed came from five rules in globals.css that
// spelled `font-size: 0.875rem` by hand — the exact value Tailwind's `text-sm`
// used to carry, arrived at independently, which is what a default looks like
// after it has been copied around for a while. They read `var(--text-sm)` now.
//
// Fluid `clamp()` headers are deliberately not covered: a hero that scales with
// the viewport passes through every value between its endpoints, so "is it a
// scale step" is not a question that has an answer for them. Ten such rules
// remain and are the known gap in this section.
const hardcodedRem = [
  ...stripComments(globals).matchAll(/^\s*font-size:\s*(?!var\()([0-9.]+)rem\s*;/gm),
]
  .map((m) => m[1])
  .filter((rem) => !scaleSizes.has(rem));
assert.deepEqual(
  hardcodedRem,
  [],
  `globals.css spells font sizes that are not on the scale: ${[...new Set(hardcodedRem)].join("rem, ")}rem.\n` +
    "  Use `var(--text-*)` — those ten names now resolve to scale steps, so a rule that reads one\n" +
    "  moves when the scale moves. A literal does not, which is how five rules ended up holding\n" +
    "  the framework default long after the product stopped using it.",
);

const arbitrary: string[] = [];
for (const file of files) {
  if (!file.endsWith(".tsx")) continue;
  // stripComments, because this file's own prose and several components' comments
  // quote `text-[10px]` while explaining why it is gone. Reading commentary as a
  // violation is the same mistake in the other direction, and this repo's gates
  // have made both.
  const body = stripComments(readFileSync(join(ROOT, file), "utf8"));
  for (const m of body.matchAll(/text-\[[0-9.]+px\]/g)) {
    arbitrary.push(`${file}: ${m[0]}`);
  }
}
assert.deepEqual(
  arbitrary,
  [],
  "Arbitrary pixel font sizes are back:\n" +
    arbitrary.slice(0, 20).map((a) => `    ${a}`).join("\n") +
    (arbitrary.length > 20 ? `\n    …and ${arbitrary.length - 20} more` : "") +
    "\n  Use a scale step. `text-micro` is the floor for meta text (badges, counts, timestamps);\n" +
    "  above it the rem-valued steps in tokens.css cover everything. A one-off px size is how the\n" +
    "  product ended up reporting eleven font sizes on a single screen, which is the difference\n" +
    "  between a type system and a pile of numbers.",
);

console.log(
  `type contract OK — ${files.length} files scanned: no uppercase, no weight above 600, no tracking\n` +
    "  above +0.02em, the small-caps eyebrow exists, and all three families load through next/font.\n" +
    "  Does NOT cover: runtime-computed inline styles or third-party stylesheets.",
);
