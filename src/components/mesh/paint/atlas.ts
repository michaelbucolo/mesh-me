// Sprite atlas: pre-rasterized node visuals (orbs, avatar orbs, platform
// tiles, post cards) blitted per frame instead of re-running gradients,
// shadows, text layout, and clipping every 16ms. Entries are individual
// offscreen canvases keyed `id:contentHash:tier`:
//
//   id          — the node (sprites are never shared across nodes)
//   contentHash — every visual input baked into the pixels (colour, emphasis
//                 bucket, quantized radius/scale, text, counts, image state,
//                 selection…) — when any of them changes the key changes and
//                 the stale sprite simply ages out of the LRU
//   tier        — quality tier (shadows on/off etc. change the pixels)
//
// Bounded by count AND device-pixel bytes; least-recently-blitted sprites are
// evicted first. PRIVACY: the atlas is engine-local (one engine per mounted
// surface), holds only content the model already authorized this viewer to
// see (gated nodes never reach the model, so they can never be rasterized),
// and is dropped whole at unmount — never serialized or shared.

import { LruCache } from "./caches";
import { domSurface, type CreateSurface, type OffscreenSurface } from "./types";

const ATLAS_MAX_SPRITES = 320;
const ATLAS_MAX_BYTES = 32 * 1024 * 1024; // 32 MiB of device pixels

export interface Sprite {
  surface: OffscreenSurface;
  /** Anchor offset inside the sprite, CSS units at raster scale: the node's
   * (x, y) sits at (ax, ay). */
  ax: number;
  ay: number;
  /** CSS-unit size at raster scale (device size = css × dpr). */
  w: number;
  h: number;
}

export class SpriteAtlas {
  private readonly cache: LruCache<Sprite>;
  private readonly createSurface: CreateSurface;
  private dpr = 1;
  /** Rasterizations performed (for telemetry/parity assertions). */
  rasterCount = 0;

  constructor(createSurface: CreateSurface = domSurface) {
    this.createSurface = createSurface;
    this.cache = new LruCache<Sprite>(ATLAS_MAX_SPRITES, ATLAS_MAX_BYTES);
  }

  /** New device-pixel-ratio (tier change / display move): every sprite was
   * rasterized at the old density — drop them all. */
  setDpr(dpr: number): void {
    if (dpr === this.dpr) return;
    this.dpr = dpr;
    this.cache.clear();
  }

  /**
   * The sprite for `key`, rasterizing via `paint` on miss. `paint` receives
   * a context whose origin is the anchor point, at CSS scale — the same
   * coordinate contract as painting the node directly at (0, 0).
   */
  get(
    key: string,
    w: number,
    h: number,
    ax: number,
    ay: number,
    paint: (ctx: CanvasRenderingContext2D) => void,
  ): Sprite | null {
    const hit = this.cache.get(key);
    if (hit) return hit;
    const deviceW = Math.max(1, Math.ceil(w * this.dpr));
    const deviceH = Math.max(1, Math.ceil(h * this.dpr));
    const surface = this.createSurface(deviceW, deviceH);
    if (!surface) return null;
    surface.width = deviceW;
    surface.height = deviceH;
    const ctx = surface.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, ax * this.dpr, ay * this.dpr);
    paint(ctx);
    this.rasterCount += 1;
    const sprite: Sprite = { surface, ax, ay, w, h };
    this.cache.set(key, sprite, deviceW * deviceH * 4);
    return sprite;
  }

  clear(): void {
    this.cache.clear();
  }

  get count(): number {
    return this.cache.count;
  }

  get byteSize(): number {
    return this.cache.byteSize;
  }
}

/** Blit a sprite so the node's anchor lands at (x, y), scaled by `scale`
 * (birth spring, orb pulse, sub-bucket zoom) — one drawImage per node. */
export function blitSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  scale: number,
): void {
  ctx.drawImage(
    sprite.surface as unknown as CanvasImageSource,
    x - sprite.ax * scale,
    y - sprite.ay * scale,
    sprite.w * scale,
    sprite.h * scale,
  );
}

/** Quantize a continuous size onto a geometric ladder (~4% steps) so zoom
 * changes re-rasterize a handful of times, not every frame; the residual is
 * folded into the blit scale (≤ ~2% resample — antialiasing-level). */
export function quantizeScale(value: number): number {
  if (value <= 0) return value;
  const STEP = Math.log(1.04);
  return Math.exp(Math.round(Math.log(value) / STEP) * STEP);
}
