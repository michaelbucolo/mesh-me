// One cached lookup for "what does this user's Meshi look like?" — shared by
// the typing route (typing indicator), the thread route (read receipts) and
// the viewing-presence heartbeat, so every MeChat surface that draws someone
// AS their Meshi resolves the same customization the same way. 60s TTL on a
// process-global map: presence endpoints are polled every few seconds by every
// open thread, and a per-poll preference query would be pure amplification.

import { getUserMeshiPreference } from "@/lib/actions";
import type { TypingMeshi } from "@/lib/mechat-presence";

type MeshiCacheGlobal = typeof globalThis & {
  __meshTypingMeshiCache?: Map<string, { meshi: TypingMeshi | null; expiresAt: number }>;
};

const MESHI_CACHE_TTL_MS = 60_000;

export async function getCachedMeshiFor(userId: string): Promise<TypingMeshi | null> {
  const globalRef = globalThis as MeshiCacheGlobal;
  if (!globalRef.__meshTypingMeshiCache) {
    globalRef.__meshTypingMeshiCache = new Map();
  }
  const cache = globalRef.__meshTypingMeshiCache;
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.meshi;
  }

  const pref = await getUserMeshiPreference(userId);
  const meshi: TypingMeshi | null = pref
    ? {
        color: pref.colorTheme,
        hat: pref.hatStyle,
        hair: pref.hairStyle,
        accessory: pref.accessoryStyle,
        eyeStyle: pref.eyeStyle,
        badge: pref.badgeStyle,
        outfit: pref.outfitStyle,
      }
    : null;
  // Opportunistically evict expired entries (this runs only on a cache miss, so
  // at most once per user per TTL) — otherwise the process-global map grows one
  // permanent entry per distinct user forever.
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  cache.set(userId, { meshi, expiresAt: now + MESHI_CACHE_TTL_MS });
  return meshi;
}
