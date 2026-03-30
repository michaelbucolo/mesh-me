import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { phone } = await req.json();
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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { phoneId } = await req.json();
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
