/**
 * THE TAB ICONS ARE DRAWN AT 22px. THIS CHECKS THEY WERE DESIGNED FOR IT.
 *
 * ── WHAT WENT WRONG ──────────────────────────────────────────────────────────
 *
 * The previous set looked correct in the file and correct at 56px, and three of
 * the five stopped meaning anything at the size a tab actually renders:
 *
 *   - MeshIcon joined six dots with hairlines at `opacity="0.55"`. At 22px the
 *     lines are gone and the dots are gear teeth. The namesake tab of the whole
 *     product was a settings cog, lit orange, on the mesh page.
 *   - ExploreIcon's compass needle was a 4px blob inside a ring: a smudge.
 *   - MeChatIcon's two body lines closed into a rounded rectangle.
 *
 * Nobody could catch that by reading the source, because the source is correct
 * — it is the SIZE that breaks it. So this gate does not judge the drawing. It
 * enforces the four structural properties whose absence caused the failure, all
 * of which ARE readable in source.
 *
 * ── WHAT THIS CANNOT PROVE ───────────────────────────────────────────────────
 *
 * That an icon is good, means the right thing, or is distinguishable from its
 * neighbours. Those are judgements made by looking at rendered images at 20 /
 * 22 / 26px on both themes, which is how this set was chosen and is not
 * something a script can do. A hexagon that everyone reads as a bolt would pass
 * this cleanly. It only stops the four MECHANICAL ways a tab icon dies small.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC = "src/components/brand/nav-icons.tsx";
const source = readFileSync(join(ROOT, SRC), "utf8");
/** Blank comments: this file explains itself at length, and a gate that reads
 *  its own prose as product code cannot. */
const body = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => {
  checks += 1;
};

const REQUIRED = ["MeshIcon", "FlowIcon", "MeChatIcon", "ExploreIcon", "ProfileIcon"];

/** Each exported icon's JSX, from its `export function X` to the next one. */
function iconBodies(): Map<string, string> {
  const out = new Map<string, string>();
  const marks = [...body.matchAll(/export function (\w+Icon)\(/g)];
  marks.forEach((m, i) => {
    const start = m.index ?? 0;
    const end = i + 1 < marks.length ? (marks[i + 1].index ?? body.length) : body.length;
    out.set(m[1], body.slice(start, end));
  });
  return out;
}
const icons = iconBodies();

// ── 1. All five exist ────────────────────────────────────────────────────────
{
  for (const name of REQUIRED) {
    if (!icons.has(name)) fail("1 the five", `${name} is missing from ${SRC}`);
    else ok();
  }
}

// ── 2. No faint strokes ──────────────────────────────────────────────────────
//
// THE cog bug. `opacity="0.55"` on the connecting lines meant that at tab size
// the mesh mark's edges were invisible and only its dots survived — and six
// dots in a ring, alone, are gear teeth. Anything a person needs to see at 22px
// must be drawn at full strength.
{
  for (const [name, src] of icons) {
    const faint = [...src.matchAll(/opacity=["{]?["']?(0?\.\d+)/g)].map((m) => Number(m[1]));
    const tooFaint = faint.filter((v) => v < 0.8);
    if (tooFaint.length) {
      fail("2 faint", `${name} draws at opacity ${tooFaint.join(", ")}. At 22px that is invisible — it is exactly how the mesh mark lost its edges and kept its teeth.`);
    } else ok();
  }
}

// ── 3. Nothing but currentColor ──────────────────────────────────────────────
//
// These ride on a `.key-lit` face in the account plastic, in two themes. A
// literal colour is right in exactly one of those four combinations. A knocked-
// out compass pivot was drawn and dropped for this reason.
{
  for (const [name, src] of icons) {
    const literals = [...src.matchAll(/(?:fill|stroke)=["']?(#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]*\)|(?!currentColor|none|["'{])[a-z]+)["']?/g)]
      .map((m) => m[1])
      .filter((v) => v !== "currentColor" && v !== "none");
    if (literals.length) {
      fail("3 colour", `${name} hardcodes ${[...new Set(literals)].join(", ")}. Tab icons invert on a lit tab and across both themes; only currentColor survives all four.`);
    } else ok();
  }
}

// ── 4. Thick enough, simple enough ───────────────────────────────────────────
//
// Detail is what dies first. A 22px icon has roughly 20 usable pixels across;
// past a handful of elements they merge into a grey blob, which is what
// happened to the six-dot ring and the two-line bubble.
{
  const strokeWidth = /strokeWidth:\s*([\d.]+)/.exec(body)?.[1];
  if (!strokeWidth || Number(strokeWidth) < 1.8) {
    fail("4 weight", `the shared base stroke is ${strokeWidth ?? "unset"} — under 1.8 these grey out against a moulded face at tab size`);
  } else ok();

  for (const [name, src] of icons) {
    // Every drawn element: paths, circles, rects, lines, polygons.
    const parts = (src.match(/<(path|circle|rect|line|polygon|polyline|ellipse)\b/g) || []).length;
    if (parts === 0) {
      fail("4 weight", `${name} draws nothing`);
    } else if (parts > 4) {
      fail("4 weight", `${name} has ${parts} elements. Past four they merge at 22px — the old mesh mark had seven and rendered as a cog.`);
    } else ok();
  }
}

// ── 5. Both nav lists use them, and only them ────────────────────────────────
//
// An icon set only holds if there is one set. A second inline <svg> in a nav
// item is how a bar ends up half-redesigned.
{
  const nav = readFileSync(join(ROOT, "src/components/layout/navigation-config.ts"), "utf8");
  for (const name of REQUIRED) {
    if (!new RegExp(`\\b${name}\\b`).test(nav)) {
      fail("5 one set", `navigation-config.ts does not use ${name}`);
    } else ok();
  }
  for (const file of ["src/components/layout/mobile-nav.tsx", "src/components/layout/app-shell.tsx"]) {
    const src = readFileSync(join(ROOT, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    // A nav item renders `item.icon`; a literal <svg> in the nav markup means a
    // sixth icon nobody will remember to update.
    if (/<svg[\s>]/.test(src)) {
      fail("5 one set", `${file} contains a literal <svg> — nav marks come from brand/nav-icons.tsx so the set stays one set`);
    } else ok();
  }
}

if (failures.length) {
  console.error(`\nnav-icons: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(`nav-icons: ${checks} assertions passed — five marks, full strength, currentColor only, legible small.`);
