// Seen-bridge contract gate for the mesh → Flow impression bridge
// (`npm run mesh:seen-contract`).
//
// The FROZEN contract (blueprint invariant #5 — "native-id-only seen bridge,
// skip Global/guest"):
//
//   1. NATIVE POST IDS ONLY — only a mesh.me Post row's id is ever beaconed
//      to POST /api/flow/impression; platform/external content never is.
//   2. NEVER FROM GLOBAL — the Global viewer is untracked; ViewerCaps
//      structurally withholds `canRecordImpressions` and the bridge yields
//      nothing.
//   3. NEVER FOR GUESTS — the endpoint itself answers 204 and writes no row
//      without a session (asserted against the route source below, since this
//      gate runs without a DB).
//
// Also pinned here: Catch-up mode consumes UNSEEN items OLDEST-FIRST via the
// pure catchUpTourIds, and mark-seen/mute stay viewer-side (mute keys parse
// strictly; mark-seen is a local watermark that only clears isNew flags).
//
// Runs standalone (no DOM, no DB): `npm run mesh:seen-contract`.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deriveViewerCaps } from "../src/components/mesh/core/viewer";
import { impressionIdFor, nativePostId } from "../src/components/mesh/ui/seen-bridge";
import { applySeenState, catchUpTourIds } from "../src/components/mesh/scene/seen-marks";
import type { SceneModel, SceneNode } from "../src/components/mesh/scene/scene-model";
import {
  accountMuteKey,
  authorMuteKey,
  isValidMutedSourceKey,
  meshNodeMuteKey,
  parseMutedSources,
} from "../src/lib/muted-sources";

// ---------------------------------------------------------------------------
// 1. Native-id-only: what counts as a native post is decided exactly once.
// ---------------------------------------------------------------------------

assert.equal(nativePostId({ id: "post:abc123" }), "abc123", "own native post id must extract");
assert.equal(nativePostId({ id: "friend-post:user9:post77" }), "post77", "friend native post id must extract");
assert.equal(nativePostId({ id: "platform-post:acct1:pp1" }), null, "platform posts are NOT native");
assert.equal(nativePostId({ id: "platform:acct1" }), null, "platform hubs are NOT native");
assert.equal(nativePostId({ id: "person:user9" }), null, "people are NOT native posts");
assert.equal(nativePostId({ id: "activity:xyz" }), null, "activities are NOT native posts");
assert.equal(nativePostId({ id: "post:" }), "", "degenerate id stays falsy — never beaconed");

// ---------------------------------------------------------------------------
// 2. Viewer capability: owner + visitor record, Global NEVER.
// ---------------------------------------------------------------------------

const owner = deriveViewerCaps({});
const visitor = deriveViewerCaps({ viewUserId: "someone-else" });
const globalViewer = deriveViewerCaps({ viewMode: "global" });

assert.equal(owner.canRecordImpressions, true, "the owner is a tracked participant");
assert.equal(visitor.canRecordImpressions, true, "a visiting viewer is a tracked participant");
assert.equal(globalViewer.canRecordImpressions, false, "Global viewers are untracked, structurally");
// Global is read-only in EVERY write capability — the invariant the bridge
// capability derives from.
assert.equal(globalViewer.isGlobalReadOnly, true);
assert.equal(globalViewer.canLike, false);
assert.equal(globalViewer.canSave, false);
assert.equal(globalViewer.canMuteSources, false);
assert.equal(globalViewer.canBroadcastPresence, false);

const nativeNode = { id: "post:abc123" };
assert.equal(impressionIdFor(nativeNode, owner), "abc123", "owner opening native content records it");
assert.equal(impressionIdFor(nativeNode, visitor), "abc123", "visitor opening native content records it");
assert.equal(impressionIdFor(nativeNode, globalViewer), null, "Global NEVER records — even native ids");
assert.equal(impressionIdFor({ id: "platform-post:a:b" }, owner), null, "non-native NEVER records — even for the owner");

// ---------------------------------------------------------------------------
// 3. Guests: the endpoint writes nothing without a session. This gate has no
//    DB, so pin the route source's guard instead — the guest branch must
//    answer 204 before any body parsing or prisma call.
// ---------------------------------------------------------------------------

