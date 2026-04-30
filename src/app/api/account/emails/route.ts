import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";

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

  const { email } = await req.json();
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const normalized = email.toLowerCase().trim();

  // Check if email already exists in UserEmail table or as a primary User email
  const existing = await prisma.userEmail.findUnique({ where: { email: normalized } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }
  const existingPrimary = await prisma.user.findUnique({ where: { email: normalized } });
  if (existingPrimary) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const userEmail = await prisma.userEmail.create({
    data: {
      userId: session.userId,
      email: normalized,
      isPrimary: false,
      isVerified: false,
    },
  });

  return NextResponse.json({ email: userEmail });
}

export async function DELETE(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { emailId } = await req.json();
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
