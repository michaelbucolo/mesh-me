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
      prisma
        .$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*) as count
        FROM "Message" m
        INNER JOIN "ThreadMember" tm ON tm."threadId" = m."threadId"
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
