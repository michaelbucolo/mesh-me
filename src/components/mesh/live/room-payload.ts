// WHO IS ACTUALLY STANDING IN THIS ROOM — decided once, for every surface.
//
// ── THE BUG THIS FILE EXISTS BECAUSE OF ────────────────────────────────────
//
// The room surface read `payload.people`. The wire has always said
// `presences`. So `readPeople` returned an empty array on every single
// payload and NOBODY EVER APPEARED — while the roster contract, the glide
// machine, the transport backoff and the presence store's privacy gate all
// passed, because not one of them feeds a real payload through the component
// that draws the bodies. Two browser contexts in one room found it in about
// four seconds (scripts/room-copresence-proof.mjs).
//
// The deeper mistake was not the typo. It was that the room wrote its own
// second copy of "read the payload, keep the people who are here", so the
// copy that was already right could not protect it. There is one copy now.
//
// ── WHY ADMISSION IS NARROWER THAN VISIBILITY ──────────────────────────────
//
// The server deliberately sends MORE than the room needs. Its payload also
// carries connections who are online elsewhere on mesh.me — that is correct
// for a mesh, where a friend reading /flow shows as alive on their node. It
// is wrong for a ROOM: drawing them puts a body on the floor for someone who
// is not in the space, and the whole promise of the room is that a body means
// a person who is actually here. So admission asks four things, and a person
// has to pass all four:
//
//   isOnline           — not a stale entry inside the grace window
//   viewingMesh===room — in THIS room, not merely somewhere
//   surface==="mesh"   — standing in a mesh, not scrolling the feed
//   not you            — you are drawn from your own position, never an echo

import type { RemotePresence } from "./roster";

/**
 * Pull the people standing in `room` out of a presence payload.
 *
 * Defensive at every step: the payload is shared with older clients and comes
 * off the network, so a wrong shape has to mean "nobody" rather than a throw
 * that takes the animation loop down with it.
 */
export function readRoomPeople(
  payload: unknown,
  options: { room: string | null; viewerId: string | null },
): RemotePresence[] {
  const { room, viewerId } = options;
  // No room means we are not joined yet — an unfiltered list here would draw
  // whoever happened to be in the last payload, in a room they are not in.
  if (!room) return [];
  if (!payload || typeof payload !== "object") return [];

  const raw = (payload as { presences?: unknown }).presences;
  if (!Array.isArray(raw)) return [];

  const people: RemotePresence[] = [];
  for (const entry of raw) {
    if (!isPresence(entry)) continue;
    if (entry.userId === viewerId) continue;
    if (!entry.isOnline) continue;
    if (entry.viewingMesh !== room) continue;
    if (entry.surface !== "mesh") continue;
    people.push(entry);
  }
  return people;
}

/** A payload entry we can actually place a body for. A presence without a
 * usable position cannot be drawn anywhere honest, so it is not admitted. */
function isPresence(value: unknown): value is RemotePresence {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<RemotePresence>;
  if (typeof p.userId !== "string" || p.userId.length === 0) return false;
  const vp = p.viewportPosition;
  if (!vp || typeof vp !== "object") return false;
  return Number.isFinite(vp.vx) && Number.isFinite(vp.vy);
}
