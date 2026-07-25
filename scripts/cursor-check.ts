/**
 * CURSOR GATE — the user always has a pointer.
 *
 * Meshi rides the pointer as two layers: a native `cursor: url()` PNG floor set
 * in CSS, and a DOM sprite that draws the body. The floor exists precisely
 * because the sprite can be absent — over an iframe, behind a modal, before
 * hydration, or if the bundle failed outright.
 *
 * The one rule that makes that safe is that `cursor: none` never appears. Every
 * custom-cursor implementation reaches for it eventually: hide the native
 * pointer, draw your own, done. It works until the moment your drawing is not
 * on screen, and then the user is moving an invisible pointer around a page
 * they cannot navigate. There is no state in which that is an acceptable cost,
 * so the rule is mechanical rather than editorial.
 *
 * Checks:
 *   1. `cursor: none` appears in no stylesheet and no component.
 *   2. The floor is declared in CSS, with the hotspot, and the PNG it names
 *      actually exists — a 404 here is a silently missing cursor.
 *   3. The PNG is at most 32×32. Chrome and Firefox on Windows ignore custom
 *      cursors above that and fall back to nothing.
 *   4. The floor is restored to native on text inputs and embedded content.
 *      `cursor` inherits, so :root's value reaches them unless it is undone,
 *      and a mascot shadow where an I-beam belongs is a broken text field.
 *   5. Exactly one component owns the pointer decision, so the cursor sprite
 *      and the floating companion cannot both chase the pointer.
 *
 * WHAT THIS CANNOT PROVE
 *   That the cursor renders. It reads source text and the PNG header; the
 *   browser pass is what confirms the pointer is visible on a real page.
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
    "\n  The DOM sprite is not guaranteed to be on screen — it is suppressed over\n" +
    "  iframes, text fields and modals, and it does not exist before hydration.\n" +
    "  Hiding the native pointer means that in every one of those states the user\n" +
    "  is moving an invisible cursor. The floor image is the pointer; the sprite is\n" +
    "  decoration on top of it.",
);

// ── 2. The floor is declared, and the file it names exists ───────────────────
const css = read("src/app/globals.css");
const floor = /:root\s*\{[^}]*cursor:\s*var\(--meshi-cursor,\s*url\("([^"]+)"\)\s+(\d+)\s+(\d+)\)/.exec(css);
assert.ok(
  floor,
  "globals.css must set the cursor floor on :root as\n" +
    '    cursor: var(--meshi-cursor, url("/cursor/…png") <hx> <hy>), auto;\n' +
    "  The var() is how JS swaps in a cosmetic-specific variant later; the url()\n" +
    "  fallback is what makes the pointer exist in the first paint, before any\n" +
    "  JavaScript has run.",
);
const [, floorUrl, hx, hy] = floor;
const floorPath = join("public", floorUrl.replace(/^\//, ""));
assert.ok(
  existsSync(join(ROOT, floorPath)),
  `globals.css points the cursor at ${floorUrl}, but ${floorPath} does not exist.\n` +
    "  A missing cursor image does not fall back to a default — it 404s and the\n" +
    "  browser silently uses `auto`, so this fails invisibly. Run `npm run cursor:build`.",
);
assert.ok(
  floorUrl.endsWith(".png"),
  `The cursor floor must be a PNG (got ${floorUrl}).\n` +
    "  WebKit does not support SVG cursor images, and this site ships inside an\n" +
    "  iOS WKWebView — an SVG floor falls back to `auto` on exactly the platform\n" +
    "  that most needs it.",
);

// ── 3. Size ceiling ──────────────────────────────────────────────────────────
// PNG: 8-byte signature, then IHDR whose first 8 bytes are width and height.
const png = readFileSync(join(ROOT, floorPath));
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
assert.ok(
  width <= 32 && height <= 32,
  `The cursor image is ${width}×${height}; Chrome and Firefox on Windows ignore\n` +
    "  custom cursors above 32×32 device px and show nothing at all. Slight\n" +
    "  softness on HiDPI is an acceptable cost; a missing pointer is not.",
);
assert.ok(
  Number(hx) < width && Number(hy) < height,
  `The hotspot (${hx}, ${hy}) falls outside the ${width}×${height} image, which\n` +
    "  browsers treat as invalid and replace with the top-left corner.",
);

// ── 4. Native cursors are restored where they belong ─────────────────────────
assert.match(
  css,
  /:is\(\s*input,\s*textarea,[^)]*\)\s*\{\s*cursor:\s*auto/,
  "globals.css must restore `cursor: auto` on input and textarea.\n" +
    "  `cursor` is an inherited property: once :root carries the floor, it reaches\n" +
    "  every descendant that does not set its own. input and textarea keep the UA\n" +
    "  I-beam only by omission, and omission stops working the moment :root has a\n" +
    "  value. Without this, every text field in the product shows a mascot shadow\n" +
    "  where the caret indicator should be.",
);
assert.match(
  css,
  /@media\s*\(forced-colors:\s*active\)\s*\{\s*:root\s*\{\s*cursor:\s*auto/,
  "globals.css must drop the custom cursor under `forced-colors: active`.\n" +
    "  That mode is a request for the OS's own high-contrast presentation, and a\n" +
    "  decorative cursor image is precisely what it is asking to remove.",
);

// ── 5. One owner of the pointer decision ─────────────────────────────────────
const OWNER = "src/lib/pointer-modality.ts";
assert.ok(existsSync(join(ROOT, OWNER)), `${OWNER} must exist — it is the one predicate deciding which Meshi owns the pointer.`);
for (const consumer of ["src/components/meshi/meshi-cursor.tsx", "src/components/meshi/meshi-float.tsx"]) {
  const body = read(consumer);
  // Imported from the owner module — not called there, because one of them
  // hands the predicate to useSyncExternalStore by reference rather than
  // invoking it. What matters is that neither file reimplements the test.
  assert.match(
    body,
    /import\s*\{[^}]*\bcursorSpriteOwnsPointer\b[^}]*\}\s*from\s*"@\/lib\/pointer-modality"/,
    `${consumer} must import cursorSpriteOwnsPointer from ${OWNER}.\n` +
      "  The cursor sprite and the floating companion both react to the pointer. If\n" +
      "  they test different conditions they will both chase it, which is two\n" +
      "  drawings of one character converging on one point.",
  );
  // And must not roll its own version of the same media queries.
  const ownRolled = /matchMedia\(\s*"\(pointer: fine\)"/.test(stripComments(body));
  assert.ok(
    !ownRolled,
    `${consumer} tests "(pointer: fine)" directly instead of using cursorSpriteOwnsPointer().\n` +
      "  That is how the two Meshis drifted apart in the first place: the sprite\n" +
      "  gated on the media query and the companion on event.pointerType, so on\n" +
      "  every desktop both of them followed the pointer.",
  );
}

console.log(
  `cursor contract OK — no \`cursor: none\` in ${files.length} files, the floor is a ${width}×${height} PNG\n` +
    `  at ${floorUrl} with hotspot (${hx}, ${hy}), native cursors are restored on text inputs and\n` +
    "  under forced-colors, and one predicate decides which Meshi owns the pointer.\n" +
    "  Does NOT cover: whether the cursor actually renders — that is the browser pass.",
);
