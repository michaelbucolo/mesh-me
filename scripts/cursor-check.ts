/**
 * CURSOR GATE — the OS cursor is the pointer.
 *
 * A mascot used to ride the pointer here: a `cursor: url()` PNG floor on
 * :root plus a DOM sprite drawing the body, with a pointer-modality predicate
 * deciding which of two Meshis chased the hand. The tone reset (R5) deleted
 * the whole system — an adult product's pointer is the system's — so the
 * contract this file guards flipped from "the floor is complete" to "the
 * replacement stays gone", plus the two rules that were always timeless:
 *
 *   1. `cursor: none` appears in no stylesheet and no component. Every custom
 *      cursor implementation reaches for it eventually, and it strands the
 *      user with an invisible pointer the moment the replacement is not on
 *      screen. The rule is mechanical rather than editorial.
 *   2. No `cursor: url()` images anywhere — that is the replacement growing
 *      back, one "small" cosmetic at a time.
 *   3. The pointer-affordance floor stays: Tailwind v4's preflight stopped
 *      giving <button> a pointer cursor, so globals.css restores affordances
 *      once for everything — pointer on interactive roles, auto on typing
 *      surfaces, not-allowed on disabled controls. Losing these regresses
 *      every control in the product simultaneously.
 *
 * WHAT THIS CANNOT PROVE
 *   That the cursor renders correctly on a page. It reads source text; the
 *   browser pass confirms the pointer behaves on real surfaces.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const files = execFileSync("git", ["ls-files", "src"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".css"))
  .filter((f) => !f.startsWith("src/generated/"))
  .filter((f) => existsSync(join(ROOT, f)));

/** Blank comments, preserving offsets and newlines, so prose about the rule is
 *  not a violation of it and line numbers still point at the right line. */
function stripComments(text: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  return text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^\s*\/\/[^\n]*/gm, blank);
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

// ── 1. `cursor: none` appears nowhere ────────────────────────────────────────
const hidden: string[] = [];
for (const file of files) {
  const source = stripComments(read(file));
  // CSS declaration, and the Tailwind utility, which compiles to the same thing.
  for (const m of source.matchAll(/cursor:\s*none|(?<![\w-])cursor-none(?![\w-])/g)) {
    hidden.push(`${file}:${lineOf(source, m.index)}`);
  }
}
assert.deepEqual(
  hidden,
  [],
  "`cursor: none` must not appear anywhere:\n" +
    hidden.map((h) => `    ${h}`).join("\n") +
    "\n  Hiding the native pointer strands the user with an invisible cursor the\n" +
    "  moment whatever was meant to replace it is not on screen. There is no state\n" +
    "  in which that is an acceptable cost.",
);

// ── 2. No cursor image replacements ──────────────────────────────────────────
const replaced: string[] = [];
for (const file of files) {
  const source = stripComments(read(file));
  for (const m of source.matchAll(/cursor:\s*[^;{}]*url\(/g)) {
    replaced.push(`${file}:${lineOf(source, m.index)}`);
  }
}
assert.deepEqual(
  replaced,
  [],
  "a `cursor: url(...)` image has appeared:\n" +
    replaced.map((h) => `    ${h}`).join("\n") +
    "\n  The OS cursor is the pointer. The mascot-cursor system was deleted by the\n" +
    "  tone reset (R5) — the product does not replace the pointer, not even a\n" +
    "  little, because that is how the last 263-line sprite system started.",
);

// ── 3. The affordance floor stays ────────────────────────────────────────────
const css = read("src/app/globals.css");
assert.match(
  css,
  /:is\(input,\s*textarea,[^)]*\)\s*\{\s*cursor:\s*auto/,
  "globals.css must keep `cursor: auto` on input and textarea — typing surfaces\n" +
    "  keep the UA I-beam explicitly, not by omission.",
);
assert.match(
  css,
  /\[role="menuitemcheckbox"\][\s\S]{0,400}?cursor:\s*pointer/,
  "globals.css must keep the interactive-role pointer floor. Tailwind v4's\n" +
    "  preflight stopped giving <button> a pointer cursor; this block restores\n" +
    "  affordances once, for everything, instead of per-component patches.",
);
assert.match(
  css,
  /:is\(button,\s*select,\s*input,\s*textarea\):disabled[\s\S]{0,400}?cursor:\s*not-allowed/,
  "globals.css must keep `cursor: not-allowed` on disabled controls.",
);

// ── 4. The deleted system stays deleted ──────────────────────────────────────
for (const ghost of ["src/components/meshi/meshi-cursor.tsx", "src/lib/pointer-modality.ts"]) {
  assert.ok(
    !existsSync(join(ROOT, ghost)),
    `${ghost} is back. The cursor sprite and the pointer-modality predicate were\n` +
      "  deleted with the mascot cursor; if a custom pointer is ever wanted again it\n" +
      "  must be a fresh, deliberate design decision — not this file resurrected.",
  );
}

console.log(
  `cursor contract OK — no \`cursor: none\` and no cursor images in ${files.length} files, the\n` +
    "  affordance floor stands (pointer on interactive roles, auto on typing surfaces, not-allowed\n" +
    "  on disabled), and the deleted mascot-cursor files stay deleted.\n" +
    "  Does NOT cover: pointer behavior on a rendered page — that is the browser pass.",
);
