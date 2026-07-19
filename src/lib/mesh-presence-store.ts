import { EventEmitter } from "events";
import { prisma } from "@/lib/prisma";
import {
  areMutualFollowers,
  canViewMesh,
  normalizeMeshVisibility,
} from "@/lib/privacy-policy";

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
  /**
   * Most recent tiny world action, encoded "type|targetId|atMs" (e.g. a Meshi
   * throwing a heart at a post: "heart|post:abc|1784..."). Room viewers replay
   * it once, deduped by the timestamp.
   */
  lastAction: string | null;
  /** Mesh Pro member — their Meshi carries a gold aura in the room. */
  isPro: boolean;
  lastSeen: number;
};

// A Meshi is "online" if a heartbeat arrived within this window.
const ONLINE_WINDOW_MS = 15000;
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
  lastAction: string | null;
  isPro: boolean;
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
    lastAction: row.lastAction,
    isPro: row.isPro,
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
    lastAction: entry.lastAction,
    isPro: entry.isPro,
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

// Cross-instance presence lives in the DB, but every open SSE stream polls it
// several times a second (the stream ticks each 400ms). Cache the DB read
// per-instance for a short window and de-dupe concurrent reads into one query,
// so N viewers cost ~2.5 queries/sec TOTAL instead of 2.5×N. The in-memory
// store (same-instance, always fresh) is merged on top after the cache, so a
// viewer's own heartbeats are never delayed by it.
const DB_CACHE_TTL_MS = 250;
const PRUNE_INTERVAL_MS = 10000;
let dbCache: { at: number; entries: PresenceEntry[] } | null = null;
let dbInFlight: Promise<PresenceEntry[]> | null = null;
let lastPruneAt = 0;

async function fetchDbPresences(): Promise<PresenceEntry[]> {
  if (dbCache && Date.now() - dbCache.at < DB_CACHE_TTL_MS) return dbCache.entries;
  if (dbInFlight) return dbInFlight;
  dbInFlight = (async () => {
    const cutoff = Date.now() - STALE_MS;
    try {
      const rows = (await prisma.meshPresence.findMany({
        where: { lastSeen: { gte: new Date(cutoff) } },
      })) as PresenceRow[];
      const entries = rows.map(rowToEntry);
      dbCache = { at: Date.now(), entries };
      // Prune stale rows on a slow cadence rather than on every read.
      if (Date.now() - lastPruneAt > PRUNE_INTERVAL_MS) {
        lastPruneAt = Date.now();
        prisma.meshPresence
          .deleteMany({ where: { lastSeen: { lt: new Date(cutoff) } } })
          .catch(() => {});
      }
      return entries;
    } catch {
      // DB unavailable — reuse the last snapshot (or nothing) and keep serving.
      return dbCache?.entries ?? [];
    } finally {
      dbInFlight = null;
    }
  })();
  return dbInFlight;
}

