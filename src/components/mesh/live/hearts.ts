// Thrown hearts + reaction bursts — the world actions your Meshi performs.
// Pure functions over the shared MeshRuntime: they push glyphs into the
// in-flight list (stepped imperatively by the domSync phase) and stage the
// pending action the presence heartbeat broadcasts to the room. Extracted
// verbatim from the old mesh-scene.tsx.

import { playSound } from "@/lib/sound";
import type { MeshRuntime } from "../scene/runtime";
import type { SceneNode } from "../scene/scene-model";
import type { ReactionGlyph } from "../scene/reaction-glyphs";

/** Your Meshi throws a heart at the post you just liked — visible to you AND
 * to everyone else in the room, where it lands and ticks the count up. */
export function spawnHeart(rt: MeshRuntime, fromX: number, fromY: number, targetId: string): void {
  // Respect reduced-motion, same as spawnBurst — no flying flourish (the like
  // itself still registers through the normal action path).
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  rt.hearts.push({
    id: ++rt.heartSeq,
    fromX,
    fromY,
    targetId,
    born: typeof performance !== "undefined" ? performance.now() : Date.now(),
    dur: 950,
  });
}

/** A targetless flourish: a small fan of glyphs bursting out of a world point
 * and fading — reuses the heart host + hand-drawn SVGs, never an emoji. Total
 * in-flight particles are capped so a rapid sequence never floods the host. */
export function spawnBurst(
  rt: MeshRuntime,
  originX: number,
  originY: number,
  glyph: ReactionGlyph,
  count: number,
): void {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  if (rt.hearts.length > 36) return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const n = Math.min(count, 6);
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (i - (n - 1) / 2) * 0.5 + (Math.random() - 0.5) * 0.22;
    rt.hearts.push({
      id: ++rt.heartSeq,
      fromX: originX,
      fromY: originY,
      targetId: "",
      born: now + i * 45,
      dur: 760,
      glyph,
      burst: { angle, dist: 66 + Math.random() * 46 },
    });
  }
}

/** Like → the heart physically flies from your Meshi and the room hears it. */
export function emitHeart(rt: MeshRuntime, isOwnMesh: boolean, node: SceneNode): void {
  const from = !isOwnMesh ? rt.cursorWorldPos : rt.ownerWorldPos;
  spawnHeart(rt, from.x, from.y, node.id);
  playSound("heart");
  rt.pendingAction = { kind: "heart", targetId: node.id, at: Date.now() };
  // Broadcast immediately so the room sees the throw with minimal lag.
  rt.heartbeatNow?.();
}
