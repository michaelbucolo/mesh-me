// The sky — deep-space gradient, drifting nebulae, parallax stars, focal
// vignette — rendered to an offscreen layer and BLITTED per frame instead of
// re-painted (the single biggest per-frame win on old phones: ~3ms/frame of
// gradient fills becomes one opaque drawImage).
//
// The layer repaints only when its inputs actually moved: resize, atmosphere
// (theme) change, star field regeneration, camera pan, or — for the twinkle
// and nebula drift — when the cached pixels grow older than the tier's
// backgroundRefreshMs (Infinity at T2: a static sky). Every repaint uses the
// CURRENT time and pan, so any single frame's output is exactly what the
// legacy painter would draw for the same inputs; staleness between repaints
// is bounded and sub-perceptual (twinkle period ~5s vs ≤400ms staleness).

import type { Camera } from "../core/camera";
import { GradientCache } from "./caches";
import { atmosphereOf, NEBULA_FIELD, withAlpha } from "./shared";
import { domSurface, type CreateSurface, type OffscreenSurface } from "./types";

export interface BackgroundInputs {
  width: number;
  height: number;
  time: number;
  camera: Camera;
  atmosphere?: string | null;
  stars: { x: number; y: number; r: number; tw: number }[];
}

/** Paint the sky exactly as the legacy painter does — shared by the direct
 * (parity) path and the offscreen layer's repaint. Ported VERBATIM from
 * scene/scene-render.ts drawScene's background section. */
