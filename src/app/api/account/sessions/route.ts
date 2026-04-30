import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { isSameOriginRequest } from "@/lib/request-guard";

const SESSION_COOKIE = "__Host-mesh_session";
const LEGACY_SESSION_COOKIE = "mesh_session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const cookieStore = await cookies();
  const currentSessionId = cookieStore.get(SESSION_COOKIE)?.value || cookieStore.get(LEGACY_SESSION_COOKIE)?.value || null;

  const sessions = await prisma.session.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
    },
    take: 10,
  });
  const totalSessions = await prisma.session.count({ where: { userId: session.userId } });

  return NextResponse.json({
    sessions: sessions.map((item) => ({
      createdAt: item.createdAt,
      expiresAt: item.expiresAt,
      isCurrent: item.id === currentSessionId,
    })),
    totalSessions,
  });
}

export async function DELETE(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const cookieStore = await cookies();
  const currentSessionId = cookieStore.get(SESSION_COOKIE)?.value || cookieStore.get(LEGACY_SESSION_COOKIE)?.value || null;

  if (!currentSessionId) {
    return NextResponse.json({ error: "Current session unavailable" }, { status: 400 });
  }

  const deleted = await prisma.session.deleteMany({
    where: {
      userId: session.userId,
      id: { not: currentSessionId },
    },
  });

  return NextResponse.json({ success: true, deletedCount: deleted.count });
}
