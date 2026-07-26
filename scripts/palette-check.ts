/**
 * PALETTE — one set of colours, stated once.
 *
 * The product shipped two palettes at the same time. tokens.css declared seven
 * moulded plastics and five ink pigments; the mesh — the surface the product is
 * named after — painted six colours straight off Tailwind's 400 ramp, and the
 * Trail API painted a third set. Measured in OKLCH, six of the mesh's eight were
 * NEAR-MISSES of a plastic the product already owned: `#a78bfa` sat 1.0deg from
 * --mould-grape, `#34d399` 1.7deg from --mould-jade, `#a5b4fc` 2.6deg from
 * --accent. A colour one degree from another colour and a fifth of the scale
 * lighter does not read as a second colour; it reads as the first one rendered
 * wrong, which is what "the colours don't complement each other" describes.
 *
 * Meanwhile `--domain-feed`, `--domain-messages`, `--domain-communities`,
 * `--domain-mesh`, `--domain-notifications` and `--domain-you` — the design
 * system's own statement of which plastic means which part of the product — had
 * ZERO call sites. Nothing had ever read them, so they could never look wrong
 * enough for anyone to notice they disagreed with what shipped.
 *
 * Same shape as every other defect this week: two places state one fact, and
 * only one of them is ever taught the rule. This gate is the teaching.
 *
 *   1. src/lib/palette.ts matches tokens.css, triple for triple.
 *   2. Every --domain-* token resolves to a real --mould-* name.
 *   3. The mesh scene model paints no colour literal at all.
 *   4. The Trail API paints no colour literal at all.
 *   5. No chip paints a palette fill under --chip-ink, which fails AA on four
 *      of the seven plastics.
 *   6. The canvas theme bridge's DOM-less fallbacks match tokens.css. They were
 *      the old warm ramp, six months after the theme went neutral black.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const tokens = read("src/app/tokens.css");
const palette = read("src/lib/palette.ts");

/** Every `--name: value;` inside the block opened by `header`. */
function block(header: RegExp): Record<string, string> {
  const start = tokens.search(header);
  if (start < 0) throw new Error(`palette-check: no block matching ${header}`);
  const open = tokens.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < tokens.length; i += 1) {
    if (tokens[i] === "{") depth += 1;
    else if (tokens[i] === "}") { depth -= 1; if (depth === 0) { end = i; break; } }
  }
  const body = tokens.slice(open, end);
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) out[m[1]] = m[2].trim();
  return out;
}

