import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";
import {
  buildPresencePayload,
  canViewMeshRoom,
  clampNumber,
  getBlockedUserIds,
  getMutualConnectionIds,
  listPresences,
  normalizePosition,
  normalizeViewportPosition,
  removePresence,
  setPresence,
} from "@/lib/mesh-presence-store";

// Meshi cosmetic values are short style keys; anything longer is clamped so a
// heartbeat can't persist arbitrarily large strings into the presence store.
function cleanStyleValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value.slice(0, 40) : fallback;
}

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
    const body = await readJsonObject(request);
    const { meshiColor, meshiHat, meshiHair, meshiAccessory, meshiEyeStyle, meshiBadge, meshiOutfit, meshiMood, position, viewportPosition, viewingMesh, surface, activePostId, activeNodeId, activeRoute, velocity, activity, ghostMode, action } = body;

    // Tiny world actions broadcast to the room: a Meshi throwing a heart at a
    // post, a reaction burst (star/spark/wow), or a wave hello on arrival.
    // Strictly validated against a fixed kind set and size-capped. `heart`
    // flies at a target node so it requires a targetId; the others are
    // targetless flourishes that spawn at the sender's Meshi.
    const ACTION_KINDS = new Set(["heart", "star", "spark", "wow", "wave"]);
    let lastAction: string | null = null;
    if (action && typeof action === "object") {
      const a = action as Record<string, unknown>;
      if (
        typeof a.type === "string" &&
        ACTION_KINDS.has(a.type) &&
        typeof a.at === "number" &&
        Number.isFinite(a.at)
      ) {
        const targetId = typeof a.targetId === "string" ? a.targetId.slice(0, 160) : "";
        if (a.type !== "heart" || targetId.length > 0) {
          lastAction = `${a.type}|${targetId}|${Math.round(a.at)}`;
        }
      }
    }

    await setPresence({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      meshiColor: cleanStyleValue(meshiColor, "blue"),
      meshiHat: cleanStyleValue(meshiHat, "none"),
      meshiHair: cleanStyleValue(meshiHair, "none"),
      meshiAccessory: cleanStyleValue(meshiAccessory, "none"),
      meshiEyeStyle: cleanStyleValue(meshiEyeStyle, "regular"),
      meshiBadge: cleanStyleValue(meshiBadge, "none"),
      meshiOutfit: cleanStyleValue(meshiOutfit, "none"),
      meshiMood: cleanStyleValue(meshiMood, "happy"),
      position: normalizePosition(position),
      viewportPosition: normalizeViewportPosition(viewportPosition),
      // Normalize own-mesh views to the current user id so all viewers of the same mesh match.
      viewingMesh: (typeof viewingMesh === "string" && viewingMesh.length > 0) ? viewingMesh.slice(0, 160) : user.id,
      surface: surface === "feed" ? "feed" : "mesh",
      activePostId: typeof activePostId === "string" && activePostId.length > 0 ? activePostId.slice(0, 160) : null,
      activeNodeId: typeof activeNodeId === "string" && activeNodeId.length > 0 ? activeNodeId.slice(0, 160) : null,
      activeRoute: typeof activeRoute === "string" && activeRoute.length > 0 ? activeRoute.slice(0, 160) : null,
      velocity: clampNumber(velocity, 0, 0, 1000),
      activity: activity === "traveling" || activity === "exploring" ? activity : "idle",
      ghostMode: ghostMode === true,
      lastAction,
      // Server-authoritative: the gold Pro aura can't be spoofed by clients.
      isPro: Boolean(user.isMeshPro),
      lastSeen: Date.now(),
    });

    // Keep the durable User.lastSeenAt fresh so profiles can show an accurate
    // "last online" for anyone active on the mesh/flow — not just MeChat. The
    // WHERE-clause throttle is stateless (correct across serverless instances)
    // and a no-op on all but ~one heartbeat per minute. Skipped while ghosting;
    // hidden-activity users already early-returned above, so theirs stays frozen.
    if (ghostMode !== true) {
      await prisma.user
        .updateMany({
          where: {
            id: user.id,
            OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: new Date(Date.now() - 60_000) } }],
          },
          data: { lastSeenAt: new Date() },
        })
        .catch(() => {});
    }

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

  const [connectedSet, blockedSet, roomAllowed] = await Promise.all([
    getMutualConnectionIds(user.id),
    getBlockedUserIds(user.id),
    canViewMeshRoom(user.id, meshOwner, user.isAdmin),
  ]);
  // Only honor the requested room if the viewer could actually open that mesh —
  // otherwise it collapses to their own room, so presence can't be used to spy.
  const allowedMeshOwner = roomAllowed ? meshOwner : null;

  const all = await listPresences();
  const payload = buildPresencePayload(all, {
    viewerId: user.id,
    connectedSet,
    blockedSet,
    meshOwner: allowedMeshOwner,
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
