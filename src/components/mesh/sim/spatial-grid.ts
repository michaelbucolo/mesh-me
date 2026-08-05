// A tiny uniform spatial hash over node positions, rebuilt once per frame and
// queried by radius-bounded passes (strand routing) so per-strand work is
// O(k) neighbours instead of O(N) all-nodes. Cell size equals the query
// radius, so a 3×3 cell neighbourhood provably covers every point within
// that radius — the grid returns a SUPERSET of the true neighbours and the
// caller's own distance check stays the authority, meaning results are
// identical to the brute-force scan it replaces.
//
// Reused across frames: `rebuild` recycles the bucket arrays it allocated
// before (truncating, not reallocating), so a settled scene rebuilds the
// grid with zero per-frame allocation.

export interface GridPoint {
  id: string;
  dx: number;
  dy: number;
}

export class SpatialGrid<T extends GridPoint> {
  private readonly cellSize: number;
  private readonly buckets = new Map<number, T[]>();
  /** Scratch output reused by queryInto so queries allocate nothing. */
  private readonly scratch: T[] = [];

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  private cellKey(cx: number, cy: number): number {
    // Pack two small signed cell coords into one number key (no string alloc).
    return (cx + 0x8000) * 0x10000 + (cy + 0x8000);
  }

  rebuild(points: Iterable<T>): void {
    this.buckets.forEach((bucket) => {
      bucket.length = 0;
    });
    for (const p of points) {
      const cx = Math.floor(p.dx / this.cellSize);
      const cy = Math.floor(p.dy / this.cellSize);
      const key = this.cellKey(cx, cy);
      let bucket = this.buckets.get(key);
      if (!bucket) {
        bucket = [];
        this.buckets.set(key, bucket);
      }
      bucket.push(p);
    }
  }

  /**
   * All points within `cellSize` of (x, y) — as a superset (the 3×3 cell
   * neighbourhood). The returned array is internal scratch, valid until the
   * next query: read it immediately, never hold it.
   */
  near(x: number, y: number): readonly T[] {
    const out = this.scratch;
    out.length = 0;
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    for (let gx = cx - 1; gx <= cx + 1; gx += 1) {
      for (let gy = cy - 1; gy <= cy + 1; gy += 1) {
        const bucket = this.buckets.get(this.cellKey(gx, gy));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i += 1) out.push(bucket[i]);
      }
    }
    return out;
  }
}
