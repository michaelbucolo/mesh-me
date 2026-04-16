import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// In-memory presence store (would be Redis in production)
const presenceStore = new Map<string, {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  meshiColor: string;
  meshiHat: string;
  meshiMood: string;
  position: { x: number; y: number };
  viewingMesh: string | null; // userId of mesh being viewed, null = own mesh
  lastSeen: number;
}>();

// Clean stale entries (older than 30 seconds)
function cleanStale() {
  const now = Date.now();
  for (const [key, entry] of presenceStore) {
    if (now - entry.lastSeen > 30000) {
      presenceStore.delete(key);
    }
  }
}

// POST: Update my presence (heartbeat)
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { meshiColor, meshiHat, meshiMood, position, viewingMesh } = body;

    presenceStore.set(user.id, {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      meshiColor: meshiColor || "blue",
      meshiHat: meshiHat || "none",
      meshiMood: meshiMood || "happy",
      position: position || { x: 0, y: 0 },
      viewingMesh: viewingMesh || null,
      lastSeen: Date.now(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// GET: Get all active presences (optionally filtered by mesh being viewed)
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  cleanStale();

  const { searchParams } = new URL(request.url);
  const meshOwner = searchParams.get("meshOwner"); // filter to users viewing a specific mesh

  const now = Date.now();
  const presences: Array<{
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    meshiColor: string;
    meshiHat: string;
    meshiMood: string;
    position: { x: number; y: number };
    isOnline: boolean;
  }> = [];

  for (const [, entry] of presenceStore) {
    // Don't include the requesting user's own presence
    if (entry.userId === user.id) continue;

    // If filtering by mesh owner, only include users viewing that mesh
    if (meshOwner) {
      if (entry.viewingMesh !== meshOwner) continue;
    } else {
      // On own mesh, show users who are viewing our mesh
      if (entry.viewingMesh !== user.id) continue;
    }

    // Consider online if heartbeat received in last 15 seconds
    const isOnline = (now - entry.lastSeen) < 15000;

    presences.push({
      userId: entry.userId,
      username: entry.username,
      displayName: entry.displayName,
      avatarUrl: entry.avatarUrl,
      meshiColor: entry.meshiColor,
      meshiHat: entry.meshiHat,
      meshiMood: entry.meshiMood,
      position: entry.position,
      isOnline,
    });
  }

  return NextResponse.json({ presences });
}

// DELETE: Remove my presence (leaving mesh)
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  presenceStore.delete(user.id);
  return NextResponse.json({ ok: true });
}
