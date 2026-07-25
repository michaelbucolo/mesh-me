import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";
import { normalizeScopes, syncConnectedAccountPermissions } from "@/lib/platform-permissions";
import { getDefaultPermissionKeysForPlatform } from "@/lib/platform-adapters";
import { clearMeshCache } from "@/lib/mesh-cache";
import { disconnectConnectedAccount } from "@/lib/connected-account-deletion";

// PATCH — update alter ego association or label
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

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
    if (body.accountLabel !== null && typeof body.accountLabel !== "string") {
      return NextResponse.json({ error: "Invalid accountLabel payload" }, { status: 400 });
    }
    if (typeof body.accountLabel === "string" && body.accountLabel.length > 100) {
      return NextResponse.json({ error: "Account label must be 100 characters or fewer" }, { status: 400 });
    }
    updateData.accountLabel = body.accountLabel || null;
  }

  if ("scopes" in body) {
    if (body.scopes === null) {
      updateData.scopes = null;
    } else if (typeof body.scopes === "string") {
      if (body.scopes.length > 2000) {
        return NextResponse.json({ error: "Scopes must be 2000 characters or fewer" }, { status: 400 });
      }
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
    select: {
      id: true,
      platform: true,
      platformUsername: true,
      isActive: true,
      syncStatus: true,
      syncError: true,
      lastSyncAt: true,
      scopes: true,
      alterEgoId: true,
      accountLabel: true,
      updatedAt: true,
    },
  });

  if ("scopes" in body || "isActive" in body) {
    const scopes = normalizeScopes(updated.scopes);
    const permissionKeys = scopes.length > 0 ? scopes : getDefaultPermissionKeysForPlatform(updated.platform);
    await prisma.$transaction(async (tx) => {
      await syncConnectedAccountPermissions(tx, {
        userId: user.id,
        connectedAccountId: id,
        platform: updated.platform,
        scopes: permissionKeys,
        isActive: updated.isActive,
        source: scopes.length > 0 ? "oauth_scope" : "manual_connection",
      });
    });
  }

  clearMeshCache(user.id);
  return NextResponse.json({ account: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

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

  // The one disconnect path, shared with Meta's deauthorize / data-deletion
  // callbacks: revoke, tear down, clear cache.
  //
  // This route used to inline the revoke, and its `decryptSecret` call was NOT
  // wrapped — so a malformed token, or any token written before an encryption
  // key rotation, threw and became a 500 BEFORE the teardown ran. The user
  // could not disconnect, and the account plus its mirrored DMs stayed in the
  // database, permanently and silently. The shared function has always guarded
  // that; only this copy did not.
  await disconnectConnectedAccount(id, user.id, account.platform, account.accessToken);

  return NextResponse.json({ success: true });
}
