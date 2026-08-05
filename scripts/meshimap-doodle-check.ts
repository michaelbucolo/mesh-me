// THE PICTOCHAT VISIBILITY CONTRACT.
//
// The one thing this must prove: A DOODLE CANNOT BE SEEN BY SOMEBODY WHO
// CANNOT SEE ITS AUTHOR ON THE MAP. Not "the audience check also runs on
// doodles" — that is a second copy of the rule, and a second copy is what
// drifts. The drawing hangs off the PIN, and pins have already been through
// blocking, ghost mode, audience and freshness in `pinsFor`.
//
// So the test for a blocked viewer is not "does the block check fire" — it is
// "given the pins that survived the real gate, is the drawing gone". That is
// the property that survives somebody adding a new privacy rule later without
// remembering this file exists.
//
// Run: npm run meshimap-doodle:check

import assert from "node:assert/strict";
import { doodlesFor, DOODLE_TTL_MS, MAX_IN_ROOM, MAX_PER_AUTHOR, type DoodleRow } from "../src/lib/meshimap/doodles";
import { pinsFor, type MapSubject } from "../src/lib/meshimap/coarse";

let n = 0;
function ok(condition: boolean, label: string): void {
  n++;
  assert.ok(condition, label);
}

const NOW = 1_800_000_000_000;

function subject(over: Partial<MapSubject> & { userId: string }): MapSubject {
  return {
    username: over.userId,
    displayName: null,
    lat: 51.5,
    lng: -0.12,
    reportedAtMs: NOW - 60_000,
    audience: "everyone",
    ghostMode: false,
    precision: "town",
    relation: { isSelf: false, followsSubject: false, subjectFollowsViewer: false, isBlockedEitherWay: false },
    ...over,
  } as MapSubject;
}

function ink(id: string, userId: string, ageMs = 1000): DoodleRow {
  return { id, userId, ink: "v1:0,0,10,10", createdAtMs: NOW - ageMs };
}

// ---------------------------------------------------------------------------
// 1. VISIBILITY IS INHERITED FROM THE PIN. Each case runs the REAL gate.
// ---------------------------------------------------------------------------

{
  const pins = pinsFor([subject({ userId: "ada" })], NOW);
  ok(pins.length === 1, "(setup) an open pin survives the gate");
  ok(doodlesFor([ink("d1", "ada")], pins, NOW).length === 1, "a visible person's drawing is visible");
}

for (const [label, over] of [
  ["blocked either way", { relation: { isSelf: false, followsSubject: false, subjectFollowsViewer: false, isBlockedEitherWay: true } }],
  ["ghost mode", { ghostMode: true }],
  ["audience nobody", { audience: "nobody" as const }],
  ["audience mutuals, not a mutual", { audience: "mutuals" as const }],
  ["a stale location", { reportedAtMs: NOW - 60 * 60 * 1000 - 1 }],
] as const) {
  const pins = pinsFor([subject({ userId: "ada", ...(over as object) })], NOW);
  ok(pins.length === 0, `(setup) ${label} removes the pin`);
  ok(
    doodlesFor([ink("d1", "ada")], pins, NOW).length === 0,
    `…and with the pin gone the drawing is gone too (${label})`,
  );
}

{
  // The headline: STOP SHARING YOUR LOCATION AND YOUR DRAWINGS GO WITH IT.
  // A drawing broadcast to "people near me" by somebody no longer telling
  // anyone where they are has no audience left to belong to.
  const sharing = pinsFor([subject({ userId: "ada" })], NOW);
  const stopped = pinsFor([subject({ userId: "ada", audience: "nobody" })], NOW);
  const rows = [ink("d1", "ada"), ink("d2", "ada", 2000)];
  ok(doodlesFor(rows, sharing, NOW).length === 2, "while sharing, their drawings show");
  ok(doodlesFor(rows, stopped, NOW).length === 0, "the moment they stop sharing, every drawing disappears");
}

{
  // A doodle from somebody with no pin AT ALL cannot be rendered — there is
  // nowhere to draw it, and inventing a position would be inventing a location.
  ok(doodlesFor([ink("d1", "nobody-here")], [], NOW).length === 0, "a drawing with no visible author is dropped");
}

{
  // Mixed room: only the visible author's ink comes through.
  const pins = pinsFor(
    [
      subject({ userId: "ada" }),
      subject({ userId: "blocked", relation: { isSelf: false, followsSubject: false, subjectFollowsViewer: false, isBlockedEitherWay: true } }),
    ],
    NOW,
  );
  const got = doodlesFor([ink("d1", "ada"), ink("d2", "blocked")], pins, NOW);
  ok(got.length === 1 && got[0].userId === "ada", "a mixed room admits exactly the drawings whose author is visible");
}

// ---------------------------------------------------------------------------
// 2. It carries no location of its own — it cannot be finer than the pin.
// ---------------------------------------------------------------------------

