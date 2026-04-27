import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizeScopes(scopes: string | null | undefined): string[] {
  return Array.from(new Set((scopes ?? "").split(/[\s,]+/).map((scope) => scope.trim()).filter(Boolean)));
}

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

  if ("scopes" in body || "isActive" in body) {
    const scopes = normalizeScopes(updated.scopes);
    const placeholders = scopes.map(() => "?").join(", ");

    await prisma.$transaction(async (tx) => {
      if (scopes.length > 0) {
        await tx.$executeRawUnsafe(
          `
          UPDATE "PlatformPermission"
          SET "permissionState" = 'revoked',
              "revokedAt" = CURRENT_TIMESTAMP,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "userId" = ?
            AND "connectedAccountId" = ?
            AND "permissionKey" NOT IN (${placeholders});
          `,
          user.id,
          id,
          ...scopes,
        );

        for (const scope of scopes) {
          await tx.$executeRawUnsafe(
            `
            INSERT INTO "PlatformPermission" (
              "id",
              "userId",
              "connectedAccountId",
              "platform",
              "permissionKey",
              "permissionState",
              "grantedAt",
              "source",
              "metadata",
              "createdAt",
              "updatedAt"
            )
            SELECT lower(hex(randomblob(16))), ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'oauth_scope', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            WHERE NOT EXISTS (
              SELECT 1 FROM "PlatformPermission"
              WHERE "userId" = ?
                AND "connectedAccountId" = ?
                AND "platform" = ?
                AND "permissionKey" = ?
            );
            `,
            user.id,
            id,
            updated.platform,
            scope,
            updated.isActive ? "granted" : "revoked",
            user.id,
            id,
            updated.platform,
            scope,
          );

          await tx.$executeRawUnsafe(
            `
            UPDATE "PlatformPermission"
            SET "permissionState" = ?,
                "revokedAt" = CASE WHEN ? = 'revoked' THEN CURRENT_TIMESTAMP ELSE NULL END,
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "userId" = ?
              AND "connectedAccountId" = ?
              AND "platform" = ?
              AND "permissionKey" = ?;
            `,
            updated.isActive ? "granted" : "revoked",
            updated.isActive ? "granted" : "revoked",
            user.id,
            id,
            updated.platform,
            scope,
          );
        }
      } else {
        await tx.$executeRawUnsafe(
          `
          UPDATE "PlatformPermission"
          SET "permissionState" = 'revoked',
              "revokedAt" = CURRENT_TIMESTAMP,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "userId" = ?
            AND "connectedAccountId" = ?;
          `,
          user.id,
          id,
        );
      }
    });
  }

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
