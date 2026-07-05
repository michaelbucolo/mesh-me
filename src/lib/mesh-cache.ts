const MESH_CACHE_TTL_MS = 45_000;
const MESH_CACHE_MAX_ENTRIES = 500;

type MeshCacheEntry = {
  expiresAt: number;
  payload: unknown;
};

const meshCache = new Map<string, MeshCacheEntry>();

export function getMeshCache(userId: string): unknown | undefined {
  const entry = meshCache.get(userId);
  if (!entry) return undefined;

  if (entry.expiresAt <= Date.now()) {
    meshCache.delete(userId);
    return undefined;
  }

  meshCache.delete(userId);
  meshCache.set(userId, entry);
  return entry.payload;
}

export function setMeshCache(userId: string, payload: unknown) {
  meshCache.delete(userId);
  if (meshCache.size >= MESH_CACHE_MAX_ENTRIES) {
    const oldest = meshCache.keys().next().value;
    if (oldest !== undefined) {
      meshCache.delete(oldest);
    }
  }

  meshCache.set(userId, {
    expiresAt: Date.now() + MESH_CACHE_TTL_MS,
    payload,
  });
}

export function clearMeshCache(userId: string) {
  meshCache.delete(userId);
}
