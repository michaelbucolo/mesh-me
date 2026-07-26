/**
 * THE MESH HAS TWO CHROME ANCHORS. IT USED TO HAVE SEVEN.
 *
 * Photographed on the running build at 1440×900 and 390×844 before the
 * rebuild, /mesh carried seven absolutely-positioned islands:
 *
 *   1. a Mesh|Global pill at left-1/2 top-20 — dead centre, over a post card
 *   2. a three-pill visiting row at left-3 top-20
 *   3. a 46×440 column of eight identical discs at right-3 top-1/2
 *      (46×408 on the phone — 48% of the screen height, down the held edge)
 *   4. a column of unseen chip-pairs at bottom-5 left-3
 *   5. an ambient toast at left-1/2 top-32
 *   6. a live-paused pip at bottom-4 left-1/2
 *   7. the continuum handle at bottom-centre
 *
 * Nobody designed that. Each one was a reasonable local decision — a control
 * needed a home, so it got its own floating chip. The scatter is what the user
 * meant by "cheap and impractical", and the reason it happened is that no
 * single place was responsible for the answer.
 *
 * Now `ui/chrome.tsx` is that place, and it mounts two anchored objects: the
 * context bar (where am I) and the dock (what can I do). This gate fails the
 * build when a ninth control decides it needs a corner of its own.
 *
 * ── WHAT THIS CANNOT PROVE ───────────────────────────────────────────────────
 *
 * That the result looks good, or that a control is reachable. It counts
 * anchored islands in source and checks the material vocabulary; it does not
 * render anything. A dock with every key wired to a no-op passes this cleanly.
 * It also cannot see an island introduced through a variable class string or a
 * wrapper component — it reads literals.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
/** Blank comments while keeping the file readable as code. A gate that reads
 *  its own prose as product source cannot explain itself — this codebase has
 *  shipped that bug twice (meshpro-claims, public-supply). */
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(\/\/|\s\*).*$/gm, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => {
  checks += 1;
};

const UI_DIR = "src/components/mesh/ui";
const uiFiles = readdirSync(join(ROOT, UI_DIR)).filter((f) => f.endsWith(".tsx"));

// ── 1. The rail and its siblings are gone, not merely unmounted ──────────────
//
// A deleted component that still exists on disk gets re-imported by the next
// person who needs a button somewhere.
{
  for (const gone of ["rail.tsx", "mode-tabs.tsx", "wedge-counts.tsx"]) {
    if (uiFiles.includes(gone)) {
      fail("1 the rail", `${UI_DIR}/${gone} is back. The eight-disc rail and its loose chips were replaced by dock.tsx + context-bar.tsx; two components for one job is how this started.`);
    } else ok();
  }
  for (const required of ["dock.tsx", "context-bar.tsx", "chrome.tsx"]) {
    if (!uiFiles.includes(required)) {
      fail("1 the rail", `${UI_DIR}/${required} is missing — the mesh chrome has no owner`);
    } else ok();
  }
}

// ── 2. Chrome mounts from ONE place ──────────────────────────────────────────
//
// chrome.tsx calls itself "the mesh's ONE stacking manager". That is only true
// while the surface does not mount persistent chrome around it.
{
  const chrome = strip(read(`${UI_DIR}/chrome.tsx`));
  for (const required of ["MeshContextBar", "MeshDock", "MeshMarquee"]) {
    // The name must END here. `chrome.includes("<MeshDock")` was the first
    // draft, and mutation M7 walked straight through it: renaming the element
    // to <MeshDockDisabled kept the substring and the gate reported green
    // while the dock was gone. A prefix match is not an identity check.
    if (!new RegExp(`<${required}(?![A-Za-z0-9_])`).test(chrome)) {
      fail("2 one owner", `chrome.tsx does not render <${required}> — the chrome group has been split again`);
    } else ok();
  }
  const surface = strip(read("src/components/mesh/scene/mesh-surface.tsx"));
  // The surface may mount overlays (they are layers, not anchors) but must not
  // mount a second persistent toolbar.
  for (const banned of ["MeshRail", "MeshModeTabs", "MeshVisitingHeader", "MeshWedgeCounts"]) {
    if (surface.includes(banned)) {
      fail("2 one owner", `mesh-surface.tsx still mounts ${banned}, which chrome.tsx now owns`);
    } else ok();
  }
}

