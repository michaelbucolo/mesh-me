import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";

const VALID_STATUSES = ["online", "dnd", "busy", "offline"] as const;

// GET current user's status
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { status: true, lastSeenAt: true },
    });
    
    return NextResponse.json({ status: userData?.status || "offline", lastSeenAt: userData?.lastSeenAt });
  } catch {
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 });
  }
}

// PUT to update status
export async function PUT(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const newStatus = body.status;
    
    if (!VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: "Invalid status. Must be: online, dnd, busy, offline" }, { status: 400 });
    }
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: newStatus,
        lastSeenAt: new Date(),
      },
    });
    
    return NextResponse.json({ status: newStatus });
  } catch {
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
