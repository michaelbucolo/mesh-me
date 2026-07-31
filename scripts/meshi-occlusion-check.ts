/**
 * THE FLOAT DOES NOT MOVE. THAT IS THE WHOLE OCCLUSION STORY NOW.
 *
 * This check used to guard a text-measuring avoidance system — candidate
 * positions, overlap scoring, a leaf-text walk, a drag cache — because the
 * float wandered: it trailed the pointer, dodged scrolls, flew to per-route
 * arrival points, and so needed several hundred lines of geometry to avoid
 * parking on the Email verification row. The tone reset (R5: mascot presence
 * policy) removed the wandering itself. The float is chrome: ONE instance,
 * pinned to the corner by `.meshi-float-shell` in globals.css — above the tab
 * bar and the compose FAB on phones, plain corner inset from 768px up — and
 * the component computes no position at all.
 *
 * A fixed dock cannot drift onto content, so the invariant this file guards
 * flipped from "the avoidance system stays complete" to "the positioning
 * system stays ABSENT". Every assertion below names a piece of the old
 * wandering apparatus and fails if it grows back, because each one grew out
 * of a real photographed defect and each one is exactly what R5 deleted:
 * a follow effect puts the mascot over content; a drag handler makes the
 * corner negotiable; an avoid-rect walk means something moves that needs to
 * avoid; an inline left/top means CSS no longer owns the corner.
 *
 * WHAT THIS CANNOT DO: check the rendered dock clears the FAB and tab bar.
 * That was measured directly at 390 and 1440px when the dock CSS landed.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const src = readFileSync(join(ROOT, "src/components/meshi/meshi-float.tsx"), "utf8");
const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
const stripped = src
  .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
  .replace(/^\s*\/\/.*$/gm, (m) => " ".repeat(m.length));

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => {
  checks += 1;
};

// ── 1. NO POSITIONING APPARATUS IN THE COMPONENT ────────────────────────────
//
// Each name below is a limb of the deleted wandering system. Any one of them
// reappearing means the float has started computing where to stand again.
{
  const FORBIDDEN = [
    "getMeshiAvoidRects",
    "getReadableTextRects",
    "findSafeMeshiPosition",
    "getSafePosition",
    "getPointerFollowPosition",
    "getPageArrivalPosition",
    "MESHI_AVOID_SELECTOR",
    "dragAvoidRectsRef",
    "useMotionValue",
    "useSpring",
    "handlePointerDown",
    "handlePointerMove",
    "cursorSpriteOwnsPointer",
  ];
  const found = FORBIDDEN.filter((name) => stripped.includes(name));
  if (found.length) {
    fail(
      "1 no positioning",
      `the wandering apparatus is growing back: ${found.join(", ")}.\n` +
        "  The float is docked chrome — CSS owns its corner. A float that computes positions needs the\n" +
        "  whole avoidance system back (text rects, drag cache, safe-position search), and that system\n" +
        "  existed to serve behaviors (pointer-follow, scroll-dodge, arrival flights) the tone reset\n" +
        "  deliberately removed.",
    );
  } else ok();

  // The shell must not position itself inline; `.meshi-float-shell` in
  // globals.css is the single authority for where Meshi stands.
  const shellTag = /className="meshi-float-shell[^"]*"/.exec(stripped)?.[0] ?? "";
  if (!shellTag) {
    fail("1 no positioning", "the `.meshi-float-shell` class is gone; the dock CSS has lost its subject");
  } else ok();
  if (/style=\{\{[^}]*(left|top|right|bottom)\s*:/.test(stripped)) {
    fail(
      "1 no positioning",
      "an inline left/top/right/bottom style has appeared in the float. CSS owns the corner; a second\n" +
        "  opinion in JS is how the last system ended up with three bodies on one screen.",
    );
  } else ok();
}

// ── 2. THE DOCK CSS EXISTS AND CLEARS THE PHONE CHROME ──────────────────────
{
  const dock = /\.meshi-float-shell\s*\{([\s\S]*?)\}/.exec(css)?.[1];
  if (!dock) {
    fail("2 dock css", "`.meshi-float-shell` has no rule in globals.css; nothing places the float");
  } else {
    if (!/bottom:\s*calc\([^)]*--mobile-nav-h/.test(dock)) {
      fail(
        "2 dock css",
        "the phone dock no longer clears the tab bar from its token (`--mobile-nav-h`). A literal here\n" +
          "  is a guess that goes stale the day the bar changes height.",
      );
    } else ok();
    if (!/env\(safe-area-inset-bottom\)/.test(dock)) {
      fail("2 dock css", "the phone dock ignores the home indicator (`safe-area-inset-bottom`)");
    } else ok();
  }
}

// ── 3. ONE BODY, SINGLETON-MARKED, YIELDING TO THE CANVAS ───────────────────
//
// The mesh canvas draws the same character; the DOM body must yield there so
// Meshi stays a strict singleton (this is also asserted at runtime by
// meshi:singleton against the rendered page).
{
  if (!/\{!isMeshSurface && \(/.test(stripped)) {
    fail("3 one body", "the float no longer yields to the canvas Meshi on the mesh surface");
  } else ok();
  if (!/data-meshi-singleton="true"/.test(stripped)) {
    fail("3 one body", "the singleton marker attribute is gone; the runtime singleton check loses its subject");
  } else ok();
  const mascotMounts = (stripped.match(/<MeshiMascot/g) ?? []).length;
  if (mascotMounts !== 1) {
    fail(
      "3 one body",
      `the float renders ${mascotMounts} MeshiMascot bodies; the policy is exactly one.`,
    );
  } else ok();
}

// ── 4. NO PERMANENT BALLOONS ────────────────────────────────────────────────
//
// The "Tap" chip and the "Fact-check ready" popover floated over content on
// six of eleven screens. Meshi speaks only inside its own opened panel; the
// content actions live in the post ⋯ menu and arrive via MESHI_PROMPT_EVENT.
{
  if (/>\s*Tap\s*</.test(stripped) || /Fact-check ready/.test(stripped)) {
    fail(
      "4 no balloons",
      "a permanent balloon (\"Tap\" chip or \"Fact-check ready\" popover) is back on the float.\n" +
        "  Meshi speaks only inside its own opened panel; content actions belong to the post ⋯ menu.",
    );
  } else ok();
  if (!/MESHI_PROMPT_EVENT/.test(stripped)) {
    fail(
      "4 no balloons",
      "the float no longer listens for MESHI_PROMPT_EVENT, so the post ⋯ menu's Summarize/Fact-check/\n" +
        "  Verify media actions have nowhere to land — deleting the popover without this listener\n" +
        "  deletes the feature, not just its costume.",
    );
  } else ok();
}

if (failures.length) {
  console.error(`\nmeshi-occlusion: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(
  `meshi-occlusion OK — ${checks} assertions. The float is docked chrome: no positioning code in the\n` +
    "  component, CSS owns the corner (tab bar + safe-area aware on phones), one singleton body that\n" +
    "  yields to the canvas, and no permanent balloons — content actions arrive via MESHI_PROMPT_EVENT\n" +
    "  from the post ⋯ menu. Does NOT cover: the rendered dock clearing the FAB; that was measured\n" +
    "  directly at 390 and 1440px when the dock CSS landed.",
);