// ── 3. Anchor budget ─────────────────────────────────────────────────────────
//
// Every persistent chrome element pinned to an edge or a corner. Transient
// overlays (search, list, compose, the rewind panel, gates) are NOT anchors:
// they are full-surface layers in the dismissal stack, one at a time.
{
  const dock = strip(read(`${UI_DIR}/dock.tsx`));
  const context = strip(read(`${UI_DIR}/context-bar.tsx`));
  const chrome = strip(read(`${UI_DIR}/chrome.tsx`));

  // The two objects each anchor exactly once, through a named class whose
  // position lives in CSS rather than in a Tailwind soup of edge utilities.
  if (!/className="[^"]*\bmesh-dock\b[^"]*\babsolute\b/.test(dock)) {
    fail("3 anchors", "the dock's root is not a single `.mesh-dock absolute` — its position has scattered back into utilities");
  } else ok();
  if (!/className="[^"]*\bmesh-context\b[^"]*\babsolute\b/.test(context)) {
    fail("3 anchors", "the context bar's root is not a single `.mesh-context absolute`");
  } else ok();

  // Count edge-pinned islands the chrome group declares. Three is the budget:
  // context bar, marquee, dock. The rewind panel is a layer, not an anchor.
  const anchorClasses = new Set<string>();
  for (const src of [dock, context, chrome]) {
    for (const m of src.matchAll(/className="([^"]*\babsolute\b[^"]*)"/g)) {
      const cls = m[1];
      // A popover anchored to its own key is not an island — it is part of the
      // object that owns it, and it moves with it.
      if (/\bbottom-full\b|\btop-full\b/.test(cls)) continue;
      const named = /\b(mesh-dock|mesh-context|mesh-marquee)\b/.exec(cls)?.[1];
      if (named) anchorClasses.add(named);
      else anchorClasses.add(cls.replace(/\s+/g, " ").trim());
    }
  }
  if (anchorClasses.size > 3) {
    fail(
      "3 anchors",
      `${anchorClasses.size} persistent chrome anchors on the mesh (budget 3: context bar, marquee, dock). New: ${[...anchorClasses].join(" | ")}`,
    );
  } else ok();
}

// ── 4. The chrome is made of the product's material ──────────────────────────
//
// The rail was `.mesh-glass` paper pills while every other control in the app
// is a moulded `.key`. That single mismatch is most of why the mesh read as an
// embedded widget rather than a screen of mesh.me.
{
  const dock = strip(read(`${UI_DIR}/dock.tsx`));
  const context = strip(read(`${UI_DIR}/context-bar.tsx`));

  for (const [name, src] of [["dock", dock], ["context bar", context]] as const) {
    if (!/\btray\b/.test(src)) {
      fail("4 material", `the ${name} is not a .tray — a recess is what holds keys`);
    } else ok();
    if (!/\bkey\b/.test(src)) {
      fail("4 material", `the ${name} has no .key — its controls are made of something other than the app's controls`);
    } else ok();
    // shape-check.ts forbids the pair outright; asserting it here too means a
    // regression is caught by the gate that owns THIS surface, with a message
    // about this surface.
    if (/className="[^"]*\bkey\b[^"]*\bds-interactive\b/.test(src)) {
      fail("4 material", `the ${name} pairs .key with .ds-interactive — a key presses, it does not lift`);
    } else ok();
  }
}

// ── 5. Pigment is ink, never a fill ──────────────────────────────────────────
//
// The marquee shipped three raw Tailwind palette hues as FILLS — cyan for
// catch-up, emerald for weave, violet for presence — plus a fourth in the
// wedge chips. Nobody could learn what the colours meant, because the slot is
// a priority queue and you never see two at once.
{
  const PALETTE = "(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)";
  const FILL = new RegExp(`\\b(?:bg|border)-${PALETTE}-\\d{2,3}\\b`, "g");
  for (const file of uiFiles) {
    const src = strip(read(`${UI_DIR}/${file}`));
    const hits = [...src.matchAll(FILL)].map((m) => m[0]);
    if (hits.length) {
      fail("5 pigment", `${UI_DIR}/${file} paints raw palette fills (${[...new Set(hits)].join(", ")}). On this surface pigment is ink; fills come from --paper-*, --face and the mould plastics.`);
    } else ok();
  }
}

