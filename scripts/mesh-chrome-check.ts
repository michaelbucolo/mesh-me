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
  for (const required of ["MeshContextBar", "MeshDock"]) {
    // The name must END here. `chrome.includes("<MeshDock")` was the first
    // draft, and mutation M7 walked straight through it: renaming the element
    // to <MeshDockDisabled kept the substring and the gate reported green
    // while the dock was gone. A prefix match is not an identity check.
    if (!new RegExp(`<${required}(?![A-Za-z0-9_])`).test(chrome)) {
      fail("2 one owner", `chrome.tsx does not render <${required}> — the chrome group has been split again`);
    } else ok();
  }
  // The ambient slot moved into the desk's Today strip (`.mesh-tray` in
  // desk.tsx) — the DESK owns it now, and chrome.tsx must not grow a second
  // renderer for the same queue.
  if (/<MeshMarquee(?![A-Za-z0-9_])/.test(chrome)) {
    fail("2 one owner", "chrome.tsx renders <MeshMarquee> again — the ambient slot lives in the desk's tray; two renderers for one queue is the pile-up this gate exists to stop");
  } else ok();
  const desk = strip(read(`${UI_DIR}/desk.tsx`));
  if (!/\bmesh-tray\b/.test(desk)) {
    fail("2 one owner", "desk.tsx has no .mesh-tray — the one ambient slot has no home");
  } else ok();
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
  const desk = strip(read(`${UI_DIR}/desk.tsx`));

  // The floating objects each anchor exactly once, through a named class
  // whose position lives in CSS rather than in a Tailwind soup of edge
  // utilities: the rim pair over the full-screen world, and the HUD (the one
  // collapsible ledger) at the right edge.
  if (!/className={`mesh-rim-keys\b[^`]*\babsolute\b|className="[^"]*\bmesh-rim-keys\b[^"]*\babsolute\b/.test(dock)) {
    fail("3 anchors", "the rim keys' root is not a single `.mesh-rim-keys absolute` — its position has scattered back into utilities");
  } else ok();
  if (!/className="[^"]*\bmesh-rim-context\b[^"]*\babsolute\b/.test(context)) {
    fail("3 anchors", "the context bar's root is not a single `.mesh-rim-context absolute`");
  } else ok();
  // The HUD is desk.tsx's ONE floating object; anything else absolute there
  // is a fourth island growing back.
  const deskAnchors = [...desk.matchAll(/className="([^"]*\babsolute\b[^"]*)"/g)]
    .map((m) => m[1])
    // A presence dot pinned to its avatar's corner is part of the avatar,
    // not an island (negative-offset corner pins are always decorations).
    .filter((cls) => !/-bottom-0\.5|-top-1/.test(cls));
  if (!deskAnchors.length || deskAnchors.some((cls) => !/\bmesh-hud\b/.test(cls))) {
    fail("3 anchors", `desk.tsx floats something that is not .mesh-hud: ${deskAnchors.join(" | ") || "(none found)"}`);
  } else ok();

  // Count edge-pinned islands the chrome group declares. Two is the budget
  // here: rim context and rim keys (the HUD is counted above, in its own
  // file). The rewind panel is a layer, not an anchor.
  const anchorClasses = new Set<string>();
  for (const src of [dock, context, chrome]) {
    for (const m of src.matchAll(/className="([^"]*\babsolute\b[^"]*)"/g)) {
      const cls = m[1];
      // A popover anchored to its own key is not an island — it is part of the
      // object that owns it, and it moves with it. Same for the badge pinned
      // to a key's corner.
      if (/\bbottom-full\b|\btop-full\b/.test(cls)) continue;
      if (/\bmesh-dock-badge\b/.test(cls)) continue;
      const named = /\b(mesh-rim-keys|mesh-rim-context)\b/.exec(cls)?.[1];
      if (named) anchorClasses.add(named);
      else anchorClasses.add(cls.replace(/\s+/g, " ").trim());
    }
  }
  if (anchorClasses.size > 2) {
    fail(
      "3 anchors",
      `${anchorClasses.size} persistent chrome anchors on the mesh (budget 2: rim context, rim keys). New: ${[...anchorClasses].join(" | ")}`,
    );
  } else ok();
}

