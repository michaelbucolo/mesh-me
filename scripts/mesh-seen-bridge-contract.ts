// The mesh → Flow seen-bridge contract, pinned.
//
// The bridge moved off the deleted canvas onto the ring field, so the ID SHAPE
// it reasons about changed: a canvas node was a prefixed string ("post:<id>",
// "friend-post:<owner>:<id>") that had to be parsed, while a field item carries
// the real row — a native post is kind "post" from platform "mesh", and its
// `id` IS the Post id.
//
// The three rules the bridge exists to enforce did NOT change, and are the
// reason this gate still exists:
//
//   1. NATIVE POSTS ONLY — external/platform content has no Flow seen-set key.
//   2. NEVER FROM GLOBAL — Global viewers are untracked, structurally.
//   3. NEVER FOR GUESTS  — the endpoint writes nothing without a session.
//
// Runs standalone (no DOM, no DB): `npm run mesh:seen-contract`.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deriveViewerCaps } from "../src/components/mesh/core/viewer";
import { impressionIdFor } from "../src/components/meshfield/seen-bridge";
import {
  accountMuteKey,
  authorMuteKey,
  isValidMutedSourceKey,
  meshNodeMuteKey,
  parseMutedSources,
} from "../src/lib/muted-sources";

// ---------------------------------------------------------------------------
// 1. Native-posts-only: what counts as a native post is decided exactly once.
// ---------------------------------------------------------------------------

const tracked = { canRecordImpressions: true };
const untracked = { canRecordImpressions: false };

const nativePost = { id: "abc123", kind: "post", platform: "mesh" };

assert.equal(impressionIdFor(nativePost, tracked), "abc123", "a native post records its own id");
assert.equal(
  impressionIdFor({ id: "pp1", kind: "post", platform: "instagram" }, tracked),
  null,
  "platform posts are NOT native and must never be beaconed",
);
assert.equal(
  impressionIdFor({ id: "user9", kind: "person", platform: "mesh" }, tracked),
  null,
  "people are NOT posts",
);
assert.equal(
  impressionIdFor({ id: "t1", kind: "message", platform: "mesh" }, tracked),
  null,
  "messages are NOT posts",
);
assert.equal(
  impressionIdFor({ id: "", kind: "post", platform: "mesh" }, tracked),
  null,
  "a degenerate id is never beaconed",
);

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

assert.equal(impressionIdFor(nativePost, owner), "abc123", "owner opening native content records it");
assert.equal(impressionIdFor(nativePost, visitor), "abc123", "visitor opening native content records it");
assert.equal(impressionIdFor(nativePost, globalViewer), null, "Global NEVER records — even native ids");
assert.equal(impressionIdFor(nativePost, untracked), null, "an untracked viewer records nothing");

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
// 4. Mute keys: strict format, derived only from source-bearing node ids.
//    (Still the only gate covering muted-sources, so it stays here.)
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

console.log("mesh seen-bridge contract OK — native-posts-only, Global untracked, guests dropped, mute keys strict");
