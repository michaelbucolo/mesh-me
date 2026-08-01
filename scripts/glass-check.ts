/**
 * THE GLASS GATE — because the contrast gate cannot see through glass.
 *
 * scripts/contrast-check.ts measures 241 ratios and is the reason this palette
 * is trustworthy. It also cannot measure a single pixel of Liquid Glass, and
 * the failure is silent rather than loud:
 *
 *   - `luminance()` asserts /^[0-9a-fA-F]{6}$/, so an `rgba()` or a
 *     `color-mix(…, transparent)` is never fed to it.
 *   - `stripWashes()` (contrast-check.ts:534) DELETES
 *     `color-mix(… <=60%, transparent)` from the inked-fill sweep before it
 *     runs, on purpose, because a wash is not a fill.
 *
 * Ship a translucent material under those rules and the suite goes green on a
 * surface it never looked at. That is worse than having no gate, and it is the
 * exact shape of every defect this project has spent weeks closing: a fact
 * stated in one place, and the checker taught about a different place.
 *
 * WHAT THIS PROVES, AND WHY IT IS PROVABLE AT ALL
 *
 * Apple's Regular variant stays legible "regardless of context" because it
 * samples the composited backdrop at runtime. CSS cannot read its own backdrop.
 * So legibility here cannot come from adaptation — it has to come from an
 * OPACITY FLOOR that holds against every backdrop that could ever be behind it.
 *
 * That is a finite, checkable claim. A translucent fill composites as
 *
 *     C = alpha*F + (1 - alpha)*B          (in gamma-encoded sRGB, which is
 *                                           what CSS actually does)
 *
 * so as B ranges over the sRGB cube, C sweeps a segment from F itself
 * (alpha = 1) toward B. Sampling B across the full grey ramp plus the six
 * saturated corners bounds that segment: the grey ramp covers the luminance
 * extremes, which is what contrast depends on, and the corners cover chroma.
 * The worst ratio over that set is the guarantee.
 *
 * Blur contributes NOTHING to these numbers and must not be argued as a
 * mitigation. A box blur is a weighted mean, and the mean luminance of a white
 * region is white.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
/**
 * Comments are blanked rather than deleted, so every byte offset in the file
 * still lines up. This file's own prose says `backdrop-filter: none !important`
 * several times, and the first version of section 3 dutifully reported its own
 * documentation as a violation.
 */
const decomment = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));

const tokens = decomment(readFileSync(join(ROOT, "src/app/tokens.css"), "utf8"));
const globals = decomment(readFileSync(join(ROOT, "src/app/globals.css"), "utf8"));

const AA = 4.5;
/** WCAG 1.4.11 — the floor for a boundary a user must be able to see. */
const NON_TEXT = 3;

let checks = 0;
const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);

// ── colour maths ────────────────────────────────────────────────────────────

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

/** Source-over compositing, in gamma-encoded sRGB — what a browser does. */
function composite(fill: string, alpha: number, backdrop: string): string {
  const f = rgb(fill);
  const b = rgb(backdrop);
  return toHex(f.map((v, i) => alpha * v + (1 - alpha) * b[i]));
}

/**
 * Every backdrop that matters. The grey ramp spans the luminance extremes,
 * which is the axis contrast actually depends on; the six saturated corners
 * cover the chroma the ramp cannot reach.
 */
const BACKDROPS: string[] = [];
for (let v = 0; v <= 255; v += 5) BACKDROPS.push(toHex([v, v, v]));
for (const c of [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255], [255, 0, 255]]) {
  BACKDROPS.push(toHex(c));
}

/** The worst ratio `ink` achieves on this glass over ANY backdrop. */
function worstOverAnyBackdrop(ink: string, fill: string, alpha: number): { r: number; backdrop: string } {
  let worst = Infinity;
  let where = BACKDROPS[0];
  for (const b of BACKDROPS) {
    const r = ratio(ink, composite(fill, alpha, b));
    if (r < worst) {
      worst = r;
      where = b;
    }
  }
  return { r: worst, backdrop: where };
}

// ── reading the declared material ───────────────────────────────────────────

/** A custom property's value inside one selector block of a stylesheet. */
function declared(css: string, selector: string, prop: string): string | null {
  const at = css.indexOf(selector);
  if (at < 0) return null;
  const open = css.indexOf("{", at);
  if (open < 0) return null;
  let depth = 1;
  let i = open + 1;
  while (i < css.length && depth > 0) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") depth -= 1;
    i += 1;
  }
  const body = css.slice(open + 1, i - 1);
  return new RegExp(`${prop}\\s*:\\s*([^;]+);`).exec(body)?.[1].trim() ?? null;
}

