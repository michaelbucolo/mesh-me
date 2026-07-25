// THE 1:1 CONVERSATION — one definition of "the direct thread between two
// people", and of who is allowed to be put in one.
//
// ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
//
// Three places found-or-created a DM. Two of them stated the rules; the third
// restated a subset, and the gap was a leak:
//
//   src/lib/actions.ts (sendMessage)          direct-only ✓   block-checked ✓
//   src/app/api/messages/route.ts (POST)      direct-only ✓   block-checked ✓
//   src/lib/platform-sync.ts (comment import) direct-only ✗   block-checked ✗
//
// The import matched a thread on "has member A AND has member B" with no
// `threadType` filter. A community thread carries EVERY member of the community
// (see startCommunityChat), and a group thread carries everyone in the group —
// so for any two people who shared a community, that lookup selected the
// COMMUNITY thread and posted the imported platform comment into it, in front
// of the whole room. It was addressed to one person and it arrived in public.
//
// The missing block check was the second half: blocking someone on Mesh.me did
// nothing to the import path, so a blocked account that commented on your
// connected-platform post still landed in your MeChat, under their name, as a
// message. Settings promises blocks work "in both directions"; this route went
// around them entirely.
//
// Neither is a forgotten line. Both are the same shape as the eight other
// defects in this repo: two places state one fact, and only one of them is ever
// taught the rule. So the rule moves here, and scripts/second-writer-check.ts
// fails the build if a fourth caller re-spells it.
//
// ── WHAT "DIRECT" MEANS ──────────────────────────────────────────────────────
//
// `threadType: "direct"` is the ONLY marker of a two-person conversation.
// /api/messages sets it exactly when `memberIds.length === 1`; "group" and
// "community" threads are unbounded in membership. Matching on membership alone
// is therefore never sufficient — the two people you are looking for can both
// be inside a room of two hundred.

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";

/**
 * The filter that identifies the one-to-one conversation between two people.
 *
 * Exported as a `where` fragment rather than only as a function, because
 * /api/messages composes it into a larger query. Spreading a shared fragment is
 * what keeps the definition single; re-typing the three clauses inline is how
 * the third copy lost `threadType`.
 */
export function directThreadWhere(
  userId: string,
  otherUserId: string,
): Prisma.MessageThreadWhereInput {
  return {
    threadType: "direct",
    AND: [
      { members: { some: { userId } } },
      { members: { some: { userId: otherUserId } } },
    ],
  };
}

/**
 * True when a block in EITHER direction stands between `userId` and any of
 * `otherUserIds` — the one test for "these people must not be put in a
 * conversation together".
 *
 * Takes a list because /api/messages adds several people at once and one
 * blocked participant has to fail the whole request; the single-recipient
 * callers pass an array of one.
 */
export async function directMessagingBlocked(
  userId: string,
  otherUserIds: string[],
): Promise<boolean> {
  const others = otherUserIds.filter((id) => id && id !== userId);
  if (others.length === 0) return false;

  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: { in: others } },
        { blockerId: { in: others }, blockedId: userId },
      ],
    },
    select: { id: true },
  });
  return Boolean(block);
}

export type DirectThreadResult =
  | { threadId: string; reason?: undefined }
  | { threadId: null; reason: "blocked" | "self" };

/**
 * Find — or create — the one-to-one thread between two people, refusing when a
 * block stands between them.
 *
 * Returns a discriminated result rather than throwing, because the three
 * callers answer a refusal differently: sendMessage returns an error string,
 * the API returns 403, and the platform-comment import silently skips the
 * comment. What they must NOT differ on is whether the refusal happens.
 */
export async function findOrCreateDirectThread(
  userId: string,
  otherUserId: string,
): Promise<DirectThreadResult> {
  if (!otherUserId || otherUserId === userId) return { threadId: null, reason: "self" };
  if (await directMessagingBlocked(userId, [otherUserId])) {
    return { threadId: null, reason: "blocked" };
  }

  const existing = await prisma.messageThread.findFirst({
    where: directThreadWhere(userId, otherUserId),
    select: { id: true },
  });
  if (existing) return { threadId: existing.id };

  const created = await prisma.messageThread.create({
    data: {
      threadType: "direct",
      sourcePlatform: "mesh",
      isEncrypted: true,
      members: {
        create: [
          { userId, role: "owner" },
          { userId: otherUserId, role: "member" },
        ],
      },
    },
    select: { id: true },
  });
  return { threadId: created.id };
}
