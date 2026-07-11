import { EventEmitter } from "events";
import { prisma } from "@/lib/prisma";

export type PresenceEntry = {
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
  ghostMode: boolean;
  lastSeen: number;
};

// A Meshi is "online" if a heartbeat arrived within this window.
export const ONLINE_WINDOW_MS = 15000;
// Entries older than this are considered gone and removed.
const STALE_MS = 30000;

// Shared singleton across hot reloads and route modules within a single process.
type PresenceGlobal = {
  store: Map<string, PresenceEntry>;
  emitter: EventEmitter;
};

const globalForPresence = globalThis as unknown as {
  __meshPresence?: PresenceGlobal;
};

const presence: PresenceGlobal =
  globalForPresence.__meshPresence ??
  (globalForPresence.__meshPresence = {
    store: new Map<string, PresenceEntry>(),
    emitter: (() => {
      const e = new EventEmitter();
      e.setMaxListeners(0);
      return e;
    })(),
  });

// Subscribe to local (same-instance) presence changes for instant SSE fanout.
export function subscribePresence(listener: () => void): () => void {
  presence.emitter.on("change", listener);
  return () => {
    presence.emitter.off("change", listener);
  };
}

function emitChange() {
  presence.emitter.emit("change");
}

type PresenceRow = {
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
  posX: number;
  posY: number;
  vx: number;
  vy: number;
  viewingMesh: string;
  surface: string;
  activePostId: string | null;
  activeNodeId: string | null;
  activeRoute: string | null;
  velocity: number;
  activity: string;
  ghostMode: boolean;
  lastSeen: Date;
};

function rowToEntry(row: PresenceRow): PresenceEntry {
  return {
    userId: row.userId,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    meshiColor: row.meshiColor,
    meshiHat: row.meshiHat,
    meshiHair: row.meshiHair,
    meshiAccessory: row.meshiAccessory,
    meshiEyeStyle: row.meshiEyeStyle,
    meshiBadge: row.meshiBadge,
    meshiOutfit: row.meshiOutfit,
    meshiMood: row.meshiMood,
    position: { x: row.posX, y: row.posY },
    viewportPosition: { vx: row.vx, vy: row.vy },
    viewingMesh: row.viewingMesh,
    surface: row.surface === "feed" ? "feed" : "mesh",
    activePostId: row.activePostId,
    activeNodeId: row.activeNodeId,
    activeRoute: row.activeRoute,
    velocity: row.velocity,
    activity:
      row.activity === "traveling" || row.activity === "exploring"
        ? row.activity
        : "idle",
    ghostMode: row.ghostMode,
    lastSeen: row.lastSeen.getTime(),
  };
}

function entryToRow(entry: PresenceEntry) {
  return {
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
    posX: entry.position.x,
    posY: entry.position.y,
    vx: entry.viewportPosition.vx,
    vy: entry.viewportPosition.vy,
    viewingMesh: entry.viewingMesh,
    surface: entry.surface,
    activePostId: entry.activePostId,
    activeNodeId: entry.activeNodeId,
    activeRoute: entry.activeRoute,
    velocity: entry.velocity,
    activity: entry.activity,
    ghostMode: entry.ghostMode,
    lastSeen: new Date(entry.lastSeen),
  };
}

// Write/refresh a user's presence. Updates the in-memory cache and notifies
// local subscribers instantly, then persists to the DB so other serverless
// instances can observe it.
let lastPresenceWriteError = 0;

export async function setPresence(entry: PresenceEntry): Promise<void> {
  presence.store.set(entry.userId, entry);
  emitChange();
  try {
    const row = entryToRow(entry);
    await prisma.meshPresence.upsert({
      where: { userId: entry.userId },
      create: { userId: entry.userId, ...row },
      update: row,
    });
  } catch (error) {
    // Memory cache still serves same-instance viewers, but a failing DB write
    // means presence is invisible across serverless instances — surface it
    // (throttled) so it shows in production logs instead of hiding.
    const now = Date.now();
    if (now - lastPresenceWriteError > 60000) {
      lastPresenceWriteError = now;
      console.error("[presence] DB write failed — cross-instance presence degraded:", error);
    }
  }
}

// Remove a user's presence (leaving the mesh / logout / hidden activity).
export async function removePresence(userId: string): Promise<void> {
  presence.store.delete(userId);
  emitChange();
  try {
    await prisma.meshPresence.deleteMany({ where: { userId } });
  } catch {
    // ignore
  }
}

