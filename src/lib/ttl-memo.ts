import "server-only";

/**
 * In-memory TTL memoization for expensive per-request server work.
 *
 * Unlike `unstable_cache` this keeps live objects (Dates survive), dedupes
 * concurrent callers onto one in-flight promise, and needs no serialization.
 * The trade-off: the cache is per-instance, so cold serverless instances
 * recompute — which is exactly the behavior we want for short-TTL dashboard
 * data that must never be stale for long.
 */
export function memoizeWithTtl<Args extends unknown[], T>(
  load: (...args: Args) => Promise<T>,
  options: { ttlMs: number; key: (...args: Args) => string; maxEntries?: number },
): (...args: Args) => Promise<T> {
  const { ttlMs, key, maxEntries = 500 } = options;
  const cache = new Map<string, { value: Promise<T>; expires: number }>();

  return (...args: Args) => {
    const k = key(...args);
    const now = Date.now();
    const hit = cache.get(k);
    if (hit && hit.expires > now) return hit.value;

    const value = load(...args);
    // A rejected load must not poison the cache window.
    value.catch(() => {
      if (cache.get(k)?.value === value) cache.delete(k);
    });
    cache.delete(k); // re-insert to keep Map order ≈ recency for eviction
    cache.set(k, { value, expires: now + ttlMs });
    if (cache.size > maxEntries) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return value;
  };
}
