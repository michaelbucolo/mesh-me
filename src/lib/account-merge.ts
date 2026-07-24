import "server-only";
import { prisma } from "./prisma";

/**
 * Two-party account merge (One Account).
 *
 * A signed-in user (the PRIMARY) requests to merge another mesh.me account
 * (the SECONDARY) into theirs. The secondary side must be proven before
 * anything moves: either the requester enters the secondary account's login
 * credentials (verified server-side), or the secondary account's owner
 * approves the request from their own session. The requester then re-enters
 * their OWN password to finalize, and the merge executes in one transaction.
 *
 * Merge policy (conservative — nothing is ever hard-deleted):
 * - Moves to the primary: posts, follows/followers (deduped), connected
 *   platform accounts (deduped by platform+id/handle), alter egos, secondary
 *   emails/phones (as non-primary), federated sign-in identities.
 * - Fills gaps only: bio/avatar/banner/location/website copy over ONLY where
 *   the primary has none. Username, display name, email, and all other
 *   conflicts keep the primary's version.
 * - Stays on the tombstoned account: comments, reactions, messages, saved
 *   posts, community memberships, blocks/mutes, billing.
 * - The secondary account is deactivated (isSuspended) with a tombstone
 *   pointer (mergedIntoUserId) to the surviving account, and every session it
 *   holds is revoked.
 */

export const MERGE_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Statuses a request can hold while still actionable. */
const OPEN_STATUSES = ["pending", "verified"];

export type OutgoingMergeRequestView = {
  id: string;
  /** The identifier exactly as the requester entered it (never the resolved email). */
  target: string;
  status: "pending" | "verified";
  createdAt: string;
  expiresAt: string;
};

export type IncomingMergeRequestView = {
  id: string;
  status: "pending" | "verified";
  requester: { username: string; displayName: string; avatarUrl: string | null };
  createdAt: string;
  expiresAt: string;
};

export type AccountMergeCenter = {
  outgoing: OutgoingMergeRequestView[];
  incoming: IncomingMergeRequestView[];
};

export type AccountMergeSummary = {
  mergedUsername: string;
  postsMoved: number;
  followersAdded: number;
  followingAdded: number;
  accountsMoved: number;
  accountsSkipped: number;
  emailsLinked: number;
  personaCreated: boolean;
};

function effectiveMergeExpiry(request: { expiresAt: Date | null; createdAt: Date }): Date {
  return request.expiresAt ?? new Date(request.createdAt.getTime() + MERGE_REQUEST_TTL_MS);
}

export function isMergeRequestExpired(request: { expiresAt: Date | null; createdAt: Date }): boolean {
  return effectiveMergeExpiry(request).getTime() <= Date.now();
}

/** Lazily flip open-but-stale requests to "expired" (legacy rows have null expiresAt). */
async function expireStaleMergeRequests(): Promise<void> {
  const now = new Date();
  await prisma.accountMergeRequest.updateMany({
    where: {
      status: { in: OPEN_STATUSES },
      OR: [
        { expiresAt: { lt: now } },
        { expiresAt: null, createdAt: { lt: new Date(now.getTime() - MERGE_REQUEST_TTL_MS) } },
      ],
    },
    data: { status: "expired" },
  });
}

function asOpenStatus(status: string): "pending" | "verified" {
  return status === "verified" ? "verified" : "pending";
}

