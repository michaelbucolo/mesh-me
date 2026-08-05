// THE INK FORMAT CONTRACT.
//
// This format is a moderation decision as much as a serialisation one: a
// doodle is a few hundred points on a tiny grid in four colours, so a person
// can draw something rude but cannot transmit a photograph. That property only
// holds if the decoder actually REFUSES everything outside the format — and
// the tempting failure is to clamp instead, which turns a malformed payload
// into a valid one nobody drew.
//
// Run: npm run meshimap-ink:check

import assert from "node:assert/strict";
import {
  decodeInk,
  encodeInk,
  INK_COLOURS,
  INK_HEIGHT,
  INK_WIDTH,
  MAX_POINTS,
  MAX_STROKES,
  type Ink,
} from "../src/lib/meshimap/ink";

let n = 0;
function ok(condition: boolean, label: string): void {
  n++;
  assert.ok(condition, label);
}
function rejects(raw: unknown, why: string): void {
  n++;
  const r = decodeInk(raw);
  assert.ok(!r.ok, `should refuse ${why} (got ok)`);
}

// ---------------------------------------------------------------------------
// 1. Round trip.
// ---------------------------------------------------------------------------

{
  const ink: Ink = {
    strokes: [
      { colour: 0, points: [{ x: 0, y: 0 }, { x: 10, y: 12 }, { x: 127, y: 63 }] },
      { colour: 3, points: [{ x: 5, y: 5 }] },
    ],
  };
  const wire = encodeInk(ink);
  const back = decodeInk(wire);
  ok(back.ok, "a real drawing decodes");
  ok(back.ok && JSON.stringify(back.ink) === JSON.stringify(ink), "…to exactly what was encoded");
  ok(encodeInk((back as { ink: Ink }).ink) === wire, "…and re-encodes to the same bytes");
}

{
  // Compactness is the reason the format exists. A 300-point drawing has to
  // fit in an ordinary request, not need a new budget.
  const points = Array.from({ length: 300 }, (_, i) => ({ x: i % INK_WIDTH, y: i % INK_HEIGHT }));
  const wire = encodeInk({ strokes: [{ colour: 1, points }] });
  ok(wire.length < 2400, `a 300-point drawing stays small (${wire.length} bytes)`);
  ok(decodeInk(wire).ok, "…and still decodes");
}

// ---------------------------------------------------------------------------
// 2. OFF-CANVAS IS REFUSED, NOT CLAMPED. A clamped point is a point nobody
//    drew, and accepting it means the stored drawing is not the one sent.
// ---------------------------------------------------------------------------

rejects(`v1|0:${INK_WIDTH},0`, "an x exactly at the width");
rejects(`v1|0:0,${INK_HEIGHT}`, "a y exactly at the height");
rejects("v1|0:99999,0", "an absurd x");
rejects("v1|0:-1,0", "a negative x");
rejects("v1|0:0,-1", "a negative y");
{
  const r = decodeInk(`v1|0:${INK_WIDTH - 1},${INK_HEIGHT - 1}`);
  ok(r.ok, "the last legal pixel IS legal — the bound is exclusive, not off by one");
}
{
  // The clamping failure mode, stated as an assertion: an off-canvas payload
  // must not come back as an on-canvas drawing.
  const r = decodeInk("v1|0:500,500");
  ok(!r.ok, "an off-canvas point does not silently become the corner");
}

// ---------------------------------------------------------------------------
// 3. Budgets are ceilings, not trim lines.
// ---------------------------------------------------------------------------

{
  const strokes = Array.from({ length: MAX_STROKES }, () => ({ colour: 0, points: [{ x: 1, y: 1 }] }));
  ok(decodeInk(encodeInk({ strokes })).ok, `exactly ${MAX_STROKES} strokes is allowed`);
  const tooMany = [...strokes, { colour: 0, points: [{ x: 1, y: 1 }] }];
  ok(!decodeInk(encodeInk({ strokes: tooMany })).ok, "one stroke over the cap is refused, not trimmed");
}
{
  const points = Array.from({ length: MAX_POINTS }, () => ({ x: 1, y: 1 }));
  ok(decodeInk(encodeInk({ strokes: [{ colour: 0, points }] })).ok, `exactly ${MAX_POINTS} points is allowed`);
  const over = Array.from({ length: MAX_POINTS + 1 }, () => ({ x: 1, y: 1 }));
  ok(!decodeInk(encodeInk({ strokes: [{ colour: 0, points: over }] })).ok, "one point over the cap is refused");
}
{
  // The cap is on the TOTAL, not per stroke — otherwise 24 strokes of 320
  // points each sails through while each one looks fine on its own.
  const half = Array.from({ length: MAX_POINTS }, () => ({ x: 1, y: 1 }));
  const two = { strokes: [{ colour: 0, points: half }, { colour: 1, points: half }] };
  ok(!decodeInk(encodeInk(two)).ok, "the point budget is a total across strokes, not per stroke");
}
{
  // A megabyte of coordinates is refused. Note what this does NOT prove:
  // deleting the pre-split length guard leaves it passing, because the point
  // cap catches the payload anyway. The guard is an ALLOCATION defence — it
  // stops a 400,000-element split happening before the rejection — and no
  // assertion here can see the difference, so the comment on it says so
  // rather than this label taking credit for it.
  const huge = "v1|0:" + "1,1,".repeat(200000);
  ok(!decodeInk(huge).ok, "a megabyte of coordinates is refused (by the point cap; the length guard saves the allocation)");
}

