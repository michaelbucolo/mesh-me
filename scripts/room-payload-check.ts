// THE ROOM ADMISSION CONTRACT.
//
// This gate exists because of a bug that every other check on the live stack
// was structurally incapable of seeing: the room surface read `payload.people`
// while the wire has always said `presences`. Nobody ever appeared in a room,
// and the roster contract, the glide machine, the transport backoff and the
// presence store's privacy gate all stayed green — because not one of them
// feeds a real payload into the thing that draws the bodies.
//
// So the first assertion here is the dumbest one in the repo, and it is the
// only one that would have caught it: THE KEY IS `presences`.
//
// Run: npm run room:payload-check

import assert from "node:assert/strict";
import { readRoomPeople } from "../src/components/mesh/live/room-payload";
import type { RemotePresence } from "../src/components/mesh/live/roster";

let n = 0;
function ok(condition: boolean, label: string): void {
  n++;
  assert.ok(condition, label);
}

const ROOM = "room-owner";
const ME = "viewer-1";

function person(over: Partial<RemotePresence> & { userId: string }): RemotePresence {
  return {
    username: over.userId,
    displayName: over.userId,
    meshiColor: "blue",
    meshiHat: "none",
    meshiMood: "happy",
    viewportPosition: { vx: 0.5, vy: 0.5 },
    viewingMesh: ROOM,
    surface: "mesh",
    isOnline: true,
    ...over,
  } as RemotePresence;
}

/** The wire shape the server actually sends (see PresencePayload). */
function wire(...people: RemotePresence[]) {
  return { presences: people, summary: { totalOnline: people.length, sameMeshOnline: people.length, connectedOnline: 0 } };
}

const opts = { room: ROOM, viewerId: ME };

// ---------------------------------------------------------------------------
// 1. THE KEY. This is the whole bug.
// ---------------------------------------------------------------------------

const someone = person({ userId: "ada" });
ok(readRoomPeople(wire(someone), opts).length === 1, "reads the `presences` key the server actually sends");
ok(
  readRoomPeople({ people: [someone] }, opts).length === 0,
  "`people` is NOT the wire key — a reader that guesses it sees an empty room forever",
);

// ---------------------------------------------------------------------------
// 2. Admission: in THIS room, on the mesh surface, online, and not you.
// ---------------------------------------------------------------------------

ok(
  readRoomPeople(wire(person({ userId: "elsewhere", viewingMesh: "another-room" })), opts).length === 0,
  "someone in a different room is not in this one",
);
ok(
  readRoomPeople(wire(person({ userId: "scrolling", surface: "feed" })), opts).length === 0,
  "a connection reading the feed gets no body on this floor — the server sends them, the room must not draw them",
);
ok(
  readRoomPeople(wire(person({ userId: "stale", isOnline: false })), opts).length === 0,
  "an offline entry is not a person standing here",
);
ok(
  readRoomPeople(wire(person({ userId: ME })), opts).length === 0,
  "your own echo is never admitted — you are drawn from your own position",
);
ok(
  readRoomPeople(wire(someone, person({ userId: ME }), person({ userId: "b", viewingMesh: "x" })), opts).length === 1,
  "a mixed payload admits exactly the people who are here",
);

// A signed-out visitor has no viewerId. Everyone else in the room must still
// appear — otherwise walking into a public mesh logged out shows an empty
// space that is demonstrably not empty.
ok(
  readRoomPeople(wire(someone), { room: ROOM, viewerId: null }).length === 1,
  "a signed-out visitor still sees the people in the room",
);

// ---------------------------------------------------------------------------
// 3. Not joined yet: no room means nobody, never "whoever was in the payload".
// ---------------------------------------------------------------------------

ok(
  readRoomPeople(wire(someone), { room: null, viewerId: ME }).length === 0,
  "with no room joined, an unfiltered list would place bodies in a room they are not in",
);
// That assertion alone does NOT exercise the no-room guard — deleting the
// guard still passes it, because `viewingMesh !== null` filters a normal entry
// out anyway. This is the case where the guard is the only thing standing:
// an entry whose room is ALSO null matches a null room, and would be admitted
// into a room the viewer has not joined. Found by mutating the guard away and
// watching the suite stay green.
ok(
  readRoomPeople({ presences: [{ ...someone, viewingMesh: null }] }, { room: null, viewerId: ME }).length === 0,
  "a null room never matches a null viewingMesh — the not-joined guard, not the room filter, is what stops this",
);

// ---------------------------------------------------------------------------
// 4. Junk off the network must mean "nobody", never a throw — this runs inside
//    an animation frame, so an exception here stops the whole room.
// ---------------------------------------------------------------------------

for (const junk of [null, undefined, 42, "presences", [], {}, { presences: null }, { presences: "nope" }]) {
  ok(readRoomPeople(junk, opts).length === 0, `junk payload (${JSON.stringify(junk) ?? "undefined"}) reads as an empty room`);
}

// A body needs a place to stand. An entry without a usable position cannot be
// drawn anywhere honest, so it is dropped rather than defaulted to a corner.
ok(
  readRoomPeople({ presences: [{ ...someone, viewportPosition: undefined }] }, opts).length === 0,
  "a presence with no position is not admitted",
);
ok(
  readRoomPeople({ presences: [{ ...someone, viewportPosition: { vx: Number.NaN, vy: 0.5 } }] }, opts).length === 0,
  "NaN coordinates are not a position",
);
ok(
  readRoomPeople({ presences: [{ ...someone, userId: "" }] }, opts).length === 0,
  "an entry with no id cannot be tracked across payloads",
);
ok(
  readRoomPeople({ presences: [null, undefined, 7, someone] }, opts).length === 1,
  "junk entries are skipped without losing the valid ones beside them",
);

// ---------------------------------------------------------------------------
// 5. Identity passes through untouched — the roster memoizes on these objects.
// ---------------------------------------------------------------------------

const admitted = readRoomPeople(wire(someone), opts);
ok(admitted[0] === someone, "admitted entries are passed through by reference, not copied");

console.log(`room payload contract OK — ${n} assertions (the wire key is 'presences')`);
