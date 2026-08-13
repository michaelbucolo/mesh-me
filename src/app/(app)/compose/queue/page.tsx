import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSafeService } from "@/lib/compose/atproto";
import { parseStoredReport, parseStoredTargets } from "@/lib/compose/schedule";
import { QueueView, type QueueRow } from "@/components/compose/queue-view";

export const metadata: Metadata = { title: "Queue" };

// THE QUEUE — a calendar of promises, and the receipts of kept ones.
//
// The second segment of the compose surface (the five tabs are law; the door
// here is the segment link, the composer's confirmation, and the /meshpro
// card). Upcoming rows re-announce a future skip BEFORE it happens — a
// disconnected platform is named while there is still time to reconnect, not
// discovered in a morning-after report.

export default async function QueuePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fcompose%2Fqueue");

  const [rows, accounts] = await Promise.all([
    prisma.scheduledPost.findMany({
      where: { userId: user.id },
      select: {
        id: true, text: true, title: true, targetsJson: true, scheduledFor: true,
        tz: true, status: true, attempts: true, firedAt: true, completedAt: true,
        reportJson: true,
      },
      orderBy: { scheduledFor: "asc" },
      take: 200,
    }),
    prisma.connectedAccount.findMany({
      where: { userId: user.id, isActive: true },
      select: { platform: true, accessToken: true, platformId: true, serviceUrl: true },
    }),
  ]);

  // What would actually GO if a row fired right now — the same shape
  // deliverers.ts resolves, computed without touching credentials client-side.
  const reachable = new Set(["mesh"]);
  for (const account of accounts) {
    if (
      account.platform === "bluesky" &&
      account.accessToken && account.platformId && account.serviceUrl &&
      isSafeService(account.serviceUrl)
    ) {
      reachable.add("bluesky");
    }
  }

  const queueRows: QueueRow[] = rows.map((row) => ({
    id: row.id,
    text: row.text,
    title: row.title,
    targets: parseStoredTargets(row.targetsJson),
    scheduledForIso: row.scheduledFor.toISOString(),
    tz: row.tz,
    status: row.status,
    firedAtIso: row.firedAt?.toISOString() ?? null,
    report: parseStoredReport(row.reportJson),
  }));

  return (
    <div className="h-full min-h-full w-full overflow-y-auto" style={{ background: "#070b14" }}>
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <div className="flex items-baseline gap-2">
          <Link href="/compose" className="text-2xl font-semibold underline-offset-4 hover:underline" style={{ color: "#8b93a7" }}>
            Compose
          </Link>
          <span className="text-2xl font-semibold" style={{ color: "#8b93a7" }}>·</span>
          <h1 className="text-2xl font-semibold" style={{ color: "#f2f4f8" }}>
            Queue{queueRows.filter((r) => r.status === "queued" || r.status === "retrying").length > 0
              ? ` (${queueRows.filter((r) => r.status === "queued" || r.status === "retrying").length})`
              : ""}
          </h1>
        </div>
        <QueueView rows={queueRows} reachable={[...reachable]} />
      </div>
    </div>
  );
}
