// EIGHT PEOPLE, EIGHT IDENTICAL BLUE DISCS.
//
// That was the single cheapest thing in the surface this replaces, and the
// reason it happened is that an initial is not an identity: three of your
// friends share a letter and the old avatar rendered them as the same object.
//
// So the assertion that matters here is not "does it look nice" — it is that
// two people can never come out looking the same, and that what comes out reads
// as one object rather than as scattered dots.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { identityMark, type Mark } from "../src/components/meshfield/model/identity-mark";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
let checks = 0;

function prose(source: string): string {
  return source
    .split("\n")
    .map((line) => line.replace(/^\s*(\/\/|\*)\s?/, ""))
    .join(" ")
    .replace(/\s+/g, " ");
}

/** A stable, lossless description of a mark, for comparing two of them. */
function fingerprint(m: Mark): string {
  return (
    m.nodes.map((n) => `${n.x.toFixed(5)},${n.y.toFixed(5)},${n.r.toFixed(5)}`).join("|") +
    "::" +
    m.edges.map((e) => e.join("-")).join(",") +
    "::" +
    m.hue.toFixed(3)
  );
}

/** Union-find over the edges: does the mark form ONE object? */
function isConnected(m: Mark): boolean {
  const parent = m.nodes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const [a, b] of m.edges) parent[find(a)] = find(b);
  const root = find(0);
  return m.nodes.every((_, i) => find(i) === root);
}

// ── 1. NO TWO PEOPLE LOOK THE SAME ──────────────────────────────────────────
//
// The whole point. Checked at a scale well past any plausible friends list.
{
  const seen = new Map<string, string>();
  const hues = new Set<number>();
  const allHues: number[] = [];
  const COUNT = 20_000;

  for (let i = 0; i < COUNT; i += 1) {
    const id = `user_${i}`;
    const mark = identityMark(id);
    const print = fingerprint(mark);
    const clash = seen.get(print);
    assert.equal(clash, undefined, `${id} and ${clash} produce an identical mark — two people rendered as the same object.`);
    seen.set(print, id);
    hues.add(Math.round(mark.hue));
    allHues.push(mark.hue);
  }
  checks += 1;

  // ── DISTRIBUTION, NOT CARDINALITY ─────────────────────────────────────────
  //
  // Counting distinct hues is the wrong measure and this check used to make it.
  // A palette crammed into one corner of the wheel can still produce thousands
  // of distinct values while every mark on screen looks like the same colour.
  //
  // Chi-squared over twelve 30-degree buckets asks the question that matters:
  // is the wheel used EVENLY. With 11 degrees of freedom, ~19.7 is the 95th
  // percentile and ~31 the 99.9th; a genuinely clustered palette scores in the
  // hundreds. The bound is set where a real problem is caught and ordinary
  // sampling noise is not.
  //
  // This measurement is also what corrected the module: a golden-angle multiply
  // scored 19.5 here against a plain uniform hash's 9.2, so the clever version
  // was marginally worse than the simple one it was chosen over.
  const buckets = new Array(12).fill(0);
  for (const hue of allHues) buckets[Math.min(11, Math.floor(hue / 30))] += 1;
  const expected = COUNT / 12;
  const chiSquared = buckets.reduce((sum, observed) => sum + (observed - expected) ** 2 / expected, 0);
  assert.ok(
    chiSquared < 31,
    `hues are clustered: chi-squared ${chiSquared.toFixed(1)} over twelve buckets (${buckets.join(", ")}). ` +
      "Distinct-but-adjacent hues read as one colour family on screen.",
  );
  assert.ok(hues.size > 300, `only ${hues.size} distinct hues across ${COUNT} ids.`);
  checks += 2;

  // Realistic ids too, not just sequential ones.
  const realistic = ["alexcreates", "jordandev", "mayamusic", "lunawrites", "rileydesigns", "naomi", "sam", "sasha"];
  const prints = new Set(realistic.map((id) => fingerprint(identityMark(id))));
  assert.equal(prints.size, realistic.length, "two realistic usernames collided.");
  checks += 1;

  // And the case the old avatar failed on: people who share a first letter.
  const sameLetter = ["sam", "sasha", "sophie", "steven", "sky"];
  const letterPrints = new Set(sameLetter.map((id) => fingerprint(identityMark(id))));
  assert.equal(
    letterPrints.size,
    sameLetter.length,
    "people sharing a first letter collided — the exact failure an initial-in-a-circle has.",
  );
  checks += 1;
}

