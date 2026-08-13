"use server";

// THE QUEUE'S VERBS — schedule, edit, move, cancel, send now, retry.
//
// House pattern throughout: getCurrentUser first, ownership inside the WHERE
// (`{ id, userId }` — never a read-then-write), every transition a guarded
// updateMany whose `count === 0` means another writer got there first. The
// only module that also transitions rows is the cron tick, and both go
// through the SAME claim in schedule-fire.ts, so "Send now" racing the
// scheduler is settled by the lock, not by luck.
//
// Caps are adjudicated HERE, at promise-creation time, and nowhere else: a
// Pro lapse deletes nothing, pauses nothing — everything queued always fires.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasMeshPro, resolveScheduleCaps } from "@/lib/mesh-pro";
import { rateLimit, sanitizeForDisplay } from "@/lib/security";
import { planPublish, ruleFor, type Draft } from "./plan";
import { claimScheduledPost, fireClaimedPost } from "./schedule-fire";
import { parseStoredReport, parseStoredTargets } from "./schedule";
import { SCHEDULE_LAW } from "./schedule-law";
import type { PublishReport } from "./publish";

const LIVE_STATUSES = ["queued", "retrying"] as const;

function cleanScheduleText(text: unknown) {
  return sanitizeForDisplay(String(text ?? "")).slice(0, 5000).trim();
}

function cleanScheduleTitle(title: unknown) {
  const clean = sanitizeForDisplay(String(title ?? "")).slice(0, 300).trim();
  return clean || null;
}

function cleanTargets(targets: unknown): string[] {
  if (!Array.isArray(targets)) return [];
  return [...new Set(
    targets
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => ruleFor(t)?.publishable),
  )].slice(0, 12);
}

/** IANA-shaped, display-only. A bad zone stores as null, never breaks a fire. */
function cleanTz(tz: unknown): string | null {
  const value = String(tz ?? "").trim();
  return /^[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(value) && value.length <= 64 ? value : null;
}

function parseWhen(iso: unknown): Date | null {
  const date = new Date(String(iso ?? ""));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function schedulePost(input: { text: string; title?: string; targets: string[]; scheduledForIso: string; tz?: string }) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const rl = rateLimit(`schedule:${user.id}`, 20, 60 * 1000);
  if (!rl.allowed) return { error: "Scheduling too fast — give it a moment." };

  const text = cleanScheduleText(input.text);
  const title = cleanScheduleTitle(input.title);
  const targets = cleanTargets(input.targets);
  if (!targets.length) return { error: "Pick at least one place for it to go." };

  const draft: Draft = { text, media: [], title: title ?? undefined };
  const plan = planPublish(draft, targets);
  if (!plan.canPublish) {
    // The plan's own words — the same refusal the composer shows live.
    const firstProblem = plan.targets.find((t) => !t.ok)?.problems[0]?.message;
    return { error: firstProblem ?? "Nothing here can take this post yet." };
  }

  const when = parseWhen(input.scheduledForIso);
  if (!when) return { error: "That time didn't come through — pick it again." };
  const now = Date.now();
  if (when.getTime() < now + SCHEDULE_LAW.minLeadMs) {
    return { error: "That's basically now — use Post now, or pick a time at least a minute out." };
  }

  const caps = resolveScheduleCaps(hasMeshPro(user));
  if (when.getTime() > now + caps.horizonDays * 24 * 60 * 60 * 1000) {
    return {
      error: hasMeshPro(user)
        ? "That's more than a year out — pick a nearer time."
        : "The free plan schedules a fortnight ahead; MeshPro reaches a year.",
    };
  }

  const held = await prisma.scheduledPost.count({
    where: { userId: user.id, status: { in: [...LIVE_STATUSES] } },
  });
  if (held >= caps.slots) {
    return {
      error: hasMeshPro(user)
        ? "Your queue holds a hundred posts — one has to send before another joins."
        : "Your queue holds 10 posts on the free plan — a slot opens when the next one sends, or MeshPro holds a hundred.",
    };
  }

  const row = await prisma.scheduledPost.create({
    data: {
      userId: user.id,
      text,
      title,
      targetsJson: JSON.stringify(targets),
      // Cross-post law: public everywhere, decided here, never at fire time.
      visibility: "public",
      scheduledFor: when,
      tz: cleanTz(input.tz),
    },
    select: { id: true, scheduledFor: true },
  });

  revalidatePath("/compose/queue");
  return { success: true as const, id: row.id };
}

export async function editScheduled(id: string, patch: { text?: string; title?: string; targets?: string[] }) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  if (!id || typeof id !== "string") return { error: "That post is gone." };

  const text = cleanScheduleText(patch.text);
  const title = cleanScheduleTitle(patch.title);
  const targets = cleanTargets(patch.targets);
  if (!targets.length) return { error: "Pick at least one place for it to go." };

  const plan = planPublish({ text, media: [], title: title ?? undefined }, targets);
  if (!plan.canPublish) {
    const firstProblem = plan.targets.find((t) => !t.ok)?.problems[0]?.message;
    return { error: firstProblem ?? "Nothing here can take this post yet." };
  }

  const updated = await prisma.scheduledPost.updateMany({
    where: { id, userId: user.id, status: "queued" },
    data: { text, title, targetsJson: JSON.stringify(targets) },
  });
  if (updated.count === 0) return { error: "It's already going out — check its report in a moment." };

  revalidatePath("/compose/queue");
  return { success: true as const };
}

