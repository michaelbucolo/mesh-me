import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const phones = await prisma.userPhone.findMany({
    where: { userId: session.userId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ phones });
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { phone } = body;
  if (!phone || typeof phone !== "string" || phone.length < 7) {
    return NextResponse.json({ error: "Valid phone number required" }, { status: 400 });
  }

  // Normalize: strip non-digits except leading +
  const normalized = phone.replace(/[^\d+]/g, "");

  const existing = await prisma.userPhone.findUnique({ where: { phone: normalized } });
  if (existing) {
    return NextResponse.json({ error: "Phone number already in use" }, { status: 409 });
  }

  const userPhone = await prisma.userPhone.create({
    data: {
      userId: session.userId,
      phone: normalized,
      isPrimary: false,
      isVerified: false,
    },
  });

  return NextResponse.json({ phone: userPhone });
}

export async function DELETE(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const deleteBody = await req.json().catch(() => null);
  if (!deleteBody || typeof deleteBody !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { phoneId } = deleteBody;
  if (!phoneId) return NextResponse.json({ error: "phoneId required" }, { status: 400 });

  const phoneRecord = await prisma.userPhone.findUnique({ where: { id: phoneId } });
  if (!phoneRecord || phoneRecord.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (phoneRecord.isPrimary) {
    return NextResponse.json({ error: "Cannot remove primary phone" }, { status: 400 });
  }

  await prisma.userPhone.delete({ where: { id: phoneId } });
  return NextResponse.json({ success: true });
}
