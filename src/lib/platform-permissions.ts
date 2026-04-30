import type { Prisma } from "@/generated/prisma/client";

export function normalizeScopes(scopes: string | string[] | null | undefined): string[] {
  const values = Array.isArray(scopes) ? scopes : (scopes ?? "").split(/[\s,]+/);
  return Array.from(new Set(values.map((scope) => scope.trim()).filter(Boolean)));
}

export function serializeScopes(scopes: string | string[] | null | undefined): string | null {
  const normalized = normalizeScopes(scopes);
  return normalized.length ? normalized.join(" ") : null;
}

export async function syncConnectedAccountPermissions(
  tx: Prisma.TransactionClient,
  {
    userId,
    connectedAccountId,
    platform,
    scopes,
    isActive,
    source = "oauth_scope",
  }: {
    userId: string;
    connectedAccountId: string;
    platform: string;
    scopes: string | string[] | null | undefined;
    isActive: boolean;
    source?: string;
  },
) {
  const normalizedScopes = normalizeScopes(scopes);
  const now = new Date();

  if (normalizedScopes.length === 0) {
    await tx.platformPermission.updateMany({
      where: { userId, connectedAccountId },
      data: {
        permissionState: "revoked",
        revokedAt: now,
      },
    });
    return;
  }

  await tx.platformPermission.updateMany({
    where: {
      userId,
      connectedAccountId,
      platform,
      permissionKey: { notIn: normalizedScopes },
    },
    data: {
      permissionState: "revoked",
      revokedAt: now,
    },
  });

  const permissionState = isActive ? "granted" : "revoked";

  for (const scope of normalizedScopes) {
    const existing = await tx.platformPermission.findFirst({
      where: {
        userId,
        connectedAccountId,
        platform,
        permissionKey: scope,
      },
    });

    if (existing) {
      await tx.platformPermission.update({
        where: { id: existing.id },
        data: {
          permissionState,
          revokedAt: isActive ? null : now,
          source,
          metadata: "{}",
        },
      });
      continue;
    }

    await tx.platformPermission.create({
      data: {
        userId,
        connectedAccountId,
        platform,
        permissionKey: scope,
        permissionState,
        grantedAt: now,
        revokedAt: isActive ? null : now,
        source,
        metadata: "{}",
      },
    });
  }
}