/**
 * Move a queued post, or restore a missed/canceled one. A restore is a NEW
 * promise: attempts, report, and the notify guard all reset — at-most-once
 * is per promise, not per row lifetime.
 */
export async function rescheduleScheduled(id: string, newIso: string, tz?: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  if (!id || typeof id !== "string") return { error: "That post is gone." };

  const when = parseWhen(newIso);
  if (!when) return { error: "That time didn't come through — pick it again." };
  const now = Date.now();
  if (when.getTime() < now + SCHEDULE_LAW.minLeadMs) {
    return { error: "That's basically now — use Send now instead." };
  }
  const caps = resolveScheduleCaps(hasMeshPro(user));
  if (when.getTime() > now + caps.horizonDays * 24 * 60 * 60 * 1000) {
    return {
      error: hasMeshPro(user)
        ? "That's more than a year out — pick a nearer time."
        : "The free plan schedules a fortnight ahead; MeshPro reaches a year.",
    };
  }

  const row = await prisma.scheduledPost.findFirst({
    where: { id, userId: user.id },
    select: { status: true },
  });
  if (!row) return { error: "That post is gone." };

  if (row.status === "queued") {
    const moved = await prisma.scheduledPost.updateMany({
      where: { id, userId: user.id, status: "queued" },
      data: { scheduledFor: when, tz: cleanTz(tz) },
    });
    if (moved.count === 0) return { error: "It's already going out — check its report in a moment." };
  } else if (row.status === "missed" || row.status === "canceled") {
    const held = await prisma.scheduledPost.count({
      where: { userId: user.id, status: { in: [...LIVE_STATUSES] } },
    });
    if (held >= caps.slots) {
      return {
        error: hasMeshPro(user)
          ? "Your queue holds a hundred posts — one has to send before another joins."
          : "Your queue holds 10 posts on the free plan — a slot opens when the next one sends, or MeshPro holds a hundred.",
      };
    }
    const restored = await prisma.scheduledPost.updateMany({
      where: { id, userId: user.id, status: { in: ["missed", "canceled"] } },
      data: {
        status: "queued",
        scheduledFor: when,
        tz: cleanTz(tz),
        attempts: 0,
        nextAttemptAt: null,
        claimedAt: null,
        firedAt: null,
        completedAt: null,
        reportJson: null,
        notifiedAt: null,
      },
    });
    if (restored.count === 0) return { error: "That post is gone." };
  } else {
    return { error: "This one already went — its report tells the story." };
  }

  revalidatePath("/compose/queue");
  return { success: true as const };
}

/** Cancel stops the future, never rewrites the past: a canceled retrying row
 *  keeps its posted legs' report. Restore-able via reschedule. */
export async function cancelScheduled(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  if (!id || typeof id !== "string") return { error: "That post is gone." };

  const canceled = await prisma.scheduledPost.updateMany({
    where: { id, userId: user.id, status: { in: [...LIVE_STATUSES] } },
    data: { status: "canceled", completedAt: new Date(), nextAttemptAt: null },
  });
  if (canceled.count === 0) return { error: "Too late to cancel — check its report in a moment." };

  revalidatePath("/compose/queue");
  return { success: true as const };
}

/** Hard delete, any non-firing row. Firing rows finish their story first. */
export async function deleteScheduled(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  if (!id || typeof id !== "string") return { success: true as const };

  await prisma.scheduledPost.deleteMany({
    where: { id, userId: user.id, status: { not: "firing" } },
  });
  revalidatePath("/compose/queue");
  return { success: true as const };
}

/**
 * The owner's "don't wait" — the SAME guarded claim the cron makes, so a
 * racing tick cannot double it, followed by the same fire.
 */
export async function sendScheduledNow(id: string): Promise<PublishReport | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  if (!id || typeof id !== "string") return { error: "That post is gone." };

  const owned = await prisma.scheduledPost.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!owned) return { error: "That post is gone." };

  const now = new Date();
  const won = await claimScheduledPost(id, ["queued", "retrying", "missed"], now);
  if (!won) return { error: "It's already sending — check its report in a moment." };

  const report = await fireClaimedPost(id, now);
  revalidatePath("/compose/queue");
  return report ?? { error: "Could not fire it — try again in a moment." };
}

/**
 * The sanctioned exit from "interrupted" and permanent failures: an
 * owner-initiated re-fire of a done row's failed legs. Posted legs replay
 * from their recorded URLs (buildRetryDeliverers) — never re-sent.
 */
export async function retryFailedLegs(id: string): Promise<PublishReport | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  if (!id || typeof id !== "string") return { error: "That post is gone." };

  const row = await prisma.scheduledPost.findFirst({
    where: { id, userId: user.id, status: "done" },
    select: { reportJson: true, targetsJson: true },
  });
  if (!row) return { error: "Nothing here to retry." };
  const report = parseStoredReport(row.reportJson);
  const hasFailure = report?.outcomes.some((o) => o.state === "failed") ?? false;
  const hasTargets = parseStoredTargets(row.targetsJson).length > 0;
  if (!report || !hasFailure || !hasTargets) return { error: "Nothing here to retry." };

  const now = new Date();
  const won = await claimScheduledPost(id, ["done"], now);
  if (!won) return { error: "It's already sending — check its report in a moment." };

  const result = await fireClaimedPost(id, now);
  revalidatePath("/compose/queue");
  return result ?? { error: "Could not fire it — try again in a moment." };
}