const routeSource = readFileSync(
  join(__dirname, "..", "src", "app", "api", "flow", "impression", "route.ts"),
  "utf8",
);
assert.match(
  routeSource,
  /if \(!user\) return new NextResponse\(null, \{ status: 204 \}\);/,
  "impression route must drop guest beacons (204, no write) — the server half of the contract",
);
const guardIndex = routeSource.indexOf("if (!user) return new NextResponse(null, { status: 204 });");
const firstWrite = routeSource.indexOf("prisma.");
assert.ok(
  guardIndex !== -1 && (firstWrite === -1 || guardIndex < firstWrite),
  "the guest guard must precede every prisma access in the impression route",
);

// ---------------------------------------------------------------------------
// 4. Catch-up consumes UNSEEN items oldest-first (ties broken by id).
// ---------------------------------------------------------------------------

function makeNode(partial: Partial<SceneNode> & { id: string }): SceneNode {
  return {
    kind: "post",
    label: partial.id,
    color: "#fff",
    parentId: null,
    childIds: [],
    branch: "posts",
    weight: 0.3,
    x: 0, y: 0, angle: 0, depth: 2, dx: 0, dy: 0, vx: 0, vy: 0,
    ...partial,
  } as SceneNode;
}

function modelOf(nodes: SceneNode[]): SceneModel {
  return { selfId: "self", nodes: new Map(nodes.map((n) => [n.id, n])) };
}

const tourModel = modelOf([
  makeNode({ id: "post:new-late", isNew: true, createdAtMs: 3000 }),
  makeNode({ id: "post:new-early", isNew: true, createdAtMs: 1000 }),
  makeNode({ id: "post:new-tie-b", isNew: true, createdAtMs: 2000 }),
  makeNode({ id: "post:new-tie-a", isNew: true, createdAtMs: 2000 }),
  makeNode({ id: "post:old-seen", isNew: false, createdAtMs: 500 }),
  makeNode({ id: "person:friend", kind: "person", isNew: true, createdAtMs: 100, branch: "people" }),
]);
assert.deepEqual(
  catchUpTourIds(tourModel),
  ["post:new-early", "post:new-tie-a", "post:new-tie-b", "post:new-late"],
  "catch-up must stream UNSEEN CONTENT only, oldest-first, id tiebreak",
);

// Mark-seen is viewer-side: a branch watermark + session ids only ever clear
// isNew presentation flags — layout inputs (x/y/angle) are untouched.
const seenModel = modelOf([
  makeNode({ id: "post:a", isNew: true, createdAtMs: 1000, x: 42, y: 7 }),
  makeNode({ id: "post:b", isNew: true, createdAtMs: 9999, x: 3, y: 4 }),
]);
applySeenState(seenModel, { posts: 5000 }, new Set());
assert.equal(seenModel.nodes.get("post:a")!.isNew, false, "at/under the watermark → seen");
assert.equal(seenModel.nodes.get("post:b")!.isNew, true, "after the watermark → still new");
assert.equal(seenModel.nodes.get("post:a")!.x, 42, "mark-seen must never move a node");
applySeenState(seenModel, {}, new Set(["post:b"]));
assert.equal(seenModel.nodes.get("post:b")!.isNew, false, "session-read ids → seen");

// ---------------------------------------------------------------------------
// 5. Mute keys: strict format, derived only from source-bearing node ids.
// ---------------------------------------------------------------------------

assert.equal(meshNodeMuteKey("platform-post:acct1:pp9"), accountMuteKey("acct1"));
assert.equal(meshNodeMuteKey("platform:acct1"), accountMuteKey("acct1"));
assert.equal(meshNodeMuteKey("friend-post:user7:post3"), authorMuteKey("user7"));
assert.equal(meshNodeMuteKey("person:user7"), authorMuteKey("user7"));
assert.equal(meshNodeMuteKey("post:mine"), null, "your own posts have no mutable source");
assert.equal(meshNodeMuteKey("activity:x"), null, "activities have no mutable source");
assert.ok(isValidMutedSourceKey("author:abc_DEF-123"));
assert.ok(!isValidMutedSourceKey("author:"), "empty ids are invalid");
assert.ok(!isValidMutedSourceKey("evil:key"), "unknown kinds are invalid");
assert.ok(!isValidMutedSourceKey("author:a; DROP TABLE"), "junk never parses");
assert.deepEqual(
  parseMutedSources(JSON.stringify(["author:u1", "bogus", 42, "account:a2"])),
  ["author:u1", "account:a2"],
  "persisted lists parse defensively",
);
assert.deepEqual(parseMutedSources("not json"), [], "corrupt rows read as no mutes");

console.log("mesh seen-bridge contract OK — native-id-only, Global untracked, guests dropped, catch-up oldest-first, mute keys strict");
