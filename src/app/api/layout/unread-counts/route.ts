import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readInboxSignals } from "@/lib/inbox/read-inbox";

export const dynamic = "force-dynamic";

const ZERO = { unreadNotifications: 0, unreadMessages: 0, needsYou: 0 };

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(ZERO, {
        status: 401,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    const [unreadNotifications, unreadMessages, signals] = await Promise.all([
      prisma.notification.count({
        where: { recipientId: user.id, read: false },
      }),
      // MUTED MEANS MUTED (wants-you.ts): the muted thread stays fully readable
      // in MeChat, but a nav badge that counts it has overridden an explicit
      // "do not bother me about this" to make itself look busier.
      //
      // THE LAST WORD IS THEIRS, OR THE THREAD IS READ: this counts THREADS
      // whose newest message is another sender's and newer than lastRead —
      // the exact judgement the inbox rows ride (read-inbox.ts). Counting any
      // other-sender message newer than the watermark left a permanent
      // phantom badge whenever the viewer's own reply landed without opening
      // the thread: every surface said read, the badge said 1 (audit 2).
      prisma
        .$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*) as count
        FROM "ThreadMember" tm
        INNER JOIN "Message" m ON m."id" = (
          SELECT m2."id"
          FROM "Message" m2
          WHERE m2."threadId" = tm."threadId"
          ORDER BY m2."createdAt" DESC
          LIMIT 1
        )
        WHERE tm."userId" = ${user.id}
          AND tm."notificationsMuted" = false
          AND m."senderId" != ${user.id}
          AND m."createdAt" > tm."lastRead"
      `
        .then((rows) => Number(rows[0]?.count ?? 0))
        .catch(() => 0),
      // The one owed judgement, shared with the inbox and the Return Brief —
      // never a second derivation here.
      readInboxSignals(user.id).catch(() => null),
    ]);

    return NextResponse.json(
      { unreadNotifications, unreadMessages, needsYou: signals?.needsYou ?? 0 },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch {
    return NextResponse.json(ZERO, {
      status: 500,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }
}
