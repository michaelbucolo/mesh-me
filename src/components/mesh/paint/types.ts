// The layered painter's per-frame inputs. The scene builds ONE options
// object per frame and hands it to the paint engine. These types were
// declared independently of the (now-deleted) legacy renderer, which is why
// paint/ survived its removal untouched.

import type { Camera } from "../core/camera";
import type { BranchKey, SceneModel, SceneNode } from "../scene/scene-model";

/** An incoming reaction's comet trail — from the sender's Meshi to the node
 * they reacted at, following the same arc the thrown glyph flies. The fx
 * layer draws it (particle-budget scaled by tier, off with fx), resolving the
 * target's LIVE position each frame so the trail lands where the heart does. */
export interface ReactionTrail {
  fromX: number;
  fromY: number;
  targetId: string;
  /** performance.now() timestamp (the scheduler's frame clock). */
  born: number;
  dur: number;
}

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
  /** Strand strums (edge key → start time): a sweep across a filament sends
   * a shimmer down it. Omitted entirely under reduced motion. */
  strandStrums?: Map<string, number>;
  /** Incoming reactions' comet trails (fx layer; tier-budgeted). */
  trails?: ReactionTrail[];
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
