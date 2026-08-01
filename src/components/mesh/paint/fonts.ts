// THE CANVAS FINALLY SPEAKS THE BRAND'S TYPE.
//
// Every ctx.font in paint/ used to hardcode `ui-sans-serif, system-ui` — the
// DOM wore Instrument Sans and Fraunces while the product's namesake surface
// spoke the system default. next/font registers hashed family names, so the
// canvas cannot name the faces literally; it reads the SAME custom properties
// the DOM uses (--font-sans-loaded / --font-display-loaded, set by
// next/font in layout.tsx) and falls back to the system stack.
//
// DOM-less renders (mesh-render-parity runs in Node) get the fallback stack
// deterministically, so the op-stream contract is unchanged there.
//
// Sprites rasterized before the faces finish loading would keep fallback
// glyphs forever — fontEpoch() folds "the faces arrived" into the sprite key
// so text-bearing sprites re-rasterize exactly once, when it matters.

const SANS_FALLBACK = "ui-sans-serif, system-ui, sans-serif";
const DISPLAY_FALLBACK = SANS_FALLBACK;

let sans = SANS_FALLBACK;
let display = DISPLAY_FALLBACK;
let epoch = 0;
let initialized = false;

function init(): void {
  if (initialized || typeof document === "undefined") return;
  initialized = true;
  const cs = getComputedStyle(document.documentElement);
  const sansVar = cs.getPropertyValue("--font-sans-loaded").trim();
  const displayVar = cs.getPropertyValue("--font-display-loaded").trim();
  if (sansVar) sans = `${sansVar}, ${SANS_FALLBACK}`;
  if (displayVar) display = `${displayVar}, ${DISPLAY_FALLBACK}`;
  // One epoch bump when the document's faces settle: cached text sprites
  // re-key once, instead of holding first paint hostage or thrashing.
  if (document.fonts?.ready) {
    void document.fonts.ready.then(() => {
      epoch = 1;
    });
  }
}

/** Body/label stack for canvas text — Instrument Sans once loaded. */
export function canvasSans(): string {
  init();
  return sans;
}

/** Display stack — Fraunces — for the self nameplate and branch pills. */
export function canvasDisplay(): string {
  init();
  return display;
}

/** 0 before the document's fonts are ready, 1 after. Part of sprite keys. */
export function fontEpoch(): number {
  init();
  return epoch;
}
