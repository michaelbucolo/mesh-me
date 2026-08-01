// Golden layout-determinism gate for the mesh constellation.
//
// The invariant: two clients holding the SAME mesh — even when the API hands
// them its arrays in different orders (which happens between viewers and
// reloads) — must compute IDENTICAL node positions, or two people looking at
// one mesh see subtly different worlds and spatial memory breaks. Every sort
// upstream carries an id tiebreak and `resolveOverlaps` iterates an id-sorted
// list precisely so this holds; this script asserts it end-to-end by parsing
// and laying out two shuffled copies of one payload and diffing positions.
//
// Runs standalone (no DOM, no DB): `npm run mesh:layout-check`.

import assert from "node:assert/strict";
import { MeshPayloadError, parseMeshApiResponse } from "../src/components/mesh/core/domain";
import { buildSceneModel } from "../src/components/mesh/scene/scene-model";
import { layoutScene } from "../src/components/mesh/sim/layout";

// Deterministic PRNG (mulberry32) so a failure reproduces exactly.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// A dense fixture: enough same-timestamp content that the relaxation pass has
// real overlaps to settle (the order-sensitive part the fix pins down), plus
// duplicate createdAt values to exercise every id tiebreak before the caps.
const NOW = Date.parse("2026-07-01T12:00:00Z");
const iso = (minutesAgo: number) => new Date(NOW - minutesAgo * 60000).toISOString();

function buildFixture() {
  const people = Array.from({ length: 14 }, (_, i) => ({
    id: `user-${String(i).padStart(2, "0")}`,
    username: `person${i}`,
    displayName: `Person ${i}`,
    avatarUrl: null,
    // Duplicate interaction counts + mutual flags force the id tiebreak.
    isMutual: i % 2 === 0,
    interactionCount: i % 3,
    joinedAt: iso(60 * 24 * (i % 4)),
    followerCount: 10 * i,
    postCount: i,
    status: "offline",
  }));
  const friendMeshes = people.slice(0, 6).map((p, i) => ({
    user: { id: p.id, username: p.username, displayName: p.displayName, avatarUrl: null },
    // MORE posts than the model keeps (slice cap 3), with shared timestamps:
    // if the model ever slices before sorting again, shuffled payloads keep a
    // DIFFERENT set and this test fails — the cap must be binding to bite.
    posts: Array.from({ length: 5 }, (_, k) => ({
      id: `fpost-${i}-${k}`,
      content: `Friend post ${i}.${k}`,
      // Same createdAt across friends: layout order must come from ids.
      createdAt: iso(30 * Math.floor(k / 2)),
      media: [],
      likeCount: k,
      commentCount: 0,
    })),
    connectedAccounts: [],
  }));
  const posts = Array.from({ length: 12 }, (_, i) => ({
    id: `post-${String(i).padStart(2, "0")}`,
    content: `Own post ${i}`,
    // Pairs share a timestamp so the pre-cap sort exercises its tiebreak.
    createdAt: iso(45 * Math.floor(i / 2)),
    media: [],
    likeCount: i,
    commentCount: i % 3,
  }));
  const connectedAccounts = Array.from({ length: 3 }, (_, i) => ({
    id: `acct-${i}`,
    platform: ["youtube", "instagram", "github"][i],
    platformUsername: `handle${i}`,
    createdAt: iso(60 * 24 * 30),
    syncStatus: "idle",
    counts: { platformPosts: 8, platformFollowers: 120 },
    // 7 posts against a keep-cap of 4 (MAX_PLATFORM_POSTS), timestamp pairs
    // shared — makes the sort-before-slice invariant binding, same as the
    // friend posts above.
    topPosts: Array.from({ length: 7 }, (_, k) => ({
      id: `pp-${i}-${k}`,
      title: `Platform post ${i}.${k}`,
      content: null,
      url: `https://example.com/${i}/${k}`,
      publishedAt: iso(90 * Math.floor(k / 2)),
      likeCount: 5 * k,
      commentCount: k,
      media: [],
    })),
  }));
  return {
    user: { id: "self-user", username: "me", displayName: "Me", avatarUrl: null, bio: null, isVerified: false },
    following: people.slice(0, 10),
    followers: people.slice(6),
    communities: [],
    interests: [],
    posts,
    connectedAccounts,
    friendMeshes,
    alterEgos: [],
    meshiPreference: {
      colorTheme: "blue",
      hatStyle: "none",
      faceStyle: "happy",
      hairStyle: "none",
      accessoryStyle: "none",
      eyeStyle: "regular",
      badgeStyle: "none",
    },
    stats: {
      followingCount: 10,
      followerCount: 8,
      mutualCount: 7,
      communityCount: 0,
      postCount: posts.length,
      interestCount: 0,
      connectedPlatformCount: connectedAccounts.length,
      alterEgoCount: 0,
    },
  };
}

// Shuffle EVERY array the API could reorder, differently per copy.
function shuffledCopy(seed: number) {
  const random = rng(seed);
  const fixture = buildFixture();
  return {
    ...fixture,
    following: shuffled(fixture.following, random),
    followers: shuffled(fixture.followers, random),
    posts: shuffled(fixture.posts, random),
    connectedAccounts: shuffled(
      fixture.connectedAccounts.map((a) => ({ ...a, topPosts: shuffled(a.topPosts, random) })),
      random,
    ),
    friendMeshes: shuffled(
      fixture.friendMeshes.map((fm) => ({ ...fm, posts: shuffled(fm.posts, random) })),
      random,
    ),
  };
}

function layoutPositions(seed: number): Map<string, { x: number; y: number; angle: number; depth: number }> {
  // Round-trip the boundary validator too — the golden payload must parse.
  const payload = parseMeshApiResponse(shuffledCopy(seed));
  const model = buildSceneModel(payload);
  layoutScene(model);
  const out = new Map<string, { x: number; y: number; angle: number; depth: number }>();
  model.nodes.forEach((n) => out.set(n.id, { x: n.x, y: n.y, angle: n.angle, depth: n.depth }));
  return out;
}

// The boundary validator must fail LOUDLY on a structurally broken payload,
// naming the offending path — never let it become NaN positions downstream.
assert.throws(
  () => parseMeshApiResponse({ ...buildFixture(), posts: "not-an-array" }),
  MeshPayloadError,
  "a non-array branch must be rejected at the boundary",
);
assert.throws(
  () => parseMeshApiResponse({ user: { id: 42 } }),
  MeshPayloadError,
  "a payload without a real user identity must be rejected",
);

const a = layoutPositions(0xa11ce);
const b = layoutPositions(0xb0b);

assert.ok(a.size > 40, `fixture too small to exercise the relaxation pass (${a.size} nodes)`);
assert.deepEqual([...a.keys()].sort(), [...b.keys()].sort(), "shuffled payloads must build the same node set");
for (const [id, pa] of a) {
  const pb = b.get(id)!;
  assert.deepEqual(pb, pa, `node ${id} settled differently across shuffled payloads`);
}

console.log(`mesh layout determinism OK — ${a.size} nodes, positions identical across shuffled payloads`);
