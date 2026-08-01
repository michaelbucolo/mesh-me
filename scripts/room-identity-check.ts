// TWO PEOPLE WHO MEANT TO WATCH ONE THING TOGETHER, IN TWO DIFFERENT ROOMS.
//
// `MeChatSession` has no threadId, so a room is identified by who is in it, and
// nothing was checking. `POST /api/mechat/sessions` created unconditionally and
// the client held the room id in local state starting at null, so:
//
//   Alice presses "Watch something together" → room R1, Bob invited, Bob
//   notified. Bob opens the thread; his roomId has never been anything but
//   null, so his button offers to start something. He presses it → ROOM R2.
//   Each of them is now looking at an empty queue in a room the other is not
//   in, and nothing on either screen says so.
//
// Every gate in `npm run check` passed while that was true, and so did tsc,
// lint, knip and the build — because it is not a type error, not dead code, and
// not a broken build. It is one HTTP call meaning something different from what
// the person pressing the button meant.
//
// The rule now lives in exactly one pure function. This is what holds it there.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { canReuseRoom, findReusableRoom, participantKey, type RoomCandidate } from "../src/lib/mechat/room-identity";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
let checks = 0;

function room(over: {
  participants: string[];
  status?: string;
  callMode?: string;
  sessionType?: string;
}): RoomCandidate {
  return {
    status: over.status ?? "draft",
    callMode: over.callMode ?? "none",
    sessionType: over.sessionType ?? "co_browse",
    participants: over.participants.map((userId) => ({ userId })),
  };
}

const plainRequest = (ids: string[]) => ({
  wantedKey: participantKey(ids),
  sessionType: "co_browse",
  callMode: "none",
  itemCount: 0,
});

// ── 1. THE BUG ITSELF: THE INVITEE MUST LAND IN THE ROOM, NOT MAKE A NEW ONE ─
{
  const alicesRoom = room({ participants: ["alice", "bob"] });
  // Bob asks for a room with Alice. Alice already made one. He must get HERS.
  const found = findReusableRoom([alicesRoom], plainRequest(["bob", "alice"]));
  assert.equal(found, alicesRoom, "the invitee must be handed the existing room, not a second one");
  checks += 1;

  // Order must not matter — this is a set, and the invitee names the pair in
  // the opposite order from the host by construction.
  assert.equal(
    participantKey(["bob", "alice"]),
    participantKey(["alice", "bob"]),
    "participant identity must not depend on who is listing whom",
  );
  checks += 1;

  // And the host reopening after a close gets the same room back, which is what
  // stopped one person alone from manufacturing R3, R4, R5 until the rate
  // limiter told them they had made too many rooms.
  assert.equal(
    findReusableRoom([alicesRoom], plainRequest(["alice", "bob"])),
    alicesRoom,
    "reopening must return the same room",
  );
  checks += 1;
}

// ── 2. EXACT MATCH ONLY — A SUPERSET IS A DIFFERENT ROOM ────────────────────
//
// The tempting bug in the fix is "contains both of them, close enough". It is
// not close enough: it walks a third person's conversation partner into a room
// with them, which is a privacy failure wearing a convenience's clothes.
{
  const withCarol = room({ participants: ["alice", "bob", "carol"] });
  assert.equal(
    findReusableRoom([withCarol], plainRequest(["alice", "bob"])),
    null,
    "a room containing a THIRD person must never be returned for a two-person request",
  );
  checks += 1;

  const justAlice = room({ participants: ["alice"] });
  assert.equal(
    findReusableRoom([justAlice], plainRequest(["alice", "bob"])),
    null,
    "a room missing one of the requested people is not that room either",
  );
  checks += 1;

  const otherPair = room({ participants: ["alice", "dave"] });
  assert.equal(
    findReusableRoom([otherPair], plainRequest(["alice", "bob"])),
    null,
    "a room with a different second person is a different room",
  );
  checks += 1;

  // With several rooms in play, the right one is picked out of the crowd.
  const right = room({ participants: ["alice", "bob"] });
  assert.equal(
    findReusableRoom([withCarol, otherPair, justAlice, right], plainRequest(["alice", "bob"])),
    right,
    "the exactly-matching room must be found among non-matching ones",
  );
  checks += 1;
}

// ── 3. AN ENDED ROOM STAYS ENDED ────────────────────────────────────────────
{
  assert.equal(
    findReusableRoom([room({ participants: ["alice", "bob"], status: "ended" })], plainRequest(["alice", "bob"])),
    null,
    "somebody closed that room on purpose; it must not reopen under them",
  );
  checks += 1;

  // But a live one is fine — only "ended" is excluded, not everything non-draft.
  assert.ok(
    findReusableRoom([room({ participants: ["alice", "bob"], status: "live" })], plainRequest(["alice", "bob"])),
    "a live room is still the room they are in",
  );
  checks += 1;
}