/**
 * Follow `var(--x)` to a literal, preferring the declaration that applies in
 * this theme.
 *
 * Written as a scan over every block rather than as a lookup at two guessed
 * selector spellings: the first version searched `":root,"` and `".dark {"` by
 * `indexOf`, which found whichever block happened to be spelled that way first
 * and reported `--media-ink` as undeclared while it sat three blocks further
 * down. A resolver that silently returns null makes the gate report "no ink
 * declared" for an ink that is right there.
 */
function resolve(css: string, theme: "light" | "dark", value: string | null): string | null {
  if (!value) return null;
  let current = value.trim();
  for (let hop = 0; hop < 5; hop += 1) {
    const ref = /^var\((--[a-z0-9-]+)\)$/.exec(current);
    if (!ref) return current;
    const found: { selector: string; value: string }[] = [];
    for (const m of css.matchAll(/(^|\n)([^{}\n][^{}]*)\{([^{}]*)\}/g)) {
      const hit = new RegExp(`${ref[1]}\\s*:\\s*([^;]+);`).exec(m[3]);
      if (hit) found.push({ selector: m[2].trim(), value: hit[1].trim() });
    }
    if (!found.length) return null;
    // `.dark` overrides `:root`; anything else falls through to the base block.
    const themed = found.filter((f) => /(^|\s|,)\.dark\b/.test(f.selector));
    const picked = theme === "dark" && themed.length ? themed[themed.length - 1] : found[0];
    current = picked.value;
  }
  return null;
}

// ── 1. THE OPACITY FLOOR HOLDS, ON BOTH GROUNDS, FOR BOTH INKS ──────────────
//
// This is the whole contract. Every ink the material declares must clear AA on
// its own fill at its own alpha, over every backdrop in the sweep.
{
  const grounds = [
    { name: "light ground", selector: ":root,\n.light {", theme: "light" as const },
    { name: "dark ground", selector: ".dark {\n  --lg-fill", theme: "dark" as const },
  ];

  for (const ground of grounds) {
    // The light block is `:root,\n.light {` and the dark one is a plain
    // `.dark {`; find each by its own --lg-fill declaration rather than by a
    // selector spelling that a reformat would break.
    const blocks = [...tokens.matchAll(/(^|\n)([^{}\n][^{}]*)\{([^{}]*--lg-fill[^{}]*)\}/g)];
    const block = blocks.find((b) =>
      ground.theme === "dark" ? /(^|\s)\.dark\b/.test(b[2]) : !/(^|\s)\.dark\b/.test(b[2]),
    );
    if (!block) {
      fail("1 opacity floor", `no --lg-fill block found for the ${ground.name}`);
      continue;
    }
    const body = block[3];
    const get = (p: string) => new RegExp(`${p}\\s*:\\s*([^;]+);`).exec(body)?.[1].trim() ?? null;

    const fill = get("--lg-fill");
    const alphaRaw = get("--lg-alpha");
    if (!fill || !alphaRaw) {
      fail("1 opacity floor", `the ${ground.name} declares --lg-fill or --lg-alpha not at all`);
      continue;
    }
    const alpha = Number(alphaRaw);
    assert.ok(Number.isFinite(alpha) && alpha > 0 && alpha <= 1, `--lg-alpha "${alphaRaw}" is not a fraction`);

    for (const inkProp of ["--lg-ink", "--lg-ink-2"] as const) {
      const ink = resolve(tokens, ground.theme, get(inkProp));
      if (!ink) {
        fail("1 opacity floor", `the ${ground.name} declares no ${inkProp}`);
        continue;
      }
      const { r, backdrop } = worstOverAnyBackdrop(ink, fill, alpha);
      if (r < AA) {
        fail(
          "1 opacity floor",
          `${ground.name}: ${inkProp} ${ink} on ${fill} at alpha ${alpha} is ${r.toFixed(2)}:1 ` +
            `over a ${backdrop} backdrop, below AA ${AA}:1.\n` +
            "    Glass cannot read what is behind it, so it cannot adapt the way Apple's does. Raise\n" +
            "    --lg-alpha until the floor holds, or use a darker ink. Blur is not a mitigation: a box\n" +
            "    blur is a weighted mean, and the mean of a white region is white.",
        );
      } else {
        checks += 1;
      }
    }
  }
}

