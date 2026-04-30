import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security";
import { isSameOriginRequest } from "@/lib/request-guard";
import { readJsonObject } from "@/lib/api-validation";
import { getConnectedAccountsDashboard } from "@/lib/connected-accounts";
import { getDefaultPermissionKeysForPlatform, getSupportedPlatformAdapter } from "@/lib/platform-adapters";
import { normalizePlatformId } from "@/lib/platform-capabilities";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json(
    await getConnectedAccountsDashboard(user.id),
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rl = rateLimit(`connect-manual:${user.id}`, 10, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many connection attempts. Please try again later." }, { status: 429 });
  }

  const body = await readJsonObject(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const platform = typeof body.platform === "string" ? normalizePlatformId(body.platform) : "";
  if (!platform) {
    return NextResponse.json({ error: "Platform is required" }, { status: 400 });
  }

  const adapter = getSupportedPlatformAdapter(platform);
  if (!adapter) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  if (adapter.authType !== "manual") {
    return NextResponse.json({ error: "This platform must be connected via OAuth" }, { status: 400 });
  }

  const trimmedUsername = typeof body.username === "string" ? body.username.trim() : "";
  if (!trimmedUsername) {
    return NextResponse.json({ error: "Username is required for this platform" }, { status: 400 });
  }

  const trimmedAccountLabel = typeof body.accountLabel === "string" ? body.accountLabel.trim() : "";
  const alterEgoId = typeof body.alterEgoId === "string" ? body.alterEgoId : "";

  // Validate alter ego belongs to this user if provided
  if (alterEgoId) {
    const alterEgo = await prisma.alterEgo.findFirst({
      where: { id: alterEgoId, userId: user.id, isActive: true },
    });
    if (!alterEgo) {
      return NextResponse.json({ error: "Alter ego not found" }, { status: 400 });
    }
  }

  // Check if this exact username is already connected on this platform
  const existing = await prisma.connectedAccount.findFirst({
    where: { userId: user.id, platform, platformUsername: trimmedUsername },
  });

  if (existing) {
    return NextResponse.json({ error: "This account is already connected" }, { status: 400 });
  }

  // Create the connection with optional alter ego association
  const permissionKeys = getDefaultPermissionKeysForPlatform(platform);
  const account = await prisma.$transaction(async (tx) => {
    const created = await tx.connectedAccount.create({
      data: {
        userId: user.id,
        platform,
        platformUsername: trimmedUsername,
        isActive: true,
        alterEgoId: alterEgoId || null,
        accountLabel: trimmedAccountLabel || null,
      },
      select: {
        id: true,
        platform: true,
        platformUsername: true,
        isActive: true,
        alterEgoId: true,
        accountLabel: true,
        createdAt: true,
      },
    });

    for (const permissionKey of permissionKeys) {
      await tx.platformPermission.create({
        data: {
          userId: user.id,
          connectedAccountId: created.id,
          platform,
          permissionKey,
          permissionState: "granted",
          source: "manual_connection",
          metadata: "{}",
        },
      });
    }

    return created;
  });

  return NextResponse.json({ account, dashboard: await getConnectedAccountsDashboard(user.id) });
}
