import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/request-guard";
import {
  buildPresencePayload,
  clampNumber,
  getMutualConnectionIds,
  listPresences,
  normalizePosition,
  normalizeViewportPosition,
  removePresence,
  setPresence,
} from "@/lib/mesh-presence-store";

// POST: Update my presence (heartbeat)
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.hideActivityStatus) {
    await removePresence(user.id);
    return NextResponse.json({ ok: true, hidden: true });
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { meshiColor, meshiHat, meshiHair, meshiAccessory, meshiEyeStyle, meshiBadge, meshiOutfit, meshiMood, position, viewportPosition, viewingMesh, surface, activePostId, activeNodeId, activeRoute, velocity, activity, ghostMode, action } = body;

    // Tiny world actions broadcast to the room — currently just a Meshi
    // throwing a heart at a post. Strictly validated and size-capped.
    let lastAction: string | null = null;
    if (action && typeof action === "object") {
      const a = action as Record<string, unknown>;
      if (
        a.type === "heart" &&
        typeof a.targetId === "string" &&
        a.targetId.length > 0 &&
        typeof a.at === "number" &&
        Number.isFinite(a.at)
      ) {
        lastAction = `heart|${a.targetId.slice(0, 160)}|${Math.round(a.at)}`;
      }
    }

    await setPresence({
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
      ghostMode: ghostMode === true,
      lastAction,
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

  const { searchParams } = new URL(request.url);
  const meshOwner = searchParams.get("meshOwner"); // filter to users viewing a specific mesh owner id
  const surface = searchParams.get("surface");
  const activePostId = searchParams.get("activePostId");
  const connectedSet = await getMutualConnectionIds(user.id);

  const all = await listPresences();
  const payload = buildPresencePayload(all, {
    viewerId: user.id,
    connectedSet,
    meshOwner,
    surface,
    activePostId,
  });

  return NextResponse.json(payload);
}

// DELETE: Remove my presence (leaving mesh)
export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await removePresence(user.id);
  return NextResponse.json({ ok: true });
}