// ── 6. The dock clears the tab bar from ONE number ───────────────────────────
//
// The dock sits above the mobile tab bar. If it clears it with a literal
// height copied out of the nav, the two drift the first time either changes —
// the exact shape of failure that took production down over schema.prisma vs
// ensure-schema.sql.
{
  const css = read("src/app/globals.css");
  if (!/--mobile-nav-h\s*:/.test(css)) {
    fail("6 one number", "--mobile-nav-h is not declared; the dock's clearance is a magic number again");
  } else ok();
  const dockRule = /\.mesh-dock\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  if (!/var\(--mobile-nav-h/.test(dockRule)) {
    fail("6 one number", ".mesh-dock does not read var(--mobile-nav-h) — it will sit under the tab bar the moment the bar's height changes");
  } else ok();
  const navRule = /\.mobile-bottom-nav\s*\{([^}]*)\}/g;
  let navReadsToken = false;
  for (const m of css.matchAll(navRule)) {
    if (/var\(--mobile-nav-h/.test(m[1])) navReadsToken = true;
  }
  if (!navReadsToken) {
    fail("6 one number", ".mobile-bottom-nav does not apply --mobile-nav-h, so the token describes nothing and the dock is clearing a number nobody enforces");
  } else ok();
  // The breakpoint at which the dock stops reserving room must be the one at
  // which the bar actually disappears (`md:hidden` = 768px). A 1024px override
  // leaves a 3.5rem hole nothing occupies between the two.
  const dockMedia = /@media \(min-width: (\d+)px\) \{\s*\.mesh-dock\s*\{/.exec(css)?.[1];
  if (dockMedia !== "768") {
    fail("6 one number", `.mesh-dock drops its tab-bar clearance at ${dockMedia ?? "no"}px, but .mobile-bottom-nav is md:hidden (768px)`);
  } else ok();
}

// ── 7. The chrome clears the top bar from ONE number too ─────────────────────
//
// This is not hypothetical. The first draft of the context bar pinned itself at
// a flat `top: 0.75rem` and rendered UNDERNEATH the top bar — which on this
// surface is `position: absolute; top: 0` over the canvas. It was photographed
// that way: half a Mesh|Global switch peeking out from behind the page title.
// The code it replaced had avoided that with a hardcoded `top-20` (80px, to
// clear 72px) written in a component, which is the same bug waiting for either
// number to move.
{
  const css = read("src/app/globals.css");
  if (!/--mesh-topbar-h\s*:/.test(css)) {
    fail("7 top clearance", "--mesh-topbar-h is not declared; the mesh chrome is guessing how tall the top bar is");
  } else ok();

  const topbarRule = /\.mesh-topbar\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  if (!/min-height:\s*var\(--mesh-topbar-h/.test(topbarRule)) {
    fail("7 top clearance", ".mesh-topbar does not size itself from --mesh-topbar-h, so the token describes nothing");
  } else ok();

  for (const cls of [".mesh-context", ".mesh-marquee"]) {
    const rule = new RegExp(`\\${cls}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";
    if (!/top:\s*calc\([^)]*var\(--mesh-topbar-h/.test(rule)) {
      fail("7 top clearance", `${cls} does not derive its top from var(--mesh-topbar-h) — it will render under the top bar the moment that bar's height changes`);
    } else ok();
  }

  // The dock is bottom-anchored, so it must NOT reserve top-bar room — doing so
  // would be a third opinion about a bar it never touches.
  const dockRule = /\.mesh-dock\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  if (/--mesh-topbar-h/.test(dockRule)) {
    fail("7 top clearance", ".mesh-dock reads --mesh-topbar-h, but it is anchored to the bottom and never meets the top bar");
  } else ok();
}

if (failures.length) {
  console.error(`\nmesh-chrome: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(`mesh-chrome: ${checks} assertions passed — two anchors, one material, no loose pigment.`);
