// The surface the mesh is laid out ON — a warm vertical wash with a faint
// tooth, rendered to an offscreen layer and BLITTED per frame instead of
// re-painted (the single biggest per-frame win on old phones: ~3ms/frame of
// gradient fills becomes one opaque drawImage).
//
// This used to be outer space: a radial void, three additive drifting nebulae
// under `globalCompositeOperation = "lighter"`, and a parallax star field. All
// three were ambient motion with nothing happening — the exact thing the
// product does not do — and none of it was reachable by the design tokens, so
// the mesh stayed futuristic while everything around it became paper.
//
// It is now a NIGHT ATLAS SHEET. The wash and grain are static, but the sheet
// carries ORBIT CONTOURS — world-anchored rings at the layout's real semantic
// radii — so the map states its geography: this ring is where your people
// live, that one is where the platforms sit, the outer ones carry the posts.
// Distance stops being decoration and becomes information.
//
// The layer repaints only when its inputs actually moved: resize, paper or
// tier-alpha change, or camera pan/zoom (the contours are world-anchored, so
// the camera moves them). A repaint is one gradient fill, one pattern fill and
// at most fourteen arc strokes — cheap enough to track the camera every frame
// on every tier, which is what the pan path always did.

import type { Camera } from "../core/camera";
import { CONTENT_RADIUS, PERSON_NEAR, PLATFORM_RADIUS, RING_GAP } from "../sim/layout";
import { GradientCache } from "./caches";
import { atmosphereOf } from "./papers";
import type { PaintTheme } from "./theme";
import { domSurface, type CreateSurface, type OffscreenSurface } from "./types";

export interface BackgroundInputs {
  width: number;
  height: number;
  time: number;
  camera: Camera;
  atmosphere?: string | null;
  /** Lamplit paper when true (the DOM theme), daylit when false. */
  dark?: boolean;
  /** The frame's theme, hoisted once per frame by the engine. */
  theme: PaintTheme;
  /** Contour ink opacity for the active quality tier (alpha only — the rings
   *  themselves exist at every tier; T2 thins, it never deletes). */
  contourAlpha: number;
}

/**
 * The one grain tile. Paper has tooth; that tooth is what stops a flat fill
 * reading as a screen. Generated once, deterministically (no Math.random, so
 * two engines painting the same frame produce the same pixels), then tiled.
 */
let grainPattern: CanvasPattern | null = null;
let grainKey = "";

function grainTile(ctx: CanvasRenderingContext2D, alpha: number): CanvasPattern | null {
  const key = alpha.toFixed(3);
  if (grainPattern && grainKey === key) return grainPattern;
  const size = 128;
  let tile: HTMLCanvasElement | OffscreenCanvas;
  try {
    tile = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(size, size)
      : Object.assign(document.createElement("canvas"), { width: size, height: size });
  } catch {
    return null;
  }
  const tctx = (tile as HTMLCanvasElement).getContext("2d") as CanvasRenderingContext2D | null;
  if (!tctx) return null;
  const img = tctx.createImageData(size, size);
  // A cheap deterministic hash per pixel — same tile every time, every engine.
  let seed = 0x9e3779b9;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = (seed >>> 24) & 0xff;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.round(alpha * 255);
  }
  tctx.putImageData(img, 0, 0);
  grainPattern = ctx.createPattern(tile as unknown as CanvasImageSource, "repeat");
  grainKey = key;
  return grainPattern;
}

