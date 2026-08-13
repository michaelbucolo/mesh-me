import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cronSecretMatches } from "@/lib/cron-secret";
import { fireClaimedPost, claimScheduledPost, notifyScheduledOutcome } from "@/lib/compose/schedule-fire";
import { leaseExpired, missedReport, parseStoredReport, parseStoredTargets, settleInterrupted } from "@/lib/compose/schedule";
import { SCHEDULE_LAW } from "@/lib/compose/schedule-law";

// THE SCHEDULER'S TICK — the only route the platform's clock rides.
//
// There is NO session path here: nothing imports getCurrentUser, so there is
// no cookie to ride and no CSRF shape to reason about (the lesson the
// public-supply route documents). The Authorization header is the entire
// identity; the comparison lives in src/lib/cron-secret.ts (length pre-check
// + timingSafeEqual, unset env fails closed). Bad or missing secret answers
// 401 with nothing else — unset-vs-wrong are indistinguishable. (This
// deliberately diverges from public-supply's 404; the COMPARISON law is the
// shared part.)
//
// Ticks are idempotent by construction: every row transition in the tick is
// a guarded updateMany, so a doubled cron, a replayed request, or a deploy
// race just loses the claim and walks away. Running this a hundred times
// changes nothing the first run didn't.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function methodNotAllowed() {
  return new NextResponse(JSON.stringify({ ok: false }), {
    status: 405,
    headers: { Allow: "GET", "content-type": "application/json" },
  });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

export async function GET(req: Request) {
  const header = req.headers.get("authorization");
  // SCHEDULE_CRON_SECRET is the explicit contract; CRON_SECRET is the header
  // Vercel's cron invocations attach automatically when it is configured.
  const authorized =
    cronSecretMatches(header, process.env.SCHEDULE_CRON_SECRET) ||
    cronSecretMatches(header, process.env.CRON_SECRET);
  if (!authorized) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const startedAt = Date.now();
  const now = new Date();
  let interrupted = 0;
  let missed = 0;
  let fired = 0;
  let retried = 0;
  let claimed = 0;

  try {
    // ── 1. Interrupt sweep: settle crashed invocations, never re-fire ──────
    const leaseCutoff = new Date(now.getTime() - SCHEDULE_LAW.firingLeaseMs);
    const orphans = await prisma.scheduledPost.findMany({
      where: { status: "firing", claimedAt: { lt: leaseCutoff }, user: { isSuspended: false } },
      select: { id: true, userId: true, targetsJson: true, reportJson: true, claimedAt: true },
      take: SCHEDULE_LAW.tickBatch,
    });
    for (const row of orphans) {
      if (!leaseExpired(now, row.claimedAt, SCHEDULE_LAW)) continue;
      const report = settleInterrupted(parseStoredReport(row.reportJson), parseStoredTargets(row.targetsJson));
      const settled = await prisma.scheduledPost.updateMany({
        where: { id: row.id, status: "firing", claimedAt: { lt: leaseCutoff } },
        data: { status: "done", reportJson: JSON.stringify(report), completedAt: now },
      });
      if (settled.count === 1) {
        interrupted += 1;
        if (!report.complete) await notifyScheduledOutcome(row.id, row.userId, report);
      }
    }

    // ── 2. Missed sweep: past the grace is terminal, and says so ───────────
    const graceCutoff = new Date(now.getTime() - SCHEDULE_LAW.lateFireGraceMs);
    const overdue = await prisma.scheduledPost.findMany({
      where: { status: "queued", scheduledFor: { lte: graceCutoff }, user: { isSuspended: false } },
      select: { id: true, userId: true, targetsJson: true },
      take: SCHEDULE_LAW.tickBatch,
    });
    for (const row of overdue) {
      const report = missedReport(parseStoredTargets(row.targetsJson));
      const settled = await prisma.scheduledPost.updateMany({
        where: { id: row.id, status: "queued", scheduledFor: { lte: graceCutoff } },
        data: { status: "missed", reportJson: JSON.stringify(report), completedAt: now },
      });
      if (settled.count === 1) {
        missed += 1;
        await notifyScheduledOutcome(row.id, row.userId, report);
      }
    }

    // ── 3–5. Claim and fire what is due, one guarded row at a time ─────────
    const due = await prisma.scheduledPost.findMany({
      where: {
        user: { isSuspended: false },
        OR: [
          { status: "queued", scheduledFor: { lte: now, gt: graceCutoff } },
          { status: "retrying", nextAttemptAt: { lte: now } },
        ],
      },
      select: { id: true, status: true },
      orderBy: { scheduledFor: "asc" },
      take: SCHEDULE_LAW.tickBatch,
    });
    for (const row of due) {
      const won = await claimScheduledPost(row.id, [row.status], now);
      if (!won) continue;
      claimed += 1;
      if (row.status === "retrying") retried += 1;
      const report = await fireClaimedPost(row.id, now);
      if (report) fired += 1;
    }

    // ── 7. Prune old terminal rows (ScheduledPost only) + the receipt ──────
    const retentionCutoff = new Date(now.getTime() - SCHEDULE_LAW.historyRetentionDays * 24 * 60 * 60 * 1000);
    await prisma.scheduledPost.deleteMany({
      where: { status: { in: ["done", "missed", "canceled"] }, updatedAt: { lt: retentionCutoff } },
    });

    await prisma.schedulerRun.create({
      data: {
        durationMs: Date.now() - startedAt,
        claimed,
        fired,
        missed,
        retried,
        interrupted,
      },
    });

    // Counts only — never content, never usernames.
    return NextResponse.json({ ok: true, claimed, fired, missed, retried, interrupted });
  } catch (error) {
    console.error("Scheduler tick failed:", error);
    await prisma.schedulerRun
      .create({
        data: {
          durationMs: Date.now() - startedAt,
          claimed,
          fired,
          missed,
          retried,
          interrupted,
          detail: error instanceof Error ? error.message.slice(0, 500) : "unknown",
        },
      })
      .catch(() => {});
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
