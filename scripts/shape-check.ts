/**
 * SHAPE GATE — `npm run shape:check`
 *
 * TOYBOX's depth model is one sentence:
 *
 *     A PLINTH MEANS YOU CAN PRESS THIS SPECIFIC THING.
 *
 * The side wall is not decoration and not elevation — it is an affordance. The
 * first draft of this system put a 4px plinth on every feed card, and all three
 * judges independently said the same thing: it makes the feed worse, on the one
 * surface where the competition wins by disappearing. The fix was not a
 * shallower plinth. It was noticing that a card is not a thing that presses; the
 * buttons on it are. Information gets `.plate`, action gets `.key`.
 *
 * That distinction only survives if it is enforced, because "add a bit of depth
 * to this card" will always look like an improvement in isolation.
 *
 * ── WHAT THIS CANNOT PROVE ───────────────────────────────────────────────────
 *
 * It reads class strings, not the rendered DOM. An element that receives `.key`
 * through a variable, a `cn()` branch on a prop, or a wrapper component is
 * invisible to it. It checks that the CSS keeps its shape and that the obvious
 * misuse is absent — it is not a proof that every plinth in the running app sits
 * on something pressable.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const globals = read("src/app/globals.css");

/** Blank comments while preserving offsets. A gate that reads its own prose as
 *  product code cannot explain itself. */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

// ── 1. Nothing is rounder than the cap ───────────────────────────────────────
//
// 28px is where a rectangle stops reading as a moulded part and starts reading
// as a lozenge. Tailwind resolves all 732 `rounded-*` utilities through this
// scale, so the cap has to hold here or it holds nowhere.
const RADIUS_CAP_REM = 1.75;
const scale = /--radius-(xs|sm|md|lg|xl|2xl|3xl):\s*([0-9.]+)rem/g;
const radii: Array<[string, number]> = [...globals.matchAll(scale)].map((m) => [m[1], Number(m[2])]);
assert.ok(radii.length >= 7, `expected the full --radius-* scale in globals.css, found ${radii.length}`);
for (const [name, rem] of radii) {
  assert.ok(
    rem <= RADIUS_CAP_REM,
    `--radius-${name} is ${rem}rem (${rem * 16}px), above the ${RADIUS_CAP_REM * 16}px cap.\n` +
      "  Past this a rectangle reads as a lozenge, not a moulded object. 2xl and 3xl collapse\n" +
      "  into the cap deliberately — that is what stops `rounded-3xl` reintroducing the old blob.",
  );
}
// Monotonic: a scale that goes backwards is a scale nobody can reason about.
const order = ["xs", "sm", "md", "lg", "xl"];
const byName = new Map(radii);
for (let i = 1; i < order.length; i += 1) {
  const prev = byName.get(order[i - 1]);
  const cur = byName.get(order[i]);
  assert.ok(prev !== undefined && cur !== undefined, `--radius-${order[i]} missing`);
  assert.ok(cur >= prev, `--radius-${order[i]} (${cur}rem) is smaller than --radius-${order[i - 1]} (${prev}rem)`);
}

// ── 2. The press conserves total height ──────────────────────────────────────
//
// The side wall goes to zero AND the face travels down by exactly one wall, so
// the bottom edge never moves. That is the whole difference between a key
// bottoming out and a jiggle.
const keyActive = /\.key:active\s*\{([\s\S]*?)\}/.exec(globals)?.[1];
assert.ok(keyActive, ".key:active not found in globals.css");
assert.match(
  keyActive,
  /translate:\s*0 var\(--plinth-h\)/,
  ".key:active must translate down by exactly one wall-height, `translate: 0 var(--plinth-h)`.\n" +
    "  Anything else breaks height conservation and the press stops feeling like a key.",
);
assert.match(
  keyActive,
  /0 0 0 0 var\(--plinth-1\)/,
  ".key:active must collapse the side wall to zero. A face that moves down while the wall stays\n" +
    "  is an object getting taller as you press it.",
);
// `transform` here would force rewriting every existing
// `:active { transform: ... scale(var(--mesh-press-scale)) }` rule in the same
// commit. The individual `translate` property composes with them instead.
assert.ok(
  !/transform:/.test(keyActive),
  ".key:active must use the individual `translate` property, never `transform`.\n" +
    "  globals.css already ships `:active { transform: translateY(0) scale(var(--mesh-press-scale)) }`\n" +
    "  rules elsewhere; transform is ONE property, so using it here silently overrides them.",
);

