import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH — update alter ego association or label
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const account = await prisma.connectedAccount.findFirst({
    where: { id, userId: user.id },
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const updateData: {
    alterEgoId?: string | null;
    accountLabel?: string | null;
    scopes?: string | null;
    isActive?: boolean;
  } = {};

  // Update alter ego association
  if ("alterEgoId" in body) {
    if (body.alterEgoId) {
      const alterEgo = await prisma.alterEgo.findFirst({
        where: { id: body.alterEgoId, userId: user.id, isActive: true },
      });
      if (!alterEgo) {
        return NextResponse.json({ error: "Alter ego not found" }, { status: 400 });
      }
      updateData.alterEgoId = body.alterEgoId;
    } else {
      updateData.alterEgoId = null;
    }
  }

  // Update account label
  if ("accountLabel" in body) {
    updateData.accountLabel = body.accountLabel || null;
  }

  if ("scopes" in body) {
    if (body.scopes === null) {
      updateData.scopes = null;
    } else if (typeof body.scopes === "string") {
      updateData.scopes = body.scopes;
    } else {
      return NextResponse.json({ error: "Invalid scopes payload" }, { status: 400 });
    }
  }

  if ("isActive" in body) {
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "Invalid isActive payload" }, { status: 400 });
    }
    updateData.isActive = body.isActive;
  }

  const updated = await prisma.connectedAccount.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ account: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const account = await prisma.connectedAccount.findFirst({
    where: { id, userId: user.id },
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await prisma.connectedAccount.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
