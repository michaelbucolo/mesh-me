// PICTOCHAT ON THE MAP — the part that decides who sees a drawing.
//
// PictoChat was a room with a LOG: you drew a thing, hit send, and it appended
// to a list everybody in the room could read and scroll back through. That
// last part is the feature. The obvious shortcut — one overwritable message
// per person, floating above their head — is a Club Penguin speech balloon,
// not a chat: a reply overwrites the thing it is replying to and no
// conversation can exist. So doodles APPEND and expire; they never overwrite.
//
// ── THE VISIBILITY RULE IS NOT RESTATED HERE. IT IS INHERITED. ─────────────
//
// A doodle is visible to you if and only if ITS AUTHOR'S PIN IS VISIBLE TO
// YOU. Not "if the audience says so" — that would be a second copy of the
// rule, and a second copy is the thing that drifts. `pinsFor` already applies
// blocking, then ghost mode, then audience, then freshness, in that order, and
// consumes the raw coordinate on the way through. Attaching ink to the pins
// that survive it means a viewer who cannot see somebody on the map cannot see
// their drawing either, by construction rather than by a matching `if`.
//
// The consequence worth stating: turning off location sharing takes your
// doodles with it. That is correct. A drawing broadcast to "people near me" by
// somebody who is no longer telling anyone where they are has no audience left
// to belong to.
//
// ── AND IT CANNOT LEAK A FINER LOCATION THAN A PIN ─────────────────────────
//
// A doodle carries no coordinate of its own. It is drawn at its author's pin,
// which is already a grid cell. There is deliberately no per-message position:
// a message placed "where you were standing when you sent it" would be a
// movement trail assembled one drawing at a time.

import type { MapPin } from "./coarse";

/** How long a drawing lives. Short on purpose — PictoChat's charm was that it
 * was disposable, and a permanent log of what strangers drew near you is a
 * different and much worse product. */
export const DOODLE_TTL_MS = 15 * 60 * 1000;

/** The most recent drawings kept per person. A wall of one author's doodles is
 * how a room gets shouted down by whoever types fastest. */
export const MAX_PER_AUTHOR = 3;

/** How many drawings the room shows at once, newest first. */
export const MAX_IN_ROOM = 40;

export type DoodleRow = {
  id: string;
  userId: string;
  /** Compact encoded strokes — see meshimap/ink for the wire format. */
  ink: string;
  createdAtMs: number;
};

export type Doodle = {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  ink: string;
  createdAtMs: number;
  /** The cell it is drawn at — the author's pin, never its own coordinate. */
  at: { lat: number; lng: number };
};

/**
 * The room's log, for one viewer.
 *
 * Takes the pins the viewer is ALREADY allowed to see and the raw doodle rows,
 * and returns only the drawings whose author is among those pins. A caller
 * cannot pass "all doodles" and get them back, because a doodle with no
 * matching visible pin has nowhere to be drawn and is dropped.
 */
export function doodlesFor(
  rows: readonly DoodleRow[],
  visiblePins: readonly MapPin[],
  nowMs: number,
): Doodle[] {
  // The pins are the allow-list. Building it from `visiblePins` rather than
  // from the viewer's relationships is the whole point: there is exactly one
  // gate, it lives in coarse.ts, and this reads its output.
  const byAuthor = new Map(visiblePins.map((p) => [p.userId, p]));

  const fresh = rows
    .filter((row) => {
      if (!byAuthor.has(row.userId)) return false;
      if (!Number.isFinite(row.createdAtMs)) return false;
      // A future-dated row is a clock problem or a forgery. Neither is a
      // reason to show a drawing, and letting one through would pin it to the
      // top of the room until its timestamp came around.
      if (row.createdAtMs > nowMs + 60_000) return false;
      return nowMs - row.createdAtMs <= DOODLE_TTL_MS;
    })
    // Newest first. Ties break on id so two drawings sent in the same
    // millisecond do not swap places between renders.
    .sort((a, b) =>
      b.createdAtMs !== a.createdAtMs ? b.createdAtMs - a.createdAtMs : a.id < b.id ? -1 : 1,
    );

  const perAuthor = new Map<string, number>();
  const out: Doodle[] = [];
  for (const row of fresh) {
    if (out.length >= MAX_IN_ROOM) break;
    const seen = perAuthor.get(row.userId) ?? 0;
    if (seen >= MAX_PER_AUTHOR) continue;
    perAuthor.set(row.userId, seen + 1);
    const pin = byAuthor.get(row.userId)!;
    out.push({
      id: row.id,
      userId: row.userId,
      username: pin.username,
      displayName: pin.displayName,
      ink: row.ink,
      createdAtMs: row.createdAtMs,
      // The AUTHOR'S CELL. The doodle has no coordinate of its own, so it
      // cannot be more precise than the pin it hangs off.
      at: { lat: pin.at.lat, lng: pin.at.lng },
    });
  }
  return out;
}

// NOTE ON WHAT IS DELIBERATELY NOT HERE YET: the send budget. Constants for a
// rate limit were written here first and then removed, because knip was right
// to call them dead — an exported budget that no endpoint enforces is a
// promise the code does not keep, and the honest place for it is next to the
// write path when that lands. It will go through `durableRateLimit` like every
// other limit on this codebase; a feature-local counter would be a bypass with
// extra steps.