// ── 1b. EVERY STEP OF THE TRANSLUCENCY SLIDER HOLDS THE SAME FLOOR ──────────
//
// Section 1 proves the DEFAULT alpha. iOS 27 added a control that changes it,
// and the moment a person can move that number the default being safe stops
// meaning anything — the reachable minimum is what has to be safe.
//
// This is the exact shape of hole this gate exists to close, one level up: a
// fact proven in one place while the product reads a different place. So each
// `[data-lg="N"]` block is found, its alpha (and its ink, where a step
// brightens one to buy range) is read, and section 1's floor is run again on
// it. A step that cannot be proven cannot ship, which is also why the slider
// has detents instead of being continuous — a continuous range is a number
// this cannot enumerate.
{
  const grounds = [
    { name: "light", theme: "light" as const, isDark: false },
    { name: "dark", theme: "dark" as const, isDark: true },
  ];

  for (const ground of grounds) {
    // The ground's own defaults, which a step inherits unless it overrides them.
    const baseBlocks = [...tokens.matchAll(/(^|\n)([^{}\n][^{}]*)\{([^{}]*--lg-fill[^{}]*)\}/g)];
    const base = baseBlocks.find((b) =>
      ground.isDark ? /(^|\s)\.dark\b/.test(b[2]) : !/(^|\s)\.dark\b/.test(b[2]),
    );
    if (!base) {
      fail("1b slider", `no --lg-fill block for the ${ground.name} ground`);
      continue;
    }
    const baseGet = (p: string) =>
      new RegExp(`${p}\\s*:\\s*([^;]+);`).exec(base[3])?.[1].trim() ?? null;
    const fill = baseGet("--lg-fill");
    if (!fill) {
      fail("1b slider", `the ${ground.name} ground declares no --lg-fill`);
      continue;
    }

    // Every block whose selector mentions this ground AND a data-lg step.
    const steps = new Map<string, { alpha: number; inks: Record<string, string> }>();
    for (const m of tokens.matchAll(/(^|\n)([^{}\n][^{}]*)\{([^{}]*)\}/g)) {
      const selector = m[2];
      const step = /\[data-lg="(\d)"\]/.exec(selector);
      if (!step) continue;
      const selectorIsDark = /(^|\s|,)\.dark\[data-lg/.test(selector);
      if (selectorIsDark !== ground.isDark) continue;
      const body = m[3];
      const alphaRaw = /--lg-alpha\s*:\s*([^;]+);/.exec(body)?.[1].trim();
      if (!alphaRaw) continue;
      const inks: Record<string, string> = {};
      for (const inkProp of ["--lg-ink", "--lg-ink-2"] as const) {
        const v = new RegExp(`${inkProp}\\s*:\\s*([^;]+);`).exec(body)?.[1].trim();
        if (v) inks[inkProp] = v;
      }
      steps.set(step[1], { alpha: Number(alphaRaw), inks });
    }

    if (steps.size !== 5) {
      fail(
        "1b slider",
        `the ${ground.name} ground declares ${steps.size} translucency steps, expected 5 ` +
          "— src/lib/glass-level.ts offers five, and a step the CSS does not define silently " +
          "falls back to the default while the slider claims it moved.",
      );
      continue;
    }

    for (const [stepId, { alpha, inks }] of [...steps].sort()) {
      if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
        fail("1b slider", `${ground.name} step ${stepId}: --lg-alpha "${alpha}" is not a fraction`);
        continue;
      }
      for (const inkProp of ["--lg-ink", "--lg-ink-2"] as const) {
        const raw = inks[inkProp] ?? baseGet(inkProp);
        const ink = resolve(tokens, ground.theme, raw);
        if (!ink) {
          fail("1b slider", `${ground.name} step ${stepId}: cannot resolve ${inkProp}`);
          continue;
        }
        const { r, backdrop } = worstOverAnyBackdrop(ink, fill, alpha);
        if (r < AA) {
          fail(
            "1b slider",
            `${ground.name} step ${stepId}: ${inkProp} ${ink} on ${fill} at alpha ${alpha} is ` +
              `${r.toFixed(2)}:1 over a ${backdrop} backdrop, below AA ${AA}:1.\n` +
              "    This step is REACHABLE from Settings > Appearance > Liquid Glass. Either raise its\n" +
              "    alpha, or brighten that step's ink the way the two clearest dark steps do.",
          );
        } else {
          checks += 1;
        }
      }
    }

    // The middle detent must be the ground's own default, so that a person who
    // never opens the control sees no change at all.
    const middle = steps.get("2");
    const baseAlpha = Number(baseGet("--lg-alpha"));
    if (middle && Number.isFinite(baseAlpha) && middle.alpha !== baseAlpha) {
      fail(
        "1b slider",
        `${ground.name}: step 2 is alpha ${middle.alpha} but the ground's default is ${baseAlpha}. ` +
          "Step 2 is what an untouched install renders, so the two have to agree.",
      );
    } else if (middle) {
      checks += 1;
    }

    // And the steps have to actually run clear-to-tinted, or the slider's
    // direction is a lie.
    const ordered = [0, 1, 2, 3, 4].map((i) => steps.get(String(i))!.alpha);
    for (let i = 1; i < ordered.length; i += 1) {
      if (!(ordered[i] < ordered[i - 1])) {
        fail(
          "1b slider",
          `${ground.name}: step ${i} (alpha ${ordered[i]}) is not clearer than step ${i - 1} ` +
            `(alpha ${ordered[i - 1]}). The control is labelled Solid -> Clearest.`,
        );
      } else {
        checks += 1;
      }
    }
  }
}

