import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { unreadNotifications: 0, unreadMessages: 0 },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    const [unreadNotifications, unreadMessages] = await Promise.all([
      prisma.notification.count({
        where: { recipientId: user.id, read: false },
      }),
      prisma
        .$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*) as count
        FROM "Message" m
        INNER JOIN "ThreadMember" tm ON tm."threadId" = m."threadId"
        WHERE tm."userId" = ${user.id}
          AND m."senderId" != ${user.id}
          AND m."createdAt" > tm."lastRead"
      `
        .then((rows) => Number(rows[0]?.count ?? 0))
        .catch(() => 0),
    ]);

    return NextResponse.json(
      { unreadNotifications, unreadMessages },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { unreadNotifications: 0, unreadMessages: 0 },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}
