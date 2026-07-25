"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security";
import {
  checkDurableLockout,
  clearDurableFailedLogins,
  durableRateLimit,
  recordDurableFailedLogin,
} from "@/lib/durable-rate-limit";
import { clearMeshCache } from "@/lib/mesh-cache";
import {
  MERGE_REQUEST_TTL_MS,
  isMergeRequestExpired,
  performAccountMerge,
  type AccountMergeSummary,
  type OutgoingMergeRequestView,
} from "@/lib/account-merge";

// Every identifier-shaped failure returns this exact message so the flow can
// never be used to probe whether an email/username is registered.
const GENERIC_REQUEST_MESSAGE =
  "Merge request recorded. If that account exists, its owner can approve it from their own One Account page — or it simply expires.";
const GENERIC_CREDENTIAL_ERROR = "Couldn't verify those credentials.";

// Constant bcrypt hash of random bytes: when the target identifier doesn't
// resolve we still burn a compare against this so response timing doesn't
// reveal whether the account exists.
const TIMING_EQUALIZER_HASH = "$2b$12$JILRX7bEywWZST6fQ8KKE.X2qB.Xcxi0WubMvIoQVEr9HRhwE.EjK";

function revalidateMergeSurfaces() {
  revalidatePath("/connected-accounts");
  revalidatePath("/connected-accounts");
  revalidatePath("/notifications");
}

function serializeOutgoing(row: {
  id: string;
  secondaryEmail: string;
  status: string;
  createdAt: Date;
  expiresAt: Date | null;
}): OutgoingMergeRequestView {
  return {
    id: row.id,
    target: row.secondaryEmail,
    status: row.status === "verified" ? "verified" : "pending",
    createdAt: row.createdAt.toISOString(),
    expiresAt: (row.expiresAt ?? new Date(row.createdAt.getTime() + MERGE_REQUEST_TTL_MS)).toISOString(),
  };
}

/** Resolve an identifier (email or username) the way sign-in does — including
 * verified secondary emails — without ever reporting the outcome to the caller. */
async function resolveMergeTarget(lowered: string) {
  let target = await prisma.user.findFirst({
    where: { OR: [{ email: lowered }, { username: lowered }] },
  });
  if (!target && lowered.includes("@")) {
    const emailRecord = await prisma.userEmail.findUnique({
      where: { email: lowered },
      include: { user: true },
    });
    if (emailRecord?.isVerified) target = emailRecord.user;
  }
  return target;
}

/**
 * Step 1 — the signed-in user asks to merge another account into this one.
 * Without the target's password the request waits for the other account's
 * owner to approve it from their own session. With the target's password
 * (verified against its hash, hard rate-limited, lockout-integrated) the
 * secondary side is proven immediately. Either way, nothing moves until the
 * requester re-enters their OWN password in the finalize step.
 */
