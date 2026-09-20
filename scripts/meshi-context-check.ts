import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearLegacyMeshiContext } from "../src/lib/meshi-knowledge";

// Run real permission queries in a disposable local database. No server,
// provider calls, browser credentials, or production environment is needed.
let assertions = 0;
function check(actual: unknown, expected: unknown, message: string) {
  assert.deepEqual(actual, expected, message);
  assertions++;
}

function checkLegacyCleanup() {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map([
    ["meshi-knowledge", "previous account relationships"],
    ["meshi-chat-history", "previous account private conversation"],
    ["meshiColor", "blue"],
  ]);
  const removed: string[] = [];
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: {
      localStorage: {
        getItem: () => { throw new Error("Legacy account data must never be read"); },
        setItem: () => { throw new Error("Context must never be persisted"); },
        removeItem: (key: string) => { removed.push(key); values.delete(key); },
      },
    } });
    clearLegacyMeshiContext();
    check([...values.entries()], [["meshiColor", "blue"]], "cleanup removes both previous-account caches without touching cosmetics");
    check(removed, ["meshi-knowledge", "meshi-chat-history"], "cleanup deletes values without reading or migrating their contents");
    clearLegacyMeshiContext();
    check(values.size, 1, "cleanup is safe to repeat");
    Object.defineProperty(globalThis, "window", { configurable: true, value: {
      get localStorage() { throw new Error("Storage unavailable"); },
    } });
    assert.doesNotThrow(clearLegacyMeshiContext);
    assertions++;
    Reflect.deleteProperty(globalThis, "window");
    assert.doesNotThrow(clearLegacyMeshiContext);
    assertions++;
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
  const float = readFileSync("src/components/meshi/meshi-float.tsx", "utf8");
  check(/localStorage\.(?:getItem|setItem)\([\s\n]*["']meshi-(?:knowledge|chat-history)/.test(float), false, "speech cannot restore or persist unscoped account context");
  check(float.includes("clearLegacyMeshiContext();"), true, "the mounted companion performs legacy cleanup");
  check(float.includes("PRESENCE_ACCOUNT_EVENT, reconcileAccount"), true, "account changes invalidate in-memory context even when the root survives");
  check(float.includes("key={contextSession}"), true, "account invalidation also discards the child chat's in-memory conversation");
}

async function main() {
  checkLegacyCleanup();
  const directory = mkdtempSync(join(tmpdir(), "mesh-context-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  delete process.env.DATABASE_AUTH_TOKEN;
  delete process.env.PRISMA_QUERY_LOG;
  process.env.VERCEL_ENV = "preview";
  execFileSync(process.execPath, ["scripts/ensure-schema.mjs"], { env: process.env, stdio: "pipe" });
  const { prisma } = await import("../src/lib/prisma");
  const { readMeshiMeshContext } = await import("../src/lib/meshi-context");
  try {
    const names = ["owner", "other", "public", "hiddenstats", "privateone", "privatemutual", "privatehard", "denied", "legacydenied", "suspended", "blockedout", "blockedin"];
    const users = Object.fromEntries(await Promise.all(names.map(async (name) => {
      const user = await prisma.user.create({ data: {
        id: name, username: name, displayName: name, email: `${name}@example.invalid`,
        passwordHash: "isolated-test-no-login", isPublic: !name.startsWith("private"),
        isSuspended: name === "suspended", isAdmin: name === "owner",
      } });
      return [name, user] as const;
    })));
    await prisma.follow.createMany({ data: names.slice(2).map((followingId) => ({ followerId: "owner", followingId })) });
    await prisma.follow.createMany({ data: ["privatemutual", "privatehard"].map((followerId) => ({ followerId, followingId: "owner" })) });
    await prisma.meshPrivacy.createMany({ data: [
      { userId: "public", meshVisibility: "public", showStats: true },
      { userId: "hiddenstats", meshVisibility: "public", showStats: false },
      { userId: "privateone", meshVisibility: "friends", showStats: true },
      { userId: "privatemutual", meshVisibility: "friends", showStats: true },
      { userId: "privatehard", meshVisibility: "private", showStats: true },
    ] });
    await prisma.dataVisibilityPolicy.createMany({ data: [
      { userId: "denied", entityType: "meshi_memory", visibility: "private", allowMeshiUse: false },
      { userId: "legacydenied", entityType: "meshi_ai", visibility: "private", allowMeshiUse: false },
    ] });
    await prisma.block.createMany({ data: [
      { blockerId: "owner", blockedId: "blockedout" },
      { blockerId: "blockedin", blockedId: "owner" },
    ] });
    for (const owner of ["owner", "other"]) {
      await prisma.community.create({ data: { id: `${owner}-community`, name: `${owner} private club`, slug: `${owner}-club`, isPublic: false, members: { create: { userId: owner } } } });
      await prisma.userInterest.create({ data: { userId: owner, tag: `${owner}-interest` } });
      await prisma.connectedAccount.create({ data: {
        id: `${owner}-platform`, userId: owner, platform: "youtube", platformUsername: `${owner}-channel`,
        accessToken: "test-access-credential", refreshToken: "test-refresh-credential",
      } });
      await prisma.post.create({ data: { authorId: owner, content: `${owner} private post`, visibility: "private" } });
    }
    await prisma.post.create({ data: { authorId: "owner", content: "Adult fixture", isNsfw: true } });
    await prisma.connectedAccount.create({ data: { id: "inactive-platform", userId: "owner", platform: "instagram", isActive: false } });

    const signedOut = await readMeshiMeshContext(null);
    check([signedOut.access, signedOut.entities, Object.values(signedOut.stats)], ["signed-out", [], [0, 0, 0, 0, 0]], "signed-out calls expose no Mesh context");
    const context = await readMeshiMeshContext(users.owner);
    check(context.access, "allowed", "an absent privacy denial permits current-account review");
    check(context.entities.filter((entity) => entity.type === "user").map((entity) => entity.id).sort(), ["hiddenstats", "privatemutual", "public"], "real queries enforce subject consent, both block directions, suspension, and private-profile authorization");
    check(context.entities.find((entity) => entity.id === "public")?.followerCount, 1, "explicitly shared follower stats remain available");
    check(Object.hasOwn(context.entities.find((entity) => entity.id === "hiddenstats")!, "followerCount"), false, "hidden follower stats are omitted, never replaced with a fabricated zero");
    check(context.entities.find((entity) => entity.id === "privatemutual")?.isMutual, true, "authorized friends retain mutual relationship context");
    check(context.entities.some((entity) => entity.id === "privatehard"), false, "admin moderation privilege never expands optional assistant context");
    check(context.stats, { followers: 2, following: 10, posts: 1, communities: 1, platforms: 1 }, "own account totals remain accurate and honor adult-content and active-connection rules");
    check(context.entities.some((entity) => entity.id === "owner-community"), true, "a private community is available to its actual member");
    check(JSON.stringify(context).includes("other-"), false, "another account's communities, interests, and platform identities stay isolated");
    check(/test-(?:access|refresh)-credential|private post/.test(JSON.stringify(context)), false, "context never includes OAuth credentials or post bodies");
    check(context.entities.some((entity) => entity.id === "inactive-platform"), false, "inactive connections do not appear");

    for (const entityType of ["meshi_memory", "meshi_ai"]) {
      const policy = await prisma.dataVisibilityPolicy.create({ data: { userId: "owner", entityType, visibility: "private", allowMeshiUse: false } });
      const denied = await readMeshiMeshContext(users.owner);
      check([denied.access, denied.entities, Object.values(denied.stats)], ["disabled", [], [0, 0, 0, 0, 0]], `${entityType} denial clears context instead of returning a previous successful review`);
      await prisma.dataVisibilityPolicy.delete({ where: { id: policy.id } });
    }
    await prisma.user.update({ where: { id: "public" }, data: { displayName: "Updated public identity" } });
    check((await readMeshiMeshContext(users.owner)).entities.find((entity) => entity.id === "public")?.label, "Updated public identity", "a later review reads current identity instead of a persistent cache");
    await prisma.dataVisibilityPolicy.create({ data: { userId: "public", entityType: "meshi_memory", visibility: "private", allowMeshiUse: false } });
    check((await readMeshiMeshContext(users.owner)).entities.some((entity) => entity.id === "public"), false, "subject consent withdrawal removes formerly available context on the next read");
    await prisma.follow.deleteMany({ where: { followerId: "owner", followingId: "hiddenstats" } });
    await prisma.connectedAccount.update({ where: { id: "owner-platform" }, data: { isActive: false } });
    const refreshed = await readMeshiMeshContext(users.owner);
    check(refreshed.entities.some((entity) => ["hiddenstats", "owner-platform"].includes(entity.id)), false, "unfollowed people and disconnected identities disappear rather than accumulating");
    const other = await readMeshiMeshContext(users.other);
    check(other.entities.map((entity) => entity.id).sort(), ["interest-other-interest", "other-community", "other-platform"], "switching accounts reads only the new account's current context");
    console.log(`Meshi context: ${assertions} assertions passed (isolated database and legacy-storage cleanup).`);
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
