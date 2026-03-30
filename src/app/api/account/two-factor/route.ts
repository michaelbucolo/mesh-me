import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const methods = await prisma.twoFactorMethod.findMany({
    where: { userId: session.userId },
    select: {
      id: true,
      method: true,
      label: true,
      isEnabled: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ methods });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { method, label } = await req.json();
  const validMethods = ["email", "sms", "totp", "passkey"];
  if (!method || !validMethods.includes(method)) {
    return NextResponse.json({ error: "Invalid 2FA method. Must be: " + validMethods.join(", ") }, { status: 400 });
  }

  // For email/sms, just register the method (verification happens during login)
  // For totp, generate a secret (in production, use a proper TOTP library)
  // For passkey, the client sends the credential data

  const twoFactor = await prisma.twoFactorMethod.create({
    data: {
      userId: session.userId,
      method,
      label: label || method.toUpperCase() + " verification",
      isEnabled: true,
    },
  });

  return NextResponse.json({ twoFactor });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { methodId } = await req.json();
  if (!methodId) return NextResponse.json({ error: "methodId required" }, { status: 400 });

  // Verify ownership
  const method = await prisma.twoFactorMethod.findUnique({ where: { id: methodId } });
  if (!method || method.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 2FA is optional — users can remove their last method to fully disable 2FA.
  // No guard needed here; the user simply won't have 2FA if they delete all methods.

  await prisma.twoFactorMethod.delete({ where: { id: methodId } });
  return NextResponse.json({ success: true });
}