export async function requestAccountMerge(input: { identifier: string; targetPassword?: string }) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const identifier = String(input?.identifier ?? "").trim().slice(0, 200);
  if (!identifier) return { error: "Enter the email or username of the account to merge." };
  const lowered = identifier.toLowerCase();
  const targetPassword = typeof input?.targetPassword === "string" ? input.targetPassword : "";

  // Self-merge guard on the caller's own identifiers (leaks nothing — callers
  // know their own email, username, and linked emails).
  if (lowered === user.email.toLowerCase() || lowered === user.username.toLowerCase()) {
    return { error: "You can't merge an account with itself." };
  }
  const ownAlias = await prisma.userEmail.findUnique({ where: { email: lowered }, select: { userId: true } });
  if (ownAlias?.userId === user.id) {
    return { error: "You can't merge an account with itself." };
  }

  // Hard rate limits: in-memory fast path + durable cross-instance counter.
  const memoryLimit = rateLimit(`account-merge-init:${user.id}`, 5, 60 * 60 * 1000);
  const durableLimit = await durableRateLimit(`account-merge-init:${user.id}`, 5, 60 * 60 * 1000);
  if (!memoryLimit.allowed || !durableLimit.allowed) {
    return { error: "Too many merge requests. Please try again later." };
  }

  let target = await resolveMergeTarget(lowered);
  if (target && target.id === user.id) {
    return { error: "You can't merge an account with itself." };
  }
  // Suspended or already-merged accounts can't be merged — but saying so would
  // reveal account state, so they behave exactly like an unknown identifier.
  if (target && (target.isSuspended || target.mergedIntoUserId)) target = null;

  const expiresAt = new Date(Date.now() + MERGE_REQUEST_TTL_MS);

  if (targetPassword) {
    // Credential path: prove control of the secondary account right now.
    // Rate-limited per requester+target and wired into the same durable
    // lockout as sign-in, so this can never be a cheaper brute-force oracle.
    const credentialLimit = await durableRateLimit(`merge-cred:${user.id}:${lowered}`, 5, 60 * 60 * 1000);
    if (!credentialLimit.allowed) {
      return { error: "Too many verification attempts. Please try again later." };
    }

    let verified = false;
    if (target) {
      const lockout = await checkDurableLockout(target.id);
      if (!lockout.locked) {
        verified = await verifyPassword(targetPassword, target.passwordHash);
      }
    } else {
      // Burn an equivalent compare so timing can't distinguish "no such
      // account" from "wrong password".
      await verifyPassword(targetPassword, TIMING_EQUALIZER_HASH);
    }

    if (!verified || !target) {
      await recordDurableFailedLogin(target ? target.id : lowered);
      return { error: GENERIC_CREDENTIAL_ERROR };
    }
    await clearDurableFailedLogins(target.id);

    if (target.isAdmin) {
      // Control of the account is proven at this point, so a specific error is safe.
      return { error: "Admin accounts can't be merged." };
    }

    // Reuse an open request for this pair if one exists; otherwise create it —
    // already proven, so it lands "verified" and only awaits finalization.
    const existing = await prisma.accountMergeRequest.findFirst({
      where: {
        primaryUserId: user.id,
        status: { in: ["pending", "verified"] },
        OR: [{ secondaryUserId: target.id }, { secondaryEmail: lowered }],
      },
    });
    const request = existing
      ? await prisma.accountMergeRequest.update({
          where: { id: existing.id },
          // secondaryEmail is refreshed to the identifier just entered so the
          // echoed `target` honors the OutgoingMergeRequestView contract
          // (safe here: control of the account was proven above).
          data: { status: "verified", approvedAt: new Date(), expiresAt, secondaryUserId: target.id, secondaryEmail: lowered },
        })
      : await prisma.accountMergeRequest.create({
          data: {
            primaryUserId: user.id,
            secondaryEmail: lowered,
            secondaryUserId: target.id,
            status: "verified",
            approvedAt: new Date(),
            expiresAt,
          },
        });

    // Security notice to the account whose password was used — its owner can
    // still decline from One Account before anything is finalized.
    await prisma.notification.create({
      data: {
        type: "security_alert",
        recipientId: target.id,
        actorId: user.id,
        message: `Your password was used to approve merging @${target.username} into @${user.username}. If this wasn't you, decline the request in One Account and change your password now.`,
      },
    });

    revalidateMergeSurfaces();
    return {
      success: true as const,
      request: serializeOutgoing(request),
      message: "Ownership verified. Re-enter your own password to finalize the merge.",
    };
  }

  // Two-party path: record the request and wait for the other side. A row is
  // created even when the identifier doesn't resolve, so the outcome (and the
  // caller's own request list) looks identical either way.
  //
  // Reuse is keyed on the literal identifier string ONLY — never on the
  // resolved account. Matching on secondaryUserId here would let a requester
  // detect that two different identifiers resolve to the same account (the
  // reused row echoes the earlier identifier as `target`), turning this flow
  // into a confirmation oracle for hidden emails. Keying on the exact string
  // keeps the response a pure function of what the caller typed; a resolved
  // target entered under a second identifier just yields a second row (bounded
  // by the 5/hr init rate limit, and moot rows are cancelled on merge).
  const existing = await prisma.accountMergeRequest.findFirst({
    where: {
      primaryUserId: user.id,
      status: { in: ["pending", "verified"] },
      secondaryEmail: lowered,
    },
  });
  const request =
    existing ??
    (await prisma.accountMergeRequest.create({
      data: {
        primaryUserId: user.id,
        secondaryEmail: lowered,
        secondaryUserId: target?.id ?? null,
        status: "pending",
        expiresAt,
      },
    }));

  if (target && !existing) {
    await prisma.notification.create({
      data: {
        type: "account_merge_request",
        recipientId: target.id,
        actorId: user.id,
        message: `@${user.username} asked to merge the account @${target.username} into theirs. Review it in One Account — approving lets them permanently absorb this account.`,
      },
    });
  }

  revalidateMergeSurfaces();
  return { success: true as const, request: serializeOutgoing(request), message: GENERIC_REQUEST_MESSAGE };
}

/** Load a request that targets the CURRENT user (the secondary side). */
async function findIncomingRequestFor(userId: string, email: string, requestId: string) {
  const request = await prisma.accountMergeRequest.findUnique({ where: { id: requestId } });
  if (!request) return null;
  const isMine =
    request.secondaryUserId === userId ||
    (request.secondaryUserId === null && request.secondaryEmail === email.toLowerCase());
  return isMine ? request : null;
}

