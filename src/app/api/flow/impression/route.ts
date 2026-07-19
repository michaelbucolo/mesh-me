import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";
import { rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Cap per beacon so one request can never write an unbounded batch.
const MAX_IDS = 60;
// Retained seen-only rows per user. Far more than any candidate pool, so the
// no-repeat guarantee holds across sessions while the table stays bounded.
const KEEP_PER_USER = 2000;

/**
 * Batched "I saw these reels" beacon. The Flow client flushes accumulated ids
 * every few reels and on tab-background; the server records them privately so
 * the ranker never replays them across sessions/devices. Best-effort: a lost
 * beacon just means a reel could reappear once — never an error surfaced to the
 * user. Guests write nothing.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 204 });

  const rl = rateLimit(`flow-seen:${user.id}`, 60, 60_000);
  if (!rl.allowed) return new NextResponse(null, { status: 429 });

  const body = await readJsonObject(request);
  const ids = Array.isArray(body.ids)
    ? [
        ...new Set(
          (body.ids as unknown[])
            .filter((v): v is string => typeof v === "string")
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      ].slice(0, MAX_IDS)
    : [];
  if (ids.length === 0) return new NextResponse(null, { status: 204 });

  try {
    // Insert only genuinely-new rows (SQLite has no skipDuplicates): fetching
    // the already-present ids first means we never touch an existing row — so a
    // `liked` row (with its taste signal + heart state) is never clobbered by a
    // later plain "seen".
    const existing = await prisma.flowImpression.findMany({
      where: { userId: user.id, postId: { in: ids } },
      select: { postId: true },
    });
    const have = new Set(existing.map((e) => e.postId));
    const fresh = ids.filter((id) => !have.has(id));
    if (fresh.length > 0) {
      const seenAt = new Date();
      await prisma.flowImpression.createMany({
        data: fresh.map((postId) => ({ userId: user.id, postId, seenAt })),
      });
    }

    // Opportunistic retention — prune only the oldest seen-only rows past the
    // cap, so likes (and their taste signal) are never evicted.
    if (Math.random() < 0.05) {
      const edge = await prisma.flowImpression.findMany({
        where: { userId: user.id, liked: false },
        orderBy: { seenAt: "desc" },
        skip: KEEP_PER_USER,
        take: 1,
        select: { seenAt: true },
      });
      if (edge[0]) {
        await prisma.flowImpression.deleteMany({
          where: { userId: user.id, liked: false, seenAt: { lt: edge[0].seenAt } },
        });
      }
    }
  } catch {
    // Best-effort seen tracking; a concurrent-write race or transient failure
    // must never break the Flow.
  }

  return new NextResponse(null, { status: 204 });
}
