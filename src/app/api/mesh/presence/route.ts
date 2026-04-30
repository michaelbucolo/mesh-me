import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/request-guard";
import { prisma } from "@/lib/prisma";

// In-memory presence store (would be Redis in production)
const presenceStore = new Map<string, {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  meshiColor: string;
  meshiHat: string;
  meshiHair: string;
  meshiAccessory: string;
  meshiEyeStyle: string;
  meshiBadge: string;
  meshiOutfit: string;
  meshiMood: string;
  position: { x: number; y: number };
  // Viewport-relative position (0-1 range) for where Meshi sits on the user's screen.
  viewportPosition: { vx: number; vy: number };
  viewingMesh: string; // userId of mesh being viewed (always normalized)
  surface: "mesh" | "feed";
  activePostId: string | null;
  activeNodeId: string | null;
  activeRoute: string | null;
  velocity: number;
  activity: "idle" | "traveling" | "exploring";
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

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalizePosition(value: unknown) {
  const position = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    x: clampNumber(position.x, 0, -10000, 10000),
    y: clampNumber(position.y, 0, -10000, 10000),
  };
}

function normalizeViewportPosition(value: unknown) {
  const position = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    vx: clampNumber(position.vx, 0.5, 0, 1),
    vy: clampNumber(position.vy, 0.5, 0, 1),
  };
}

async function getMutualConnectionIds(userId: string) {
  const [following, followers] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
    prisma.follow.findMany({ where: { followingId: userId }, select: { followerId: true } }),
  ]);
  const followerIds = new Set(followers.map((f) => f.followerId));
  return new Set(following.map((f) => f.followingId).filter((id) => followerIds.has(id)));
}

// POST: Update my presence (heartbeat)
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.hideActivityStatus) {
    presenceStore.delete(user.id);
    return NextResponse.json({ ok: true, hidden: true });
  }

  try {
    const body = await request.json();
    const { meshiColor, meshiHat, meshiHair, meshiAccessory, meshiEyeStyle, meshiBadge, meshiOutfit, meshiMood, position, viewportPosition, viewingMesh, surface, activePostId, activeNodeId, activeRoute, velocity, activity } = body;

    presenceStore.set(user.id, {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      meshiColor: meshiColor || "blue",
      meshiHat: meshiHat || "none",
      meshiHair: meshiHair || "none",
      meshiAccessory: meshiAccessory || "none",
      meshiEyeStyle: meshiEyeStyle || "regular",
      meshiBadge: meshiBadge || "none",
      meshiOutfit: meshiOutfit || "none",
      meshiMood: meshiMood || "happy",
      position: normalizePosition(position),
      viewportPosition: normalizeViewportPosition(viewportPosition),
      // Normalize own-mesh views to the current user id so all viewers of the same mesh match.
      viewingMesh: (typeof viewingMesh === "string" && viewingMesh.length > 0) ? viewingMesh : user.id,
      surface: surface === "feed" ? "feed" : "mesh",
      activePostId: typeof activePostId === "string" && activePostId.length > 0 ? activePostId.slice(0, 160) : null,
      activeNodeId: typeof activeNodeId === "string" && activeNodeId.length > 0 ? activeNodeId.slice(0, 160) : null,
      activeRoute: typeof activeRoute === "string" && activeRoute.length > 0 ? activeRoute.slice(0, 160) : null,
      velocity: clampNumber(velocity, 0, 0, 1000),
      activity: activity === "traveling" || activity === "exploring" ? activity : "idle",
      lastSeen: Date.now(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// GET: Get active connected-user presences.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  cleanStale();

  const { searchParams } = new URL(request.url);
  const meshOwner = searchParams.get("meshOwner"); // filter to users viewing a specific mesh owner id
  const surface = searchParams.get("surface");
  const activePostId = searchParams.get("activePostId");
  const connectedSet = await getMutualConnectionIds(user.id);
  const allowedMeshOwner = meshOwner && (meshOwner === user.id || connectedSet.has(meshOwner)) ? meshOwner : user.id;

  const now = Date.now();
  let totalOnline = 0;
  let sameMeshOnline = 0;
  let connectedOnline = 0;
  const presences: Array<{
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    meshiColor: string;
    meshiHat: string;
    meshiHair: string;
    meshiAccessory: string;
    meshiEyeStyle: string;
    meshiBadge: string;
    meshiOutfit: string;
    meshiMood: string;
    position: { x: number; y: number };
    viewportPosition: { vx: number; vy: number };
    surface: "mesh" | "feed";
    activePostId: string | null;
    activeNodeId: string | null;
    viewingMesh: string;
    activeRoute: string | null;
    velocity: number;
    activity: "idle" | "traveling" | "exploring";
    isOnline: boolean;
  }> = [];

  for (const [, entry] of presenceStore) {
    // Don't include the requesting user's own presence
    if (entry.userId === user.id) continue;

    // Include if: viewing our mesh, viewing the same mesh we are, OR is a connected user who is online anywhere
    const isViewingOurMesh = entry.viewingMesh === user.id;
    const isViewingSameMesh = entry.viewingMesh === allowedMeshOwner && connectedSet.has(entry.userId);
    const isConnectedAndOnline = connectedSet.has(entry.userId);
    const isSameActivePost = Boolean(activePostId && entry.activePostId === activePostId && connectedSet.has(entry.userId));
    const isSameFeedPost = surface === "feed" && isSameActivePost;
    const isSameMeshContent = surface === "mesh" && isSameActivePost;

    if (!isViewingOurMesh && !isViewingSameMesh && !isSameFeedPost && !isSameMeshContent) continue;
    if (surface === "feed" && activePostId && !isSameFeedPost) continue;
    if (surface === "mesh" && activePostId && !isViewingOurMesh && !isViewingSameMesh && !isSameMeshContent) continue;

    // Consider online if heartbeat received in last 15 seconds
    const isOnline = (now - entry.lastSeen) < 15000;
    if (isOnline) totalOnline += 1;
    if (isOnline && isViewingSameMesh) sameMeshOnline += 1;
    if (isOnline && isConnectedAndOnline) connectedOnline += 1;

    presences.push({
      userId: entry.userId,
      username: entry.username,
      displayName: entry.displayName,
      avatarUrl: entry.avatarUrl,
      meshiColor: entry.meshiColor,
      meshiHat: entry.meshiHat,
      meshiHair: entry.meshiHair,
      meshiAccessory: entry.meshiAccessory,
      meshiEyeStyle: entry.meshiEyeStyle,
      meshiBadge: entry.meshiBadge,
      meshiOutfit: entry.meshiOutfit,
      meshiMood: entry.meshiMood,
      position: entry.position,
      viewportPosition: entry.viewportPosition,
      surface: entry.surface,
      activePostId: entry.activePostId,
      activeNodeId: entry.activeNodeId,
      viewingMesh: entry.viewingMesh,
      activeRoute: entry.activeRoute,
      velocity: entry.velocity,
      activity: entry.activity,
      isOnline,
    });
  }

  return NextResponse.json({
    presences,
    summary: {
      totalOnline,
      sameMeshOnline,
      connectedOnline,
    },
  });
}

// DELETE: Remove my presence (leaving mesh)
export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  presenceStore.delete(user.id);
  return NextResponse.json({ ok: true });
}
