import assert from "node:assert/strict";
import {
  canSeeMeshBranch,
  canSeeMeshStats,
  canViewMesh,
  canViewProfile,
  parseBranchOverrides,
} from "../src/lib/privacy-policy";

const owner = { id: "owner" };
const friend = { id: "friend" };
const outsider = { id: "outsider" };
const admin = { id: "admin", isAdmin: true };
const subject = { id: owner.id, isPublic: false, isSuspended: false };

assert.equal(canViewMesh(owner, owner.id, "private", false), true, "owners must see their private Mesh");
assert.equal(canViewMesh(outsider, owner.id, "private", false), false, "outsiders must not see a private Mesh");
assert.equal(canViewMesh(friend, owner.id, "friends", true), true, "mutual friends must see a friends-only Mesh");
assert.equal(canViewMesh(outsider, owner.id, "friends", false), false, "non-friends must not see a friends-only Mesh");

assert.equal(canViewProfile(outsider, subject, "private", false), false, "private profile details must remain hidden");
assert.equal(canViewProfile(friend, subject, "friends", true), true, "friends-only profile details must be visible to mutual friends");
assert.equal(canViewProfile(admin, { ...subject, isSuspended: true }, "private", false), true, "admins must be able to review suspended profiles");
assert.equal(canViewProfile(outsider, { ...subject, isSuspended: true, isPublic: true }, "public", false), false, "suspended profiles must remain hidden from outsiders");

const overrides = parseBranchOverrides(JSON.stringify({ people: "public", content: "friends", invalid: "everyone" }));
assert.deepEqual(overrides, { people: "public", content: "friends" }, "invalid branch visibility values must be discarded");
assert.equal(canSeeMeshBranch({
  viewer: outsider,
  targetUserId: owner.id,
  branchKey: "people",
  branchOverrides: overrides,
  isFriend: false,
  showConnections: false,
  defaultVisibility: "private",
}), false, "showConnections=false must hide connection branches even when an override is public");
assert.equal(canSeeMeshBranch({
  viewer: friend,
  targetUserId: owner.id,
  branchKey: "content",
  branchOverrides: overrides,
  isFriend: true,
  defaultVisibility: "private",
}), true, "friends must see a friends-only content branch");
assert.equal(canSeeMeshBranch({
  viewer: outsider,
  targetUserId: owner.id,
  branchKey: "interests",
  branchOverrides: {},
  isFriend: false,
  defaultVisibility: "private",
}), false, "partial Mesh branches must default to private");

assert.equal(canSeeMeshStats(outsider, owner.id, { meshVisibility: "public", branchOverrides: "{}", showConnections: true, showStats: false }), false, "showStats=false must hide counts from outsiders");
assert.equal(canSeeMeshStats(owner, owner.id, null), true, "owners must always see their own counts");

console.log("Privacy policy checks passed");