/** Step 2 (two-party path) — the other account's owner approves from their own session. */
export async function approveIncomingMergeRequest(requestId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (typeof requestId !== "string" || !requestId) return { error: "Invalid request." };
  if (user.isAdmin) return { error: "Admin accounts can't be merged into another account." };

  const request = await findIncomingRequestFor(user.id, user.email, requestId);
  if (!request || request.status !== "pending") {
    return { error: "This merge request is no longer open." };
  }
  if (isMergeRequestExpired(request)) {
    await prisma.accountMergeRequest.update({ where: { id: request.id }, data: { status: "expired" } });
    return { error: "This merge request has expired." };
  }

  const requester = await prisma.user.findUnique({
    where: { id: request.primaryUserId },
    select: { id: true, username: true, isSuspended: true },
  });
  if (!requester || requester.isSuspended) {
    return { error: "This merge request is no longer valid." };
  }

  await prisma.accountMergeRequest.update({
    where: { id: request.id },
    data: { status: "verified", approvedAt: new Date(), secondaryUserId: user.id },
  });
  await prisma.notification.create({
    data: {
      type: "account_merge_approved",
      recipientId: requester.id,
      actorId: user.id,
      message: `@${user.username} approved your merge request. Finalize it from One Account to fold that account into yours.`,
    },
  });

  revalidateMergeSurfaces();
  return { success: true as const };
}

/** The secondary side declines — or revokes an earlier approval before finalization. */
export async function declineIncomingMergeRequest(requestId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (typeof requestId !== "string" || !requestId) return { error: "Invalid request." };

  const request = await findIncomingRequestFor(user.id, user.email, requestId);
  if (!request || (request.status !== "pending" && request.status !== "verified")) {
    return { error: "This merge request is no longer open." };
  }

  await prisma.accountMergeRequest.update({
    where: { id: request.id },
    data: { status: "declined", secondaryUserId: request.secondaryUserId ?? user.id },
  });
  await prisma.notification.create({
    data: {
      type: "account_merge_declined",
      recipientId: request.primaryUserId,
      actorId: user.id,
      message: `Your request to merge "${request.secondaryEmail}" was declined.`,
    },
  });

  revalidateMergeSurfaces();
  return { success: true as const };
}

/** The requester withdraws their own request at any point before completion. */
export async function cancelAccountMergeRequest(requestId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (typeof requestId !== "string" || !requestId) return { error: "Invalid request." };

  const cancelled = await prisma.accountMergeRequest.updateMany({
    where: { id: requestId, primaryUserId: user.id, status: { in: ["pending", "verified"] } },
    data: { status: "cancelled" },
  });
  if (cancelled.count === 0) return { error: "This merge request is no longer open." };

  revalidateMergeSurfaces();
  return { success: true as const };
}

/**
 * Step 3 — the requester re-enters their OWN password (fresh confirmation)
 * and the merge executes transactionally. Idempotent: repeat calls find the
 * request already completed and change nothing.
 */
export async function finalizeAccountMerge(requestId: string, password: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (typeof requestId !== "string" || !requestId) return { error: "Invalid request." };

  const attemptLimit = await durableRateLimit(`merge-finalize:${user.id}`, 5, 60 * 60 * 1000);
  if (!attemptLimit.allowed) {
    return { error: "Too many attempts. Please try again later." };
  }

  const request = await prisma.accountMergeRequest.findUnique({ where: { id: requestId } });
  if (!request || request.primaryUserId !== user.id) return { error: "Merge request not found." };
  if (request.status !== "verified") {
    return { error: request.status === "pending"
      ? "The other account hasn't been verified yet — enter its password or wait for its owner to approve."
      : "This merge request is no longer open." };
  }
  if (isMergeRequestExpired(request)) {
    await prisma.accountMergeRequest.update({ where: { id: request.id }, data: { status: "expired" } });
    return { error: "This merge request has expired. Start a new one." };
  }

  // Fresh confirmation of the requester's own password — a live session alone
  // is not enough to execute an irreversible merge.
  if (!password || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Your password is incorrect." };
  }

  const secondaryId = request.secondaryUserId;
  const secondary = secondaryId
    ? await prisma.user.findUnique({
        where: { id: secondaryId },
        select: { id: true, username: true, isSuspended: true, isAdmin: true, mergedIntoUserId: true, stripeSubscriptionId: true },
      })
    : null;
  if (!secondary || secondary.id === user.id) return { error: "This merge request is no longer valid." };
  if (secondary.isSuspended || secondary.mergedIntoUserId) return { error: "That account can no longer be merged." };
  if (secondary.isAdmin) return { error: "Admin accounts can't be merged." };

  const result = await performAccountMerge(request.id, user.id, secondary.id);
  if (!result.ok) {
    return { error: "This merge request was already processed." };
  }

  // Best-effort: stop billing on the deactivated account (mirrors account
  // deletion). The merge itself never transfers plans or billing.
  if (secondary.stripeSubscriptionId) {
    try {
      const key = process.env.STRIPE_SECRET_KEY;
      if (key) {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(key);
        await stripe.subscriptions.cancel(secondary.stripeSubscriptionId);
      }
    } catch {
      // Billing cleanup is advisory — the merge is already committed.
    }
  }

  clearMeshCache(user.id);
  clearMeshCache(secondary.id);
  revalidateMergeSurfaces();
  revalidatePath("/profile");
  revalidatePath(`/profile/${user.username}`);
  revalidatePath("/mesh");

  const summary: AccountMergeSummary = result.summary;
  return { success: true as const, summary };
}
