// The layered paint engine — the mesh's renderer.
// One engine per mounted mesh surface. Layers, in draw order:
//
//   background — offscreen-cached sky (stars/nebulae/vignette), blitted
//   edges      — strands (physics control points ride sim's spatial grid)
//   nodes      — sprite-atlas orbs/avatars/tiles/cards + immediate garnish
//   fx         — pulses/bursts, drawn inline by edges/nodes at their z-order
//
// The engine draws and ONLY draws — sim/hitmap remains the hit-testing
// authority (this module never writes a hit target; it shares hitmap's
// size/LOD vocabulary so pixels and tap targets agree).
//
// PRIVACY: all caches (sprites, images, gradients, background) live on the
// engine instance — per mounted surface, per session, never serialized or
// shared. Content reaches a sprite only if the model (server-gated) handed
// it to the painter to draw in the first place.

import { TIER_PARAMS, type QualityTier } from "../core/motion";
import { SpriteAtlas } from "./atlas";
import { BackgroundLayer, paintSky } from "./background";
import { ImageLru } from "./caches";
import { drawEdges } from "./edges";
import { drawReactionTrails } from "./fx";
import { createNodePassResources, drawNodesPass, type NodePassResources } from "./nodes";
import { domSurface, type CreateSurface, type ScenePaintOptions } from "./types";


export interface PaintEngineOptions {
  /** Offscreen surface factory — injectable for the node parity harness. */
  createSurface?: CreateSurface;
  /** false = direct mode: no sprites, no cached background — the engine
   * issues the exact legacy op stream (the parity path; also the fallback
   * wherever offscreen canvases are unavailable). */
  cached?: boolean;
  /** Node ids to drop from the id→image map when the image LRU evicts. */
  onImagesEvicted?: (ids: readonly string[]) => void;
}

export interface PaintEngine {
  /** Draw one frame at the given quality tier. The ctx must already carry
   * the frame's DPR transform (the scene sets it, same as for the legacy
   * painter). */
  draw(o: ScenePaintOptions, tier: QualityTier): void;
  /** Device-pixel-ratio changed (tier ladder / display move). */
  setDpr(dpr: number): void;
  /** URL-keyed image LRU — the scene's loader routes through this. */
  readonly images: ImageLru;
  /** Cache telemetry for dev/tests. */
  stats(): { sprites: number; spriteBytes: number; rasters: number; backgroundRepaints: number; images: number; imageBytes: number };
  dispose(): void;
}

export function createPaintEngine(options: PaintEngineOptions = {}): PaintEngine {
  const cached = options.cached ?? true;
  const createSurface = options.createSurface ?? domSurface;
  const background = new BackgroundLayer(createSurface);
  const atlas = cached ? new SpriteAtlas(createSurface) : null;
  const images = new ImageLru(options.onImagesEvicted);
  // Node-pass resources are rebuilt cheaply when the tier changes (params
  // object identity is the change signal).
  let nodeRes: NodePassResources | null = null;
  let disposed = false;

  return {
    draw(o, tier) {
      if (disposed) return;
      const params = TIER_PARAMS[tier];
      if (!nodeRes || nodeRes.tier !== tier) {
        nodeRes = createNodePassResources(atlas, params, tier);
      }
      const { ctx, width, height } = o;
      ctx.clearRect(0, 0, width, height);
      const skyInputs = {
        width,
        height,
        time: o.time,
        camera: o.camera,
        atmosphere: o.visuals?.atmosphere,
        stars: o.backgroundStars,
      };
      if (cached) background.draw(ctx, skyInputs, params.backgroundRefreshMs);
      else paintSky(ctx, skyInputs); // direct: the exact legacy op stream
      drawEdges(ctx, o, { liveStrands: params.liveStrands, fx: params.fx });
      drawNodesPass(o, nodeRes);
      // Incoming reactions' comet trails ride the topmost canvas layer —
      // halved at T1 (particleScale), absent at T2 (fx off) — the reaction
      // itself (the thrown glyph + count tick) works at every tier.
      if (params.fx) drawReactionTrails(ctx, o, params.particleScale);
    },
    setDpr(dpr) {
      background.setDpr(dpr);
      atlas?.setDpr(dpr);
    },
    images,
    stats() {
      return {
        sprites: atlas?.count ?? 0,
        spriteBytes: atlas?.byteSize ?? 0,
        rasters: atlas?.rasterCount ?? 0,
        backgroundRepaints: background.repaintCount,
        images: images.count,
        imageBytes: images.byteSize,
      };
    },
    dispose() {
      disposed = true;
      background.dispose();
      atlas?.clear();
      images.clear();
    },
  };
}
