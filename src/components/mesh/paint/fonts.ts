// THE CANVAS SPEAKS THE BRAND'S TYPE.
//
// Every ctx.font in paint/ hardcoded `ui-sans-serif, system-ui` — the DOM wore
// Instrument Sans and Fraunces while the product's NAMESAKE surface spoke
// whatever the operating system happened to supply. A canvas that is 100% of
// the screen and 0% of the typeface is the loudest possible place for the brand
// to be missing.
//
// This bridge existed once and was lost. It was added alongside the canvas's
// typography pass, then went out with the 66-file scene when /mesh was replaced
// — and the verbatim restore brought the scene back from a commit that predates
// it, so the pills came back speaking the system stack. This is that module,
// re-made for the restored scene.
//
// WHY IT CANNOT NAME THE FACES. next/font registers HASHED family names
// (`__Instrument_Sans_abc123`), decided at build time. No literal in this file
// could name them. What it can do is read the same custom properties the DOM
// reads — layout.tsx puts `--font-sans-loaded` on <html> via next/font's
// `variable` — and fall back to the system stack when there is no DOM at all.
//
// THE FALLBACK IS LOAD-BEARING, not defensive. paint/ is imported by modules
// that run without a document, and `getComputedStyle` would throw there. The
// system stack is also what any pre-hydration or Node render deterministically
// gets, so the geometry those produce is unchanged by this file existing.

const SANS_FALLBACK = "ui-sans-serif, system-ui, sans-serif";

let sans = SANS_FALLBACK;
let initialized = false;

function init(): void {
  if (initialized || typeof document === "undefined") return;
  initialized = true;
  const loaded = getComputedStyle(document.documentElement).getPropertyValue("--font-sans-loaded").trim();
  // Appended to, never replacing, the stack: the hashed family is first choice
  // and the system faces still catch the swap window and any glyph the subset
  // does not carry.
  if (loaded) sans = `${loaded}, ${SANS_FALLBACK}`;
}

/** Body/label stack for canvas text — Instrument Sans once it has loaded. */
export function canvasSans(): string {
  init();
  return sans;
}

// NOT HERE YET, AND DELIBERATELY SO — the two other halves of the original
// bridge, named so the next person does not have to rediscover them:
//
//   canvasDisplay()  the Fraunces stack (`--font-display-loaded`), for the
//                    branch pills and the self nameplate in paint/nodes.ts.
//                    Whoever adds it must move sim/hitmap.ts's FONT_STACK in
//                    the same commit: hitmap MEASURES the branch pill to build
//                    its hit rect, so a painter that draws in one face while
//                    the hit-test measures another puts the tap target off the
//                    pill it belongs to.
//   fontEpoch()      0 before document.fonts.ready, 1 after — folded into the
//                    sprite key in paint/nodes.ts so text-bearing sprites
//                    rasterized during the swap window re-rasterize exactly
//                    once when the real faces land, instead of caching fallback
//                    glyphs for the life of the session.
//
// Neither is exported today because nothing in this tree consumes it, and an
// export with no call site is a claim the code does not keep.
