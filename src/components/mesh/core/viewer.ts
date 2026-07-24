// ViewerCaps — ONE derived capability object answering "what may this viewer
// do on this mesh?", computed once from the URL-derived view context (which
// itself only reflects server truth: the server decides what a payload
// contains and rejects writes it never offered).
//
// Capability-by-construction is the goal: instead of scattering
// `if (isGlobal) return` vigilance through effects and JSX, code asks for the
// capability it needs. Two invariants live here as capabilities:
//
// - GLOBAL IS READ-ONLY IN EVERY LAYER (`isGlobalReadOnly`): no compose, no
//   likes, no follows, no DMs, no presence broadcast, no impression writes —
//   the zero-new-visibility invariant of the anonymous world view.
// - THE SEEN BRIDGE IS NATIVE-ID-ONLY (`canRecordImpressions`): opening
//   content may POST /api/flow/impression only for native post ids, and never
//   from the Global view (a Global viewer is untracked; the server already
//   drops guest beacons).

export interface ViewerCaps {
  /** This is the signed-in owner browsing their OWN mesh. */
  isOwner: boolean;
  /** Visiting another user's mesh (server already granted access). */
  isVisiting: boolean;
  /** The Global view — the guest-open, anonymous world hub. */
  isGlobal: boolean;
  /** Global's structural invariant: read-only in all layers. */
  isGlobalReadOnly: boolean;
  /** May compose new posts from this surface (own mesh only). */
  canPost: boolean;
  /** May write likes to native posts (never from Global). */
  canLike: boolean;
  /** May open a DM with a person node (never from Global). */
  canDM: boolean;
  /** May follow/unfollow from a person card. Own mesh only: on a visited
   *  mesh `isFollowing` describes the OWNER's ties, not the viewer's. */
  canFollow: boolean;
  /** May broadcast presence heartbeats (and thus DELETE them on leave).
   *  False in Global: a Global viewer must never be tracked or tracked-back. */
  canBroadcastPresence: boolean;
  /** May record seen-bridge impressions — native post ids only, and only
   *  where the viewer is a tracked participant (never Global). */
  canRecordImpressions: boolean;
}

export interface ViewerContext {
  /** Set when visiting someone else's mesh (`/mesh?user=`). */
  viewUserId?: string;
  /** "global" is the read-only world view; "mesh" is a personal mesh. */
  viewMode?: "mesh" | "global";
}

export function deriveViewerCaps({ viewUserId, viewMode = "mesh" }: ViewerContext): ViewerCaps {
  // "Am I on my own mesh?" must be an EXPLICIT test, never just `!viewUserId`:
  // Global has no viewUserId either, but it must never be treated as the owner.
  const isGlobal = viewMode === "global";
  const isOwner = !viewUserId && !isGlobal;
  return {
    isOwner,
    isVisiting: !isOwner && !isGlobal,
    isGlobal,
    isGlobalReadOnly: isGlobal,
    canPost: isOwner,
    canLike: !isGlobal,
    canDM: !isGlobal,
    canFollow: isOwner,
    canBroadcastPresence: !isGlobal,
    canRecordImpressions: !isGlobal,
  };
}
