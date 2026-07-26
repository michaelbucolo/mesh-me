/**
 * ONE MESHI.
 *
 * Meshi is a character, and a product has one of him. The codebase kept
 * rediscovering this and fixing it locally, which is why it kept coming back:
 *
 *   - `meshi-float` yielded on the PATHNAME (`pathname === "/mesh"`), but the
 *     pathname flips on the first frame of the navigation and the canvas Meshi
 *     does not exist until the mesh request returns. The loading gate filled
 *     that hole with a Meshi of its own, so entering your mesh played three
 *     different bodies in a row.
 *   - Measured in a browser on /feed, FIVE Meshi bodies were visible at once:
 *     the brand lockup, three identity badges, and the companion. Three of them
 *     animated, and motion is what makes a drawing a character rather than a
 *     picture of one.
 *
 * So there are two rules, and this asserts both:
 *
 *   1. The handoff between the floating companion and the mesh canvas is driven
 *      by whether the canvas ACTUALLY has him, not by the route.
 *   2. Exactly one Meshi may move. Every other depiction — badge, lockup, chat
 *      avatar, cursor marker — is a still portrait.
 *
 * What it cannot prove: how many are on screen at once. That is a browser
 * measurement (scratchpad/meshicount.mjs in the PR), and this keeps the two
 * structural causes from coming back between those runs.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

// ── 1. The handoff is a fact, not a route ────────────────────────────────────
{
  const presence = read("src/components/mesh/live/meshi-presence.ts");
  for (const sym of ["setCanvasMeshi", "useCanvasHasMeshi"]) {
    if (!presence.includes(`export function ${sym}`)) fail("1 handoff", `meshi-presence.ts no longer exports ${sym}`);
    else ok();
  }

  const layer = strip(read("src/components/mesh/live/meshi-layer.tsx"));
  // Must report the LIVE value, not merely call the setter — an early draft of
  // this matched the `setCanvasMeshi(false)` in the cleanup and passed a
  // mutation that stopped reporting presence altogether.
  if (!/setCanvasMeshi\(\s*(?!false\s*\))[A-Za-z_$]/.test(layer)) {
    fail("1 handoff", "meshi-layer no longer reports whether the canvas has Meshi — the float cannot know when to yield");
  } else ok();
  if (!/return\s*\(\)\s*=>\s*setCanvasMeshi\(false\)/.test(layer)) {
    fail("1 handoff", "meshi-layer does not clear the canvas-Meshi flag on unmount, so the float stays hidden after you leave /mesh");
  } else ok();

  const float = strip(read("src/components/meshi/meshi-float.tsx"));
  if (!/useCanvasHasMeshi\(\)/.test(float)) {
    fail("1 handoff", "meshi-float no longer reads the canvas presence signal");
  } else ok();
  // The specific regression: yielding on the path alone.
  if (/const\s+isMeshSurface\s*=\s*isMeshSurfacePath\(pathname\)\s*;/.test(float)) {
    fail("1 handoff", "meshi-float yields on the pathname again. Being on /mesh is not the same as the canvas having him — that gap is where the third Meshi lived.");
  } else ok();
}

// ── 2. Only the companion moves ──────────────────────────────────────────────
{
  const userMeshi = read("src/components/meshi/user-meshi.tsx");
  if (!/animate\s*=\s*false/.test(userMeshi)) {
    fail("2 one alive", "UserMeshi animates by default again — every badge and lockup becomes a live character");
  } else ok();

  // Nothing reached through UserMeshi may opt back into motion. The companion
  // does not go through it: meshi-float renders MeshiMascot directly.
  // Both entry points, because the brand lockup reaches MeshiMascot directly and
  // slipped past a UserMeshi-only pattern.
  const OPT_IN = /<(?:UserMeshi|MeshiMascot)[^>]*\banimate(?!\s*=\s*\{false\})/;
  const CONSUMERS = [
    "src/components/meshi/meshi-identity.tsx",
    "src/components/meshi/meshi-chat.tsx",
    "src/components/meshi/meshi-actions-menu.tsx",
    "src/components/meshi/meshi-cursor.tsx",
    "src/components/brand/meshi-brand-mark.tsx",
    "src/components/loading/meshi-wait.tsx",
  ];
  for (const file of CONSUMERS) {
    const src = strip(read(file));
    if (OPT_IN.test(src)) {
      fail("2 one alive", `${file} turns motion back on for a Meshi portrait — only the companion may move`);
    } else ok();
  }

  // The wait state must not draw one at all: the companion is already on screen.
  const wait = strip(read("src/components/loading/meshi-wait.tsx"));
  if (/<UserMeshi|<MeshiMascot/.test(wait)) {
    fail("2 one alive", "the loading gate draws its own Meshi again — the companion carries through the wait now");
  } else ok();
}

if (failures.length) {
  console.error(`\nmeshi-singleton: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(`meshi-singleton: ${checks} assertions passed — one Meshi, and only he moves.`);
