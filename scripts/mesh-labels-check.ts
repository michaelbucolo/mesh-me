// ELEVEN CAPTIONS IN ROOM FOR FOUR.
//
// That was the old surface: it had space for about four readable captions and
// rendered eleven, so they ran under each other and under the cards and not one
// was legible. Nothing decided which four should survive, because nothing
// decided anything — every caption was drawn because it existed.
//
// "If a caption does not fit at a legible size, show fewer cards" is rule one's
// second half, and a budget is only as good as its answer to "what gets cut".
// The answer here is the same as everywhere else in this rebuild: context gives
// way before obligation.
//
// The load-bearing assertion is on COUNTS: no ring may carry more captions than
// the ring inside it. Deliberately not "captions were handed out inner-first" —
// that was this check's first version, it is a fact about processing order, and
// it passed while a phone showed zero captions on needs-you and seven on
// nine-day-old context. See section 3.
//
// Two overlapping captions are not two captions — they are zero, and the old
// surface had eleven of them.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { layOut, type Viewport } from "../src/components/meshfield/model/geometry";
import { planLabels } from "../src/components/meshfield/model/labels";
import { MAX_LINES, MIN_SIZE, type Measure } from "../src/components/meshfield/model/legible";
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

const NARROW = new Set("iljtfIr.,;:'!|".split(""));
const WIDE = new Set("mwMW@%".split(""));
const measure: Measure = (text, size) => {
  let units = 0;
  for (const ch of Array.from(text)) {
    if (NARROW.has(ch)) units += 0.3;
    else if (WIDE.has(ch)) units += 0.87;
    else if (ch === "…") units += 0.6;
    else units += 0.54;
  }
  return units * size;
};

const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;

const VIEWPORTS: Array<[string, Viewport]> = [
  ["phone portrait 390x844", { width: 390, height: 844 }],
  ["small phone 360x780", { width: 360, height: 780 }],
  ["phone landscape 844x390", { width: 844, height: 390 }],
  ["tablet 834x1112", { width: 834, height: 1112 }],
  ["laptop 1440x900", { width: 1440, height: 900 }],
  ["wide 2560x1080", { width: 2560, height: 1080 }],
];

function item(over: Partial<FieldItem> & { id: string }): FieldItem {
  return { kind: "post", title: `Item ${over.id}`, platform: "mesh", atMs: NOW - HOUR, href: `/x/${over.id}`, ...over };
}

function busyField() {
  const items: FieldItem[] = [];
  for (let i = 0; i < 8; i += 1) items.push(item({ id: `need-${i}`, kind: "message", awaitingViewer: true }));
  for (let i = 0; i < 10; i += 1) items.push(item({ id: `live-${i}`, kind: "person", live: true }));
  for (let i = 0; i < 12; i += 1) items.push(item({ id: `new-${i}`, atMs: NOW - 2 * HOUR }));
  for (let i = 0; i < 40; i += 1) items.push(item({ id: `old-${i}`, atMs: NOW - 40 * 24 * HOUR }));
  return placeField(items, NOW);
}

/** Realistic captions, including the one that was photographed unreadable. */
function textsFor(field: ReturnType<typeof placeField>): Record<string, string> {
  const captions = [
    "The future of social media isn't about more content",
    "Reply to Jordan",
    "Naomi went live",
    "New video: how we rebuilt everything in one weekend",
    "Maya sent a photo",
    "Sam mentioned you",
  ];
  const out: Record<string, string> = {};
  field.items.forEach((it, i) => {
    out[it.id] = captions[i % captions.length];
  });
  return out;
}

