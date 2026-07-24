import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";
import { rateLimit } from "@/lib/security";
import { isUniqueConstraintError } from "@/lib/prisma-errors";

const MAX_PHONES_PER_ACCOUNT = 5;

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

  // Unverified additions reserve the global UserPhone.phone namespace, so cap
  // the rate and count to blunt namespace-squatting from a single account.
  const limit = rateLimit(`account-phone-add:${session.userId}`, 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many phone additions. Please try again later." }, { status: 429 });
  }

  const body = await readJsonObject(req);
  const { phone } = body;
  if (!phone || typeof phone !== "string" || phone.length < 7) {
    return NextResponse.json({ error: "Valid phone number required" }, { status: 400 });
  }

  // Normalize: strip non-digits except leading +
  const normalized = phone.replace(/[^\d+]/g, "");

  const phoneCount = await prisma.userPhone.count({ where: { userId: session.userId } });
  if (phoneCount >= MAX_PHONES_PER_ACCOUNT) {
    return NextResponse.json({ error: "You've reached the maximum number of phone numbers on this account." }, { status: 409 });
  }

  const existing = await prisma.userPhone.findUnique({ where: { phone: normalized } });
  if (existing) {
    return NextResponse.json({ error: "Phone number already in use" }, { status: 409 });
  }

  let userPhone;
  try {
    userPhone = await prisma.userPhone.create({
      data: {
        userId: session.userId,
        phone: normalized,
        isPrimary: false,
        isVerified: false,
      },
    });
  } catch (error) {
    // Lost the race between the pre-check and the insert: return a clean 409
    // instead of letting the raw unique-constraint error escape as a 500.
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Phone number already in use" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ phone: userPhone });
}

export async function DELETE(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const deleteBody = await readJsonObject(req);
  const { phoneId } = deleteBody;
  if (!phoneId || typeof phoneId !== "string") return NextResponse.json({ error: "phoneId required" }, { status: 400 });

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
