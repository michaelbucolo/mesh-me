// THE ONLY SLOT THAT STACKS IS THE ONLY SLOT THAT CAN COLLIDE WITH ITSELF.
//
// Every other accessory slot renders exactly one item, so two items in it can
// never be on screen together and their geometry does not have to agree. The
// `marks` slot is different: freckles, blush and the star are all drawn at once
// when all three are chosen, and nothing was making their coordinates aware of
// each other. They were not aware of each other. Freckles occupied y 2.3-6.3,
// blush y 1.9-5.3, and the star y 1.8-7.0 on the right cheek alone, so the
// full combination stacked a solid gold star over a pink wash over the dots and
// read as a smudge — while a single-sided star also made the whole face
// lopsided.
//
// Reviewing the code did not reveal that; rendering the combination did. This
// gate is the part that survives, so the next edit to a mark has to keep the
// bands apart instead of rediscovering the overlap in a screenshot.
//
// The bands, in the mascot's SVG units (head r=16 centred on the origin):
//
//     freckles   upper cheek   y 1.88 .. 4.58
//     blush      lower cheek   y 4.70 .. 7.70
//     star       jawline       y 7.70 .. 11.30, mirrored on both sides
//
// and every mark stays in the x corridor between the eyes and the earrings.

import { readFileSync } from "node:fs";

const SRC = readFileSync("src/components/meshi/meshi-mascot.tsx", "utf8");

let passed = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`meshi-marks: ${message}`);
  passed += 1;
}

/**
 * A box in the FOLDED half-face: x is a distance from the centre line, not a
 * signed coordinate. Every mark is mirrored, so a signed union would span both
 * cheeks (-13.4 .. 13.4) and claim each mark covers the whole face, which is
 * both useless for the overlap test and wrong about where the eyes are.
 */
type Box = { x0: number; x1: number; y0: number; y1: number };

const fold = (x0: number, x1: number): [number, number] => {
  const a = Math.abs(x0);
  const b = Math.abs(x1);
  // A shape straddling the centre line starts at 0.
  return x0 < 0 && x1 > 0 ? [0, Math.max(a, b)] : [Math.min(a, b), Math.max(a, b)];
};

const union = (boxes: Box[]): Box => ({
  x0: Math.min(...boxes.map((b) => b.x0)),
  x1: Math.max(...boxes.map((b) => b.x1)),
  y0: Math.min(...boxes.map((b) => b.y0)),
  y1: Math.max(...boxes.map((b) => b.y1)),
});

/** Pull one accessory's literal source out of the ACCESSORIES table. */
function accessorySource(name: string): string {
  const start = SRC.indexOf(`\n  ${name}: (`);
  if (start < 0) throw new Error(`meshi-marks: accessory "${name}" not found`);
  const end = SRC.indexOf("\n  ),", start);
  if (end < 0) throw new Error(`meshi-marks: accessory "${name}" is not closed`);
  return SRC.slice(start, end);
}

const num = (s: string) => Number.parseFloat(s);

/** Every <circle> in a fragment, as a box. */
function circleBoxes(src: string): Box[] {
  const out: Box[] = [];
  for (const m of src.matchAll(/<circle\s+cx="(-?[\d.]+)"\s+cy="(-?[\d.]+)"\s+r="([\d.]+)"/g)) {
    const [cx, cy, r] = [num(m[1]), num(m[2]), num(m[3])];
    const [x0, x1] = fold(cx - r, cx + r);
    out.push({ x0, x1, y0: cy - r, y1: cy + r });
  }
  return out;
}

/** Every <ellipse> in a fragment, as a box. */
function ellipseBoxes(src: string): Box[] {
  const out: Box[] = [];
  for (const m of src.matchAll(
    /<ellipse\s+cx="(-?[\d.]+)"\s+cy="(-?[\d.]+)"\s+rx="([\d.]+)"\s+ry="([\d.]+)"/g,
  )) {
    const [cx, cy, rx, ry] = [num(m[1]), num(m[2]), num(m[3]), num(m[4])];
    const [x0, x1] = fold(cx - rx, cx + rx);
    out.push({ x0, x1, y0: cy - ry, y1: cy + ry });
  }
  return out;
}

// ── The three marks ─────────────────────────────────────────────────────────

const frecklesSrc = accessorySource("freckles");
const freckleBoxes = circleBoxes(frecklesSrc);
assert(freckleBoxes.length === 8, `freckles should be 8 dots, found ${freckleBoxes.length}`);
const freckles = union(freckleBoxes);

const blushSrc = accessorySource("blush");
const blushEllipses = ellipseBoxes(blushSrc);
assert(blushEllipses.length === 4, `blush should be 4 ellipses, found ${blushEllipses.length}`);
const blush = union(blushEllipses);

