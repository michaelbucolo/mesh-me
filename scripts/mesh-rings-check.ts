// THE SURFACE MUST NEVER LEAD WITH A ZERO AGAIN.
//
// The mesh this replaces put "Your pulse — 0 new for you" in its most prominent
// panel. That is not a rendering bug; it is a model that had no concept of being
// caught up, so the only thing it could do with an empty result was count it.
//
// So the assertions here are weighted toward the states nobody designs for:
// nothing waiting, nothing live, nothing new, and every combination in between.
// Placing a busy field correctly is the easy half.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { placeField, RING_CAPACITY, RINGS, type FieldItem } from "../src/components/meshfield/model/rings";

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

// ── 1. DISTANCE IS URGENCY, NOT RECENCY ─────────────────────────────────────
{
  const field = placeField(
    [
      item({ id: "old-obligation", kind: "message", awaitingViewer: true, atMs: NOW - 40 * HOUR, title: "Jordan" }),
      item({ id: "brand-new-post", atMs: NOW - 1000, title: "A fresh post" }),
    ],
    NOW,
  );

  assert.equal(field.byRing.needsYou.length, 1, "an unanswered message did not land in the innermost ring.");
  assert.equal(
    field.byRing.needsYou[0].id,
    "old-obligation",
    "a 40-hour-old obligation was displaced by something newer. Recency must not outrank a claim on the viewer.",
  );
  assert.equal(field.byRing.fresh[0]?.id, "brand-new-post", "a minutes-old post did not land in the fresh ring.");
  checks += 3;

  // The stronger claim wins when an item qualifies for two bands.
  const both = placeField([item({ id: "x", kind: "message", awaitingViewer: true, live: true, title: "Maya" })], NOW);
  assert.equal(both.byRing.needsYou.length, 1, "an item that is both awaited and live did not go to needsYou.");
  assert.equal(both.byRing.happening.length, 0, "an item was placed in two rings at once.");
  checks += 2;
}

// ── 2. THE STATE THE OLD SURFACE REPORTED AS ZERO ───────────────────────────
{
  const empty = placeField([], NOW);
  assert.equal(empty.calm, true, "an empty field is not marked calm.");
  assert.ok(empty.headline.text.length > 0, "the empty field has no headline at all.");
  assert.ok(
    !/^0\b|\b0 new\b|\bnothing\b$/i.test(empty.headline.text.trim()),
    `the headline still leads with a zero: ${JSON.stringify(empty.headline.text)}`,
  );
  assert.ok(
    /caught up/i.test(empty.headline.text),
    `being caught up is not stated as an outcome: ${JSON.stringify(empty.headline.text)}`,
  );
  assert.ok(empty.headline.action, "the caught-up state offers nowhere to go, which is a dead end with good manners.");
  checks += 5;

  // A full outer field is still calm — having a world is not being wanted by it.
  const contextOnly = placeField(
    Array.from({ length: 20 }, (_, i) => item({ id: `old-${i}`, atMs: NOW - 30 * 24 * HOUR })),
    NOW,
  );
  assert.equal(contextOnly.calm, true, "a field of old context was not treated as calm.");
  assert.ok(/caught up/i.test(contextOnly.headline.text), "an outer field suppressed the caught-up headline.");
  assert.ok(contextOnly.byRing.field.length > 0, "the old items vanished instead of becoming context.");
  checks += 3;
}

// ── 3. THE HEADLINE NAMES SOMETHING, AND IT IS THE RIGHT SOMETHING ──────────
{
  const waiting = placeField(
    [
      item({ id: "a", kind: "message", awaitingViewer: true, title: "Jordan", atMs: NOW - HOUR }),
      item({ id: "b", kind: "message", awaitingViewer: true, title: "Maya", atMs: NOW - 20 * HOUR }),
      item({ id: "c", kind: "mention", awaitingViewer: true, title: "Riley", atMs: NOW - 30 * HOUR }),
    ],
    NOW,
  );
  assert.ok(/Jordan/.test(waiting.headline.text), `the headline does not name the most pressing person: ${waiting.headline.text}`);
  assert.ok(/2 others/.test(waiting.headline.text), `the headline does not account for the rest: ${waiting.headline.text}`);
  assert.equal(waiting.headline.action?.href, "/x/a", "the headline action does not go to the thing it names.");
  assert.equal(waiting.headline.action?.label, "Reply", "the headline action is not the verb for a message.");
  assert.equal(waiting.calm, false, "a field with three obligations was marked calm.");
  checks += 5;

  // Singular reads correctly — "and 0 others" is the kind of seam that makes a
  // surface feel machine-written.
  const one = placeField([item({ id: "solo", kind: "message", awaitingViewer: true, title: "Sam" })], NOW);
  assert.ok(!/0 other|1 others/.test(one.headline.text), `plural seam: ${one.headline.text}`);
  assert.ok(/Sam is waiting on you\./.test(one.headline.text), `unexpected single-obligation headline: ${one.headline.text}`);
  checks += 2;

  // Live, but nothing owed.
  const live = placeField([item({ id: "l", kind: "person", live: true, title: "Naomi" })], NOW);
  assert.ok(/around right now/i.test(live.headline.text), `live headline is wrong: ${live.headline.text}`);
  assert.equal(live.headline.action?.label, "Say hi", "a live person's verb is not the greeting one.");
  assert.equal(live.calm, false, "a live field was marked calm.");
  checks += 3;

  // Fresh only — must say that nothing needs them AND what is new.
  const fresh = placeField([item({ id: "f1", atMs: NOW - HOUR }), item({ id: "f2", atMs: NOW - 2 * HOUR })], NOW);
  assert.ok(/[Nn]othing needs you/.test(fresh.headline.text), `fresh-only headline does not lead with the good news: ${fresh.headline.text}`);
  assert.ok(/2 new things/.test(fresh.headline.text), `fresh-only headline does not say what is new: ${fresh.headline.text}`);
  checks += 2;
}

