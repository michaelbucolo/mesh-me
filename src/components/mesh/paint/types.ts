// The layered painter's per-frame inputs — structurally identical to the
// legacy renderer's RenderOptions (scene/scene-render.ts) so the scene can
// build ONE options object and hand it to whichever engine the `mesh_engine`
// kill-switch selected. Declared independently (not imported from the legacy
// module) so paint/ survives the legacy painter's PR4 deletion untouched.

import type { Camera } from "../core/camera";
import type { BranchKey, SceneModel, SceneNode } from "../scene/scene-model";

export interface ScenePaintOptions {
  ctx: CanvasRenderingContext2D;
  model: SceneModel;
  width: number;
  height: number;
  camera: Camera;
  time: number;
  activeBranch: BranchKey | null;
  selectedId: string | null;
  focusId: string | null;
  hoverId?: string | null;
  images: Map<string, HTMLImageElement>;
  backgroundStars: { x: number; y: number; r: number; tw: number }[];
  /** Mesh Pro visuals chosen by this mesh's OWNER — visitors see them too. */
  visuals?: {
    connectionColor?: string | null;
    nodeStyle?: string | null;
    atmosphere?: string | null;
  };
  /** Keep labels clear of the screen center (where the pinned Meshi sits). */
  avoidCenter?: boolean;
  isOwnMesh?: boolean;
  /** Live strand control points from physics, keyed "parent>child". */
  strands?: Map<string, { mx: number; my: number }>;
  /** Interaction pulses riding strands (edge key → start time). */
  strandPulses?: Map<string, number>;
  /** Connections online right now but NOT in this room, keyed by userId. */
  livePresence?: Map<string, { where: string | null; route?: string | null }>;
}

export type { SceneNode };

/** Minimal canvas surface the engine needs for offscreen layers/sprites —
 * injectable so the node-side parity harness can substitute recorders. */
export interface OffscreenSurface {
  width: number;
  height: number;
  getContext(kind: "2d"): CanvasRenderingContext2D | null;
}

export type CreateSurface = (width: number, height: number) => OffscreenSurface | null;

/** Default surface factory: a plain DOM canvas (null off-DOM). */
export function domSurface(width: number, height: number): OffscreenSurface | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
