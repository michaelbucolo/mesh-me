// The strand (edge) pass — constellation filaments between parents and
// children. Ops ported verbatim from scene/scene-render.ts so the T0 path is
// pixel-equivalent to the legacy painter. Tier knobs: `liveStrands` false
// (T2) draws each strand at its rest pose (straight midpoint — the same
// fallback the legacy painter uses when a control point is missing) instead
// of the physics control point, and `fx` off skips interaction pulses.
//
// Per-strand routing cost lives in sim/physics (control points), which now
// rides a spatial grid — O(E×k); this pass itself is O(E) draws. Paint never
// writes hit targets: strands aren't tappable, and node hit geometry is
// sim/hitmap's alone.

import { projectPoint } from "../core/camera";
import { birthProgress, chainFrom, nodeEmphasis } from "../sim/hitmap";
import { STRUM_WAVE_MS } from "../sim/strum";
import { drawStrandPulse, drawStrandStrum } from "./fx";
import { drawPill, strandLabelFor, withAlpha } from "./shared";
import type { SceneNode, ScenePaintOptions } from "./types";
import { paintTheme } from "./theme";

export interface EdgePassKnobs {
  liveStrands: boolean;
  fx: boolean;
}

export function drawEdges(ctx: CanvasRenderingContext2D, o: ScenePaintOptions, knobs: EdgePassKnobs): void {
  const { model, width, height, time } = o;
  const nodes = model.nodes;
  const hoverChain = chainFrom(model, o.hoverId);
  const selChain = chainFrom(model, o.selectedId);
  const emphasisFor = (node: SceneNode): number =>
    nodeEmphasis(node, hoverChain, selChain, o.activeBranch);

  ctx.lineCap = "round";
  nodes.forEach((node) => {
    if (!node.parentId) return;
    const parent = nodes.get(node.parentId);
    if (!parent) return;
    const a = projectPoint(o.camera, width, height, parent.dx, parent.dy);
    const b = projectPoint(o.camera, width, height, node.dx, node.dy);
    // Physical strand: bend the line through its live control point so it
    // droops and sways like an elastic filament instead of a rigid spoke.
    // (T2: rest pose — the strand still exists and connects the same nodes.)
    const sp = knobs.liveStrands ? o.strands?.get(`${parent.id}>${node.id}`) : undefined;
    const c = sp
      ? projectPoint(o.camera, width, height, sp.mx, sp.my)
      : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const emph = Math.min(emphasisFor(node), emphasisFor(parent));
    const onHoverPath =
      (hoverChain.has(node.id) && hoverChain.has(parent.id)) ||
      (selChain.has(node.id) && selChain.has(parent.id));
    // Dotted thread = a relationship; solid line = authorship.
    const isRelationship = parent.kind === "self" && node.kind !== "post";
    const baseAlpha = node.depth === 1 ? 0.34 : node.depth === 2 ? 0.22 : 0.14;
    const alpha = onHoverPath ? 0.85 : baseAlpha * (0.35 + 0.65 * emph);
    // Mesh Pro: the owner can dye their relationship threads a signature color.
    const threadColor = isRelationship ? o.visuals?.connectionColor || null : null;
    const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    // Every strand starts at you. The self node used to carry a periwinkle of
    // its own (#a5b4fc — 2.6deg from --accent and a shade lighter, so it read as
    // the accent rendered wrong), which meant the centre of the mesh competed
    // with the six branch colours instead of anchoring them. It is neutral now:
    // a strand fades from the ink of the page out into whatever its branch is
    // made of, and the only hues on the mesh are the six that mean something.
    const originColor = parent.kind === "self" ? paintTheme().ink3 : parent.color;
    grad.addColorStop(0, withAlpha(threadColor ?? originColor, alpha));
    grad.addColorStop(1, withAlpha(threadColor ?? node.color, alpha));
    ctx.strokeStyle = grad;
    ctx.lineWidth = (onHoverPath ? 2.4 : node.depth === 1 ? 1.6 : 1) * Math.max(0.7, o.camera.zoom);

    // A just-joined child's strand draws itself out from the parent with a
    // bright tip leading the way. Not yet born means not yet drawn.
    const strandGrow = birthProgress(node, time);
    if (strandGrow <= 0 || birthProgress(parent, time) <= 0) return;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    if (strandGrow < 1) {
      const steps = 18;
      const end = Math.max(0.02, strandGrow);
      let tipX = a.x;
      let tipY = a.y;
      for (let si = 1; si <= steps; si += 1) {
        const tt = (si / steps) * end;
        const mt = 1 - tt;
        tipX = mt * mt * a.x + 2 * mt * tt * c.x + tt * tt * b.x;
        tipY = mt * mt * a.y + 2 * mt * tt * c.y + tt * tt * b.y;
        ctx.lineTo(tipX, tipY);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tipX, tipY, 2.4 * Math.max(0.8, o.camera.zoom), 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(node.color, 0.9 * (1 - strandGrow) + 0.2);
      ctx.fill();
    } else {
      if (isRelationship) ctx.setLineDash([2.5 * Math.max(0.7, o.camera.zoom), 7 * Math.max(0.7, o.camera.zoom)]);
      ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Relationship pills only appear when you're tracing that strand.
    const label = parent.kind === "self" && hoverChain.has(node.id) ? strandLabelFor(node) : null;
    if (label && o.camera.zoom >= 0.42) {
      // Sit the label on the strand's own hanging midpoint (curve at t=0.5).
      const mx = 0.25 * a.x + 0.5 * c.x + 0.25 * b.x;
      const my = 0.25 * a.y + 0.5 * c.y + 0.25 * b.y;
      drawPill(
        ctx,
        mx,
        my,
        label,
        withAlpha(paintTheme().paper2, 0.82),
        withAlpha(node.color, 0.56),
        paintTheme().ink1,
        Math.max(9, 9.5 * o.camera.zoom),
        8,
      );
    }

    // Interaction pulse: a heart's bright wave riding the strand (fx layer).
    if (knobs.fx) {
      const pulseStart = o.strandPulses?.get(`${parent.id}>${node.id}`);
      if (pulseStart != null) {
        const pt = (time - pulseStart) / 900;
        if (pt >= 0 && pt < 1) {
          drawStrandPulse(ctx, a.x, a.y, c.x, c.y, b.x, b.y, pt, o.camera.zoom);
        }
      }
      // Strum shimmer: a sweep across this filament sent a wave down it.
      const strumStart = o.strandStrums?.get(`${parent.id}>${node.id}`);
      if (strumStart != null) {
        const st = (time - strumStart) / STRUM_WAVE_MS;
        if (st >= 0 && st < 1) {
          drawStrandStrum(ctx, a.x, a.y, c.x, c.y, b.x, b.y, st, o.camera.zoom, node.color);
        }
      }
    }
  });
}