const LIGHT = block(/^:root,\s*$/m);
const DARK = block(/^\.dark\s*\{/m);

// ── 1. palette.ts IS tokens.css ───────────────────────────────────────────────
const MOULD_NAMES = ["cobalt", "tomato", "jade", "amber", "teal", "grape", "crimson"] as const;

for (const name of MOULD_NAMES) {
  const want = {
    fill: LIGHT[`--mould-${name}`],
    ink: LIGHT[`--mould-${name}-ink`],
    plinth: LIGHT[`--mould-${name}-plinth`],
  };
  for (const [field, value] of Object.entries(want)) {
    if (!value) { fail("1 sync", `tokens.css has no --mould-${name}${field === "fill" ? "" : "-" + field}`); continue; }
    // `plastic("#3b5ae0", "#ffffff", "#22369e")` — positional, so match the triple whole.
    const call = palette.match(new RegExp(`${name}:\\s*plastic\\(([^)]*)\\)`, "i"));
    if (!call) { fail("1 sync", `src/lib/palette.ts declares no plastic for "${name}"`); break; }
    const args = call[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
    const idx = { fill: 0, ink: 1, plinth: 2 }[field as "fill" | "ink" | "plinth"];
    if (args[idx]?.toLowerCase() !== value.toLowerCase()) {
      fail("1 sync", `${name}.${field}: palette.ts says ${args[idx]}, tokens.css says ${value}`);
    } else ok();
  }
  // The plastics are theme-invariant by contract; a redeclaration under .dark
  // would silently make palette.ts a light-theme-only truth.
  if (DARK[`--mould-${name}`]) {
    fail("1 sync", `--mould-${name} is redeclared under .dark — the plastics must not move with the theme`);
  } else ok();
}

// ── 2. --domain-* resolve to real plastics, and are actually reachable ────────
const domains = Object.entries(LIGHT).filter(([k]) => k.startsWith("--domain-"));
if (domains.length === 0) fail("2 domains", "tokens.css declares no --domain-* names");
for (const [name, value] of domains) {
  const m = value.match(/var\(\s*(--mould-[a-z]+)\s*\)/i);
  if (!m) fail("2 domains", `${name} is "${value}" — a domain must resolve to a --mould-* plastic`);
  else if (!LIGHT[m[1]]) fail("2 domains", `${name} points at ${m[1]}, which tokens.css does not declare`);
  else ok();
}

// ── 3-4. The data layers name plastics, they do not spell colours ────────────
const LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/g;
for (const [section, file] of [
  ["3 mesh", "src/components/mesh/scene/scene-model.ts"],
  ["4 trail", "src/app/api/trail/route.ts"],
] as const) {
  const src = read(file);
  // Comments quote the old values on purpose — that is the record of the fix.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const found = [...code.matchAll(LITERAL)].map((m) => m[0]);
  if (found.length) {
    fail(section, `${file} spells ${found.length} colour literal(s) (${[...new Set(found)].slice(0, 6).join(", ")}) — import from @/lib/palette instead`);
  } else ok();
}

// PLATFORM_COLORS is the one allowed exception and it is not ours to choose:
// #1db954 is Spotify's green whether it suits us or not.
if (!read("src/components/mesh/mesh-types.ts").includes("PLATFORM_COLORS")) {
  fail("3 mesh", "PLATFORM_COLORS moved — the brand-colour exemption above no longer describes the code");
} else ok();

// ── 5. --chip-ink is never put on a palette fill ─────────────────────────────
// It was tuned against the OLD node colours, which were uniformly pastel.
// Against the plastics it fails AA on cobalt (3.28), teal (3.47), grape (3.19)
// and crimson (2.90). `inkForFill` returns the ink tokens.css pins per plastic.
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const ch = (i: number) => {
    const v = parseInt(f.slice(i * 2, i * 2 + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(0) + 0.7152 * ch(1) + 0.0722 * ch(2);
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = luminance(a) > luminance(b) ? [a, b] : [b, a];
  return (luminance(hi) + 0.05) / (luminance(lo) + 0.05);
};

const chipInk = DARK["--chip-ink"] ?? LIGHT["--chip-ink"];
if (!chipInk) fail("5 chip ink", "tokens.css declares no --chip-ink");
for (const name of MOULD_NAMES) {
  const fill = LIGHT[`--mould-${name}`];
  const pinned = LIGHT[`--mould-${name}-ink`];
  if (!fill || !pinned) continue;
  const r = ratio(fill, pinned);
  if (r < 4.5) fail("5 chip ink", `--mould-${name}-ink measures ${r.toFixed(2)} on its own fill — under AA`);
  else ok();
}

// Anything that paints a node/step colour as a background must derive its ink.
for (const file of [
  "src/components/mesh/ui/list-view.tsx",
  "src/app/(app)/trail/trail-client.tsx",
]) {
  const src = read(file);
  const paintsPalette = /background:\s*(node|step)\.color/.test(src);
  const usesChipInk = /var\(--chip-ink\)/.test(src.replace(/\/\*[\s\S]*?\*\//g, ""));
  if (paintsPalette && usesChipInk) {
    fail("5 chip ink", `${file} paints a palette fill under --chip-ink — use inkForFill(), which returns the pinned ink`);
  } else ok();
}

// ── 6. The canvas fallbacks are the tokens they stand in for ─────────────────
const bridge = read("src/components/mesh/paint/theme.ts");
function constBlock(name: string): Record<string, string> {
  const m = bridge.match(new RegExp(`const ${name}: PaintTheme = \\{([\\s\\S]*?)\\n\\};`));
  if (!m) throw new Error(`palette-check: no ${name} in paint/theme.ts`);
  const out: Record<string, string> = {};
  for (const e of m[1].matchAll(/(\w+):\s*"([^"]+)"/g)) out[e[1]] = e[2];
  return out;
}
const BRIDGE_FIELDS: Record<string, string> = {
  paper0: "--paper-0", paper1: "--paper-1", paper2: "--paper-2",
  ink1: "--ink-1", ink2: "--ink-2", ink3: "--ink-3", ink4: "--ink-4",
  edge: "--edge", inkInverse: "--ink-inverse", accent: "--accent",
  warm: "--warm", success: "--success", warning: "--warning", danger: "--danger",
};
for (const [constName, tokenSet, label] of [
  ["WORKLIGHT", DARK, ".dark"],
  ["DAYLIGHT", LIGHT, ":root"],
] as const) {
  const got = constBlock(constName);
  for (const [field, token] of Object.entries(BRIDGE_FIELDS)) {
    const want = tokenSet[token];
    if (!want) { fail("6 bridge", `${label} declares no ${token}`); continue; }
    if ((got[field] ?? "").toLowerCase() !== want.toLowerCase()) {
      fail("6 bridge", `${constName}.${field} is ${got[field]}, ${label} says ${token} is ${want}`);
    } else ok();
  }
}
// The rim must come from --edge. A rim tinted from the fill is invisible on a
// mat the same lightness as the fill, which is how all eight node colours ended
// up between 1.60 and 2.94 against --paper-0 in Daylight.
const nodesSrc = read("src/components/mesh/paint/nodes.ts");
if (/strokeStyle\s*=\s*withAlpha\(\s*light\b/.test(nodesSrc)) {
  fail("6 bridge", "a node rim is still tinted from its own fill — the boundary must be paintTheme().edge");
} else ok();

// ── 7. The mesh's default paper IS the app's paper ───────────────────────────
// `midnight` is the free atmosphere, so it is the surface behind almost every
// mesh, edge to edge. It shipped as ["#1f1b17", "#1a1714", "#100e0c"] — the warm
// ramp — long after tokens.css went true-neutral black, which put a brown
// tabletop inside a black page on the product's hero surface. The four Pro
// papers are exempt on purpose: Kraft is meant to be brown.
{
  const shared = read("src/components/mesh/paint/papers.ts");
  const spec = (table: string) => {
    const t = shared.match(new RegExp(`const ${table}: Record<string, AtmosphereSpec> = \\{([\\s\\S]*?)\\n\\};`));
    if (!t) throw new Error(`palette-check: no ${table} in paint/papers.ts`);
    const row = t[1].match(/midnight:\s*\{[^}]*bg:\s*\[([^\]]*)\][^}]*ink:\s*"([^"]+)"/);
    if (!row) throw new Error(`palette-check: no midnight row in ${table}`);
    return {
      bg: row[1].split(",").map((s) => s.trim().replace(/^"|"$/g, "")),
      ink: row[2],
    };
  };
  for (const [table, tokenSet, label] of [
    ["ATMOSPHERES", LIGHT, ":root"],
    ["ATMOSPHERES_DARK", DARK, ".dark"],
  ] as const) {
    const got = spec(table);
    const want = [tokenSet["--paper-1"], tokenSet["--paper-0"], tokenSet["--paper-2"]];
    got.bg.forEach((stop, i) => {
      if (stop.toLowerCase() !== (want[i] ?? "").toLowerCase()) {
        fail("7 paper", `${table}.midnight.bg[${i}] is ${stop}; ${label} says it should be ${want[i]}`);
      } else ok();
    });
    if (got.ink.toLowerCase() !== (tokenSet["--ink-3"] ?? "").toLowerCase()) {
      fail("7 paper", `${table}.midnight.ink is ${got.ink}; ${label} says --ink-3 is ${tokenSet["--ink-3"]}`);
    } else ok();
  }

  // And the theme has to actually reach the sky. `paintSky` reads
  // `o.dark !== false`, so an inputs object that omits `dark` silently paints
  // the lamplit paper in Daylight — which is exactly what shipped.
  const paintIndex = read("src/components/mesh/paint/index.ts");
  const inputs = paintIndex.match(/const skyInputs = \{([\s\S]*?)\n {6}\};/);
  if (!inputs) fail("7 paper", "skyInputs has moved in paint/index.ts");
  else if (!/\bdark:/.test(inputs[1])) {
    fail("7 paper", "skyInputs does not pass `dark` — paintSky defaults to the lamplit paper, so the mesh stays dark in Daylight");
  } else ok();
}

// ── 8. THE MESH IS NOT OUTER SPACE ANY MORE ──────────────────────────────────
// #0c1226 / #04050c / #070a16 / #030409 are the blue-blacks the mesh was painted
// with before it became a tabletop. Every one below was still live: the stage
// div, three full-bleed gate overlays, and the forming loader — the first thing
// a person sees on /mesh — so the app opened with a near-black panel inside a
// cream page and only stopped once the canvas took over.
{
  const SPACE = /#(?:0c1226|04050c|070a16|030409|081726|071224|160f22|1a0f12)\b/gi;
  for (const file of [
    "src/components/mesh/ui/gates.tsx",
    "src/components/mesh/scene/mesh-surface.tsx",
    "src/components/mesh/scene/mesh-forming-loader.tsx",
    "src/components/settings/settings-control-center.tsx",
  ]) {
    const code = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const found = [...new Set([...code.matchAll(SPACE)].map((m) => m[0]))];
    if (found.length) {
      fail("8 space", `${file} still paints the old outer-space palette (${found.join(", ")}) — use the paper tokens`);
    } else ok();
  }

  // Settings must not keep its own copy of the paper list. It did, and the two
  // drifted until "Midnight" in the picker meant cream paper in the renderer.
  const settings = read("src/components/settings/settings-control-center.tsx");
  if (/const\s+meshAtmospheres\s*=/.test(settings)) {
    fail("8 space", "settings-control-center declares its own atmosphere list again — import MESH_PAPERS");
  } else ok();
  // `MESH_PAPERS` merely IMPORTED is not the picker reading it — an early draft
  // of this assertion matched the import line and passed a mutation that gutted
  // the render. Require the iteration itself.
  if (!/MESH_PAPERS\s*\.\s*map\s*\(/.test(settings)) {
    fail("8 space", "the atmosphere picker no longer iterates MESH_PAPERS");
  } else ok();
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\npalette-check: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(`palette-check: ${checks} assertions passed — one palette, stated once.`);
