// WHAT HAPPENED SINCE YOU LEFT — in one honest glance.
//
// No platform can answer this across platforms, and none of them wants to
// answer it at all: a feed with no memory of your last visit is how "90
// seconds" becomes an hour. The brief is the opposite bet — say what actually
// happened, link each fact to where acting on it goes, and offer a finite end
// ("Caught up"). All-zero renders nothing: a cheery empty card would be chrome
// between the person and their feed.
//
// ── THE CURSOR IS NOT lastSeenAt ────────────────────────────────────────────
//
// User.lastSeenAt is churned every ≤60s by the presence heartbeats, so it can
// never mark a visit boundary — measured against it, nothing would ever be
// "since you left". User.caughtUpAt is written by exactly one thing: the
// brief's own dismiss action (markCaughtUp in lib/actions.ts). Accounts that
// never pressed it get a 7-day window, because "everything ever" is not a
// brief.
//
// ── ONE DEFINITION OF "OWED" ────────────────────────────────────────────────
//
// The needs-you number is readInboxSignals' — the same rows and the same
// wants-you judgement the inbox and the nav badge ride. This module contains
// no second derivation, and the return-slice gate holds that.

import { prisma } from "@/lib/prisma";
import { readInboxSignals } from "@/lib/inbox/read-inbox";
import { getViewerSocialGraph } from "@/lib/feed-data";

const FALLBACK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** The brief's window start: the last deliberate "Caught up", floored at 7
 * days so a long absence still yields a readable brief. Shared with the feed's
 * "You're caught up" divider so the strip and the divider cannot disagree. */
function returnBriefSince(caughtUpAt: Date | null, nowMs: number): Date {
  return new Date(Math.max(caughtUpAt?.getTime() ?? 0, nowMs - FALLBACK_WINDOW_MS));
}

/** The cursor with the clock read inside — for server components, whose render
 * bodies the purity rule (correctly) bars from calling Date.now() directly. */
export function returnBriefCursor(caughtUpAt: Date | null): Date {
  return returnBriefSince(caughtUpAt, Date.now());
}

export type ReturnBriefData = {
  /** Obligations that AROSE since the cursor. The brief is a diff — the inbox
   * and the nav/PWA badge remain the timeless ledger of everything owed, so
   * nothing is hidden; the brief just doesn't re-announce the same standing
   * debt every morning, which is how "Caught up" can actually mean something. */
  needsYou: number;
  newFromFollowed: number;
  newFollowers: number;
  /** ScheduledPost rows the Studio fired while you were away. No platform can
   * show you this — mesh.me posted them itself. */
  publishedWhileAway: number;
};

export async function readReturnBrief(user: {
  id: string;
  caughtUpAt: Date | null;
}): Promise<ReturnBriefData | null> {
  const since = returnBriefSince(user.caughtUpAt, Date.now());

  const [signals, graph] = await Promise.all([
    readInboxSignals(user.id),
    getViewerSocialGraph(user.id),
  ]);

  const [newFromFollowed, newFollowers, publishedWhileAway] = await Promise.all([
    graph.followingIds.length === 0
      ? Promise.resolve(0)
      : prisma.post.count({
          where: {
            createdAt: { gt: since },
            // Public posts from anyone followed; friends-only posts count only
            // from mutuals — the same audiences the following feed shows.
            OR: [
              { authorId: { in: graph.followingIds }, visibility: "public" },
              ...(graph.friendIds.length > 0
                ? [{ authorId: { in: graph.friendIds }, visibility: "friends" }]
                : []),
            ],
          },
        }),
    prisma.follow.count({
      where: { followingId: user.id, createdAt: { gt: since } },
    }),
    prisma.scheduledPost.count({
      where: { userId: user.id, completedAt: { gt: since } },
    }),
  ]);

  // The diff, not the ledger: only obligations newer than the cursor. The
  // filter is over the SHARED judgement's items — never a re-derivation.
  const needsYou = signals.owedItems.filter((item) => item.atMs > since.getTime()).length;

  if (needsYou + newFromFollowed + newFollowers + publishedWhileAway === 0) {
    return null;
  }

  return { needsYou, newFromFollowed, newFollowers, publishedWhileAway };
}
