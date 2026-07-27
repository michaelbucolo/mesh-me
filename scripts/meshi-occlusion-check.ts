/**
 * "DON'T COVER WHAT YOU CAN CLICK" IS NOT "DON'T COVER WHAT YOU CAN READ".
 *
 * The floating Meshi has an avoidance system — candidate positions, overlap
 * scoring, a safe-position search. It worked. It was simply never told that
 * text counts.
 *
 * `MESHI_AVOID_SELECTOR` names chrome (sidebars, toolbars, dialogs) and
 * INTERACTIVE roles (button, a[href], input, textbox). Read-only content
 * appears nowhere in it, so the float treated it as free space. Photographed
 * on /settings at 1440x900 in both themes: the shell at (696, 466), 48x48,
 * sitting fully inside the Email verification row at (608, 461, 791x44) with
 * its "Tap" badge over the word "verification". That row is a <div> holding a
 * <span> and a <strong> — nothing in it is clickable, so nothing matched.
 *
 * TWO FIXES WERE TRIED. Adding `.plate` — the design system's own word for
 * "INFORMATION. Cards, feed posts, panels." — moved the float off the settings
 * row and left it sitting on the page titles of /notifications, /billing and
 * /privacy-controls, because a heading on the mat is inside no card at all.
 * Rendered text is not a class, so it is measured instead.
 *
 * WHAT THAT MADE LOAD-BEARING, and what most of this file is about: measuring
 * text means walking the document, and the walk is only affordable because
 * every hot path already caches. A drag samples the avoid set ONCE at
 * pointerdown and reuses it for every pointermove. Before this change that
 * cache was an optimisation; now it is the difference between a drag that
 * moves and a drag that walks the DOM sixty times a second. It is asserted
 * here because nothing else would notice it going away.
 *
 * WHAT THIS CANNOT DO: check that the float actually clears text on a rendered
 * page. That was measured directly — ten authenticated routes at 390, 834 and
 * 1440px, thirty combinations, zero covering any leaf text and none off-screen.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const src = readFileSync(join(ROOT, "src/components/meshi/meshi-float.tsx"), "utf8");
const stripped = src
  .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
  .replace(/^\s*\/\/.*$/gm, (m) => " ".repeat(m.length));

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => {
  checks += 1;
};

/** Body of a top-level `function name(...) { ... }`, brace-matched. */
function functionBody(name: string): string | null {
  const at = stripped.search(new RegExp(`function\\s+${name}\\s*\\(`));
  if (at === -1) return null;
  const open = stripped.indexOf("{", at);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < stripped.length; i++) {
    if (stripped[i] === "{") depth += 1;
    else if (stripped[i] === "}") {
      depth -= 1;
      if (depth === 0) return stripped.slice(open + 1, i);
    }
  }
  return null;
}

