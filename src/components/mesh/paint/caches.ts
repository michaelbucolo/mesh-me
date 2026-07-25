// Bounded caches for the layered painter.
//
// PRIVACY: every cache built on this machinery is per-engine state — one
// engine per mounted mesh surface, created at mount and disposed at unmount.
// Nothing here is ever serialized, persisted, or shared across viewers or
// sessions; eviction drops the object reference and the GC does the rest.

/** A recency-ordered cache bounded by BOTH entry count and total bytes.
 * Recency rides the Map's insertion order (get re-inserts), so hits cost two
 * Map ops and no allocation. */
export class LruCache<V> {
  private readonly map = new Map<string, { value: V; bytes: number }>();
  private bytes = 0;

  constructor(
    private readonly maxCount: number,
    private readonly maxBytes: number,
    private readonly onEvict?: (key: string, value: V) => void,
  ) {}

  get(key: string): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    // Refresh recency: re-insert at the tail of the Map's iteration order.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  /** Peek without refreshing recency (for stats/tests). */
  has(key: string): boolean {
    return this.map.has(key);
  }

  set(key: string, value: V, bytes: number): void {
    const prev = this.map.get(key);
    if (prev) {
      this.bytes -= prev.bytes;
      this.map.delete(key);
    }
    this.map.set(key, { value, bytes });
    this.bytes += bytes;
    // Evict least-recently-used until back under BOTH ceilings. The entry
    // just written is at the recency tail, so it survives unless it alone
    // exceeds the byte ceiling (in which case the cache simply won't hold it
    // beyond this use — correctness never depends on a cache hit).
    while (this.map.size > 0 && (this.map.size > this.maxCount || this.bytes > this.maxBytes)) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      this.evict(oldest.value);
      if (oldest.value === key) break; // the new entry itself was the excess
    }
  }

  delete(key: string): void {
    if (this.map.has(key)) this.evict(key);
  }

  clear(): void {
    for (const key of Array.from(this.map.keys())) this.evict(key);
  }

  private evict(key: string): void {
    const entry = this.map.get(key);
    if (!entry) return;
    this.map.delete(key);
    this.bytes -= entry.bytes;
    this.onEvict?.(key, entry.value);
  }

  get count(): number {
    return this.map.size;
  }

  get byteSize(): number {
    return this.bytes;
  }
}

// --- Gradient cache --------------------------------------------------------
// CanvasGradient objects are position-bound, so only gradients whose geometry
// repeats across frames are worth caching (the background layer's sky and
// vignette between camera moves). Count-bound: gradients hold no pixel
// memory worth metering.

const GRADIENT_CACHE_MAX = 128;

export class GradientCache {
  private readonly cache = new LruCache<CanvasGradient>(GRADIENT_CACHE_MAX, Number.MAX_SAFE_INTEGER);

  radial(
    ctx: CanvasRenderingContext2D,
    key: string,
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
    stops: readonly (readonly [number, string])[],
  ): CanvasGradient {
    const hit = this.cache.get(key);
    if (hit) return hit;
    const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
    for (const [off, color] of stops) g.addColorStop(off, color);
    this.cache.set(key, g, 0);
    return g;
  }

  linear(
    ctx: CanvasRenderingContext2D,
    key: string,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    stops: readonly (readonly [number, string])[],
  ): CanvasGradient {
    const hit = this.cache.get(key);
    if (hit) return hit;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [off, color] of stops) g.addColorStop(off, color);
    this.cache.set(key, g, 0);
    return g;
  }

  clear(): void {
    this.cache.clear();
  }

  get count(): number {
    return this.cache.count;
  }
}

// --- URL-keyed image cache -------------------------------------------------
// Keyed by URL (the legacy scene keyed by node id and never noticed a changed
// avatar URL); bounded by count AND decoded bytes (w×h×4). Eviction reports
// which node ids were showing that image so the caller can drop its id→image
// entries in the same beat — paint and hit-testing stay in lockstep.

const IMAGE_CACHE_MAX_COUNT = 256;
const IMAGE_CACHE_MAX_BYTES = 64 * 1024 * 1024; // 64 MiB decoded

export class ImageLru {
  private readonly cache: LruCache<HTMLImageElement>;
  /** url → node ids currently displaying it (for eviction fan-out). */
  private readonly urlToIds = new Map<string, Set<string>>();

  constructor(onEvictIds?: (ids: readonly string[]) => void) {
    this.cache = new LruCache<HTMLImageElement>(
      IMAGE_CACHE_MAX_COUNT,
      IMAGE_CACHE_MAX_BYTES,
      (url) => {
        const ids = this.urlToIds.get(url);
        this.urlToIds.delete(url);
        if (ids && ids.size > 0 && onEvictIds) onEvictIds(Array.from(ids));
      },
    );
  }

  /**
   * The image for `url`, loading it if needed. Returns the element once
   * loaded; undefined while in flight (onReady fires when it lands).
   */
  request(url: string, nodeId: string, onReady: (img: HTMLImageElement) => void): HTMLImageElement | undefined {
    let ids = this.urlToIds.get(url);
    if (!ids) {
      ids = new Set();
      this.urlToIds.set(url, ids);
    }
    ids.add(nodeId);
    const hit = this.cache.get(url);
    if (hit) {
      return hit.complete && hit.naturalWidth > 0 ? hit : undefined;
    }
    if (typeof Image === "undefined") return undefined;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Re-set with the real decoded size so the byte ceiling is honest.
      if (this.cache.has(url)) {
        this.cache.set(url, img, img.naturalWidth * img.naturalHeight * 4);
      }
      onReady(img);
    };
    img.src = url;
    // Provisional entry (nominal bytes) so concurrent requests coalesce.
    this.cache.set(url, img, 1024);
    return undefined;
  }

  clear(): void {
    this.cache.clear();
    this.urlToIds.clear();
  }

  get count(): number {
    return this.cache.count;
  }

  get byteSize(): number {
    return this.cache.byteSize;
  }
}
