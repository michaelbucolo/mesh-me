// Presence server policy, extracted PURE (no prisma import) so the live
// contract script can exercise it in plain node:
//
// 1. WRITE-BEHIND COALESCING for the heartbeat hot path: sustained movement
//    used to upsert the DB ~3×/s per active user — the heaviest write path
//    in the app. Position/mood drift now coalesces into one trailing write
//    per ~2s window, while SIGNIFICANT transitions (join, room/surface
//    change, perch change, a world action, ghosting) still write through
//    immediately so cross-instance viewers never miss a discrete event.
//    Same-instance viewers always see every beat instantly (the in-memory
//    store + emitter are untouched by coalescing).
//
// 2. WHERE-CHIP REDACTION: the "where they are" browsing chips are OPT-IN.
//    Location (viewingMesh / activeRoute / activeNodeId / activePostId) is
//    revealed only inside the room the viewer legitimately observes, to the
//    owner of the mesh being browsed, on a genuine same-post co-presence, or
//    when the subject opted in. Users with hide-activity or Ghost Mode have
//    no presence entry at all (removed / filtered upstream), so their
//    location can never surface here regardless.

/** The fields whose CHANGE makes a heartbeat significant (write-through). */
export interface PresenceWriteFacts {
  viewingMesh: string;
  surface: string;
  activeNodeId: string | null;
  activePostId: string | null;
  activeRoute: string | null;
  lastAction: string | null;
  ghostMode: boolean;
  shareWhere: boolean;
}

/** Heartbeat write coalescing window (the write-behind ~2s rider). */
export const PRESENCE_WRITE_BEHIND_MS = 2000;

/** Should this heartbeat hit the DB immediately? `prev` is the previous
 * in-memory entry on this instance — absent (cold instance / first beat)
 * always writes through. */
export function isSignificantPresenceWrite(
  prev: PresenceWriteFacts | undefined | null,
  next: PresenceWriteFacts,
): boolean {
  if (!prev) return true;
  return (
    prev.viewingMesh !== next.viewingMesh ||
    prev.surface !== next.surface ||
    prev.activeNodeId !== next.activeNodeId ||
    prev.activePostId !== next.activePostId ||
    prev.activeRoute !== next.activeRoute ||
    prev.lastAction !== next.lastAction ||
    prev.ghostMode !== next.ghostMode ||
    prev.shareWhere !== next.shareWhere
  );
}

export interface WhereRevealContext {
  /** The entry is inside the room the viewer is (authorizedly) observing. */
  inObservedRoom: boolean;
  /** The entry is browsing the VIEWER's own mesh — knowing who is in your
   * room is intrinsic to owning it. */
  viewingViewerMesh: boolean;
  /** Genuine same-post co-presence (feed or mesh) — the shared post IS the
   * feature; only its own id may be revealed. */
  samePost: boolean;
  /** The subject opted in to "Share where you browse". */
  shareWhere: boolean;
}

/** May this viewer see WHERE the subject is browsing? */
function revealsWhere(ctx: WhereRevealContext): boolean {
  return ctx.inObservedRoom || ctx.viewingViewerMesh || ctx.shareWhere;
}

/** Apply the opt-in redaction to the location-bearing payload fields. */
export function redactWhere<
  T extends {
    viewingMesh: string;
    activeRoute: string | null;
    activeNodeId: string | null;
    activePostId: string | null;
  },
>(fields: T, ctx: WhereRevealContext): T {
  const reveal = revealsWhere(ctx);
  return {
    ...fields,
    viewingMesh: reveal ? fields.viewingMesh : "",
    activeRoute: reveal ? fields.activeRoute : null,
    // Perch/post detail is ROOM detail — never carried outside the room
    // except for the same-post lane, which reveals only the shared post.
    activeNodeId: ctx.inObservedRoom ? fields.activeNodeId : null,
    activePostId:
      ctx.inObservedRoom || ctx.samePost ? fields.activePostId : null,
  };
}