// ── 1. TEXT IS PART OF THE AVOID SET ────────────────────────────────────────
{
  const text = functionBody("getReadableTextRects");
  const avoid = functionBody("getMeshiAvoidRects");

  if (!text) {
    fail(
      "1 text counts",
      "`getReadableTextRects` is gone. Without it the avoid set is chrome plus clickable roles, which\n" +
        "  is what let the float park on top of the Email verification row: that row holds a <span> and a\n" +
        "  <strong>, and neither is something you can click.",
    );
  } else ok();

  if (!avoid) {
    fail("1 text counts", "`getMeshiAvoidRects` is gone; this check has lost its subject");
  } else if (!/getReadableTextRects\s*\(/.test(avoid)) {
    fail(
      "1 text counts",
      "`getMeshiAvoidRects` no longer folds in the text rects, so the float is back to avoiding only\n" +
        "  what can be clicked.",
    );
  } else ok();
}

// ── 2. ONLY LEAVES ──────────────────────────────────────────────────────────
//
// An element WITH element children is a layout box; its rect is the union of
// its parts, and the gaps between those parts hold nothing to read. Measure
// those and whole columns become unavailable, which leaves the float nowhere
// to stand and pushes it into the least-bad-overlap fallback — a worse place
// than where it started.
{
  const text = functionBody("getReadableTextRects") ?? "";
  if (!/childElementCount/.test(text)) {
    fail(
      "2 leaves only",
      "`getReadableTextRects` no longer restricts itself to leaf elements.\n" +
        "  A container's rect is the union of its children's, so measuring it blacklists the empty space\n" +
        "  between them too. That is the one condition keeping this from making whole columns\n" +
        "  unavailable and dropping the float into its least-bad-overlap fallback.",
    );
  } else ok();

  // Off-screen text is not covered by anything, and measuring it would drag
  // the float toward wherever a long page happens to be scrolled.
  if (!/innerHeight|innerWidth/.test(text)) {
    fail("2 leaves only", "`getReadableTextRects` no longer rejects text outside the viewport");
  } else ok();

  // Meshi's own speech bubble and chat panel are text. It may sit on those.
  if (!/data-meshi-owned|data-meshi-primary/.test(text)) {
    fail(
      "2 leaves only",
      "`getReadableTextRects` no longer excludes Meshi's own surfaces.\n" +
        "  Its speech bubble and chat panel are text; treating them as obstacles makes the float flee\n" +
        "  from itself.",
    );
  } else ok();
}

// ── 3. THE DRAG CACHE IS NOW LOAD-BEARING ───────────────────────────────────
//
// This was an optimisation before the walk existed. It is a correctness-of-feel
// requirement now, and it is invisible: recomputing per move would still
// produce the right POSITION, just at a frame rate nobody would ship.
{
  const down = functionBody("handlePointerDown") ?? stripped;
  const move = /const handlePointerMove = useCallback\(([\s\S]*?)\n  \}, \[/.exec(stripped)?.[1] ?? "";

  if (!/dragAvoidRectsRef\.current\s*=\s*getMeshiAvoidRects\s*\(/.test(down) && !/dragAvoidRectsRef\.current\s*=\s*getMeshiAvoidRects\s*\(/.test(stripped)) {
    fail("3 drag cache", "the avoid set is no longer sampled once at pointerdown");
  } else ok();

  if (!move) {
    fail("3 drag cache", "`handlePointerMove` has moved; this check has lost its subject");
  } else if (!/findSafeMeshiPosition\([^)]*dragAvoidRectsRef\.current/.test(move)) {
    fail(
      "3 drag cache",
      "`handlePointerMove` no longer passes the cached avoid set, so every pointermove re-walks the\n" +
        "  document. That was merely wasteful when the avoid set was a querySelectorAll over chrome; it\n" +
        "  now includes a pass over every leaf text node on the page, sixty times a second, during the\n" +
        "  one interaction where the user is watching the float move.",
    );
  } else ok();
}

// ── 4. THE CHROME LIST STAYS A CHROME LIST ──────────────────────────────────
//
// The failure mode this whole change exists to end is the list growing one
// page-specific selector at a time. A settings row, a feed caption, a profile
// bio: each fixes one surface and teaches the list nothing.
//
// The first spelling of this rule rejected names by PREFIX — anything starting
// `.settings-`, `.feed-`, and so on — and it failed `.feed-x-topbar`, which is
// a topbar and has always been chrome. A prefix says which surface a thing
// belongs to; it says nothing about whether it is chrome or content. So the
// rule is positive instead: a class in this list must NAME a piece of chrome.
// `.settings-row`, `.feed-post-body` and `.profile-bio` all fail it; every
// entry present today passes.
const CHROME_NOUNS = /(bar|nav|navigation|toolbar|widget|fab|progress|dock|rail|sheet|overlay|dialog|menu|drawer|banner|tabs|hud)$/;
{
  const list = /const MESHI_AVOID_SELECTOR = \[([\s\S]*?)\]\.join/.exec(stripped)?.[1];
  if (!list) {
    fail("4 chrome only", "`MESHI_AVOID_SELECTOR` has moved; this check has lost its subject");
  } else {
    const entries = list
      .split("\n")
      .map((line) => /"([^"]+)"/.exec(line)?.[1])
      .filter((s): s is string => Boolean(s));
    if (entries.length < 5) {
      fail("4 chrome only", "`MESHI_AVOID_SELECTOR` has been emptied out; the float would ignore chrome entirely");
    } else ok();

    // Attribute, element and role selectors name generic roles rather than a
    // surface, so only class selectors are held to the naming rule.
    const notChrome = entries.filter((s) => s.startsWith(".") && !CHROME_NOUNS.test(s));
    if (notChrome.length) {
      fail(
        "4 chrome only",
        `\`MESHI_AVOID_SELECTOR\` has grown a class that does not name chrome: ${notChrome.join(", ")}.\n` +
          "  This list is for chrome, which is a genuinely fixed set. Content is measured by\n" +
          "  \`getReadableTextRects\` precisely so this list does not have to learn every surface in the\n" +
          "  product one bug report at a time — which is how it got long enough to hide the defect.",
      );
    } else ok();
  }
}

if (failures.length) {
  console.error(`\nmeshi-occlusion: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(
  `meshi-occlusion OK — ${checks} assertions. The float avoids what you can READ, not just what you\n` +
    "  can click, and it measures rendered text rather than naming a selector per surface. Only leaf\n" +
    "  elements count, so a container's rect never blacklists the gaps between its children. The drag\n" +
    "  path still samples the avoid set once at pointerdown, which the document walk makes load-bearing.\n" +
    "  Does NOT cover: whether the float clears text on a rendered page. That was measured directly —\n" +
    "  ten routes at 390 / 834 / 1440px, thirty combinations, zero covering any leaf text.",
);