// ── 2. THE INK THAT CANNOT SURVIVE LIGHT GLASS IS NOT USED ON IT ────────────
//
// --ink-3 needs alpha 0.880 on a white fill to clear AA over any backdrop, past
// what this system ships (0.86). It is legal everywhere else and illegal here,
// which is a rule a reviewer cannot apply by eye — hence a gate.
{
  const lightBlock = /(^|\n)(?![^{}]*\.dark)[^{}\n][^{}]*\{([^{}]*--lg-fill:\s*#ffffff[^{}]*)\}/.exec(tokens);
  if (!lightBlock) {
    fail("2 banned ink", "the light glass block is gone — this check has lost its subject");
  } else {
    for (const banned of ["--ink-3", "--ink-4"] as const) {
      if (new RegExp(`--lg-ink[a-z0-9-]*:\\s*var\\(${banned}\\)`).test(lightBlock[2])) {
        fail(
          "2 banned ink",
          `light glass points an ink token at ${banned}.\n` +
            "    A mid-grey over a bright backdrop has nowhere to go: --ink-3 needs alpha 0.880 to clear\n" +
            "    AA over any backdrop and the material ships 0.86. Use --ink-1 or --ink-2.",
        );
      } else {
        checks += 1;
      }
    }
  }
}

// ── 3. OPAQUE IS THE BASE; TRANSLUCENCY IS OPTED INTO ───────────────────────
//
// Safari does not implement prefers-reduced-transparency, so a `reduce`
// override silently never fires — and the users who switched Reduce
// Transparency on are disproportionately the iOS users who found this material
// unreadable. Written subtractively, the material ships translucency to exactly
// the people who asked for none. A browser that has never heard of the query
// does not match `no-preference`, so it must land on an opaque base.
{
  for (const cls of [".lg-regular", ".lg-clear"] as const) {
    const base = new RegExp(`\\n${cls.replace(".", "\\.")}\\s*\\{([^{}]*)\\}`).exec(globals)?.[1];
    if (!base) {
      fail("3 additive", `${cls} is not declared — this check has lost its subject`);
      continue;
    }
    if (/backdrop-filter/.test(base)) {
      fail(
        "3 additive",
        `${cls} declares backdrop-filter in its BASE rule.\n` +
          "    Translucency has to be additive: opaque base, blur opted into inside\n" +
          "    @media (prefers-reduced-transparency: no-preference). Safari never matches a `reduce`\n" +
          "    override, so a subtractive rule ships glass to the users who turned it off.",
      );
    } else {
      checks += 1;
    }
    // The base fill must be a solid colour, not a wash.
    const bg = /background:\s*([^;]+);/.exec(base)?.[1] ?? "";
    if (/transparent|rgba|color-mix/.test(bg)) {
      fail("3 additive", `${cls}'s base background "${bg.trim()}" is translucent; the fallback must be opaque`);
    } else {
      checks += 1;
    }
  }

  const guarded = globals.match(/@media \(prefers-reduced-transparency: no-preference\)\s*\{/g) ?? [];
  if (guarded.length < 2) {
    fail(
      "3 additive",
      `found ${guarded.length} prefers-reduced-transparency guards; both variants need one`,
    );
  } else {
    checks += 1;
  }
  // Every backdrop-filter the glass introduces must sit inside such a guard.
  // (The pre-existing `backdrop-filter: none` sweeps are the opposite of a
  // risk and are excluded by name.)
  // Every blur THIS MATERIAL introduces must sit inside such a guard.
  //
  // Scoped to `.lg-*` on purpose. globals.css carries a dozen older
  // `backdrop-filter: blur(…)` declarations on the legacy `.glass-*` names,
  // and those are already neutralised downstream by three
  // `backdrop-filter: none !important` sweeps that surface-check.ts requires to
  // exist. Flagging them here would be this gate relitigating a rule another
  // gate already owns, and the noise would bury the one case that matters.
  //
  // The value is captured and THEN tested: a `(?!none)` lookahead after `\s*`
  // is defeated by backtracking — the engine matches zero spaces and asserts
  // against " none", which is not "none" — so it waved every
  // `backdrop-filter: none` straight through.
  for (const m of globals.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    if (!/\.lg-/.test(selector)) continue;
    for (const decl of m[2].matchAll(/(-webkit-)?backdrop-filter:\s*([^;]+);/g)) {
      if (/^none\b/.test(decl[2].trim())) continue;
      const before = globals.slice(0, m.index!);
      const guard = before.lastIndexOf("@media (prefers-reduced-transparency: no-preference)");
      const closed = guard < 0 ? true : before.slice(guard).split("}").length - 1 >= 2;
      if (guard < 0 || closed) {
        fail(
          "3 additive",
          `${selector} declares backdrop-filter: ${decl[2].trim()} outside a reduced-transparency guard.\n` +
            "    Safari never matches a `reduce` override, so anything not opted into behind\n" +
            "    `no-preference` ships to the users who turned transparency off.",
        );
      } else {
        checks += 1;
      }
    }
  }
}

// ── 4. NO GLASS ON GLASS ────────────────────────────────────────────────────
//
// Apple, verbatim: "always avoid glass on glass… avoid applying the material to
// both layers." Two 0.86 fills stack to 0.98, which is a smeared double blur
// rather than a material. The CSS neutraliser has to exist because the gate
// reads class strings and a nested glass can arrive through a prop.
{
  const nested = /\.lg-regular \.lg-regular,\s*\n\.lg-regular \.lg-clear,\s*\n\.lg-clear \.lg-regular,\s*\n\.lg-clear \.lg-clear\s*\{([^{}]*)\}/.exec(globals);
  if (!nested) {
    fail("4 no glass on glass", "the nested-glass neutraliser is gone; nesting would compound the fills");
  } else {
    if (!/backdrop-filter:\s*none/.test(nested[1])) {
      fail("4 no glass on glass", "the nested-glass rule no longer cancels backdrop-filter");
    } else {
      checks += 1;
    }
    checks += 1;
  }

  // And no component may spell both variants on one element — they "should
  // never be mixed", and a single element wearing both is the one case CSS
  // descendant selectors cannot catch.
  const files = [...walk(join(ROOT, "src"))].filter((f) => /\.tsx$/.test(f));
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/className=\{?["`]([^"`]*)["`]/g)) {
      if (/\blg-regular\b/.test(m[1]) && /\blg-clear\b/.test(m[1])) {
        fail(
          "4 no glass on glass",
          `${file.slice(ROOT.length + 1)} puts lg-regular and lg-clear on one element; ` +
            "the two variants have different fills and inks and must never be mixed",
        );
      }
    }
  }
  checks += 1;
}

// ── 5. THE RIM CARRIES THE BOUNDARY, BECAUSE THE FILL CANNOT ────────────────
//
// Over a matching backdrop the fill is invisible by construction — dark glass
// over a black frame measures 1.10:1 against it. So the silhouette is the rim's
// job, and a single-toned rim fails the same way for the opposite content. Two
// rings at opposite ends of the ramp: whatever the backdrop, one of them holds.
{
  const rimOut = declared(tokens, ":root,\n.light,\n.dark {", "--lg-rim-out");
  const rimIn = declared(tokens, ":root,\n.light,\n.dark {", "--lg-rim-in");
  if (!rimOut || !rimIn) {
    fail("5 rim", "--lg-rim-out / --lg-rim-in are not both declared; the boundary has one tone or none");
  } else {
    const alphaOf = (v: string) => Number(/rgba\([^)]*,\s*([\d.]+)\s*\)/.exec(v)?.[1] ?? "0");
    const isDark = /rgba\(\s*0\s*,\s*0\s*,\s*0/.test(rimOut);
    const isLight = /rgba\(\s*255\s*,\s*255\s*,\s*255/.test(rimIn);
    if (!isDark || !isLight) {
      fail(
        "5 rim",
        "the two rim tones are not at opposite ends of the ramp.\n" +
          "    A white hairline over a white frame is 1.00:1 and a black one over a black frame is\n" +
          "    1.10:1. Only a pair at the extremes guarantees one of them is visible.",
      );
    } else {
      checks += 1;
    }

    // Each tone, composited onto the content it is worst against, must clear
    // the non-text floor. The dark ring is judged over white and vice versa.
    const outOnWhite = ratio(composite("#000000", alphaOf(rimOut), "#ffffff"), "#ffffff");
    const inOnBlack = ratio(composite("#ffffff", alphaOf(rimIn), "#000000"), "#000000");
    for (const [name, r] of [["--lg-rim-out over white", outOnWhite], ["--lg-rim-in over black", inOnBlack]] as const) {
      if (r < NON_TEXT) {
        fail("5 rim", `${name} is ${r.toFixed(2)}:1, below the ${NON_TEXT}:1 non-text floor (WCAG 1.4.11)`);
      } else {
        checks += 1;
      }
    }
  }
}

// ── 6. CLEAR IS DIMMED, AND DIMMED ENOUGH ───────────────────────────────────
//
// Apple's HIG specifies ~35% over bright content. 35% is not enough without the
// surrounding adaptation Apple has: dim 0.35 under a 0.28 fill puts --media-ink
// at 3.78:1 over a white frame. The number is checked here rather than trusted.
{
  const dim = Number(declared(tokens, ":root,\n.light,\n.dark {", "--lg-dim") ?? "0");
  const clear = /\n\.lg-clear\s*\{[^{}]*\}[\s\S]{0,400}?@media \(prefers-reduced-transparency: no-preference\)\s*\{\s*\.lg-clear\s*\{([^{}]*)\}/.exec(globals);
  const clearAlpha = Number(/color-mix\(in srgb,\s*var\(--media-chip\)\s*(\d+)%/.exec(clear?.[1] ?? "")?.[1] ?? "0") / 100;

  if (!dim || !clearAlpha) {
    fail("6 clear", "--lg-dim or .lg-clear's translucent fill could not be read; Clear must not ship undimmed");
  } else {
    const ink = declared(tokens, ":root,", "--media-ink") ?? "#f5f5f5";
    // Worst case: the brightest possible frame. Dim it, then composite Clear.
    const dimmed = composite("#000000", dim, "#ffffff");
    const surface = composite("#141414", clearAlpha, dimmed);
    const r = ratio(ink, surface);
    if (r < AA) {
      fail(
        "6 clear",
        `--media-ink on Clear over a white frame is ${r.toFixed(2)}:1 at dim ${dim} / alpha ${clearAlpha}, ` +
          `below AA ${AA}:1.\n` +
          "    Apple's 35% assumes a system that adapts around the Clear variant. This one does not.",
      );
    } else {
      checks += 1;
    }
  }

  if (!/\.lg-dim-layer\s*\{/.test(globals)) {
    fail("6 clear", "the dimming layer is gone. Apple: without it \"legibility gets noticeably worse\".");
  } else {
    checks += 1;
  }
}

// ── 6b. A CHIP THAT CARRIES TEXT DOES NOT GET A TRANSLUCENT FILL ────────────
//
// Same law as the glass above, applied where it is much cheaper to obey. Glass
// earns its translucency by proving an opacity floor over every backdrop. A
// badge earns nothing: it is 12px text on a small tinted pill, and if its fill
// is translucent then the colour under the label is whatever happened to be
// behind it.
//
// Badge's accent variant was `bg-[var(--accent-subtle)]`, an rgba at 0.09-0.14,
// while its three siblings all mix an OPAQUE fill. Browser sweep across seven
// routes, compositing every label against its real ancestor chain: 49 nodes
// below AA, worst 4.20:1, and the default dark theme among them.
//
// The rule is about the SHAPE, not the value: a text-bearing chip's fill has to
// be opaque, because that is what makes its ink checkable at all.
{
  const badge = readFileSync(join(ROOT, "src/components/ui/badge.tsx"), "utf8");
  const variants = [...badge.matchAll(/^\s{2}(\w+):\s*"([^"]*)"/gm)].map((m) => [m[1], m[2]] as const);
  assert.ok(
    variants.length >= 4,
    `parsed only ${variants.length} badge variants; an assertion that reads an empty list passes everything`,
  );

  // MEASURE, DO NOT PATTERN-MATCH ON ALPHA.
  //
  // The first version of this failed any fill containing rgba() or transparent,
  // and immediately flagged the `secondary` variant, whose --ds-surface is
  // `color-mix(… --bg-secondary 82%, transparent)`. 82% of the recess colour
  // with 18% of the backdrop showing through is not the same defect as a 12%
  // accent wash, and calling it one would have taught the next reader that this
  // gate cries wolf. Alpha is not the bug; an unmeasurable ink is. So this
  // resolves the fill and runs the same floor that section 1 runs on glass.
  //
  // A fill with no alpha at all needs no sweep: the ink sits on exactly one
  // known colour, and the palette gate already measures that.
  // Follow `var()` indirection before deciding anything. --accent-subtle is
  // declared in tokens.css as `var(--accent-wash)`, so a parser that only looked
  // for rgba()/color-mix() at the first hop saw no alpha, called it opaque, and
  // waved the exact regression it exists to catch straight through — proved by
  // mutation, twice.
  const declaredAnywhere = (token: string): string | null => {
    let name = token;
    for (let hop = 0; hop < 5; hop += 1) {
      let raw: string | null = null;
      for (const css of [tokens, globals]) {
        const m = new RegExp(`${name}:\\s*([^;]+);`).exec(css);
        if (m) { raw = m[1].trim(); break; }
      }
      if (!raw) return null;
      const ref = /^var\((--[a-z0-9-]+)\)$/.exec(raw);
      if (!ref) return raw;
      name = ref[1];
    }
    return null;
  };

  /** A fill's opaque base and its alpha, or null when it is fully opaque. */
  const translucency = (token: string, theme: "light" | "dark") => {
    const raw = declaredAnywhere(token);
    if (!raw) return null;
    const mix = /color-mix\(in srgb,\s*(?:var\((--[a-z0-9-]+)\)|(#[0-9a-fA-F]{3,6}))\s*(\d+)%\s*,\s*transparent\s*\)/.exec(raw);
    if (mix) {
      const base = mix[1] ? resolve(tokens, theme, `var(${mix[1]})`) : mix[2];
      return base && /^#/.test(base) ? { base, alpha: Number(mix[3]) / 100 } : null;
    }
    const rgba = /rgba\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)[,\s]+([\d.]+)\s*\)/.exec(raw);
    if (rgba) {
      return { base: toHex([+rgba[1], +rgba[2], +rgba[3]]), alpha: Number(rgba[4]) };
    }
    return null;
  };

  for (const [name, classes] of variants) {
    const ink = /\btext-\[var\((--[a-z0-9-]+)\)\]/.exec(classes)?.[1];
    const fill = /\bbg-\[var\((--[a-z0-9-]+)\)\]/.exec(classes)?.[1];
    if (!ink || !fill) continue;

    for (const theme of ["light", "dark"] as const) {
      const wash = translucency(fill, theme);
      if (!wash) {
        checks += 1;
        continue;
      }
      const inkHex = resolve(tokens, theme, `var(${ink})`);
      if (!inkHex || !/^#/.test(inkHex)) continue;
      const { r, backdrop } = worstOverAnyBackdrop(inkHex, wash.base, wash.alpha);
      if (r < AA) {
        fail(
          "6b chip fill",
          `the "${name}" badge paints ${ink} (${inkHex}) on ${fill}, a ${Math.round(wash.alpha * 100)}% ` +
            `wash of ${wash.base}: ${r.toFixed(2)}:1 over a ${backdrop} backdrop in the ${theme} theme.\n` +
            "    A translucent chip's label sits on whatever is behind the chip, which no token-level\n" +
            "    gate can see — 49 of these shipped below AA at 12px. Mix an OPAQUE fill, the way the\n" +
            "    danger/success/warning variants already do, so the ink is measurable at all.",
        );
      } else {
        checks += 1;
      }
    }
  }
}

// ── 6c. THE MATERIAL IS LAYERED, SO A UTILITY CAN STILL OVERRIDE IT ─────────
//
// `.lg-regular` sets `position: relative` so its ::before rim and ::after sheen
// have a containing block. Declared OUTSIDE a cascade layer, that beats
// Tailwind's `absolute` utility outright — unlayered styles win over layered
// ones no matter the order — and the mesh dock, which is `absolute` and pinned
// bottom-right, silently fell out of position. Measured in a browser: y=944 in
// a 900px viewport, 1139px wide instead of 313px. Off-screen, at four times its
// width, with all 36 assertions in this file green and the whole suite green.
//
// No gate here can see layout. What a gate CAN see is the cascade rule that
// made it possible, so that is what this checks: the material sits in
// @layer components, below utilities, which is exactly what that ordering is
// for — a component states a default and a utility on the element overrides it.
{
  const layered = /@layer\s+components\s*\{/.test(globals);
  const blockAt = globals.indexOf(".lg-regular {");
  const layerAt = globals.lastIndexOf("@layer components {", blockAt);
  if (!layered || blockAt < 0 || layerAt < 0) {
    fail(
      "6c layering",
      "the Liquid Glass material is not inside @layer components.\n" +
        "    It sets `position: relative`, and unlayered that outranks every Tailwind positioning\n" +
        "    utility — which put the mesh dock off-screen while every gate stayed green.",
    );
  } else {
    checks += 1;
  }

  // And the property that made it dangerous is still there, so the rule above
  // is not quietly guarding nothing.
  const base = /\n\.lg-regular\s*\{([^{}]*)\}/.exec(globals)?.[1] ?? "";
  if (!/position:\s*relative/.test(base)) {
    fail(
      "6c layering",
      "`.lg-regular` no longer establishes a containing block. Its ::before rim and ::after sheen\n" +
        "    are `position: absolute; inset: 0`, so without it they escape to the nearest positioned\n" +
        "    ancestor and paint over unrelated UI.",
    );
  } else {
    checks += 1;
  }
}

// ── 6d. THE SCROLL EDGE BELONGS TO THE BAR, NEVER TO THE SCROLLER ───────────
//
// A CSS mask creates a containing block, which breaks `position: sticky` and
// `position: fixed` in every descendant. The first version of the scroll edge
// masked the scrolling element itself — `.mesh-content`, the whole app's scroll
// container — and eight files render sticky elements inside it: settings,
// explore, search, admin, both community surfaces and the legal pages. It would
// have unstuck all of them, on every route, to soften the edge of one bar.
//
// The effect belongs to the bar: a strip hanging below its edge, where the BLUR
// fades and the mask sits on a small element with no positioned descendants.
// That is also what Apple's effect is — a falloff in blur, not a fill.
{
  const edge = /\.lg-scroll-edge::after\s*\{([^{}]*)\}/.exec(globals)?.[1];
  if (!edge) {
    fail("6d scroll edge", "the scroll edge is gone; this check has lost its subject");
  } else {
    if (!/top:\s*100%/.test(edge)) {
      fail(
        "6d scroll edge",
        "the scroll edge no longer hangs BELOW its bar (`top: 100%`).\n" +
          "    Inside the bar it would blur the bar's own contents; on the scroller it would break\n" +
          "    every sticky descendant.",
      );
    } else {
      checks += 1;
    }
    // BOTH spellings. Requiring the substring once was satisfied by the
    // -webkit- copy alone, so the standard property could be dropped and this
    // stayed green — shown by mutation. WebKit still needs the prefix and every
    // other engine needs the standard name, so neither is optional.
    const fades = (edge.match(/mask-image:\s*linear-gradient\(to bottom, #000, transparent\)/g) ?? []).length;
    if (fades < 2) {
      fail(
        "6d scroll edge",
        `the scroll edge declares the falloff ${fades} time(s); it needs both -webkit-mask-image\n` +
          "    and mask-image, or it is a hard line in half the browsers that matter.",
      );
    } else {
      checks += 1;
    }
    // "They don't block or darken like overlays" — so no fill, ever.
    if (/background:/.test(edge)) {
      fail(
        "6d scroll edge",
        "the scroll edge paints a background. Apple: scroll edge effects \"don't block or darken\n" +
          "    like overlays\" — the separation comes from blur falling off, not from a scrim.",
      );
    } else {
      checks += 1;
    }
  }

  // And the mask must never land back on a scroll container.
  for (const m of globals.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    const body = m[2];
    if (!/mask-image/.test(body)) continue;
    if (/overflow(-y)?:\s*(auto|scroll)/.test(body)) {
      fail(
        "6d scroll edge",
        `${selector} sets both a mask and overflow: a masked scroll container becomes a containing\n` +
          "    block, which silently unsticks every sticky child inside it.",
      );
    } else {
      checks += 1;
    }
  }
}

// ── 7. REFRACTION IS NOT SHIPPED, AND THE REASON IS RECORDED ────────────────
//
// Lensing is what Apple names as the entire distinction from the old frosted
// materials, and on the web it needs `backdrop-filter: url(#…)`, which WebKit
// has not implemented. capacitor.config.ts points the iOS app at the hosted
// site, so the primary mobile platform IS WebKit: shipping it would build the
// product's signature material for desktop Chrome and nobody else.
{
  if (/backdrop-filter:\s*url\(/.test(globals)) {
    fail(
      "7 refraction",
      "backdrop-filter: url(#…) is being used for refraction.\n" +
        "    WebKit does not implement it (bug 245510), and capacitor.config.ts serves the iOS app\n" +
        "    from the hosted site — so this renders for desktop Chromium and for no phone at all.",
    );
  } else {
    checks += 1;
  }
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

if (failures.length) {
  console.error(`\nglass: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(
  `glass OK — ${checks} assertions. Every ink on every glass clears AA over ${BACKDROPS.length} backdrops\n` +
    "  spanning the full luminance ramp and the six saturated corners, measured by compositing in\n" +
    "  gamma-encoded sRGB rather than by trusting an alpha. The opaque form is the base and\n" +
    "  translucency is opted into, so a browser without prefers-reduced-transparency (Safari, which\n" +
    "  is every iOS user of this app) gets the readable one. The rim carries the boundary at 1.4.11\n" +
    "  in both directions, glass never stacks on glass, Clear is dimmed past Apple's 35%, and\n" +
    "  refraction is absent by decision rather than by accident.\n" +
    "  Does NOT cover: what a real frame behind a real toolbar looks like. This proves the floor,\n" +
    "  not the taste.",
);