// ── 4. EVERY ITEM CARRIES A VERB AND A REASON ───────────────────────────────
//
// The rule the old surface broke: a node you can only "open" is a node with
// nothing to do on it.
{
  const kinds: FieldItem["kind"][] = ["message", "mention", "reply", "person", "post", "community"];
  const field = placeField(kinds.map((kind, i) => item({ id: `k${i}`, kind, awaitingViewer: kind === "message" })), NOW);

  for (const placed of field.items) {
    assert.ok(placed.verb.length > 0, `${placed.kind} has no verb.`);
    assert.ok(!/^open$/i.test(placed.verb) || placed.kind === "person", `${placed.kind} fell back to a generic "Open".`);
    assert.ok(placed.reason.length > 8, `${placed.kind} has no readable reason for its position: ${JSON.stringify(placed.reason)}`);
    checks += 3;
  }

  // Reasons must differ by band, or they are decoration.
  const reasons = new Set(field.items.map((i) => i.reason));
  assert.ok(reasons.size > 1, "every item gave the same reason, so the reason explains nothing.");
  checks += 1;
}

// ── 5. TOO MUCH IS TRIMMED, NEVER SHRUNK ────────────────────────────────────
//
// The old surface put eleven illegible cards on screen. The fix for "too much
// to read" is fewer things.
{
  const many = Array.from({ length: 200 }, (_, i) =>
    item({ id: `m${i}`, kind: "message", awaitingViewer: true, atMs: NOW - i * 60_000 }),
  );
  const field = placeField(many, NOW);
  assert.equal(
    field.byRing.needsYou.length,
    RING_CAPACITY.needsYou,
    `needsYou held ${field.byRing.needsYou.length}, expected the capacity of ${RING_CAPACITY.needsYou}.`,
  );
  checks += 1;

  for (const ring of RINGS) {
    assert.ok(field.byRing[ring].length <= RING_CAPACITY[ring], `${ring} exceeded its capacity.`);
    checks += 1;
  }

  // What survives the trim is the most pressing, not an arbitrary slice.
  assert.equal(field.byRing.needsYou[0].id, "m0", "trimming did not keep the most pressing item.");
  checks += 1;
}

// ── 6. DETERMINISTIC ────────────────────────────────────────────────────────
//
// nowMs is passed in rather than read, so two renders of the same field agree.
// A surface that rearranges itself for reasons the viewer did not cause is one
// they stop trusting.
{
  const input = [
    item({ id: "b", kind: "message", awaitingViewer: true }),
    item({ id: "a", kind: "message", awaitingViewer: true }),
    item({ id: "c", live: true, kind: "person" }),
  ];
  const first = JSON.stringify(placeField(input, NOW));
  for (let i = 0; i < 4; i += 1) {
    assert.equal(JSON.stringify(placeField(input, NOW)), first, "placeField is not deterministic.");
    checks += 1;
  }

  // Ties break on a stable key, not on input order.
  const reversed = JSON.stringify(placeField([...input].reverse(), NOW));
  assert.equal(reversed, first, "reordering the input reordered the field; ties are not broken stably.");
  checks += 1;

  assert.deepEqual(input.map((i) => i.id), ["b", "a", "c"], "the input array was mutated.");
  checks += 1;
}

// ── 7. THE MODULE KEEPS ITS REASONING ───────────────────────────────────────
{
  const source = readFileSync(join(ROOT, "src/components/meshfield/model/rings.ts"), "utf8");
  const words = prose(source);

  for (const [phrase, why] of [
    [/DISTANCE FROM THE CENTRE IS HOW MUCH SOMETHING WANTS YOU/i, "that geometry encodes urgency rather than closeness, which is the whole reason this replaced a diagram"],
    [/0 NEW FOR YOU/i, "the specific failure it exists to prevent"],
    [/never padded|never be padded/i, "that rings are not filled to look busy"],
  ] as const) {
    assert.ok(phrase.test(words), `the module no longer explains ${why}.`);
    checks += 1;
  }

  assert.ok(!/Date\.now\(\)/.test(source), "this module reads the clock, so two renders can disagree for no reason the viewer caused.");
  checks += 1;
}

console.log(
  `mesh rings OK — ${checks} assertions.\n` +
    "  Distance from the centre is how much a thing wants you: an unanswered message from forty hours\n" +
    "  ago outranks a post from a minute ago, and an item that is both awaited and live goes to the\n" +
    "  stronger claim rather than the newer one. Every item carries a verb and a readable reason for\n" +
    "  where it sits. Rings are trimmed at capacity rather than shrunk, because the fix for too much\n" +
    "  to read is fewer things.\n" +
    "  Being caught up is a designed outcome with its own headline and somewhere to go — the state the\n" +
    "  old surface rendered as '0 new for you' in its most prominent panel.\n" +
    "  Does NOT cover: how any of this is drawn. Placement is decided here; the field, the materials\n" +
    "  and the motion are separate and separately answerable.",
);