// Return every fresh presence entry, merging the shared DB (cross-instance) with
// the in-memory cache (same-instance, always fresh). Memory wins on ties so an
// in-flight heartbeat is never dropped. Stale entries are pruned best-effort.
export async function listPresences(): Promise<PresenceEntry[]> {
  const now = Date.now();
  const cutoff = now - STALE_MS;
  const merged = new Map<string, PresenceEntry>();

  try {
    const rows = (await prisma.meshPresence.findMany({
      where: { lastSeen: { gte: new Date(cutoff) } },
    })) as PresenceRow[];
    for (const row of rows) merged.set(row.userId, rowToEntry(row));
    prisma.meshPresence
      .deleteMany({ where: { lastSeen: { lt: new Date(cutoff) } } })
      .catch(() => {});
  } catch {
    // DB unavailable — fall back to memory only.
  }

  for (const [userId, entry] of presence.store) {
    if (entry.lastSeen < cutoff) {
      presence.store.delete(userId);
      continue;
    }
    const existing = merged.get(userId);
    if (!existing || entry.lastSeen >= existing.lastSeen) {
      merged.set(userId, entry);
    }
  }

  return [...merged.values()];
}

export type ViewerContext = {
  viewerId: string;
  connectedSet: Set<string>;
  meshOwner: string | null;
  surface: string | null;
  activePostId: string | null;
};

export type PresencePayload = {
  presences: Array<Omit<PresenceEntry, "lastSeen"> & { isOnline: boolean }>;
  summary: {
    totalOnline: number;
    sameMeshOnline: number;
    connectedOnline: number;
  };
};

// Filter the full presence list down to what a given viewer is allowed to see,
// applying the same visibility rules used by the REST and streaming endpoints.
export function buildPresencePayload(
  all: PresenceEntry[],
  ctx: ViewerContext,
): PresencePayload {
  const { viewerId, connectedSet, meshOwner, surface, activePostId } = ctx;
  // Access to view a mesh is enforced by the mesh page itself; presence just
  // reports who's in the same room. Trust the requested mesh owner.
  const allowedMeshOwner = meshOwner || viewerId;

  const now = Date.now();
  let totalOnline = 0;
  let sameMeshOnline = 0;
  let connectedOnline = 0;
  const presences: PresencePayload["presences"] = [];

  for (const entry of all) {
    if (entry.userId === viewerId) continue;

    const isViewingOurMesh = entry.viewingMesh === viewerId;
    // Everyone looking at the same mesh sees each other — being in the same
    // room shouldn't require a mutual follow (ghost mode still hides you).
    const isViewingSameMesh = entry.viewingMesh === allowedMeshOwner;
    const isConnectedAndOnline = connectedSet.has(entry.userId);
    const isSameActivePost = Boolean(
      activePostId &&
        entry.activePostId === activePostId &&
        connectedSet.has(entry.userId),
    );
    const isSameFeedPost = surface === "feed" && isSameActivePost;
    const isSameMeshContent = surface === "mesh" && isSameActivePost;

    if (entry.ghostMode) continue;
    if (!isViewingOurMesh && !isViewingSameMesh && !isSameFeedPost && !isSameMeshContent)
      continue;
    if (surface === "feed" && activePostId && !isSameFeedPost) continue;
    if (
      surface === "mesh" &&
      activePostId &&
      !isViewingOurMesh &&
      !isViewingSameMesh &&
      !isSameMeshContent
    )
      continue;

    const isOnline = now - entry.lastSeen < ONLINE_WINDOW_MS;
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
      ghostMode: entry.ghostMode,
      isOnline,
    });
  }

  return {
    presences,
    summary: { totalOnline, sameMeshOnline, connectedOnline },
  };
}

export async function getMutualConnectionIds(userId: string): Promise<Set<string>> {
  const [following, followers] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    }),
    prisma.follow.findMany({
      where: { followingId: userId },
      select: { followerId: true },
    }),
  ]);
  const followerIds = new Set(followers.map((f) => f.followerId));
  return new Set(
    following.map((f) => f.followingId).filter((id) => followerIds.has(id)),
  );
}

export function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function normalizePosition(value: unknown): { x: number; y: number } {
  const position =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    x: clampNumber(position.x, 0, -10000, 10000),
    y: clampNumber(position.y, 0, -10000, 10000),
  };
}

export function normalizeViewportPosition(value: unknown): { vx: number; vy: number } {
  const position =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    vx: clampNumber(position.vx, 0.5, 0, 1),
    vy: clampNumber(position.vy, 0.5, 0, 1),
  };
}
