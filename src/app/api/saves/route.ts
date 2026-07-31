import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";

// One saved list that spans platforms. Native mesh posts save through
// toggleSavePost (a real FK — the post lives here); everything else in the
// Flow saves through this route as a snapshot, because the supply rows
// behind external content are pruned on retention schedules and a bookmark
// must outlive the cache that fed it.

function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function cleanHttpUrl(value: unknown, max: number): string | null {
  const candidate = cleanString(value, max);
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return candidate;
  } catch {
    return null;
  }
}

// GET — everything this user has saved from the Flow, newest first.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const items = await prisma.savedFlowItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      refId: true,
      platform: true,
      title: true,
      url: true,
      thumbnailUrl: true,
      authorName: true,
      postType: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ items });
}

// POST — toggle. Saving sends the snapshot; unsaving needs only the refId.
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await readJsonObject(request);
  const refId = cleanString(body.refId, 200);
  if (!refId) return NextResponse.json({ error: "Invalid item" }, { status: 400 });

  const existing = await prisma.savedFlowItem.findUnique({
    where: { userId_refId: { userId: user.id, refId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.savedFlowItem.delete({ where: { id: existing.id } });
    return NextResponse.json({ saved: false });
  }

  await prisma.savedFlowItem.create({
    data: {
      userId: user.id,
      refId,
      platform: cleanString(body.platform, 40),
      title: cleanString(body.title, 300),
      url: cleanHttpUrl(body.url, 1024),
      thumbnailUrl: cleanHttpUrl(body.thumbnailUrl, 1024),
      authorName: cleanString(body.authorName, 120),
      postType: cleanString(body.postType, 40),
    },
  });
  return NextResponse.json({ saved: true });
}