// ---------------------------------------------------------------------------
// 4. The palette is closed.
// ---------------------------------------------------------------------------

for (let c = 0; c < INK_COLOURS; c++) ok(decodeInk(`v1|${c}:1,1`).ok, `colour ${c} is in the palette`);
rejects(`v1|${INK_COLOURS}:1,1`, "a colour past the end of the palette");
rejects("v1|-1:1,1", "a negative colour");
rejects("v1|999:1,1", "an absurd colour");

// ---------------------------------------------------------------------------
// 5. Junk. This decodes payloads a stranger controls, on a request handler.
// ---------------------------------------------------------------------------

for (const junk of [null, undefined, 42, {}, [], true, "", "v1|", "v1", "|0:1,1", "v2|0:1,1", "0:1,1"]) {
  rejects(junk, `junk (${JSON.stringify(junk) ?? "undefined"})`);
}
rejects("v1|0:1", "an odd coordinate count");
rejects("v1|0:1,1,2", "a trailing half-pair");
rejects("v1|:1,1", "a stroke with no colour");
rejects("v1|0:1,1;", "a trailing separator");
rejects("v1|abc:1,1", "a non-numeric colour");
rejects("v1|0:x,1", "a non-numeric coordinate");
rejects("v1|0:1.5,1", "a fractional coordinate");
rejects("v1|0:1e2,1", "scientific notation");
rejects("v1|0:0x10,1", "hex");
rejects("v1|0: 1,1", "a leading space");
rejects("v1|0:+1,1", "an explicit plus");
rejects("v1|0:01,1", "a leading zero");
rejects("v1|0:Infinity,1", "Infinity");
rejects("v1|0:NaN,1", "NaN");

// Nothing above should have thrown — an exception here is a 500 on a payload
// a stranger controls.
ok(true, "every junk payload returned a result rather than throwing");

// ---------------------------------------------------------------------------
// 6. CANONICAL FORM — asserted against the DECODER, because the decoder is
//    what guarantees it. A separate `canonicalInk` existed here and was
//    deleted: mutation-testing showed removing its check left this suite
//    green, which means it was never doing any work. Everything that decodes
//    is already the one true spelling.
// ---------------------------------------------------------------------------

{
  // The property, stated directly: anything that decodes re-encodes to itself.
  const corpus = [
    "v1|0:1,1",
    "v1|3:0,0,127,63",
    "v1|0:1,1;1:2,2;2:3,3",
    "v1|2:9,9,10,11",
    `v1|1:${INK_WIDTH - 1},${INK_HEIGHT - 1}`,
  ];
  for (const wire of corpus) {
    const r = decodeInk(wire);
    ok(r.ok, `corpus entry decodes (${wire})`);
    ok(r.ok && encodeInk(r.ink) === wire, `…and re-encodes to itself byte for byte (${wire})`);
  }
}
{
  // Every respelling of a legal drawing is refused OUTRIGHT by the decoder, so
  // two identical drawings cannot be stored under two different strings — the
  // thing a report or a block keyed on content depends on.
  for (const variant of ["v1|0:01,1", "v1|0:1,1;", "v1|00:1,1", "v1|0: 1,1", "v1|0:+1,1", "v1|0:1.0,1"]) {
    ok(!decodeInk(variant).ok, `a respelling of a legal drawing is refused (${variant})`);
  }
}

// ---------------------------------------------------------------------------
// 7. The format cannot carry anything but a drawing.
// ---------------------------------------------------------------------------

{
  // No text, no URL, no caption field — there is nowhere to put one. If this
  // ever starts passing, the format has grown a channel it was designed not
  // to have.
  rejects("v1|0:1,1|caption=hello", "a smuggled extra field");
  rejects("v1|0:1,1;text:hello", "a smuggled text stroke");
  rejects('v1|0:1,1,"https://example.com"', "a smuggled url");
  const ink: Ink = { strokes: [{ colour: 0, points: [{ x: 1, y: 1 }] }] };
  const wire = encodeInk(ink);
  ok(!/[a-zA-Z]/.test(wire.slice(3)), "an encoded drawing contains no letters at all past the version tag");
}

console.log(`meshimap ink contract OK — ${n} assertions (off-canvas is refused, never clamped)`);
