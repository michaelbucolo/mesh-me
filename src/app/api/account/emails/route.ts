import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";
import { rateLimit } from "@/lib/security";
import { isUniqueConstraintError } from "@/lib/prisma-errors";

const MAX_EMAILS_PER_ACCOUNT = 10;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const emails = await prisma.userEmail.findMany({
    where: { userId: session.userId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ emails });
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Unverified additions reserve the global UserEmail.email namespace, so cap
  // the rate and count to blunt namespace-squatting from a single account.
  const limit = rateLimit(`account-email-add:${session.userId}`, 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many email additions. Please try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { email } = body;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const normalized = email.toLowerCase().trim();

  const emailCount = await prisma.userEmail.count({ where: { userId: session.userId } });
  if (emailCount >= MAX_EMAILS_PER_ACCOUNT) {
    return NextResponse.json({ error: "You've reached the maximum number of emails on this account." }, { status: 409 });
  }

  // Check if email already exists in UserEmail table or as a primary User email
  const existing = await prisma.userEmail.findUnique({ where: { email: normalized } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }
  const existingPrimary = await prisma.user.findUnique({ where: { email: normalized } });
  if (existingPrimary) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  let userEmail;
  try {
    userEmail = await prisma.userEmail.create({
      data: {
        userId: session.userId,
        email: normalized,
        isPrimary: false,
        isVerified: false,
      },
    });
  } catch (error) {
    // Lost the race between the pre-check and the insert: return a clean 409
    // instead of letting the raw unique-constraint error escape as a 500.
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ email: userEmail });
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
  const { emailId } = deleteBody;
  if (!emailId) return NextResponse.json({ error: "emailId required" }, { status: 400 });

  // Don't allow deleting primary email
  const emailRecord = await prisma.userEmail.findUnique({ where: { id: emailId } });
  if (!emailRecord || emailRecord.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (emailRecord.isPrimary) {
    return NextResponse.json({ error: "Cannot remove primary email" }, { status: 400 });
  }

  await prisma.userEmail.delete({ where: { id: emailId } });
  return NextResponse.json({ success: true });
}
