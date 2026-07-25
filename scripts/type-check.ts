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

console.log(
  `type contract OK — ${files.length} files scanned: no uppercase, no weight above 600, no tracking\n` +
    "  above +0.02em, the small-caps eyebrow exists, and all three families load through next/font.\n" +
    "  Does NOT cover: runtime-computed inline styles or third-party stylesheets.",
);