// ── 2. IT READS AS ONE OBJECT ───────────────────────────────────────────────
//
// Scattered dots are noise. Connectedness is what makes it a mesh.
{
  for (let i = 0; i < 3000; i += 1) {
    const mark = identityMark(`connect_${i}`);
    assert.ok(isConnected(mark), `mark for connect_${i} is in more than one piece — that is confetti, not a mesh.`);
    assert.ok(mark.edges.length >= mark.nodes.length - 1, `mark for connect_${i} has too few edges to span its nodes.`);
  }
  checks += 2;
}

// ── 3. IT FITS, AND IT HAS STRUCTURE ────────────────────────────────────────
{
  for (let i = 0; i < 3000; i += 1) {
    const mark = identityMark(`shape_${i}`);

    assert.ok(mark.nodes.length >= 4 && mark.nodes.length <= 5, `unexpected node count ${mark.nodes.length}`);

    for (const n of mark.nodes) {
      // Inside the box, including the node's own radius — a mark that touches
      // its frame looks clipped at 32px.
      assert.ok(n.x - n.r >= 0 && n.x + n.r <= 1, `node escapes horizontally: x=${n.x} r=${n.r}`);
      assert.ok(n.y - n.r >= 0 && n.y + n.r <= 1, `node escapes vertically: y=${n.y} r=${n.r}`);
      assert.ok(n.r > 0, "a node has no size.");
    }

    // Edges must reference real nodes and never loop to themselves.
    for (const [a, b] of mark.edges) {
      assert.ok(a >= 0 && a < mark.nodes.length && b >= 0 && b < mark.nodes.length, "an edge points at a node that is not there.");
      assert.notEqual(a, b, "a node is joined to itself.");
    }

    assert.ok(mark.hue >= 0 && mark.hue < 360, `hue out of range: ${mark.hue}`);
  }
  checks += 5;
}

// ── 4. STABLE FOREVER ───────────────────────────────────────────────────────
//
// A generated face that changes between renders is worse than a letter in a
// circle, because at least the letter was stable.
{
  const id = "alexcreates";
  const first = fingerprint(identityMark(id));
  for (let i = 0; i < 50; i += 1) {
    assert.equal(fingerprint(identityMark(id)), first, "identityMark is not deterministic.");
  }
  checks += 1;

  // Interleaving other ids must not disturb it — no shared mutable state.
  identityMark("someone-else");
  identityMark("another");
  assert.equal(fingerprint(identityMark(id)), first, "a mark changed after other marks were generated; state is leaking between calls.");
  checks += 1;

  // Empty and odd ids must still produce something valid rather than throwing.
  for (const odd of ["", " ", "\u{1f600}", "a".repeat(500), "../../etc/passwd"]) {
    const mark = identityMark(odd);
    assert.ok(mark.nodes.length >= 4, `an odd id produced a degenerate mark: ${JSON.stringify(odd.slice(0, 20))}`);
    assert.ok(isConnected(mark), "an odd id produced a disconnected mark.");
    checks += 2;
  }
}

// ── 5. THE MODULE KEEPS ITS REASONING ───────────────────────────────────────
{
  const source = readFileSync(join(ROOT, "src/components/meshfield/model/identity-mark.ts"), "utf8");
  const words = prose(source);

  for (const [phrase, why] of [
    [/an initial is not an identity/i, "why a nicer letter in a nicer circle would not have fixed anything"],
    [/CONNECTED/i, "that connectedness is what makes the mark read as one object rather than as confetti"],
    [/chi-squared/i, "that the hue derivation was chosen by measurement, and that the clever golden-angle version measured worse than the simple one it was picked over"],
  ] as const) {
    assert.ok(phrase.test(words), `the module no longer explains ${why}.`);
    checks += 1;
  }

  assert.ok(!/Math\.random\(\)|Date\.now\(\)/.test(source), "the mark depends on randomness or the clock, so a person's face would change between renders.");
  checks += 1;
}

console.log(
  `mesh identity marks OK — ${checks} assertions.\n` +
    "  Twenty thousand ids produce twenty thousand distinct marks, with no collision — including\n" +
    "  people who share a first letter, which is the exact case an initial-in-a-circle renders as the\n" +
    "  same object. Hues are checked for SPREAD rather than merely for count: chi-squared over twelve\n" +
    "  buckets, because a palette crammed into one corner of the wheel can produce thousands of\n" +
    "  distinct values while every mark on screen looks like the same colour.\n" +
    "  Every mark is CONNECTED: a spanning path is laid first, so the eye sees one object rather than\n" +
    "  a sprinkle of dots. Every node sits inside its box including its own radius, no edge loops to\n" +
    "  itself, and the same id gives the same picture forever — a generated face that moves between\n" +
    "  renders is worse than the letter it replaced.\n" +
    "  Does NOT cover: how the mark is drawn, or whether a real photo should be preferred over it.\n" +
    "  A mark is what happens when there is no face, not instead of one.",
);