// ── 4. REUSE IS NARROW, AND ON PURPOSE ──────────────────────────────────────
//
// Both of these requests carry an intent an existing room cannot honour, so
// both must create instead. Getting this wrong is worse than the duplicate:
// one puts things in front of another person unasked, the other silently does
// not start the call somebody asked for.
{
  const existing = room({ participants: ["alice", "bob"] });

  assert.equal(
    findReusableRoom([existing], { ...plainRequest(["alice", "bob"]), itemCount: 3 }),
    null,
    "opening WITH items must not append them into a room the other person did not know was open",
  );
  checks += 1;

  for (const callMode of ["voice", "video"]) {
    assert.equal(
      findReusableRoom([existing], { ...plainRequest(["alice", "bob"]), callMode }),
      null,
      `asking to start a ${callMode} call must not silently hand back a room with no call in it`,
    );
    checks += 1;
  }

  // A room that is itself mid-call is not a plain room to walk into either.
  assert.equal(
    findReusableRoom([room({ participants: ["alice", "bob"], callMode: "video" })], plainRequest(["alice", "bob"])),
    null,
    "a room already on a call must not be joined by a request that asked for no call",
  );
  checks += 1;

  // canReuseRoom must agree with findReusableRoom, since the route uses it to
  // skip the database read entirely. A disagreement is a silently missed room.
  for (const req of [
    plainRequest(["alice", "bob"]),
    { ...plainRequest(["alice", "bob"]), itemCount: 1 },
    { ...plainRequest(["alice", "bob"]), callMode: "voice" },
  ]) {
    const cheap = canReuseRoom(req);
    const real = findReusableRoom([existing], req) !== null;
    assert.ok(cheap || !real, "canReuseRoom said no while findReusableRoom would have said yes — a room would be missed");
    checks += 1;
  }
}

// ── 5. A DIFFERENT KIND OF SESSION IS NOT THIS SESSION ──────────────────────
{
  assert.equal(
    findReusableRoom(
      [room({ participants: ["alice", "bob"], sessionType: "watch_party" })],
      plainRequest(["alice", "bob"]),
    ),
    null,
    "sessionType must match; co_browse and another session kind are not interchangeable",
  );
  checks += 1;
}

// ── 6. THE ROUTE MUST ACTUALLY USE THIS, AND BEFORE IT CREATES ──────────────
//
// Every assertion above is about a function. None of them prove the route calls
// it — which was exactly the shape of the original bug, where correct code
// existed and nothing reached it.
{
  const route = readFileSync(join(ROOT, "src/app/api/mechat/sessions/route.ts"), "utf8");

  assert.ok(
    route.includes("findReusableRoom"),
    "the sessions route does not call findReusableRoom, so the rule above governs nothing",
  );
  checks += 1;

  const reuseAt = route.indexOf("findReusableRoom(candidates");
  const createAt = route.indexOf("meChatSession.create");
  assert.ok(reuseAt > 0 && createAt > 0, "expected both the reuse lookup and the create call to be present");
  assert.ok(
    reuseAt < createAt,
    "the reuse lookup must run BEFORE the create — checking afterwards is just making the duplicate more slowly",
  );
  checks += 2;

  // The rate limit counts rooms CREATED. Counting re-entries is how one person
  // pressing one button ten times got told they had made too many rooms.
  const limitAt = route.indexOf("mechat-session-create:");
  assert.ok(limitAt > 0, "expected the creation rate limit to still be present");
  assert.ok(
    limitAt > reuseAt,
    "the create rate limit must come AFTER the reuse lookup, or re-entering a room you are already in\n" +
      "  consumes the budget and eventually fails with 'Too many rooms created'",
  );
  checks += 2;
}

console.log(
  `room-identity OK — ${checks} assertions.\n` +
    "  An invitee asking for a room with the host is handed the host's room; reopening returns the\n" +
    "  same one. A room with a third person in it, a room missing someone, a room with a different\n" +
    "  partner, an ended room, a room on a call, and a room of another sessionType are all refused.\n" +
    "  Requests carrying items or asking for a call always create, because an existing room cannot\n" +
    "  honour either intent. The route calls the rule before it creates, and the creation rate limit\n" +
    "  runs after it, so walking back into a room never counts against making one.\n" +
    "  Does NOT cover: the live HTTP round trip, or the client's own matching.",
);
