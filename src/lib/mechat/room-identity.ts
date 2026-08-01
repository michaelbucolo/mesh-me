// A ROOM WITH NO NAME IS IDENTIFIED BY WHO IS IN IT.
//
// `MeChatSession` has no threadId. There is no column that says "this is the
// room for that conversation", so the only thing that can answer "am I already
// in a room with this person?" is the participant set.
//
// Nothing answered it, and the feature broke in the exact way it exists to
// prevent. `POST /api/mechat/sessions` created unconditionally, and the client
// held the room id in local component state starting at null:
//
//   Alice presses "Watch something together". Room R1 is created, Bob is added
//   as a participant, Bob is notified. Bob opens the thread. His client's
//   roomId is null — it has never been anything else — so his button also says
//   "Watch something together". He presses it. ROOM R2 IS CREATED. Two people
//   who meant to watch one thing together are now in two rooms, each staring at
//   an empty queue, each believing the other can see it.
//
// One person alone hit it too: close the room, or reload the page, and pressing
// the button again made R3, R4, R5 — until the tenth press inside ten minutes
// returned "Too many rooms created. Please try again later.", which is a
// remarkable thing to be told when you believe you are walking back into the
// room you were just standing in.
//
// The rule lives here, as one pure function, because the repo's recurring
// failure is a second writer for one fact. The route calls this; so does the
// gate. There is no other copy.

export type RoomCandidate = {
  status: string;
  callMode: string;
  sessionType: string;
  participants: { userId: string }[];
};

export type RoomRequest = {
  /** participantKey of everyone the caller wants in the room, themselves included. */
  wantedKey: string;
  sessionType: string;
  callMode: string;
  /** How many items the caller is opening WITH. Zero for a plain "open the room". */
  itemCount: number;
};

/** Order-independent identity for a set of people. */
export function participantKey(ids: Iterable<string>): string {
  return Array.from(new Set(ids)).sort().join("|");
}

/**
 * The room this request should return instead of creating, or null.
 *
 * Deliberately narrow. Reuse applies only to a PLAIN request — no items, no
 * call — because either of those carries an intent an existing room cannot
 * honour:
 *
 *   • Items. Appending someone's queue into a room they did not know was open
 *     puts things in front of another person without either of them choosing
 *     it. Making a fresh room is the lesser surprise.
 *
 *   • A call. Handing back a `callMode: "none"` room to someone who asked to
 *     start a voice call silently does not do the thing they asked for, and
 *     they find out by nobody answering.
 *
 * The participant set must match EXACTLY — never a superset. A room with a
 * third person in it is a different room, and seating someone there because
 * their name happened to be on the guest list would be a privacy failure
 * dressed up as a convenience.
 *
 * An ended room stays ended. Somebody closed it on purpose.
 */
export function canReuseRoom(request: Pick<RoomRequest, "callMode" | "itemCount">): boolean {
  return request.itemCount === 0 && request.callMode === "none";
}

export function findReusableRoom<T extends RoomCandidate>(candidates: T[], request: RoomRequest): T | null {
  // Repeated rather than assumed: a caller that skips the lookup because
  // canReuseRoom said no is an optimisation, and this function must still be
  // correct when called without one.
  if (!canReuseRoom(request)) return null;

  for (const candidate of candidates) {
    if (candidate.sessionType !== request.sessionType) continue;
    if (candidate.callMode !== "none") continue;
    if (candidate.status === "ended") continue;
    if (participantKey(candidate.participants.map((p) => p.userId)) !== request.wantedKey) continue;
    return candidate;
  }
  return null;
}
