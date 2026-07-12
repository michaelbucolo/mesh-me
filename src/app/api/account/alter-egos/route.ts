import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";
import { validateUrl } from "@/lib/security";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const alterEgos = await prisma.alterEgo.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ alterEgos });
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
  const { username, displayName, bio, avatarUrl } = body;

  if (!username || typeof username !== "string" || username.length < 3) {
    return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
  }
  if (!displayName || typeof displayName !== "string") {
    return NextResponse.json({ error: "Display name required" }, { status: 400 });
  }
  if (displayName.length > 80) {
    return NextResponse.json({ error: "Display name must be 80 characters or fewer" }, { status: 400 });
  }
  if (bio !== undefined && bio !== null && typeof bio !== "string") {
    return NextResponse.json({ error: "Invalid bio" }, { status: 400 });
  }
  if (typeof bio === "string" && bio.length > 500) {
    return NextResponse.json({ error: "Bio must be 500 characters or fewer" }, { status: 400 });
  }
  if (avatarUrl !== undefined && avatarUrl !== null && typeof avatarUrl !== "string") {
    return NextResponse.json({ error: "Invalid avatar URL" }, { status: 400 });
  }
  if (typeof avatarUrl === "string" && avatarUrl.length > 2048) {
    return NextResponse.json({ error: "Avatar URL must be 2048 characters or fewer" }, { status: 400 });
  }
  if (typeof avatarUrl === "string" && avatarUrl && !validateUrl(avatarUrl)) {
    return NextResponse.json({ error: "Avatar URL must use http or https" }, { status: 400 });
  }

  // Check username availability (both User and AlterEgo tables)
  const normalizedUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (normalizedUsername.length < 3) {
    return NextResponse.json({ error: "Username must contain at least 3 alphanumeric characters" }, { status: 400 });
  }
  const existingUser = await prisma.user.findUnique({ where: { username: normalizedUsername } });
  if (existingUser) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }
  const existingAlterEgo = await prisma.alterEgo.findUnique({ where: { username: normalizedUsername } });
  if (existingAlterEgo) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const alterEgo = await prisma.alterEgo.create({
    data: {
      userId: session.userId,
      username: normalizedUsername,
      displayName,
      bio: bio || null,
      avatarUrl: avatarUrl || null,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ alterEgo });
}

export async function DELETE(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Support both query param (?id=xxx) and request body ({ alterEgoId: xxx })
  const url = new URL(req.url);
  let alterEgoId = url.searchParams.get("id");
  if (!alterEgoId) {
    try {
      const body = await req.json();
      alterEgoId = body.alterEgoId;
    } catch {
      // No body provided
    }
  }
  if (!alterEgoId) return NextResponse.json({ error: "alterEgoId required" }, { status: 400 });

  const alterEgo = await prisma.alterEgo.findUnique({ where: { id: alterEgoId } });
  if (!alterEgo || alterEgo.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.alterEgo.delete({ where: { id: alterEgoId } });
  return NextResponse.json({ success: true });
}