// ── 3. The wall is a wall, not a glow ────────────────────────────────────────
const keyBlock = /\n\.key\s*\{([\s\S]*?)\n\}/.exec(globals)?.[1];
assert.ok(keyBlock, ".key not found in globals.css");
assert.match(
  keyBlock,
  /0 var\(--plinth-h\) 0 0 var\(--plinth-1\)/,
  ".key's side wall must be `0 var(--plinth-h) 0 0 var(--plinth-1)` — offset down, BLUR ZERO.\n" +
    "  A blurred plinth is a drop shadow, and this system's whole claim is that depth comes from\n" +
    "  the object's own side rather than from light.",
);
assert.match(
  keyBlock,
  /inset 0 0 0 var\(--edge-w\) var\(--edge\)/,
  ".key must carry the --edge ring. The plinth darkens in both themes, so on a dark mat it\n" +
    "  cannot be the legal boundary — --edge is. An object without it is a WCAG 1.4.11 bug.",
);
// A border would relayout on every press; the plinth must be a shadow.
assert.ok(
  !/border-bottom/.test(keyBlock),
  ".key must not use border-bottom for the plinth — a border relayouts on every click.",
);

// ── 4. Information does not get a side wall ──────────────────────────────────
const plate = /\n\.plate\s*\{([\s\S]*?)\n\}/.exec(globals)?.[1];
assert.ok(plate, ".plate not found in globals.css");
assert.ok(
  !/--plinth-h|var\(--plinth-1\)|var\(--plinth-2\)/.test(plate),
  ".plate must have NO plinth. A card is not a thing that presses — the buttons on it are.\n" +
    "  This is the judged fix for the first draft, which put a 4px wall on every feed card and\n" +
    "  made the feed measurably worse. If a card needs to be pressable, it is a .key.",
);
for (const idiom of ["tray", "leaf"] as const) {
  const block = new RegExp(String.raw`\n\.${idiom}\s*\{([\s\S]*?)\n\}`).exec(globals)?.[1];
  assert.ok(block, `.${idiom} not found in globals.css`);
  assert.ok(
    !/0 var\(--plinth-h\)/.test(block),
    `.${idiom} must have no side wall — it is a place, not a control.`,
  );
}

