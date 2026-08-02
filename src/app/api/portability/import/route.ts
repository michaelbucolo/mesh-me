import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveImportedPosts } from "@/lib/portability/import-store";
import { prismaImportStore } from "@/lib/portability/imported-history";
import { MAX_POSTS_PER_REQUEST, validateImportRequest } from "@/lib/portability/import-request";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";
import { rateLimit } from "@/lib/security";

/**
 * Receive one batch of an archive import.
 *
 * The archive itself never arrives here. It is read in the person's own browser
 * and only the posts they chose to import are sent, which is both the honest
 * reading of "this is your data" and the reason this endpoint needs no object
 * storage and no multi-gigabyte body limit.
 *
 * Everything with a decision in it lives elsewhere and is gated: validation in
 * import-request.ts, idempotency in import-store.ts. What is left here is auth,
 * a rate limit, and a call.
 */
export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Sized for a real history sent in batches: 40 batches of 500 is 20,000 posts
  // in ten minutes, which is more than any single export holds. Well above what
  // an import needs, far below what a loop could do unattended.
  const rl = rateLimit(`portability-import:${user.id}`, 40, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "That is a lot of importing at once. Give it a few minutes and carry on where you left off — nothing already saved is lost." },
      { status: 429 },
    );
  }

  const validated = validateImportRequest(await readJsonObject(req));
  if (!validated.ok) {
    return NextResponse.json({ error: validated.reason }, { status: validated.status });
  }

  const outcome = await saveImportedPosts(prismaImportStore, user.id, validated.platform, validated.posts);

  // `dropped` is returned rather than folded into a total. Reporting "imported
  // 460" when 40 entries were unreadable tells the person something false about
  // their own history, and they are the only one who can decide whether that
  // matters enough to re-export.
  return NextResponse.json({
    added: outcome.added,
    alreadyPresent: outcome.alreadyPresent,
    repaired: outcome.repaired,
    failed: outcome.failed.length,
    dropped: validated.dropped,
    batchLimit: MAX_POSTS_PER_REQUEST,
  });
}
