import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publicPresenceRoute, redactWhere } from "../src/lib/presence-policy";
import { getPostPresenceKey } from "../src/lib/presence-keys";

async function main() {
  // Always isolate fixtures, including when production env is present.
  const directory = mkdtempSync(join(tmpdir(), "mesh-presence-privacy-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  delete process.env.DATABASE_AUTH_TOKEN;
  process.env.VERCEL_ENV = "preview";
  execFileSync(process.execPath, ["scripts/ensure-schema.mjs"], { env: process.env, stdio: "pipe" });
  const { prisma } = await import("../src/lib/prisma");
  const { setPresence, removePresence, listPresences, buildPresencePayload, isUserLiveNow, getBlockedUserIds, canViewMeshRoom } = await import("../src/lib/mesh-presence-store");
  const { canViewPresencePost } = await import("../src/lib/presence-post-access");
  let checks = 0;
  const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); checks++; };
  const refresh = () => removePresence("fixture-cache-invalidation");
  try {
    for (const path of ["/feed", "/flow", "/explore", "/communities"]) check(publicPresenceRoute(path), path, `Public surface ${path}`);
    for (const path of ["/messages/secret", "/settings", "/admin", "/explore?q=private", "/feed/secret", "/profile/private", "https://example.com/feed", null]) check(publicPresenceRoute(path), null, `Private route ${path}`);
    const users = await Promise.all(["owner", "friend", "stranger"].map((name) => prisma.user.create({ data: {
      id: randomUUID(), username: name, displayName: name, email: `${name}@example.invalid`, passwordHash: "isolated-no-login", isPublic: true, showInDiscovery: true,
    } })));
    const [owner, friend, stranger] = users;
    await prisma.follow.createMany({ data: [
      { followerId: owner.id, followingId: friend.id }, { followerId: friend.id, followingId: owner.id },
    ] });
    await prisma.meshiPreference.create({ data: { userId: owner.id, colorTheme: "purple", hatStyle: "cap", hairStyle: "tuft", hairColor: "red", accessoryStyle: "glasses", eyeStyle: "sleepy", badgeStyle: "star", faceStyle: "calm" } });
    const entry = {
      userId: owner.id, username: "spoof", displayName: "spoof", avatarUrl: null,
      meshiColor: "spoof", meshiHat: "spoof", meshiHair: "spoof", meshiHairColor: "spoof", meshiAccessory: "spoof", meshiEyeStyle: "spoof", meshiBadge: "spoof", meshiMood: "happy",
      position: { x: 1, y: 2 }, viewportPosition: { vx: 0.5, vy: 0.5 }, viewingMesh: owner.id,
      surface: "mesh" as const, activePostId: "secret", activeNodeId: "post:secret", activeRoute: "/messages/secret",
      shareWhere: true, activity: "idle" as const, ghostMode: false, lastAction: "heart|post:secret|123", isPro: true, lastSeen: Date.now(),
    };
    await setPresence(entry);
    let visible = (await listPresences())[0];
    check(visible.username, owner.username, "Identity comes from current account");
    check([visible.meshiColor, visible.meshiHat, visible.meshiHair, visible.meshiHairColor, visible.meshiAccessory, visible.meshiEyeStyle, visible.meshiBadge, visible.meshiFace], ["purple", "cap", "tuft", "red", "glasses", "sleepy", "star", "calm"], "All eight cosmetics use saved account values");
    check(visible.isPro, false, "Heartbeat cannot spoof Pro");
    const ctx = { viewerId: friend.id, connectedSet: new Set([owner.id]), meshOwner: owner.id, surface: "mesh", activePostId: null };
    let payload = buildPresencePayload([visible], ctx).presences[0];
    check(payload.activeRoute, null, "Legacy private route removed on read");
    check(payload.activePostId, null, "A shared room does not reveal private post");
    check(payload.activeNodeId, null, "A shared room does not reveal private node");
    check(payload.lastAction, null, "Targeted action cannot reveal private post");
    payload = buildPresencePayload([visible], { ...ctx, activePostId: "secret" }).presences[0];
    check(payload.activePostId, "secret", "Authorized same-post lane retains shared post");
    check(payload.activeNodeId, "post:secret", "Authorized same-post lane retains node");
    check(payload.lastAction, entry.lastAction, "Authorized same-post lane retains action");
    check(buildPresencePayload([visible], { ...ctx, blockedSet: new Set([owner.id]) }).presences.length, 0, "Blocks remove presence");
    for (const flag of ["ghostMode", "hideActivityStatus", "isSuspended"] as const) {
      await prisma.user.update({ where: { id: owner.id }, data: { [flag]: true } });
      await refresh();
      check((await listPresences()).length, 0, `Current ${flag} suppresses cached entry`);
      check(await isUserLiveNow(owner.id), false, `Profile live badge respects ${flag}`);
      await prisma.user.update({ where: { id: owner.id }, data: { [flag]: false } });
    }
    await refresh();
    visible = (await listPresences())[0];
    check(Boolean(visible), true, "Visible presence returns after privacy is restored");
    await removePresence(owner.id);
    check((await listPresences()).length, 0, "Removal invalidates previously read snapshot");
    await setPresence({ ...entry, lastSeen: Date.now() });
    await refresh();
    const originalFind = prisma.user.findMany;
    prisma.user.findMany = (() => Promise.reject(new Error("isolated database fault"))) as typeof prisma.user.findMany;
    try { check((await listPresences()).length, 0, "Authorization DB failure cannot expose memory entries"); }
    finally { prisma.user.findMany = originalFind; }
    const posts = await Promise.all(["public", "friends", "private"].map((visibility) => prisma.post.create({ data: { authorId: owner.id, content: `Fixture ${visibility}`, visibility } })));
    for (const [index, post] of posts.entries()) {
      check(await canViewPresencePost(owner, post.id), true, `Owner post access ${post.visibility}`);
      check(await canViewPresencePost(friend, post.id), index !== 2, `Friend post access ${post.visibility}`);
      check(await canViewPresencePost(stranger, post.id), index === 0, `Stranger post access ${post.visibility}`);
      const key = getPostPresenceKey({ id: post.id, sourceType: "mesh" });
      check(await canViewPresencePost(owner, key), true, `Canonical owner post access ${post.visibility}`);
      check(await canViewPresencePost(friend, key), index !== 2, `Canonical friend post access ${post.visibility}`);
      check(await canViewPresencePost(stranger, key), index === 0, `Canonical stranger post access ${post.visibility}`);
    }
    const account = await prisma.connectedAccount.create({ data: { userId: owner.id, platform: "youtube", platformUsername: owner.username } });
    const platformPosts = await Promise.all(["public", "friends", "private"].map((visibility) => prisma.platformPost.create({ data: {
      connectedAccountId: account.id, platformPostId: randomUUID(), content: `Imported ${visibility}`, visibility,
    } })));
    for (const [index, post] of platformPosts.entries()) {
      const key = getPostPresenceKey({ id: `platform-${post.id}`, platform: "youtube", sourceId: post.id, sourceType: "platform" });
      check(await canViewPresencePost(owner, key), true, `Canonical imported owner ${post.visibility}`);
      check(await canViewPresencePost(friend, key), index !== 2, `Canonical imported friend ${post.visibility}`);
      check(await canViewPresencePost(stranger, key), index === 0, `Canonical imported stranger ${post.visibility}`);
      check(getPostPresenceKey({ id: `friend-platform-${post.id}` }), key, `Friend imported card shares ${post.visibility} presence key`);
      check(await canViewPresencePost(owner, `platform-${post.id}`), true, `Legacy imported owner ${post.visibility}`);
      check(await canViewPresencePost(owner, `friend-platform-${post.id}`), true, `Legacy friend alias owner ${post.visibility}`);
    }
    const importedFeedItem = await prisma.platformFeedItem.create({ data: { connectedAccountId: account.id, platformItemId: randomUUID(), content: "Private personalized feed item" } });
    const importedFeedKey = getPostPresenceKey({ id: `feeditem-${importedFeedItem.id}`, platform: "youtube", sourceId: importedFeedItem.id, sourceType: "platform" });
    check(await canViewPresencePost(owner, importedFeedKey), true, "Canonical personalized import resolves for owner");
    check(await canViewPresencePost(friend, importedFeedKey), false, "Canonical personalized import stays private from friend");
    check(await canViewPresencePost(stranger, importedFeedKey), false, "Canonical personalized import stays private from stranger");
    check(await canViewPresencePost(owner, `feeditem-${importedFeedItem.id}`), true, "Legacy personalized import resolves for owner");
    check(await canViewPresencePost(friend, `feeditem-${importedFeedItem.id}`), false, "Legacy personalized import stays private");
    check(await canViewPresencePost(owner, `platform-${importedFeedItem.id}`), false, "Legacy platform alias cannot change a feed item's source kind");
    const collision = await prisma.platformFeedItem.create({ data: { id: platformPosts[2].id, connectedAccountId: account.id, platformItemId: randomUUID(), content: "Isolated identifier collision" } });
    check(await canViewPresencePost(owner, `feeditem-${collision.id}`), false, "Ambiguous legacy feed item collision fails closed");
    const publicSupply = await prisma.publicPost.create({ data: { platform: "youtube", platformPostId: randomUUID(), lane: "fixture", content: "Public fixture", expiresAt: new Date(Date.now() + 60_000) } });
    const publicKey = getPostPresenceKey({ id: `public-${publicSupply.id}`, platform: "youtube", sourceType: "platform" });
    check(await canViewPresencePost(stranger, publicKey), true, "Canonical public-supply key resolves without sourceId");
    await prisma.publicPost.update({ where: { id: publicSupply.id }, data: { expiresAt: new Date(0) } });
    check(await canViewPresencePost(stranger, publicKey), false, "Canonical public-supply key preserves expiry gate");
    for (const key of ["mesh:", "platform:", "imported:unknown", "url:https://example.com/private", `mesh:platform-${platformPosts[0].id}`]) {
      check(await canViewPresencePost(owner, key), false, `Malformed or wrong namespace ${key} is denied`);
    }
    check(await canViewPresencePost(friend, "missing-post"), false, "Guessed post is denied");
    check(await canViewPresencePost(friend, "x".repeat(161)), false, "Unbounded post ID is denied");
    await prisma.block.create({ data: { blockerId: owner.id, blockedId: friend.id } });
    check((await getBlockedUserIds(friend.id)).has(owner.id), true, "Both block directions are included");
    check(await canViewPresencePost(friend, posts[0].id), false, "Block also revokes public post access");
    check(await canViewPresencePost(friend, getPostPresenceKey({ id: posts[0].id })), false, "Block revokes canonical native post access");
    check(await canViewPresencePost(friend, getPostPresenceKey({ id: `platform-${platformPosts[0].id}` })), false, "Block revokes canonical imported post access");
    check(await canViewPresencePost(friend, `friend-platform-${platformPosts[0].id}`), false, "Block revokes legacy friend-platform alias");
    check(await canViewPresencePost(friend, `platform-${platformPosts[0].id}`), false, "Block revokes legacy platform alias");
    check(await canViewMeshRoom(friend.id, owner.id), false, "Block revokes room access");
    const where = { viewingMesh: owner.id, activePostId: "secret", activeNodeId: "platform-post:account:secret", activeRoute: "/messages/secret" };
    check(redactWhere(where, { inObservedRoom: true, viewingViewerMesh: false, samePost: false, shareWhere: true }).activeNodeId, null, "Platform post nodes stay private too");
    await prisma.user.update({ where: { id: owner.id }, data: { isSuspended: true } });
    check(await canViewPresencePost(stranger, posts[0].id), false, "Suspension revokes post access");
    console.log(`Presence privacy: ${checks} assertions passed.`);
  } finally {
    const all = await prisma.user.findMany({ select: { id: true } });
    await Promise.all(all.map((user) => removePresence(user.id)));
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
