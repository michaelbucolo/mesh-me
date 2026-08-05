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
// scripts/mesh-seen-bridge-contract.ts pins all three; change this file and
// that test together or not at all.

import type { ViewerCaps } from "../core/viewer";

/** The minimal shape the bridge needs — any SceneNode satisfies it. */
export interface SeenBridgeNode {
  id: string;
}

/**
 * The native Post id behind a content node, if it's one of our own posts
 * (external platform posts return null). Shared by the lens's like/save
 * affordances and the impression beacon, so "what counts as native" is
 * decided exactly once.
 */
export function nativePostId(node: SeenBridgeNode): string | null {
  if (node.id.startsWith("post:")) return node.id.slice("post:".length);
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
export function impressionIdFor(node: SeenBridgeNode, viewer: ViewerCaps): string | null {
  if (!viewer.canRecordImpressions) return null;
  return nativePostId(node);
}
