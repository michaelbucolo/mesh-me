// THREE OF THE COMPLAINTS WERE ARITHMETIC, SO THEY ARE ASSERTIONS NOW.
//
// The surface this replaces was photographed doing all three:
//
//   • a panel floated over the world and clipped the cards behind it
//   • on a phone, cards were cut off at both edges of the screen
//   • on a phone, the centre of the mesh was not visible at all
//
// "Two things occupy one place", "a thing is outside the box" and "the most
// important thing is off-screen" are not matters of taste. They are checkable
// at every viewport, and this checks them at every viewport — including the
// 390x844 phone where all three actually happened.
//
// The other half is what a small screen gives up. It has to be the outer field,
// never the ring of things that want you: a phone that hides an unanswered
// message to make room for a nine-day-old post has inverted the surface.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { layOut, type Viewport } from "../src/components/meshfield/model/geometry";
import { placeField, RINGS, type FieldItem } from "../src/components/meshfield/model/rings";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
let checks = 0;

function prose(source: string): string {
  return source
    .split("\n")
    .map((line) => line.replace(/^\s*(\/\/|\*)\s?/, ""))
    .join(" ")
    .replace(/\s+/g, " ");
}

const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;

/** Every viewport this has to survive, smallest first. */
const VIEWPORTS: Array<[string, Viewport]> = [
  ["phone portrait 390x844", { width: 390, height: 844 }],
  ["small phone 360x780", { width: 360, height: 780 }],
  ["phone landscape 844x390", { width: 844, height: 390 }],
  ["foldable open 673x841", { width: 673, height: 841 }],
  ["tablet 834x1112", { width: 834, height: 1112 }],
  ["laptop 1440x900", { width: 1440, height: 900 }],
  ["wide 2560x1080", { width: 2560, height: 1080 }],
];

function item(over: Partial<FieldItem> & { id: string }): FieldItem {
  return {
    kind: "post",
    title: `Item ${over.id}`,
    platform: "mesh",
    atMs: NOW - HOUR,
    href: `/x/${over.id}`,
    ...over,
  };
}

/** A busy field: every band populated to capacity. */
function busyField() {
  const items: FieldItem[] = [];
  for (let i = 0; i < 8; i += 1) items.push(item({ id: `need-${i}`, kind: "message", awaitingViewer: true }));
  for (let i = 0; i < 10; i += 1) items.push(item({ id: `live-${i}`, kind: "person", live: true }));
  for (let i = 0; i < 12; i += 1) items.push(item({ id: `new-${i}`, atMs: NOW - 2 * HOUR }));
  for (let i = 0; i < 40; i += 1) items.push(item({ id: `old-${i}`, atMs: NOW - 40 * 24 * HOUR }));
  return placeField(items, NOW);
}

// ── 1. NOTHING OVERLAPS ANYTHING ────────────────────────────────────────────
{
  const field = busyField();
  for (const [name, viewport] of VIEWPORTS) {
    const g = layOut(field, viewport);
    for (let i = 0; i < g.placements.length; i += 1) {
      for (let j = i + 1; j < g.placements.length; j += 1) {
        const a = g.placements[i];
        const b = g.placements[j];
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - (a.radius + b.radius);
        assert.ok(
          gap >= 0,
          `${name}: ${a.id} and ${b.id} overlap by ${Math.abs(gap).toFixed(1)}px. ` +
            "The old surface clipped its own cards behind a floating panel; overlap is not allowed to return.",
        );
      }
    }
    checks += 1;
  }
}

// ── 2. NOTHING LEAVES THE FRAME ─────────────────────────────────────────────
//
// On a phone the old mesh cut cards off at both edges.
{
  const field = busyField();
  for (const [name, viewport] of VIEWPORTS) {
    const g = layOut(field, viewport);
    for (const p of g.placements) {
      assert.ok(p.x - p.radius >= 0, `${name}: ${p.id} is clipped by the left edge.`);
      assert.ok(p.y - p.radius >= 0, `${name}: ${p.id} is clipped by the top edge.`);
      assert.ok(p.x + p.radius <= viewport.width, `${name}: ${p.id} is clipped by the right edge.`);
      assert.ok(p.y + p.radius <= viewport.height, `${name}: ${p.id} is clipped by the bottom edge.`);
    }
    checks += 1;
  }
}

// ── 3. THE CORE IS ALWAYS VISIBLE AND ALWAYS CLEAR ──────────────────────────
//
// On the old phone layout the centre of the mesh was not on screen at all.
{
  const field = busyField();
  for (const [name, viewport] of VIEWPORTS) {
    const g = layOut(field, viewport);

    assert.ok(g.core.radius > 0, `${name}: the core has no size.`);
    assert.ok(
      g.core.x - g.core.radius >= 0 &&
        g.core.y - g.core.radius >= 0 &&
        g.core.x + g.core.radius <= viewport.width &&
        g.core.y + g.core.radius <= viewport.height,
      `${name}: the core is not fully on screen — the exact failure photographed on the old phone layout.`,
    );
    assert.ok(g.core.radius >= 52, `${name}: the core shrank to ${g.core.radius}px, below what stays legible.`);

    for (const p of g.placements) {
      const clear = Math.hypot(p.x - g.core.x, p.y - g.core.y) - (g.core.radius + p.radius);
      assert.ok(clear >= 0, `${name}: ${p.id} intrudes on the core by ${Math.abs(clear).toFixed(1)}px.`);
    }
    checks += 3;
  }
}