function rectsOverlap(a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

// ── 1. NO TWO CAPTIONS EVER RUN UNDER EACH OTHER ────────────────────────────
//
// The photographed failure, exactly. Two overlapping captions are zero
// captions.
{
  const field = busyField();
  const texts = textsFor(field);
  for (const [name, viewport] of VIEWPORTS) {
    const plan = planLabels(layOut(field, viewport), viewport, texts, measure);
    for (let i = 0; i < plan.granted.length; i += 1) {
      for (let j = i + 1; j < plan.granted.length; j += 1) {
        assert.ok(
          !rectsOverlap(plan.granted[i].box, plan.granted[j].box),
          `${name}: captions for ${plan.granted[i].id} and ${plan.granted[j].id} overlap. The old surface had eleven doing this.`,
        );
      }
    }
    checks += 1;
  }
}

// ── 2. A CAPTION NEVER RUNS UNDER A NODE, OR OFF THE FRAME ──────────────────
{
  const field = busyField();
  const texts = textsFor(field);
  for (const [name, viewport] of VIEWPORTS) {
    const geometry = layOut(field, viewport);
    const plan = planLabels(geometry, viewport, texts, measure);

    for (const g of plan.granted) {
      for (const p of geometry.placements) {
        const node = { x: p.x - p.radius, y: p.y - p.radius, width: p.radius * 2, height: p.radius * 2 };
        assert.ok(!rectsOverlap(g.box, node), `${name}: the caption for ${g.id} runs under node ${p.id}.`);
      }
      const core = {
        x: geometry.core.x - geometry.core.radius,
        y: geometry.core.y - geometry.core.radius,
        width: geometry.core.radius * 2,
        height: geometry.core.radius * 2,
      };
      assert.ok(!rectsOverlap(g.box, core), `${name}: the caption for ${g.id} runs across the core.`);

      assert.ok(
        g.box.x >= 0 && g.box.y >= 0 && g.box.x + g.box.width <= viewport.width && g.box.y + g.box.height <= viewport.height,
        `${name}: the caption for ${g.id} is cut off by the frame.`,
      );
    }
    checks += 3;
  }
}

// ── 3. THE LOAD-BEARING ONE: CONTEXT GIVES WAY BEFORE OBLIGATION ────────────
//
// This check was WRONG on its first version and let a real inversion ship
// underneath it, so the way it is wrong is worth keeping written down.
//
// It used to assert that the granted list came out in ring order. That is a
// fact about the ORDER OF PROCESSING and says nothing whatsoever about the
// outcome — and the outcome, measured on a 390x844 phone, was:
//
//     needsYou 0/8    happening 0/10    fresh 3/10    field 7/26
//
// Zero captions on the ring of things that want you, seven on nine-day-old
// context, with a green check underneath. Handing captions out inner-first
// achieves nothing when inner nodes are crowded BY CONSTRUCTION and always
// refuse, while the outer band has the whole outside of the canvas.
//
// So the assertion is now about counts, which is the thing anyone actually
// cares about: NO RING MAY CARRY MORE CAPTIONS THAN THE RING INSIDE IT.
{
  const field = busyField();
  const texts = textsFor(field);
  for (const [name, viewport] of VIEWPORTS) {
    const geometry = layOut(field, viewport);
    const plan = planLabels(geometry, viewport, texts, measure);
    const ringOf = new Map(geometry.placements.map((p) => [p.id, p.ring]));

    const per = new Map<string, number>();
    for (const g of plan.granted) {
      const ring = ringOf.get(g.id);
      if (ring) per.set(ring, (per.get(ring) ?? 0) + 1);
    }

    for (let i = 0; i < RINGS.length - 1; i += 1) {
      const inner = per.get(RINGS[i]) ?? 0;
      const outer = per.get(RINGS[i + 1]) ?? 0;
      assert.ok(
        outer <= inner,
        `${name}: ${RINGS[i + 1]} carries ${outer} captions against ${RINGS[i]}'s ${inner}. ` +
          "Context is out-speaking obligation, which inverts the whole surface — and note that a check " +
          "on the ORDER captions were granted in would have passed this.",
      );
    }

    // And the blunt version of the same statement, end to end.
    assert.ok(
      (per.get("field") ?? 0) <= (per.get("needsYou") ?? 0),
      `${name}: the outer field has ${per.get("field") ?? 0} captions and the needs-you ring has ${per.get("needsYou") ?? 0}.`,
    );
    checks += 2;
  }
}

// ── 4. A PHONE REALLY DOES SHOW FEWER ───────────────────────────────────────
//
// "Show fewer cards" has to be something that happens, not something the
// comments say.
{
  const field = busyField();
  const texts = textsFor(field);
  const phone = planLabels(layOut(field, { width: 390, height: 844 }), { width: 390, height: 844 }, texts, measure);
  const desk = planLabels(layOut(field, { width: 1440, height: 900 }), { width: 1440, height: 900 }, texts, measure);

  assert.ok(desk.granted.length > 0, "a 1440x900 desktop granted no captions at all; this check is not exercising anything.");
  assert.ok(
    phone.granted.length < desk.granted.length,
    `a phone showed ${phone.granted.length} captions and a desktop ${desk.granted.length}. ` +
      "If a phone shows as many, nothing is being budgeted and the old overlap will come back.",
  );
  assert.ok(phone.withheld.length > 0, "a phone withheld nothing; the budget is not binding.");
  checks += 3;
}

// ── 5. EVERY GRANTED CAPTION IS ACTUALLY READABLE ───────────────────────────
{
  const field = busyField();
  const texts = textsFor(field);
  for (const [name, viewport] of VIEWPORTS) {
    const plan = planLabels(layOut(field, viewport), viewport, texts, measure);
    for (const g of plan.granted) {
      assert.ok(g.label.size >= MIN_SIZE, `${name}: ${g.id} granted at ${g.label.size}px, under the floor.`);
      assert.ok(g.label.lines.length >= 1 && g.label.lines.length <= MAX_LINES, `${name}: ${g.id} has ${g.label.lines.length} lines.`);
      for (const line of g.label.lines) {
        assert.ok(
          measure(line, g.label.size) <= g.box.width + 1e-9,
          `${name}: ${g.id}'s line "${line}" is wider than the box it was granted.`,
        );
      }
    }
    checks += 2;
  }
}

// ── 6. NOTHING VANISHES WITHOUT BEING ACCOUNTED FOR ─────────────────────────
//
// A plan that quietly drops half its labels looks identical to one that had
// nothing to say.
{
  const field = busyField();
  const texts = textsFor(field);
  for (const [name, viewport] of VIEWPORTS) {
    const geometry = layOut(field, viewport);
    const plan = planLabels(geometry, viewport, texts, measure);
    const accounted = new Set([...plan.granted.map((g) => g.id), ...plan.withheld.map((w) => w.id)]);
    assert.equal(
      accounted.size,
      geometry.placements.length,
      `${name}: ${geometry.placements.length} nodes but ${accounted.size} accounted for. Something was silently skipped.`,
    );

    // And the stated reason has to be the real one.
    for (const w of plan.withheld) {
      if (w.why === "no-text") {
        assert.ok(!texts[w.id]?.trim(), `${name}: ${w.id} was withheld as "no-text" but has a caption.`);
      } else {
        assert.ok(texts[w.id]?.trim(), `${name}: ${w.id} was withheld for room but has no caption to show.`);
      }
    }
    checks += 2;
  }

  // Nodes with no caption at all are reported as such rather than as crowded.
  const geometry = layOut(field, { width: 1440, height: 900 });
  const plan = planLabels(geometry, { width: 1440, height: 900 }, {}, measure);
  assert.equal(plan.granted.length, 0, "captions were granted from an empty text map.");
  assert.ok(plan.withheld.every((w) => w.why === "no-text"), "a node with no caption was blamed on the budget.");
  checks += 2;
}

// ── 7. THE CHECK THAT PROVES THE BUDGET DOES SOMETHING ──────────────────────
//
// Section 1 is only meaningful if captions WOULD collide without the budget.
// Granting every node its box unconditionally is what the old surface did, and
// on the same field at the same viewport it produces overlaps.
{
  const field = busyField();
  const viewport = { width: 1440, height: 900 };
  const geometry = layOut(field, viewport);

  const ungoverned = geometry.placements.map((p) => ({
    id: p.id,
    box: { x: p.x - p.radius * 2.6, y: p.y + p.radius + 6, width: p.radius * 2 * 2.6, height: 42 },
  }));

  let collisions = 0;
  for (let i = 0; i < ungoverned.length; i += 1) {
    for (let j = i + 1; j < ungoverned.length; j += 1) {
      if (rectsOverlap(ungoverned[i].box, ungoverned[j].box)) collisions += 1;
    }
  }
  assert.ok(
    collisions > 0,
    "drawing every caption unconditionally produced no overlaps at all, so the budget in section 1 is not preventing anything. " +
      "Re-derive the crowding before trusting that check.",
  );
  checks += 1;
}

// ── 8. DETERMINISTIC ────────────────────────────────────────────────────────
//
// Captions appearing and disappearing as you breathe on the window is its own
// kind of unreadable.
{
  const field = busyField();
  const texts = textsFor(field);
  const viewport = { width: 1440, height: 900 };
  const geometry = layOut(field, viewport);
  const first = JSON.stringify(planLabels(geometry, viewport, texts, measure));
  for (let i = 0; i < 4; i += 1) {
    assert.equal(JSON.stringify(planLabels(geometry, viewport, texts, measure)), first, "planLabels is not deterministic.");
  }
  checks += 1;

  const source = readFileSync(join(ROOT, "src/components/meshfield/model/labels.ts"), "utf8");
  assert.ok(!/Math\.random\(\)|Date\.now\(\)/.test(source), "the label plan depends on randomness or the clock.");
  checks += 1;

  const words = prose(source);
  for (const [phrase, why] of [
    [/SHOW FEWER CARDS/i, "that this is rule one's second half rather than a nicety"],
    [/Context gives way before obligation/i, "what gets cut when the room runs out, and why it is the same answer as the geometry's"],
    [/not two captions/i, "that overlapping text is worth less than no text, not more"],
  ] as const) {
    assert.ok(phrase.test(words), `the module no longer explains ${why}.`);
    checks += 1;
  }
}

console.log(
  `mesh label budget OK — ${checks} assertions.\n` +
    "  Across six viewports on a fully populated field: no two captions overlap, none runs under a node\n" +
    "  or across the core, and none is cut off by the frame — the old surface had eleven captions in\n" +
    "  room for about four and let all eleven draw.\n" +
    "  NO RING CARRIES MORE CAPTIONS THAN THE RING INSIDE IT — asserted on counts, not on the order\n" +
    "  they were handed out in. That distinction is the whole check: an order-based version passed while\n" +
    "  a phone was showing 0 captions on needs-you and 7 on nine-day-old context, because inner nodes\n" +
    "  are crowded by construction and always refuse. A phone genuinely shows fewer than a desktop, and\n" +
    "  what it withholds is reported rather than silently dropped.\n" +
    "  The budget is shown to be doing work: drawing every caption unconditionally on the same field\n" +
    "  produces real overlaps, so the no-overlap check is not passing on an empty problem.\n" +
    "  Does NOT cover: where a caption sits relative to its node beyond not colliding, or whether the\n" +
    "  words chosen are the right words. This decides who speaks, not what they say.",
);