/** Everything the One Account surface needs: my open requests + requests targeting me. */
export async function getAccountMergeCenter(user: { id: string; email: string }): Promise<AccountMergeCenter> {
  await expireStaleMergeRequests();

  const [outgoingRows, incomingRows] = await Promise.all([
    prisma.accountMergeRequest.findMany({
      where: { primaryUserId: user.id, status: { in: OPEN_STATUSES } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.accountMergeRequest.findMany({
      where: {
        status: { in: OPEN_STATUSES },
        OR: [
          { secondaryUserId: user.id },
          // Legacy rows created before the request was bound to a user id.
          { secondaryUserId: null, secondaryEmail: user.email.toLowerCase() },
        ],
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const requesterIds = Array.from(new Set(incomingRows.map((row) => row.primaryUserId)));
  const requesters = requesterIds.length
    ? await prisma.user.findMany({
        where: { id: { in: requesterIds }, isSuspended: false },
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      })
    : [];
  const requesterById = new Map(requesters.map((row) => [row.id, row]));

  return {
    outgoing: outgoingRows.map((row) => ({
      id: row.id,
      target: row.secondaryEmail,
      status: asOpenStatus(row.status),
      createdAt: row.createdAt.toISOString(),
      expiresAt: effectiveMergeExpiry(row).toISOString(),
    })),
    incoming: incomingRows.flatMap((row) => {
      const requester = requesterById.get(row.primaryUserId);
      if (!requester) return []; // requester gone or suspended — request is moot
      return [{
        id: row.id,
        status: asOpenStatus(row.status),
        requester: {
          username: requester.username,
          displayName: requester.displayName,
          avatarUrl: requester.avatarUrl,
        },
        createdAt: row.createdAt.toISOString(),
        expiresAt: effectiveMergeExpiry(row).toISOString(),
      }];
    }),
  };
}

export type PerformMergeResult =
  | { ok: true; summary: AccountMergeSummary }
  | { ok: false; reason: "already_processed" };

/**
 * Execute the merge in a single transaction. The caller has already verified:
 * requester session + fresh password, request status "verified" and unexpired,
 * both accounts existing, distinct, non-suspended, secondary not an admin.
 *
 * Idempotent: the first statement atomically claims the request
 * (verified → completed); a concurrent or repeated call claims nothing and
 * returns "already_processed" without touching data.
 */
export async function performAccountMerge(
  requestId: string,
  primaryUserId: string,
  secondaryUserId: string,
): Promise<PerformMergeResult> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.accountMergeRequest.updateMany({
      // The binding to BOTH accounts is part of the claim so a concurrent
      // re-approval can never swap parties between the caller's checks and
      // this execution.
      where: { id: requestId, status: "verified", primaryUserId, secondaryUserId },
      data: { status: "completed", completedAt: new Date() },
    });
    if (claimed.count === 0) {
      return { ok: false as const, reason: "already_processed" as const };
    }

    const [primary, secondary] = await Promise.all([
      tx.user.findUniqueOrThrow({
        where: { id: primaryUserId },
        select: { id: true, username: true, bio: true, avatarUrl: true, bannerUrl: true, location: true, website: true },
      }),
      tx.user.findUniqueOrThrow({
        where: { id: secondaryUserId },
        select: {
          id: true, username: true, displayName: true, email: true, emailVerified: true,
          bio: true, avatarUrl: true, bannerUrl: true, location: true, website: true,
        },
      }),
    ]);

    // The folded identity lives on as an alter ego of the primary account
    // (skipped only if that persona name is somehow already taken).
    let personaId: string | null = null;
    const personaTaken = await tx.alterEgo.findUnique({ where: { username: secondary.username }, select: { id: true } });
    if (!personaTaken) {
      const persona = await tx.alterEgo.create({
        data: {
          userId: primary.id,
          username: secondary.username,
          displayName: secondary.displayName,
          bio: secondary.bio,
          avatarUrl: secondary.avatarUrl,
        },
        select: { id: true },
      });
      personaId = persona.id;
    }

    // The secondary account's own personas come along too.
    await tx.alterEgo.updateMany({
      where: { userId: secondary.id },
      data: { userId: primary.id },
    });

    // Connected platform accounts — dedupe against the primary's connections.
    // Duplicates stay on the tombstoned account (preserved, never doubled).
    const [primaryAccounts, secondaryAccounts] = await Promise.all([
      tx.connectedAccount.findMany({
        where: { userId: primary.id },
        select: { platform: true, platformId: true, platformUsername: true },
      }),
      tx.connectedAccount.findMany({
        where: { userId: secondary.id },
        select: { id: true, platform: true, platformId: true, platformUsername: true, alterEgoId: true },
      }),
    ]);
    const duplicateOfPrimary = (candidate: { platform: string; platformId: string | null; platformUsername: string | null }) =>
      primaryAccounts.some((existing) => {
        if (existing.platform !== candidate.platform) return false;
        if (existing.platformId && candidate.platformId) return existing.platformId === candidate.platformId;
        if (existing.platformUsername && candidate.platformUsername) {
          return existing.platformUsername.toLowerCase() === candidate.platformUsername.toLowerCase();
        }
        return false;
      });
    const accountsToMove = secondaryAccounts.filter((account) => !duplicateOfPrimary(account));
    const moveIds = accountsToMove.map((account) => account.id);
    if (moveIds.length > 0) {
      await tx.connectedAccount.updateMany({
        where: { id: { in: moveIds } },
        data: { userId: primary.id },
      });
      if (personaId) {
        // Group moved accounts under the folded persona unless they already
        // belong to one of the secondary's own personas (which moved too).
        await tx.connectedAccount.updateMany({
          where: { id: { in: moveIds }, alterEgoId: null },
          data: { alterEgoId: personaId },
        });
      }
    }

    // Posts fold in wholesale.
    const postsMoved = await tx.post.updateMany({
      where: { authorId: secondary.id },
      data: { authorId: primary.id },
    });

    // Follows — dedupe so unique(follower, following) can never collide and no
    // self-follows appear.
    await tx.follow.deleteMany({ where: { followerId: primary.id, followingId: secondary.id } });
    await tx.follow.deleteMany({ where: { followerId: secondary.id, followingId: primary.id } });

    const primaryFollowerIds = (
      await tx.follow.findMany({ where: { followingId: primary.id }, select: { followerId: true } })
    ).map((row) => row.followerId);
    await tx.follow.deleteMany({
      where: { followingId: secondary.id, followerId: { in: primaryFollowerIds } },
    });
    const followersMoved = await tx.follow.updateMany({
      where: { followingId: secondary.id },
      data: { followingId: primary.id },
    });

    const primaryFollowingIds = (
      await tx.follow.findMany({ where: { followerId: primary.id }, select: { followingId: true } })
    ).map((row) => row.followingId);
    await tx.follow.deleteMany({
      where: { followerId: secondary.id, followingId: { in: primaryFollowingIds } },
    });
    const followingMoved = await tx.follow.updateMany({
      where: { followerId: secondary.id },
      data: { followerId: primary.id },
    });

    // Profile data fills gaps only — the primary wins every conflict.
    const profileGaps: Partial<Record<"bio" | "avatarUrl" | "bannerUrl" | "location" | "website", string>> = {};
    if (!primary.bio && secondary.bio) profileGaps.bio = secondary.bio;
    if (!primary.avatarUrl && secondary.avatarUrl) profileGaps.avatarUrl = secondary.avatarUrl;
    if (!primary.bannerUrl && secondary.bannerUrl) profileGaps.bannerUrl = secondary.bannerUrl;
    if (!primary.location && secondary.location) profileGaps.location = secondary.location;
    if (!primary.website && secondary.website) profileGaps.website = secondary.website;
    if (Object.keys(profileGaps).length > 0) {
      await tx.user.update({ where: { id: primary.id }, data: profileGaps });
    }

    // Contact methods and federated identities follow the person (never as
    // primary — the primary account's own stay first).
    const emailsMoved = await tx.userEmail.updateMany({
      where: { userId: secondary.id },
      data: { userId: primary.id, isPrimary: false },
    });
    let aliasLinked = 0;
    const aliasRow = await tx.userEmail.findUnique({ where: { email: secondary.email }, select: { id: true } });
    if (!aliasRow) {
      await tx.userEmail.create({
        data: { userId: primary.id, email: secondary.email, isPrimary: false, isVerified: secondary.emailVerified },
      });
      aliasLinked = 1;
    }
    await tx.userPhone.updateMany({
      where: { userId: secondary.id },
      data: { userId: primary.id, isPrimary: false },
    });
    await tx.authIdentity.updateMany({
      where: { userId: secondary.id },
      data: { userId: primary.id },
    });

    // Revoke every session the folded account holds, then tombstone it:
    // deactivated (never deleted) with a pointer to the surviving account.
    await tx.session.deleteMany({ where: { userId: secondary.id } });
    await tx.user.update({
      where: { id: secondary.id },
      data: {
        isSuspended: true,
        mergedIntoUserId: primary.id,
        isPublic: false,
        showInDiscovery: false,
        status: "offline",
      },
    });

    // Any other open merge requests involving the folded account are moot now.
    await tx.accountMergeRequest.updateMany({
      where: {
        status: { in: OPEN_STATUSES },
        OR: [{ primaryUserId: secondary.id }, { secondaryUserId: secondary.id }],
      },
      data: { status: "cancelled" },
    });

    const summary: AccountMergeSummary = {
      mergedUsername: secondary.username,
      postsMoved: postsMoved.count,
      followersAdded: followersMoved.count,
      followingAdded: followingMoved.count,
      accountsMoved: moveIds.length,
      accountsSkipped: secondaryAccounts.length - moveIds.length,
      emailsLinked: emailsMoved.count + aliasLinked,
      personaCreated: personaId !== null,
    };

    // Audit trail (surfaced in the admin activity log).
    await tx.adminLog.create({
      data: {
        action: "account_merge",
        details:
          `@${secondary.username} merged into @${primary.username} — ` +
          `posts:${summary.postsMoved} followers:+${summary.followersAdded} ` +
          `following:+${summary.followingAdded} accounts:${summary.accountsMoved}` +
          (summary.accountsSkipped > 0 ? ` (skipped ${summary.accountsSkipped} duplicate)` : ""),
        adminId: primary.id,
      },
    });

    return { ok: true as const, summary };
  }, { timeout: 30000, maxWait: 10000 });
}