// The star is a mirrored pair built from a transform, so its box is derived
// from the translate/scale rather than from literal coordinates.
const starSrc = accessorySource("star");
const starTransform = /translate\(\$\{side \* ([\d.]+)\}, ([\d.]+)\) scale\(([\d.]+)\)/.exec(starSrc);
assert(starTransform !== null, "star must be a mirrored pair placed by translate(side * dx, dy) scale(s)");
const [starDx, starDy, starScale] = [num(starTransform![1]), num(starTransform![2]), num(starTransform![3])];
// The star path spans -3..3 in x and -3..2.8 in y before scaling.
const starHalf = 3 * starScale;
const star: Box = {
  x0: starDx - starHalf,
  x1: starDx + starHalf,
  y0: starDy - starHalf,
  y1: starDy + 2.8 * starScale,
};

assert(
  starSrc.includes("[-1, 1].map"),
  "the star must be mirrored on both cheeks — a single-sided star makes every face wearing it lopsided",
);

// ── They must not overlap each other ────────────────────────────────────────

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

const marks: Array<[string, Box]> = [
  ["freckles", freckles],
  ["blush", blush],
  ["star", star],
];

for (let i = 0; i < marks.length; i += 1) {
  for (let j = i + 1; j < marks.length; j += 1) {
    const [an, a] = marks[i];
    const [bn, b] = marks[j];
    assert(
      !overlaps(a, b),
      `${an} and ${bn} overlap — both are drawn when a Meshi wears both, so they would stack. ` +
        `${an} y ${a.y0}..${a.y1} x ${a.x0}..${a.x1}; ${bn} y ${b.y0}..${b.y1} x ${b.x0}..${b.x1}`,
    );
  }
}

// ── And each must stay in the corridor the other slots leave free ───────────

// The widest eye at rest is the `wide` face: spacing 5.6 + rx 3.2 = 8.8.
const EYE_OUTER_X = 8.8;
// The mustache (the `brow` slot) ends at x = +-8.2 and bottoms out at y = 7.8.
const MUSTACHE_X = 8.2;
// The earring post hangs at x = +-15 with a 1.4 bead, so 13.6 is the last free x.
const EARRING_INNER_X = 13.6;
// The necklace (the `neck` slot) sits from y = 11.4 down.
const NECK_TOP_Y = 11.4;

for (const [name, box] of marks) {
  // A mark may come inside the eye/mustache corridor only if it is entirely
  // BELOW them, which is where the star lives.
  assert(
    box.x0 >= Math.min(EYE_OUTER_X, MUSTACHE_X) || box.y0 >= 7.8,
    `${name} reaches x ${box.x0}, inside the eyes (${EYE_OUTER_X}) or the mustache (${MUSTACHE_X})`,
  );
  assert(box.x1 <= EARRING_INNER_X, `${name} reaches x ${box.x1}, into the earrings at ${EARRING_INNER_X}`);
  assert(box.y1 <= NECK_TOP_Y, `${name} reaches y ${box.y1}, into the necklace at ${NECK_TOP_Y}`);
  // Everything has to be ON the head: r=16, so |x| <= sqrt(256 - y^2) at the
  // box's deepest corner.
  const deepest = Math.max(Math.abs(box.y0), Math.abs(box.y1));
  const headHalfWidth = Math.sqrt(16 * 16 - deepest * deepest);
  assert(
    box.x1 <= headHalfWidth + 0.9,
    `${name} reaches x ${box.x1.toFixed(2)} at y ${deepest}, past the head edge at ${headHalfWidth.toFixed(2)}`,
  );
}

// ── The slot table has to agree that these three are the stacking ones ──────

const SLOTS_SRC = readFileSync("src/components/meshi/meshi-slots.ts", "utf8");
assert(
  /STACKING_SLOTS[^=]*=\s*new Set<MeshiSlot>\(\["marks"\]\)/.test(SLOTS_SRC),
  "marks must be the stacking slot — if another slot starts stacking, its items need this same treatment",
);
for (const mark of ["freckles", "blush", "star"]) {
  assert(
    new RegExp(`marks: \\[[^\\]]*"${mark}"`).test(SLOTS_SRC),
    `"${mark}" must be listed in the marks slot`,
  );
}

console.log(
  `meshi-marks: ${passed} assertions passed — freckles y ${freckles.y0}..${freckles.y1}, ` +
    `blush y ${blush.y0}..${blush.y1}, star y ${star.y0.toFixed(2)}..${star.y1.toFixed(2)}, no overlap.`,
);