// ── 5. No component hangs a plinth on something unpressable ──────────────────
//
// Class-string level, and deliberately narrow: the `key` class next to a tag
// that cannot receive a press. This catches the obvious misuse; see the header
// for what it cannot see.
const sourceFiles = execFileSync("git", ["ls-files", "src"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .filter((f) => f && existsSync(join(ROOT, f)))
  .filter((f) => f.endsWith(".tsx") && !f.startsWith("src/generated/"));

const UNPRESSABLE = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "hr", "article", "section"];
const offenders: string[] = [];
for (const file of sourceFiles) {
  const body = read(file);
  for (const tag of UNPRESSABLE) {
    // `<h2 ... className="… key …">` on one element, allowing attributes between.
    const re = new RegExp(String.raw`<${tag}\b[^>]*className=[^>]*["'\s]key[\s"']`, "s");
    if (re.test(body)) offenders.push(`${file} (<${tag}>)`);
  }
}
assert.deepEqual(
  offenders,
  [],
  "These give a plinth to something that cannot be pressed:\n" +
    offenders.map((o) => `    ${o}`).join("\n") +
    "\n  A plinth is an affordance, not elevation. Use .plate for information, .tray for a recess,\n" +
    "  .leaf for a row. Only something focusable, role-interactive or draggable may be a .key.",
);

// ── 5b. TWO DEPTH MODELS MAY NOT SHARE AN ELEMENT ────────────────────────────
//
// `.ds-interactive` is the OLD paper model: it lifts 2px on hover and swaps in a
// wide blurred shadow. `.key` presses INTO a plinth. An element carrying both
// has them fighting, and because `.ds-interactive:hover` sits later in
// globals.css it wins on source order — the side wall never collapses, the
// bottom edge moves, and height conservation silently stops happening.
//
// This was found by MEASURING THE BOTTOM EDGE in a real browser, not by reading
// the CSS: everything looked right at rest, and the resting box-shadow was
// exactly correct. The press was the only place it showed.
// Scanned per LINE over comment-stripped source, not by pairing quotes.
//
// The first version of this walked `/["'`]([^"'`]{20,})["'`]/g` looking for both
// names inside one string literal. It found nothing, including when the pair was
// definitely there. Two reasons, and both are worth remembering: comments were
// not stripped, and a backtick inside one of THIS FILE'S OWN comments entered
// the character class and desynchronised the scan — after that every "opening"
// quote was actually a closing one, so the captures were the gaps between
// literals rather than the literals. Quote-pairing by regex is not something to
// rely on. Class strings live on one line; scanning lines is both simpler and
// correct.
const paired: string[] = [];
for (const file of sourceFiles) {
  const body = stripComments(read(file));
  for (const [i, line] of body.split("\n").entries()) {
    if (!/\bds-interactive\b/.test(line)) continue;
    // `key` as a standalone class token, not `key-lit`, not `keyboard`, not a
    // React `key={…}` prop.
    if (!/(^|[\s"'`])key([\s"'`]|$)/.test(line)) continue;
    paired.push(`${file}:${i + 1}: ${line.trim().slice(0, 70)}…`);
  }
}
assert.deepEqual(
  [...new Set(paired)],
  [],
  "These put `.key` and `.ds-interactive` on the same element:\n" +
    [...new Set(paired)].map((o) => `    ${o}`).join("\n") +
    "\n  They are two different depth models. ds-interactive lifts on hover (paper); key presses\n" +
    "  into a plinth (moulded). Together the later rule wins and the press stops conserving\n" +
    "  height. Pick one — a .key owns its own transitions and hover.",
);

// ── 6. The two rejected hues stay rejected ───────────────────────────────────
//
// Both were neon triples that predate the moulded palette and were named in the
// design review as the two literals to kill. They are easy to reintroduce by
// copy-paste from an older file.
const REJECTED: Record<string, string> = {
  "#6e8bff": "the old neon periwinkle — use --mould-cobalt",
  "#34e4ea": "the old neon cyan — use --mould-teal",
  "#f43f5e": "the old hot rose — use --mould-crimson",
};
const hueOffenders: string[] = [];
for (const file of ["src/components/meshi/meshi-float.tsx", "src/app/(app)/flow/flow-client.tsx"]) {
  const body = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  for (const [hex, why] of Object.entries(REJECTED)) {
    if (body.toLowerCase().includes(hex)) hueOffenders.push(`${file}: ${hex} — ${why}`);
  }
}
assert.deepEqual(
  hueOffenders,
  [],
  "Rejected hues are back in the burst palettes:\n" +
    hueOffenders.map((o) => `    ${o}`).join("\n") +
    "\n  A burst is bits of the same plastic the product is made of. Use the --mould-* faces.",
);

// ─────────────────────────────────────────────────────────────────────────────
// A LIT KEY KEEPS ITS PLASTIC UNDER THE POINTER.
// ─────────────────────────────────────────────────────────────────────────────
//
// contrast-check proves the PALETTE. It cannot catch this, because nothing in
// the palette is wrong — the failure is in the CASCADE. `.key:hover` is a
// two-class selector (0,2,0) and `.key-lit` is one class (0,1,0), so hover
// repainted every moulded primary and Delete button to --face-hover while it
// kept its PINNED ink. --mould-cobalt-ink and --mould-crimson-ink are both
// #ffffff: 5.64 and 6.37 on their own faces, and 1.01:1 on --face-hover in
// Daylight. The label on a hovered primary button was not dim, it was gone.
//
// Two assertions, because either alone passes the broken file: the override
// must EXIST, and it must come after the rule it is tying with — at equal
// specificity source order is the only tiebreak.
// Comments STRIPPED and selectors anchored to a line start before searching.
// This file's prose quotes `.key:hover` and `.key-lit` constantly to explain
// itself, and there is also a compound `.insta-post-action.key-lit:hover` rule
// which CONTAINS the substring we are looking for. A bare indexOf matched both:
// mutation-tested, deleting the real override entirely still passed, because the
// compound rule satisfied the search. Third time this class of bug has appeared
// in a gate in this repo — assume it now.
const cssOnly = globals.replace(/\/\*[\s\S]*?\*\//g, "");
const litHover = cssOnly.search(/^\.key-lit:hover\b/m);
const keyHover = cssOnly.search(/^\.key:hover\b/m);
assert.ok(
  litHover !== -1,
  "globals.css must define a standalone `.key-lit:hover` rule. Without it, `.key:hover` wins on\n" +
    "  specificity and a moulded button changes MATERIAL on contact — repainted to --face-hover\n" +
    "  while keeping the white ink pinned to its plastic. That measures 1.01:1 in Daylight: the\n" +
    "  label on a hovered primary or Delete button is not dim, it is gone.\n" +
    "  A compound rule like `.insta-post-action.key-lit:hover` does NOT satisfy this — it fixes one\n" +
    "  surface and leaves every other lit key broken.",
);
assert.ok(
  keyHover !== -1 && litHover > keyHover,
  "the `.key-lit:hover` override must come AFTER `.key:hover` in globals.css. They tie on\n" +
    "  specificity (both 0,2,0), so source order is the only tiebreak and earlier means it loses.",
);
// And it must restore BOTH halves. Either alone leaves a mismatched pair that
// nobody has measured — the pinned inks are verified against their own plastic
// and against nothing else.
const litBlock = cssOnly.slice(litHover, cssOnly.indexOf("}", litHover));
for (const prop of ["background", "color"]) {
  assert.match(
    litBlock,
    new RegExp(String.raw`${prop}:\s*var\(--mould`),
    `.key-lit:hover must restore ${prop} from the pinned --mould triple. Restoring only one of face\n` +
      "  and ink leaves a pairing nobody measured.",
  );
}

console.log(
  `shape contract OK — the radius scale is monotonic and capped at ${RADIUS_CAP_REM * 16}px, the press\n` +
    "  conserves total height (wall to zero, face down exactly one wall, via `translate` so the\n" +
    "  existing scale rules survive), the wall is blur-zero and carries --edge, .plate/.tray/.leaf\n" +
    `  have no wall, no unpressable tag wears one across ${sourceFiles.length} components, and the\n` +
    "  rejected neon hues stay out of the burst palettes.\n" +
    "  Does NOT cover: a .key applied through a variable or a wrapper — class strings only.",
);