export function paintSky(
  ctx: CanvasRenderingContext2D,
  o: BackgroundInputs,
  gradients?: GradientCache,
): void {
  const { width, height, time } = o;
  const atmo = atmosphereOf(o.atmosphere);
  const gcx = width / 2 + o.camera.panX;
  const gcy = height / 2 + o.camera.panY;
  const bgStops: readonly (readonly [number, string])[] = [
    [0, atmo.bg[0]],
    [0.55, atmo.bg[1]],
    [1, atmo.bg[2]],
  ];
  const bgR = Math.max(width, height) * 0.85;
  let bg: CanvasGradient;
  if (gradients) {
    bg = gradients.radial(
      ctx,
      `bg:${atmo.id}:${width}x${height}:${gcx.toFixed(1)},${gcy.toFixed(1)}`,
      gcx, gcy, 0, width / 2, height / 2, bgR,
      bgStops,
    );
  } else {
    bg = ctx.createRadialGradient(gcx, gcy, 0, width / 2, height / 2, bgR);
    for (const [off, color] of bgStops) bg.addColorStop(off, color);
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Drifting aurora nebulae in the atmosphere's hues — slow, additive, alive.
  const nebulaBoost = atmo.pro ? 1.8 : 1;
  ctx.globalCompositeOperation = "lighter";
  for (let ni = 0; ni < NEBULA_FIELD.length; ni += 1) {
    const n = NEBULA_FIELD[ni];
    const hue = atmo.nebulae[ni] ?? atmo.nebulae[0];
    const px = width * n.ax + Math.sin(time * n.sp) * width * 0.05 + o.camera.panX * 0.04;
    const py = height * n.ay + Math.cos(time * n.sp * 1.3) * height * 0.05 + o.camera.panY * 0.04;
    const rr = Math.max(width, height) * n.rad;
    const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
    g.addColorStop(0, withAlpha(hue, Math.min(0.12, n.a * nebulaBoost)));
    g.addColorStop(1, withAlpha(hue, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.globalCompositeOperation = "source-over";

  // Faint parallax sky stars.
  for (const s of o.stars) {
    const sx = (s.x + o.camera.panX * 0.05) % width;
    const sy = (s.y + o.camera.panY * 0.05) % height;
    const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * 0.0012 + s.tw));
    ctx.beginPath();
    ctx.arc(sx < 0 ? sx + width : sx, sy < 0 ? sy + height : sy, s.r, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(atmo.star, 0.12 * tw);
    ctx.fill();
  }

  // Focal vignette — over the sky, under the nodes.
  const vigStops: readonly (readonly [number, string])[] = [
    [0, "rgba(3,4,9,0)"],
    [1, "rgba(2,3,7,0.45)"],
  ];
  const vigR0 = Math.min(width, height) * 0.32;
  const vigR1 = Math.max(width, height) * 0.72;
  let vig: CanvasGradient;
  if (gradients) {
    vig = gradients.radial(
      ctx,
      `vig:${width}x${height}`,
      width / 2, height / 2, vigR0, width / 2, height / 2, vigR1,
      vigStops,
    );
  } else {
    vig = ctx.createRadialGradient(width / 2, height / 2, vigR0, width / 2, height / 2, vigR1);
    for (const [off, color] of vigStops) vig.addColorStop(off, color);
  }
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);
}

export class BackgroundLayer {
  private surface: OffscreenSurface | null = null;
  private surfaceCtx: CanvasRenderingContext2D | null = null;
  private readonly createSurface: CreateSurface;
  private readonly gradients = new GradientCache();
  private dpr = 1;
  // Inputs of the last offscreen repaint.
  private lastWidth = 0;
  private lastHeight = 0;
  private lastAtmo: string | null = null;
  private lastStars: BackgroundInputs["stars"] | null = null;
  private lastPanX = NaN;
  private lastPanY = NaN;
  private lastTime = -Infinity;
  /** Offscreen repaints performed (telemetry/parity assertions). */
  repaintCount = 0;

  constructor(createSurface: CreateSurface = domSurface) {
    this.createSurface = createSurface;
  }

  setDpr(dpr: number): void {
    if (dpr === this.dpr) return;
    this.dpr = dpr;
    this.lastTime = -Infinity; // force repaint at the new density
  }

  /** Blit the sky, repainting the offscreen layer first if inputs moved.
   * `refreshMs` bounds twinkle/nebula staleness (Infinity = static sky). */
  draw(ctx: CanvasRenderingContext2D, o: BackgroundInputs, refreshMs: number): void {
    const needSurface =
      !this.surface || this.lastWidth !== o.width || this.lastHeight !== o.height;
    if (needSurface) {
      this.surface = this.createSurface(
        Math.max(1, Math.ceil(o.width * this.dpr)),
        Math.max(1, Math.ceil(o.height * this.dpr)),
      );
      this.surfaceCtx = this.surface ? this.surface.getContext("2d") : null;
    }
    if (!this.surface || !this.surfaceCtx) {
      // No offscreen surface available — paint straight through (identical
      // pixels, just without the caching win).
      paintSky(ctx, o);
      return;
    }
    const atmoId = atmosphereOf(o.atmosphere).id;
    const stale =
      needSurface ||
      this.lastAtmo !== atmoId ||
      this.lastStars !== o.stars ||
      this.lastPanX !== o.camera.panX ||
      this.lastPanY !== o.camera.panY ||
      o.time - this.lastTime > refreshMs ||
      o.time < this.lastTime; // clock went backwards (model reload)
    if (stale) {
      const sctx = this.surfaceCtx;
      this.surface.width = Math.max(1, Math.ceil(o.width * this.dpr));
      this.surface.height = Math.max(1, Math.ceil(o.height * this.dpr));
      sctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      paintSky(sctx, o, this.gradients);
      this.lastWidth = o.width;
      this.lastHeight = o.height;
      this.lastAtmo = atmoId;
      this.lastStars = o.stars;
      this.lastPanX = o.camera.panX;
      this.lastPanY = o.camera.panY;
      this.lastTime = o.time;
      this.repaintCount += 1;
    }
    // The sky is opaque edge to edge, so one drawImage replaces every pixel.
    ctx.drawImage(this.surface as unknown as CanvasImageSource, 0, 0, o.width, o.height);
  }

  dispose(): void {
    this.surface = null;
    this.surfaceCtx = null;
    this.gradients.clear();
  }
}
