import "server-only";

// THE FIRE PATH — one definition, two callers.
//
// The cron tick and the owner's "Send now" both come through here, which is
// what makes the exactly-once story small enough to trust: every entry is the
// same guarded claim (`count === 1` is the lock — the CharterSeat precedent),
// and every exit is the same settle. A second tick, a deploy race, a cancel,
// and a Send now pressed at the same moment are all just writers losing the
// same updateMany.
//
// This module knows NOTHING about caps or entitlements — depth is adjudicated
// where a schedule is created. By the time a row reaches here it fires the
// same for everyone (schedule-fire-check pins that import surface).

import { prisma } from "@/lib/prisma";
import { sendPushForNotification } from "@/lib/push";
import { resolveDeliverers } from "./deliverers";
import { publishToTargets, type PublishReport } from "./publish";
import type { Draft } from "./plan";
import { buildRetryDeliverers, parseStoredReport, parseStoredTargets, settleReport } from "./schedule";
import { SCHEDULE_LAW } from "./schedule-law";

/**
 * The claim. One guarded updateMany from an expected status set into
 * `firing`; `count === 0` means another writer owns the row — a second tick,
 * a cancel, a Send now — and the caller walks away silently.
 */
export async function claimScheduledPost(id: string, from: readonly string[], now: Date): Promise<boolean> {
  const claimed = await prisma.scheduledPost.updateMany({
    where: { id, status: { in: [...from] } },
    data: { status: "firing", claimedAt: now, attempts: { increment: 1 } },
  });
  return claimed.count === 1;
}

/**
 * Fire a row this caller just claimed. Deliverers are resolved from stored
 * state AT THIS MOMENT (never a snapshot), wrapped by buildRetryDeliverers so
 * a leg that already posted is replayed from its recorded URL and never sent
 * again. The report is stored VERBATIM — publish.ts's summary is the one
 * sentence every surface renders.
 */
export async function fireClaimedPost(id: string, now: Date): Promise<PublishReport | null> {
  const row = await prisma.scheduledPost.findUnique({
    where: { id },
    include: { user: { select: { id: true, username: true } } },
  });
  if (!row || row.status !== "firing") return null;

  const targets = parseStoredTargets(row.targetsJson);
  const draft: Draft = { text: row.text, media: [], title: row.title ?? undefined };
  // Fire-time credential resolution; fire-time clock — a delivered createdAt
  // is the moment of the SEND, never backdated to scheduledFor.
  const live = await resolveDeliverers({ id: row.user.id, username: row.user.username });
  const deliverers = buildRetryDeliverers(parseStoredReport(row.reportJson), live);

  const report = await publishToTargets(draft, targets, deliverers);
  const decision = settleReport(report, row.attempts, now, SCHEDULE_LAW);

  await prisma.scheduledPost.updateMany({
    where: { id, status: "firing" },
    data: {
      status: decision.status,
      nextAttemptAt: decision.status === "retrying" ? decision.nextAttemptAt : null,
      reportJson: JSON.stringify(report),
      firedAt: row.firedAt ?? now,
      completedAt: decision.status === "done" ? now : null,
    },
  });

  if (decision.status === "done" && !report.complete) {
    await notifyScheduledOutcome(id, row.userId, report);
  }
  return report;
}

/**
 * At most once, and only bad news. The notifiedAt guard is itself a guarded
 * updateMany, so two settle passes cannot produce two notifications; a full
 * success notifies nothing — the queue's Sent row with its links is the
 * receipt. Restore (reschedule from missed/canceled) clears the guard: the
 * promise is new, so its one notification is too.
 */
export async function notifyScheduledOutcome(id: string, userId: string, report: PublishReport): Promise<void> {
  const guard = await prisma.scheduledPost.updateMany({
    where: { id, notifiedAt: null },
    data: { notifiedAt: new Date() },
  });
  if (guard.count !== 1) return;

  const message = `A scheduled post needs a look: ${report.summary}`;
  await prisma.notification
    .create({ data: { type: "scheduled_post", recipientId: userId, message } })
    .catch((error) => console.error("Scheduled-post notification failed:", error));
  sendPushForNotification(userId, { type: "scheduled_post", message }).catch(() => {});
}
