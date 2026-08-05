"use server";

// REPORTING A DRAWING.
//
// ── WHY THE REPORT IS AGAINST THE PERSON, NOT THE ROW ──────────────────────
//
// A doodle lives fifteen minutes. A report filed against its id would point at
// a row that is gone before anybody reads it, so the report would arrive as
// "somebody drew something, we no longer have it" — which is useless, and
// worse, it looks like moderation while doing nothing.
//
// So the report is filed against the AUTHOR, reusing the existing `Report`
// model exactly as `reportPost` does, with the drawing's ink captured in the
// reason. That is deliberately THE ONE PLACE ink outlives its TTL: you cannot
// act on a report whose evidence has expired, and a moderation queue full of
// unfalsifiable accusations is its own harm.
//
// ── AND WHY YOU CAN ONLY REPORT WHAT YOU CAN SEE ───────────────────────────
//
// The reporter's visibility is re-checked through the same read the map uses.
// Without that, reporting is an enumeration oracle: guess an id, and the
// difference between "reported" and "not found" tells you whether a drawing
// exists — and by extension something about who is nearby. Reusing `readMap`
// means the answer is identical for "does not exist" and "you cannot see it".

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { durableRateLimit } from "@/lib/durable-rate-limit";
import { readMap } from "./read-map";

/** A person can file a handful of reports a minute. Enough to clear a nasty
 * room, not enough to bury the queue in retaliation. */
const REPORT_LIMIT = 8;
const REPORT_WINDOW_MS = 60_000;

export type ReportDoodleResult = { ok: true } | { ok: false; error: string };

export async function reportDoodle(doodleId: string, reason?: string): Promise<ReportDoodleResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to report." };

  const limit = await durableRateLimit(`meshimap-report:${user.id}`, REPORT_LIMIT, REPORT_WINDOW_MS);
  if (!limit.allowed) return { ok: false, error: "Give that a moment." };

  // The SAME read the map renders from. A drawing you cannot see is reported
  // with the identical answer as one that does not exist, so nothing is
  // learned by guessing.
  const { doodles } = await readMap(user.id);
  const target = doodles.find((d) => d.id === doodleId);
  if (!target) return { ok: false, error: "That drawing is no longer around." };

  if (target.userId === user.id) return { ok: false, error: "That one's yours." };

  // One pending report per reporter per person — a second is the same
  // complaint, and stacking them just makes the queue lie about how many
  // people are upset.
  const existing = await prisma.report.findFirst({
    where: { reporterId: user.id, reportedUserId: target.userId, status: "pending" },
    select: { id: true },
  });
  if (existing) return { ok: true };

  const note = (reason ?? "").trim().slice(0, 300);
  await prisma.report.create({
    data: {
      reporterId: user.id,
      reportedUserId: target.userId,
      // The ink goes in the reason because the row it came from will be swept
      // long before a human looks. This is the only copy that outlives the
      // TTL, and it exists so the report can actually be judged.
      reason: [
        "MeshiMap drawing",
        note ? `note: ${note}` : null,
        `ink: ${target.ink}`,
      ]
        .filter(Boolean)
        .join(" · "),
    },
  });

  return { ok: true };
}
