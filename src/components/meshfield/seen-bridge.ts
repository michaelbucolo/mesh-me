// The mesh → Flow seen bridge, as one pure function — the FROZEN contract:
//
// 1. NATIVE POSTS ONLY. Only a mesh.me Post row's id may be beaconed to
//    POST /api/flow/impression; external/platform content has no Flow seen-set
//    key and is never recorded.
// 2. NEVER FROM GLOBAL. A Global viewer is untracked — `canRecordImpressions`
//    is false there, and the bridge returns nothing.
// 3. NEVER FOR GUESTS. The impression endpoint itself writes nothing without
//    a session (guest beacons answer 204 and touch no row) — the server-side
//    half of the contract.
//
// scripts/mesh-seen-bridge-contract.ts pins all three; change this file and
// that test together or not at all.
//
// ── WHAT CHANGED IN THE MOVE, AND WHAT DID NOT ─────────────────────────────
//
// This came off the deleted canvas, where a node id was a prefixed string
// ("post:<id>", "friend-post:<owner>:<id>") and the bridge's job was to parse
// one back out. The field carries real rows, so a native post is simply an
// item of kind "post" from platform "mesh", and its `id` IS the Post id — the
// parsing disappears because the ambiguity it existed to resolve does.
//
// All three contract rules above are unchanged. Only the shape of "which item
// is a native post" moved, because that is the part the surface owns.

/** The minimal shape the bridge needs — any FieldItem satisfies it. */
export interface SeenBridgeItem {
  id: string;
  kind: string;
  platform: string;
}

/** What the viewer is allowed to have recorded about them. */
export interface SeenBridgeViewer {
  canRecordImpressions: boolean;
}

/**
 * The id to beacon to /api/flow/impression when this item is opened, or null
 * when the contract forbids recording: non-native content, anything that is
 * not a post, or a viewer without impression capability (Global and guests —
 * untracked by construction).
 */
export function impressionIdFor(item: SeenBridgeItem, viewer: SeenBridgeViewer): string | null {
  if (!viewer.canRecordImpressions) return null;
  if (item.kind !== "post") return null;
  if (item.platform !== "mesh") return null;
  return item.id || null;
}