{
  const pins = pinsFor([subject({ userId: "ada", lat: 51.503368, lng: -0.127716, precision: "block" })], NOW);
  const got = doodlesFor([ink("d1", "ada")], pins, NOW);
  ok(got[0].at.lat === pins[0].at.lat && got[0].at.lng === pins[0].at.lng, "a drawing sits exactly at its author's cell");
  const serialized = JSON.stringify(got[0]);
  ok(!serialized.includes("51.503368"), "the raw latitude appears nowhere on a drawing");
  ok(!serialized.includes("0.127716"), "…nor the raw longitude");
}

{
  // Two people in one cell: their drawings are at the SAME point, so the log
  // cannot be used to tell them apart by position.
  const pins = pinsFor([subject({ userId: "a", lat: 51.5031, lng: -0.1277 }), subject({ userId: "b", lat: 51.5049, lng: -0.1211 })], NOW);
  const got = doodlesFor([ink("d1", "a"), ink("d2", "b")], pins, NOW);
  ok(
    got[0].at.lat === got[1].at.lat && got[0].at.lng === got[1].at.lng,
    "two neighbours in one cell draw at byte-identical points",
  );
}

// ---------------------------------------------------------------------------
// 3. It is a LOG, not a speech balloon. Appended, ordered, aged out.
// ---------------------------------------------------------------------------

{
  const pins = pinsFor([subject({ userId: "ada" })], NOW);
  const rows = [ink("old", "ada", 5000), ink("new", "ada", 1000), ink("mid", "ada", 3000)];
  const got = doodlesFor(rows, pins, NOW);
  ok(got.length === 3, "several drawings from one person all survive — a reply does not overwrite what it replies to");
  ok(got[0].id === "new" && got[2].id === "old", "the log is newest-first");
}

{
  const pins = pinsFor([subject({ userId: "ada" })], NOW);
  const tied = [
    { id: "zzz", userId: "ada", ink: "v1:", createdAtMs: NOW - 1000 },
    { id: "aaa", userId: "ada", ink: "v1:", createdAtMs: NOW - 1000 },
  ];
  const a = doodlesFor(tied, pins, NOW).map((d) => d.id).join(",");
  const b = doodlesFor([tied[1], tied[0]], pins, NOW).map((d) => d.id).join(",");
  ok(a === b, "two drawings sent in the same millisecond order stably across renders");
}

{
  const pins = pinsFor([subject({ userId: "ada" })], NOW);
  ok(doodlesFor([ink("d", "ada", DOODLE_TTL_MS + 1)], pins, NOW).length === 0, "a drawing past its TTL is gone");
  ok(doodlesFor([ink("d", "ada", -10 * 60_000)], pins, NOW).length === 0, "a future-dated drawing never pins itself to the top of the room");
  ok(
    doodlesFor([{ id: "d", userId: "ada", ink: "x", createdAtMs: Number.NaN }], pins, NOW).length === 0,
    "a drawing with no usable timestamp is dropped rather than sorted arbitrarily",
  );
}

{
  // Nobody shouts the room down.
  const pins = pinsFor([subject({ userId: "loud" })], NOW);
  const spam = Array.from({ length: 30 }, (_, i) => ink(`s${i}`, "loud", i * 100 + 100));
  const got = doodlesFor(spam, pins, NOW);
  ok(got.length === MAX_PER_AUTHOR, `one person contributes at most ${MAX_PER_AUTHOR} drawings (${got.length})`);
  ok(got.every((d) => d.userId === "loud"), "…and they are theirs");
  // The cap must keep the NEWEST, or a spammer freezes the room at their
  // oldest three and nothing anyone draws afterwards ever appears.
  ok(got[0].id === "s0", "the cap keeps the newest, not the first ones seen");
}

{
  const subjects = Array.from({ length: 30 }, (_, i) => subject({ userId: `u${i}` }));
  const pins = pinsFor(subjects, NOW);
  const rows = subjects.flatMap((s, i) => [ink(`a${i}`, s.userId, 1000), ink(`b${i}`, s.userId, 2000)]);
  ok(doodlesFor(rows, pins, NOW).length <= MAX_IN_ROOM, `the room is capped at ${MAX_IN_ROOM} drawings`);
}

// ---------------------------------------------------------------------------
// 4. Junk in, an empty room out — this renders on a server.
// ---------------------------------------------------------------------------

ok(doodlesFor([], [], NOW).length === 0, "an empty room is empty, not a crash");
{
  const pins = pinsFor([subject({ userId: "ada" })], NOW);
  ok(doodlesFor([], pins, NOW).length === 0, "pins with no drawings produce no drawings");
}

console.log(`meshimap doodle contract OK — ${n} assertions (a drawing is visible only where its author's pin is)`);