// Return every fresh presence entry, merging the shared DB (cross-instance,
// short-cached) with the in-memory cache (same-instance, always fresh). Memory
// wins on ties so an in-flight heartbeat is never dropped.
export async function listPresences(): Promise<PresenceEntry[]> {
  const now = Date.now();
  const cutoff = now - STALE_MS;
  const merged = new Map<string, PresenceEntry>();

  const dbEntries = await fetchDbPresences();
  for (const entry of dbEntries) merged.set(entry.userId, entry);

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
  /**
   * Users the viewer has blocked, plus users who blocked the viewer. Their
   * presence is never reported to this viewer in either direction. Callers
   * populate this from {@link getBlockedUserIds}.
   */
  blockedSet?: Set<string>;
  /**
   * The mesh room to report on — MUST already be authorized by the caller
   * (see {@link canViewMeshRoom}). A `meshOwner` the viewer can't actually
   * open must be passed as `null`, or this leaks who is inside a private mesh.
   */
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
  const { viewerId, connectedSet, blockedSet, meshOwner, surface, activePostId } = ctx;
  // `meshOwner` is authorized by the caller (canViewMeshRoom) before it reaches
  // here — an unauthorized room arrives as null and collapses to the viewer's
  // own room, so no one can spy on a mesh they can't open.
  const allowedMeshOwner = meshOwner || viewerId;

  const now = Date.now();
  let totalOnline = 0;
  let sameMeshOnline = 0;
  let connectedOnline = 0;
  const presences: PresencePayload["presences"] = [];

  for (const entry of all) {
    if (entry.userId === viewerId) continue;
    // A block is mutually invisible — never surface a blocked party's Meshi,
    // whichever direction the block runs.
    if (blockedSet?.has(entry.userId)) continue;

    const isViewingOurMesh = entry.viewingMesh === viewerId;
    // Everyone looking at the same mesh sees each other — being in the same
    // room shouldn't require a mutual follow (ghost mode still hides you).
    const isViewingSameMesh = entry.viewingMesh === allowedMeshOwner;
    const isConnectedAndOnline = connectedSet.has(entry.userId);
    // Connections who are online anywhere on mesh.me stay visible too, so
    // your mesh can show your people as alive even when they're not in the
    // same room (their Meshi perches on their node in your web).
    const isConnectedOnlineAnywhere =
      isConnectedAndOnline && now - entry.lastSeen < ONLINE_WINDOW_MS;
    const isSameActivePost = Boolean(
      activePostId &&
        entry.activePostId === activePostId &&
        connectedSet.has(entry.userId),
    );
    const isSameFeedPost = surface === "feed" && isSameActivePost;
    const isSameMeshContent = surface === "mesh" && isSameActivePost;

    if (entry.ghostMode) continue;
    if (
      !isViewingOurMesh &&
      !isViewingSameMesh &&
      !isSameFeedPost &&
      !isSameMeshContent &&
      !isConnectedOnlineAnywhere
    )
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
      lastAction: entry.lastAction,
      isPro: entry.isPro,
      isOnline,
    });
  }

  return {
    presences,
    summary: { totalOnline, sameMeshOnline, connectedOnline },
  };
}

// Is this user visibly live on mesh.me right now? (Fresh heartbeat, not
// ghosting.) Powers profile badges and any other "live" affordance.
export async function isUserLiveNow(userId: string): Promise<boolean> {
  const now = Date.now();

  // Single-row lookup instead of listing every online user platform-wide.
  // Same merge rule as listPresences: the fresher entry wins, memory on ties.
  let dbEntry: PresenceEntry | null = null;
  try {
    const row = (await prisma.meshPresence.findUnique({
      where: { userId },
    })) as PresenceRow | null;
    if (row) dbEntry = rowToEntry(row);
  } catch {
    // DB unavailable — fall back to memory only.
  }

  const memEntry = presence.store.get(userId) ?? null;
  const entry =
    memEntry && (!dbEntry || memEntry.lastSeen >= dbEntry.lastSeen) ? memEntry : dbEntry;

  return Boolean(entry && !entry.ghostMode && now - entry.lastSeen < ONLINE_WINDOW_MS);
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

// Everyone the viewer has blocked, unioned with everyone who has blocked the
// viewer. Presence must never cross a block in either direction, so callers pass
// this to buildPresencePayload to hard-filter those Meshis out.
export async function getBlockedUserIds(userId: string): Promise<Set<string>> {
  const [blocking, blockedBy] = await Promise.all([
    prisma.block.findMany({ where: { blockerId: userId }, select: { blockedId: true } }),
    prisma.block.findMany({ where: { blockedId: userId }, select: { blockerId: true } }),
  ]);
  const ids = new Set<string>();
  for (const b of blocking) ids.add(b.blockedId);
  for (const b of blockedBy) ids.add(b.blockerId);
  return ids;
}

// Is `viewerId` allowed to see the presence room for `meshOwnerId`? This mirrors
// the exact gate the mesh data API applies (canViewMesh with the owner's mesh
// visibility), so presence can't be used to watch who is inside a mesh the viewer
// could never open — the room param must pass through here before it's trusted.
export async function canViewMeshRoom(
  viewerId: string,
  meshOwnerId: string | null,
): Promise<boolean> {
  if (!meshOwnerId || meshOwnerId === viewerId) return true;
  const [target, isFriend] = await Promise.all([
    prisma.user.findUnique({
      where: { id: meshOwnerId },
      select: {
        id: true,
        isPublic: true,
        isSuspended: true,
        meshPrivacy: { select: { meshVisibility: true } },
      },
    }),
    areMutualFollowers(viewerId, meshOwnerId),
  ]);
  if (!target) return false;
  if (target.isSuspended && target.id !== viewerId) return false;
  const visibility = normalizeMeshVisibility(
    target.meshPrivacy?.meshVisibility,
    target.isPublic ? "public" : "private",
  );
  return canViewMesh({ id: viewerId }, meshOwnerId, visibility, isFriend);
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
