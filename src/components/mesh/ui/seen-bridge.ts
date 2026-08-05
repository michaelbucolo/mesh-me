// The mesh → Flow seen bridge, as two pure functions — the FROZEN contract:
//
// 1. NATIVE POST IDS ONLY. Only a mesh.me Post row's id may be beaconed to
//    POST /api/flow/impression; external/platform content has no Flow seen-set
//    key and is never recorded.
// 2. NEVER FROM GLOBAL. A Global viewer is untracked — ViewerCaps encodes
//    this as `canRecordImpressions: false`, and the bridge returns nothing.
// 3. NEVER FOR GUESTS. The impression endpoint itself writes nothing without
//    a session (guest beacons answer 204 and touch no row) — the server-side
//    half of the contract.
//
// ── THIS IS THE ONLY COPY NOW, AND THE GATE READS IT ───────────────────────
//
// There were two modules in this repo claiming to be the seen bridge: this
// one, which the mesh canvas actually calls (ui/content-lens.tsx beacons
// through `impressionIdFor`, ui/pluck-ring.tsx decides Like/Save through
// `nativePostId`), and src/components/meshfield/seen-bridge.ts, belonging to
// the tile layout that briefly replaced the canvas.
//
// scripts/mesh-seen-bridge-contract.ts — the gate whose entire job is to stop
// this contract drifting — imported the meshfield copy, and passed the whole
// time it was proving a property of code no user could reach. Green, and blind
// to the thing it names, which is the worst state a gate can be in.
//
// Both halves of that are resolved. app/(app)/mesh/page.tsx renders
// <MeshSceneLoader>, so the canvas is what a person sees and this file is what
// runs; the meshfield copy has been deleted along with the rest of that
// surface; and the gate now imports THIS module, with its section-1 fixtures
// rewritten from field-item shape ({ id, kind, platform }) into the canvas
// node ids the live surface actually hands over:
//
//     { id: "post:abc123" }              -> "abc123"   your own post
//     { id: "friend-post:u7:p3" }        -> "p3"       a friend's post
//     { id: "platform-post:acct1:pp9" }  -> null       external, never beaconed
//     { id: "person:u9" }                -> null       not content
//     { id: "post:" }                    -> null       degenerate, see below
//
// ── WHAT THE OTHER COPY GOT RIGHT, AND IS TAKEN BACK HERE ──────────────────
//
// The id shapes are genuinely different (a field item carries the real row; a
// canvas node carries a prefixed string that has to be parsed) and the parsing
// below is correct for the live surface. But the meshfield rewrite closed a
// hole this file still had, and the hole is real on the canvas too:
//
//   A DEGENERATE ID WAS BEACONED. `nativePostId({ id: "post:" })` sliced the
//   prefix off and returned "" — not null. The declared return type says
//   `string | null`, and "" is neither a Post id nor an absence. The
//   friend-post branch already normalised with `|| null`; the plain-post
//   branch never did. It matters twice over: content-lens writes
//   `data-meshi-content-id={nativePostId(node) ?? node.id}`, and `??` does not
//   catch "", so a malformed node would stamp an EMPTY content id onto the DOM
//   instead of falling back to its own — silently un-targeting the element for
//   everything that reads that attribute. Both branches normalise now.
//
// The viewer parameter also narrows from the full ViewerCaps to the single
// capability bit the bridge actually consults. ViewerCaps still satisfies it
// structurally so every call site is unchanged and a rename of
// `canRecordImpressions` still breaks the build at content-lens — but the
// contract gate can now state a viewer as the one fact under test rather than
// having to construct a nine-field capability object to assert one of them.
//
// Change this file and scripts/mesh-seen-bridge-contract.ts together or not
// at all.

/** The minimal shape the bridge needs — any SceneNode satisfies it. */
export interface SeenBridgeNode {
  id: string;
}

/**
 * What the viewer is allowed to have recorded about them. ViewerCaps (from
 * ../core/viewer) satisfies this; so does a bare fact under test.
 */
export interface SeenBridgeViewer {
  canRecordImpressions: boolean;
}

/**
 * The native Post id behind a content node, if it's one of our own posts
 * (external platform posts return null). Shared by the lens's like/save
 * affordances and the impression beacon, so "what counts as native" is
 * decided exactly once.
 *
 * Returns null — never "" — for a prefix with nothing behind it, so callers
 * can use `??` as well as truthiness and get the same answer.
 */
export function nativePostId(node: SeenBridgeNode): string | null {
  if (node.id.startsWith("post:")) return node.id.slice("post:".length) || null;
  if (node.id.startsWith("friend-post:")) {
    const parts = node.id.split(":");
    return parts[parts.length - 1] || null;
  }
  return null;
}

/**
 * The id to beacon to /api/flow/impression when this node opens in the lens,
 * or null when the contract forbids recording: non-native content, or a
 * viewer without impression capability (Global — untracked by construction).
 */
export function impressionIdFor(node: SeenBridgeNode, viewer: SeenBridgeViewer): string | null {
  if (!viewer.canRecordImpressions) return null;
  return nativePostId(node);
}
