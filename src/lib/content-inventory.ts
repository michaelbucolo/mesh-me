// EVERYTHING YOU HAVE EVER MADE, COUNTED — AND HONEST ABOUT WHAT IT MISSED.
//
// This is a lifetime inventory: posts, videos, comments, from mesh.me and from
// the connected platforms mesh.me is actually able to read. It is a satisfying
// number rather than an engaging one. Nobody has to come back tomorrow to see
// it move; it is a fact about your life, not a score in a game, and it
// generates no impressions for anyone.
//
// ── THE HARD PART IS NOT THE COUNTING ───────────────────────────────────────
//
// It is that the number is INCOMPLETE BY CONSTRUCTION, and a big confident
// figure invites everyone to forget that.
//
// PlatformPost and PlatformComment rows only ever exist for a platform whose
// official API lets mesh.me read your content. Six of the twelve platforms —
// Instagram, Facebook, Threads, Snapchat, LinkedIn, Pinterest — offer no such
// API, so they contribute exactly zero, forever, no matter how long they have
// been connected. Someone whose whole life is on Instagram would see a total
// that describes almost none of it.
//
// A count that says "everything you've posted" while silently omitting half
// the roster is a lie told with arithmetic. So this returns the coverage
// alongside the totals, and the surface is expected to show it: which of YOUR
// connected accounts fed this number, and which could not. That is why
// `readable` and `unreadable` are not optional extras on this type — a caller
// physically cannot render the totals without having been handed the caveat.
//
// It also puts the honest version of the pitch in front of the one person for
// whom it matters most: you cannot see your Instagram history here because
// Instagram will not hand it over to us — but it is obliged to hand it to YOU.

import { getDisplayNameForAnyPlatform, getPlatformCapability } from "@/lib/platform-capabilities";
import { isMeshPlatform } from "@/lib/platforms";
import { prisma } from "@/lib/prisma";

export type ContentInventory = {
  postsAndPhotos: number;
  videos: number;
  commentsAndReplies: number;
  /** Connected platforms whose API let us read your content into this total. */
  readable: { id: string; name: string }[];
  /** Connected platforms that contributed nothing, because they cannot. */
  unreadable: { id: string; name: string }[];
  /** The earliest post in evidence — "we can see", never "your first ever":
   *  coverage-honest phrasing is load-bearing on this surface. */
  firstSeen: { at: Date; platform: string | null } | null;
};

export async function getContentInventory(userId: string): Promise<ContentInventory> {
  const [
    postCount,
    platformPostCount,
    localVideoCount,
    platformVideoCount,
    commentCount,
    platformCommentCount,
    accounts,
    firstNative,
    firstPlatform,
  ] = await Promise.all([
    prisma.post.count({ where: { authorId: userId } }),
    prisma.platformPost.count({ where: { connectedAccount: { userId } } }),
    prisma.postMedia.count({ where: { type: "video", post: { authorId: userId } } }),
    prisma.platformPost.count({
      where: {
        connectedAccount: { userId },
        postType: { in: ["video", "reel", "short"] },
      },
    }),
    prisma.comment.count({ where: { authorId: userId } }),
    prisma.platformComment.count({ where: { connectedAccount: { userId }, isOwnComment: true } }),
    prisma.connectedAccount.findMany({
      where: { userId, isActive: true },
      select: { platform: true },
      distinct: ["platform"],
    }),
    // Two indexed MINs: the oldest credible evidence, whichever side holds it.
    prisma.post.findFirst({
      where: { authorId: userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.platformPost.findFirst({
      where: {
        connectedAccount: { userId },
        publishedAt: { not: null, gte: new Date("2005-01-01T00:00:00Z"), lte: new Date() },
      },
      orderBy: { publishedAt: "asc" },
      select: { publishedAt: true, connectedAccount: { select: { platform: true } } },
    }),
  ]);

  const readable: { id: string; name: string }[] = [];
  const unreadable: { id: string; name: string }[] = [];
  for (const { platform } of accounts) {
    // Off-allowlist rows are not named here. `platform-allowlist:check` fails
    // the build if any surface offers a platform outside the twelve, and this
    // surface naming one would be that failure.
    if (!isMeshPlatform(platform)) continue;
    // The capability table is the authority. A platform lands in `unreadable`
    // because its official API does not offer your content — never because a
    // sync happened to fail today, which is a different sentence entirely and
    // would be a wrong one to show.
    const capability = getPlatformCapability(platform);
    const entry = { id: platform, name: getDisplayNameForAnyPlatform(platform) };
    (capability?.importContent ? readable : unreadable).push(entry);
  }

  const candidates: Array<{ at: Date; platform: string | null }> = [];
  if (firstNative) candidates.push({ at: firstNative.createdAt, platform: null });
  if (firstPlatform?.publishedAt) {
    candidates.push({
      at: firstPlatform.publishedAt,
      platform: getDisplayNameForAnyPlatform(firstPlatform.connectedAccount.platform),
    });
  }
  candidates.sort((a, b) => a.at.getTime() - b.at.getTime());

  return {
    postsAndPhotos: postCount + platformPostCount,
    videos: localVideoCount + platformVideoCount,
    commentsAndReplies: commentCount + platformCommentCount,
    readable,
    unreadable,
    firstSeen: candidates[0] ?? null,
  };
}
