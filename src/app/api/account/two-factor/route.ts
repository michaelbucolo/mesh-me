import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";

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
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { method, label } = body;
  const validMethods = ["email", "sms", "totp", "passkey"];
  if (!method || !validMethods.includes(method)) {
    return NextResponse.json({ error: "Invalid 2FA method. Must be: " + validMethods.join(", ") }, { status: 400 });
  }

  // Do not create enabled 2FA records until challenge verification and login
  // enforcement exist. A stored preference without enforcement is false security.
  if (process.env.MESHME_ENABLE_UNVERIFIED_2FA !== "true") {
    return NextResponse.json(
      { error: "2FA enrollment is not available until challenge verification is implemented." },
      { status: 501 },
    );
  }

  const twoFactor = await prisma.twoFactorMethod.create({
    data: {
      userId: session.userId,
      method,
      label: label || method.toUpperCase() + " verification",
      isEnabled: false,
    },
  });

  return NextResponse.json({ twoFactor });
}

export async function DELETE(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { methodId } = body;
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