/** Paint the tabletop: one vertical wash, a warm edge, and the grain. */
export function paintSky(
  ctx: CanvasRenderingContext2D,
  o: BackgroundInputs,
  gradients?: GradientCache,
): void {
  const { width, height } = o;
  const atmo = atmosphereOf(o.atmosphere, o.dark !== false);

  // A VERTICAL wash, not a radial void: light falls from above onto a surface,
  // rather than radiating outward from a point in space. Panning shifts it a
  // little so the surface feels larger than the viewport without drifting on
  // its own.
  const shift = o.camera.panY * 0.03;
  const bgStops: readonly (readonly [number, string])[] = [
    [0, atmo.bg[0]],
    [0.62, atmo.bg[1]],
    [1, atmo.bg[2]],
  ];
  let bg: CanvasGradient;
  if (gradients) {
    bg = gradients.linear(
      ctx,
      `paper:${atmo.id}:${width}x${height}:${shift.toFixed(1)}`,
      0, -shift, 0, height - shift,
      bgStops,
    );
  } else {
    bg = ctx.createLinearGradient(0, -shift, 0, height - shift);
    for (const [off, color] of bgStops) bg.addColorStop(off, color);
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // The tooth. Same material as the DOM grain, so the canvas and the chrome
  // around it read as one surface rather than a window cut into a page.
  const grain = grainTile(ctx, atmo.grain);
  if (grain) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // ORBIT CONTOURS — the atlas's rings, drawn at the layout's real radii so
  // the map never lies about distance. World-anchored: the camera moves them.
  // Stroked in --rule; `contourAlpha` is the EFFECTIVE target ink (7/5/3% by
  // tier), so the stroke alpha is normalized against the alpha --rule itself
  // carries (0.65 dark / 0.29 light) — otherwise the light theme's rings
  // would land under 2% and vanish into the paper. 1px regardless of zoom —
  // geography zooms, ink does not.
  {
    const { camera, theme } = o;
    const ruleAlphaMatch = theme.rule.match(/rgba?\([^)]*,\s*([\d.]+)\s*\)/);
    const ruleAlpha = ruleAlphaMatch ? Math.max(0.05, parseFloat(ruleAlphaMatch[1])) : 1;
    const cx = width / 2 + camera.panX;
    const cy = height / 2 + camera.panY;
    // How far out the sheet must ring: the farthest viewport corner, in world
    // units, plus one ring of headroom.
    const cornerDx = Math.max(cx, width - cx);
    const cornerDy = Math.max(cy, height - cy);
    const maxWorldR = Math.hypot(cornerDx, cornerDy) / camera.zoom + RING_GAP;
    const radii: number[] = [PERSON_NEAR, PLATFORM_RADIUS];
    for (let r = CONTENT_RADIUS; r <= maxWorldR && radii.length < 14; r += RING_GAP) radii.push(r);
    ctx.save();
    ctx.strokeStyle = theme.rule;
    ctx.globalAlpha = Math.min(1, o.contourAlpha / ruleAlpha);
    ctx.lineWidth = 1;
    for (const worldR of radii) {
      ctx.beginPath();
      ctx.arc(cx, cy, worldR * camera.zoom, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Edge falloff in the sheet's own hairline ink, not a warm lens vignette:
  // the corners of the map catching less light. The old #261e14 radial was the
  // last hardcoded hex in this file.
  const vigStops: readonly (readonly [number, string])[] = [
    [0, "rgba(0,0,0,0)"],
    [1, o.theme.rule],
  ];
  const vigR0 = Math.min(width, height) * 0.4;
  const vigR1 = Math.max(width, height) * 0.78;
  let vig: CanvasGradient;
  if (gradients) {
    vig = gradients.radial(
      ctx,
      `edge:${width}x${height}:${o.theme.rule}`,
      width / 2, height / 2, vigR0, width / 2, height / 2, vigR1,
      vigStops,
    );
  } else {
    vig = ctx.createRadialGradient(width / 2, height / 2, vigR0, width / 2, height / 2, vigR1);
    for (const [off, color] of vigStops) vig.addColorStop(off, color);
  }
  ctx.save();
  // --rule carries its own alpha (0.65 dark / 0.29 light); these factors land
  // both themes at ≈8% effective ink in the far corners.
  ctx.globalAlpha = o.theme.dark ? 0.12 : 0.28;
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
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
  private lastPanX = NaN;
  private lastPanY = NaN;
  private lastZoom = NaN;
  private lastContourAlpha = NaN;
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
    const atmoId = atmosphereOf(o.atmosphere, o.dark !== false).id + (o.dark !== false ? ":dark" : ":light");
    // Camera movement dirties the sheet: the wash shifts with pan (as before)
    // and the contours are world-anchored, so zoom moves them too. A repaint
    // is one gradient fill + one pattern fill + ≤14 arc strokes — cheap enough
    // to track every frame on every tier, exactly as the pan path always has.
    // `refreshMs` keeps its historical meaning (time-based refresh window) and
    // nothing time-varying remains, so it only matters for clock rollback.
    const stale =
      needSurface ||
      this.lastAtmo !== atmoId ||
      this.lastContourAlpha !== o.contourAlpha ||
      this.lastPanX !== o.camera.panX ||
      this.lastPanY !== o.camera.panY ||
      this.lastZoom !== o.camera.zoom ||
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
      this.lastContourAlpha = o.contourAlpha;
      this.lastZoom = o.camera.zoom;
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