// ── 4. The chrome is made of the product's material ──────────────────────────
//
// The rail was `.mesh-glass` paper pills while every other control in the app
// is a moulded `.key`. That single mismatch is most of why the mesh read as an
// embedded widget rather than a screen of mesh.me.
//
// RETARGETED, because the material changed by design rather than by accident.
// This asserted `.tray` on both, with the reason "a recess is what holds keys".
// A recess is a hole in the page, and neither of these is in the page: they
// float above a live canvas with nodes and edges moving behind them. That is
// exactly the layer Apple describes — "Liquid Glass defines a new functional
// layer in the UI, floating above your content" — so they are `.lg-regular`.
//
// The assertion is not weakened, it is moved: they must now BE the functional
// material, and must not also claim to be a recess, because an element wearing
// both states two different things about the same surface and only source order
// decides which one renders.
{
  const dock = strip(read(`${UI_DIR}/dock.tsx`));
  const context = strip(read(`${UI_DIR}/context-bar.tsx`));

  for (const [name, src] of [["dock", dock], ["context bar", context]] as const) {
    if (!/\blg-regular\b/.test(src)) {
      fail(
        "4 material",
        `the ${name} is not .lg-regular — it floats above the canvas, so it is the functional layer`,
      );
    } else ok();
    if (/\btray\b/.test(src)) {
      fail(
        "4 material",
        `the ${name} still carries .tray alongside the glass. A recess and a floating material are\n` +
          `  two different claims about one surface, and .lg-regular only wins because it is declared\n` +
          `  later in globals.css — which is not a rule, just an ordering.`,
      );
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

  // CONCENTRICITY, which the material change could silently have broken.
  //
  // Apple's rule is innerRadius = outerRadius - padding, and this dock already
  // satisfied it by construction: .tray was --radius-lg (20px), the padding is
  // p-1.5 (6px), and .key is --radius-md (14px). 20 - 6 = 14, exactly.
  // .lg-regular also sets --radius-lg, so the relationship survives — but only
  // as long as all three keep their values, which is what this measures.
  const css = read("src/app/globals.css");
  const radius = (name: string) => {
    const m = new RegExp(`--radius-${name}:\\s*([\\d.]+)rem`).exec(css);
    return m ? Number(m[1]) * 16 : null;
  };
  const [lg, md] = [radius("lg"), radius("md")];
  const padded = /className={`mesh-rim-keys lg-regular[^`]*\bp-1\.5\b|className="mesh-rim-keys lg-regular[^"]*\bp-1\.5\b/.test(dock);
  if (lg === null || md === null) {
    fail("4 material", "the radius ladder has moved out of globals.css; concentricity is no longer measurable");
  } else if (!padded) {
    fail("4 material", "the dock's padding is no longer p-1.5, so the concentric radii no longer follow");
  } else if (Math.round(lg - 6) !== Math.round(md)) {
    fail(
      "4 material",
      `the dock is not concentric: outer ${lg}px minus 6px padding is ${lg - 6}px, but .key is ${md}px.\n` +
        "  Apple's ConcentricRectangle rule is innerRadius = outerRadius - padding; break it and the\n" +
        "  keys sit in a tray whose corners do not follow theirs.",
    );
  } else ok();
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

// ── 6. Whatever still floats near the tab bar clears it from ONE number ──────
//
// The desk is in normal flow (the page scroller handles the tab bar), so the
// rim chrome never meets it. The continuum handle is the one element on this
// surface still pinned near the bottom edge; if it clears the bar with a
// literal height copied out of the nav, the two drift the first time either
// changes — the exact shape of failure that took production down over
// schema.prisma vs ensure-schema.sql.
{
  const css = read("src/app/globals.css");
  if (!/--mobile-nav-h\s*:/.test(css)) {
    fail("6 one number", "--mobile-nav-h is not declared; bottom clearance is a magic number again");
  } else ok();
  const handleRule = /\.mesh-continuum-handle-down\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  if (!/var\(--mobile-nav-h/.test(handleRule)) {
    fail("6 one number", ".mesh-continuum-handle-down does not read var(--mobile-nav-h) — it will sit under the tab bar the moment the bar's height changes");
  } else ok();
  // The HUD's height budget must also stop at the tab bar, from the same
  // one number.
  const hudRule = /\.mesh-hud\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  if (!/var\(--mobile-nav-h/.test(hudRule)) {
    fail("6 one number", ".mesh-hud does not read var(--mobile-nav-h) — the ledger will run under the tab bar on phones");
  } else ok();
  const navRule = /\.mobile-bottom-nav\s*\{([^}]*)\}/g;
  let navReadsToken = false;
  for (const m of css.matchAll(navRule)) {
    if (/var\(--mobile-nav-h/.test(m[1])) navReadsToken = true;
  }
  if (!navReadsToken) {
    fail("6 one number", ".mobile-bottom-nav does not apply --mobile-nav-h, so the token describes nothing and the clearance is a number nobody enforces");
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

  // The world is full-bleed again, and the top bar sits absolute OVER it —
  // every floating object at the top edge must derive its clearance from the
  // bar's one token (which is 0 wherever the bar is hidden).
  for (const cls of [".mesh-rim-context", ".mesh-rim-keys", ".mesh-hud"]) {
    const rule = new RegExp(`\\${cls}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";
    if (!/top:\s*calc\([^)]*var\(--mesh-topbar-h/.test(rule)) {
      fail("7 top clearance", `${cls} does not derive its top from var(--mesh-topbar-h) — it will render under the top bar the moment that bar's height changes`);
    } else ok();
  }
}

if (failures.length) {
  console.error(`\nmesh-chrome: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(`mesh-chrome: ${checks} assertions passed — two anchors, one material, no loose pigment.`);