// ── 4. WHAT A SMALL SCREEN GIVES UP ─────────────────────────────────────────
//
// The load-bearing one. If a phone drops an obligation to make room for
// context, the surface has inverted itself.
{
  const field = busyField();
  const phone = layOut(field, { width: 390, height: 844 });

  const keptIds = new Set(phone.placements.map((p) => p.id));
  const needed = field.byRing.needsYou.map((i) => i.id);

  for (const id of needed) {
    assert.ok(
      keptIds.has(id),
      `a phone dropped ${id} from the needs-you ring. Context must give way first, never an obligation.`,
    );
  }
  checks += 1;

  // And something DID give — otherwise this proves nothing about the ordering.
  assert.ok(
    phone.dropped.length > 0,
    "a 390x844 phone fitted a fully populated field with nothing dropped; this test is not exercising the fit path.",
  );
  assert.ok(
    phone.dropped.every((id) => id.startsWith("old-") || id.startsWith("new-")),
    `a phone dropped something from an inner band: ${phone.dropped.filter((id) => !id.startsWith("old-") && !id.startsWith("new-")).join(", ")}`,
  );
  checks += 2;

  // Drops are reported, not absorbed.
  const all = new Set([...phone.placements.map((p) => p.id), ...phone.dropped]);
  assert.equal(all.size, field.items.length, "items vanished without appearing in either placements or dropped.");
  checks += 1;
}

// ── 5. DISTANCE STILL MEANS URGENCY AFTER LAYOUT ────────────────────────────
//
// rings.ts decides the band; this must not undo it. An outer item sitting
// nearer the middle than an inner one would make the geometry lie.
{
  const field = busyField();
  for (const [name, viewport] of VIEWPORTS) {
    const g = layOut(field, viewport);
    const byRing = new Map<string, number[]>();
    for (const p of g.placements) {
      const d = Math.hypot(p.x - g.core.x, p.y - g.core.y);
      byRing.set(p.ring, [...(byRing.get(p.ring) ?? []), d]);
    }

    for (let i = 0; i < RINGS.length - 1; i += 1) {
      const inner = byRing.get(RINGS[i]);
      const outer = byRing.get(RINGS[i + 1]);
      if (!inner?.length || !outer?.length) continue;
      assert.ok(
        Math.max(...inner) < Math.min(...outer),
        `${name}: ${RINGS[i]} reaches further out than ${RINGS[i + 1]} starts. Distance would stop meaning urgency.`,
      );
    }
    checks += 1;
  }
}

// ── 6. THE FRONT OF THE QUEUE IS AT THE TOP ─────────────────────────────────
//
// Reading order on a radial surface is not obvious unless it is made obvious.
{
  const field = placeField(
    Array.from({ length: 5 }, (_, i) =>
      item({ id: `n${i}`, kind: "message", awaitingViewer: true, atMs: NOW - i * HOUR }),
    ),
    NOW,
  );
  const g = layOut(field, { width: 1440, height: 900 });
  const first = g.placements.find((p) => p.id === "n0");
  assert.ok(first, "the most pressing item was not placed at all.");
  assert.ok(
    Math.abs(first.x - g.core.x) < 1 && first.y < g.core.y,
    `the most pressing item is not at twelve o'clock: (${first.x.toFixed(0)}, ${first.y.toFixed(0)}) vs core (${g.core.x}, ${g.core.y})`,
  );
  checks += 2;
}

// ── 7. CALM LAYS OUT WITHOUT INCIDENT ───────────────────────────────────────
//
// An empty field is the state the old surface handled worst.
{
  for (const [name, viewport] of VIEWPORTS) {
    const g = layOut(placeField([], NOW), viewport);
    assert.equal(g.placements.length, 0, `${name}: an empty field produced placements out of nowhere.`);
    assert.equal(g.dropped.length, 0, `${name}: an empty field dropped something.`);
    assert.ok(g.core.radius >= 52, `${name}: the core lost its size when the field was empty.`);
    checks += 3;
  }
}

// ── 8. DETERMINISTIC ────────────────────────────────────────────────────────
{
  const field = busyField();
  const viewport = { width: 1440, height: 900 };
  const first = JSON.stringify(layOut(field, viewport));
  for (let i = 0; i < 3; i += 1) {
    assert.equal(JSON.stringify(layOut(field, viewport)), first, "layOut is not deterministic.");
    checks += 1;
  }

  const source = readFileSync(join(ROOT, "src/components/meshfield/model/geometry.ts"), "utf8");
  assert.ok(!/Math\.random\(\)|Date\.now\(\)/.test(source), "the layout depends on randomness or the clock.");
  checks += 1;

  const words = prose(source);
  for (const [phrase, why] of [
    [/TRIM FROM THE OUTSIDE, NEVER FROM THE INSIDE/i, "that a small screen gives up context before it gives up an obligation"],
    [/checkable/i, "that the three failures it prevents are arithmetic rather than taste"],
  ] as const) {
    assert.ok(phrase.test(words), `the module no longer explains ${why}.`);
    checks += 1;
  }
}

console.log(
  `mesh geometry OK — ${checks} assertions.\n` +
    "  Across seven viewports from a 360x780 phone to a 2560x1080 desktop: nothing overlaps anything,\n" +
    "  nothing leaves the frame, and the core is fully on screen and clear of every node — the three\n" +
    "  things the old surface was photographed doing wrong, now arithmetic rather than intention.\n" +
    "  A fully populated field does not fit a phone, and what gives is the outer context: every\n" +
    "  needs-you item survives at 390x844, drops come only from the two outer bands, and nothing\n" +
    "  vanishes without appearing in `dropped`. Distance still means urgency after layout, and the\n" +
    "  most pressing item sits at twelve o'clock where the eye already starts.\n" +
    "  Does NOT cover: how a node is drawn once it has a position. Materials, faces and motion are\n" +
    "  separate, and none of them can rescue a layout that overlaps or clips.",
);
