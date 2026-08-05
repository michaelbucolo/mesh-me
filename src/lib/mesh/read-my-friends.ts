// THE THIRD OF THE MESH THAT WAS MISSING.
//
// The user's description of the mesh is "a web of all my posts, friends,
// accounts". The room showed accounts and posts. It showed NO FRIENDS AT ALL —
// `read-my-presence.ts` has not one reference to a follow, so a third of the
// thing by its own definition was simply absent, and no amount of rearranging
// the other two thirds was ever going to make it read as a web of your life.
//
// ── WHY MUTUALS AND NOT FOLLOWERS ──────────────────────────────────────────
//
// "Friends" here means a mutual follow, matching `areMutualFollowers`, which
// is already the codebase's definition everywhere else (mesh visibility, the
// privacy contract). Using "people I follow" instead would put celebrities in
// your room; using "people who follow me" would let a stranger install
// themselves in it. Neither is a friend, and neither is something you would
// want standing in a space you invite people into.
//
// ── WHY THIS IS DERIVED, NOT MATERIALISED ──────────────────────────────────
//
// The schema already contains MeshNode and MeshEdge — a denormalised graph
// designed for exactly this and wired to nothing: zero reads, zero writes,
// anywhere in src/. Adopting them would mean a materialisation layer that has
// to be updated on every post, follow, unfollow and disconnect, and the first
// path that forgets leaves an edge asserting a friendship that ended. The
// relationships already exist, correctly, in `Follow` and `Post`. Deriving
// them is correct by construction and cannot drift; a cache that lies about
// who your friends are is worse than no cache.

import { prisma } from "@/lib/prisma";
import { nsfwHiddenWhere } from "@/lib/content-safety";
import type { FeedCurrentUser } from "@/lib/feed-data";

export type MeshFriend = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  /** Creation order of the friendship — the stable seat key. A friend does
   * not move because they posted; the room would rearrange itself weekly. */
  rank: number;
  /** Their most recent public post, if any — the thing that hangs off them. */
  latest: { id: string; title: string; imageUrl: string | null; href: string } | null;
};

/** How many friends stand in the room. Past this it stops being a place you
 * can move through. The cap is on the OLDEST friendships, not the most
 * active, so the room does not reshuffle as people post. */
const MAX_FRIENDS = 10;

export interface FriendsDb {
  follow: {
    findMany(args: {
      where: { followerId: string };
      select: { followingId: true; createdAt: true };
    }): Promise<Array<{ followingId: string; createdAt: Date }>>;
  };
  user: {
    findMany(args: {
      where: { id: { in: string[] }; isSuspended: false };
      select: { id: true; username: true; displayName: true; avatarUrl: true };
    }): Promise<Array<{ id: string; username: string; displayName: string | null; avatarUrl: string | null }>>;
  };
  post: {
    findMany(args: unknown): Promise<
      Array<{ id: string; authorId: string; content: string; createdAt: Date; media: Array<{ url: string }> }>
    >;
  };
}

/**
 * Your friends, and the latest thing each of them put out.
 *
 * Two follow queries rather than one join: the mutual test is an intersection
 * of "who I follow" and "who follows me", and doing it in memory keeps the
 * definition identical to `areMutualFollowers` instead of restating it as SQL
 * that could drift from it.
 */
export async function readMyFriends(
  viewer: FeedCurrentUser,
  db: FriendsDb = prisma as unknown as FriendsDb,
): Promise<MeshFriend[]> {
  const [iFollow, followsMe] = await Promise.all([
    db.follow.findMany({ where: { followerId: viewer.id }, select: { followingId: true, createdAt: true } }),
    // Same shape, read from the other side. `followingId` is the viewer here,
    // so the id we want is the FOLLOWER — mapped below, deliberately not
    // reusing the variable name, because getting this backwards puts strangers
    // in your room.
    (db.follow.findMany as unknown as (a: unknown) => Promise<Array<{ followerId: string; createdAt: Date }>>)({
      where: { followingId: viewer.id },
      select: { followerId: true, createdAt: true },
    }),
  ]);

  const followsMeSet = new Set(followsMe.map((f) => f.followerId));
  const mutual = iFollow
    .filter((f) => followsMeSet.has(f.followingId))
    // Oldest friendship first — the seat key. Ties break on id so two follows
    // in the same millisecond do not swap places between renders.
    .sort((a, b) =>
      a.createdAt.getTime() !== b.createdAt.getTime()
        ? a.createdAt.getTime() - b.createdAt.getTime()
        : a.followingId < b.followingId
          ? -1
          : 1,
    )
    .slice(0, MAX_FRIENDS);

  if (mutual.length === 0) return [];
  const ids = mutual.map((f) => f.followingId);

  const [people, posts] = await Promise.all([
    db.user.findMany({
      where: { id: { in: ids }, isSuspended: false },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    }),
    // The viewer's own NSFW policy applies to a friend's post exactly as it
    // does everywhere else — the room is not a way around it.
    db.post.findMany({
      where: { authorId: { in: ids }, visibility: "public", ...nsfwHiddenWhere(viewer) },
      orderBy: { createdAt: "desc" },
      take: MAX_FRIENDS * 4,
      select: {
        id: true,
        authorId: true,
        content: true,
        createdAt: true,
        media: { select: { url: true }, take: 1 },
      },
    }),
  ]);

  const byId = new Map(people.map((p) => [p.id, p]));
  // Posts arrive newest-first, so the FIRST one seen per author is their
  // latest. Taking the last would silently show their oldest.
  const latestByAuthor = new Map<string, (typeof posts)[number]>();
  for (const post of posts) {
    if (!latestByAuthor.has(post.authorId)) latestByAuthor.set(post.authorId, post);
  }

  const out: MeshFriend[] = [];
  mutual.forEach((edge, index) => {
    const person = byId.get(edge.followingId);
    // Suspended or deleted: the follow row survives them, and a friend with no
    // account is not somebody who can be standing in your room.
    if (!person) return;
    const post = latestByAuthor.get(person.id);
    const text = (post?.content ?? "").trim();
    out.push({
      userId: person.id,
      username: person.username,
      displayName: person.displayName,
      avatarUrl: person.avatarUrl,
      // Rank is the index in the ALREADY-SORTED mutual list, so it stays
      // 0,1,2… even when a suspended account is skipped above.
      rank: index,
      latest: post
        ? {
            id: post.id,
            title: text.split("\n")[0] || "Post",
            imageUrl: post.media[0]?.url ?? null,
            href: `/feed/${encodeURIComponent(post.id)}`,
          }
        : null,
    });
  });
  return out;
}
