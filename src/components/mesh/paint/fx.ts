// The fx layer — a THIN pass of transient garnish: interaction pulses riding
// strands, and arrival (birth) celebrations. Everything here is decoration
// over state that already exists; skipping it (T2) or halving it (T1) never
// changes what the mesh MEANS, only how much it sparkles. Ops are ported
// verbatim from scene/scene-render.ts so the full-scale (T0) path is
// pixel-equivalent to the legacy painter.

import { projectPoint, type Camera } from "../core/camera";
import type { SceneModel } from "../scene/scene-model";
import { withAlpha } from "./shared";
import { paintTheme } from "./theme";
import type { ReactionTrail } from "./types";

/**
 * A bright wave riding a strand from the work back to its maker (someone
 * hearted this node). (a, c, b) are the strand's projected screen bezier
 * points; progress `pt` is 0..1 across the 900ms flight.
 */
export function drawStrandPulse(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  cx: number,
  cy: number,
  bx: number,
  by: number,
  pt: number,
  zoom: number,
): void {
  const t = 1 - pt; // travels child → parent
  const mt = 1 - t;
  const px2 = mt * mt * ax + 2 * mt * t * cx + t * t * bx;
  const py2 = mt * mt * ay + 2 * mt * t * cy + t * t * by;
  const glowR = 5 * Math.max(0.8, zoom) * (1 - pt * 0.5);
  const glow = ctx.createRadialGradient(px2, py2, 0, px2, py2, glowR * 3);
  const warm = paintTheme().warm;
  glow.addColorStop(0, withAlpha(warm, 0.85 * (1 - pt)));
  glow.addColorStop(1, withAlpha(warm, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(px2, py2, glowR * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px2, py2, glowR, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(warm, 0.95 * (1 - pt * 0.6));
  ctx.fill();
}

/**
 * A strummed strand's shimmer: a bright glint travels parent → child while a
 * short stretch of the filament around it rings with a decaying sinusoidal
 * ripple. (a, c, b) are the strand's projected screen bezier points;
 * `pt` is 0..1 across STRUM_WAVE_MS. Shared by BOTH paint cores so the
 * kill-switch engines stay op-identical. Skipped whole under reduced motion
 * (the strum map is simply never handed to the painter) and at T2 (fx off).
 */
export function drawStrandStrum(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  cx: number,
  cy: number,
  bx: number,
  by: number,
  pt: number,
  zoom: number,
  color: string,
): void {
  const env = 1 - pt; // decaying ring
  const z = Math.max(0.7, zoom);
  const t0 = Math.max(0, pt - 0.34);
  const t1 = Math.min(1, pt + 0.14);
  const span = t1 - t0;
  if (span <= 0) return;
  ctx.beginPath();
  const steps = 10;
  for (let i = 0; i <= steps; i += 1) {
    const tt = t0 + (span * i) / steps;
    const mt = 1 - tt;
    const x = mt * mt * ax + 2 * mt * tt * cx + tt * tt * bx;
    const y = mt * mt * ay + 2 * mt * tt * cy + tt * tt * by;
    // Displace perpendicular to the curve's tangent — the filament rings.
    const tx = 2 * (mt * (cx - ax) + tt * (bx - cx));
    const ty = 2 * (mt * (cy - ay) + tt * (by - cy));
    const tl = Math.hypot(tx, ty) || 1;
    const win = Math.sin(((tt - t0) / span) * Math.PI);
    const ripple = Math.sin(tt * 46 - pt * 22) * 3.2 * env * win * z;
    const px = x + (-ty / tl) * ripple;
    const py = y + (tx / tl) * ripple;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = withAlpha(color, 0.15 + 0.55 * env);
  ctx.lineWidth = 1.5 * z;
  ctx.stroke();
  // The traveling glint leading the wave.
  const mt2 = 1 - pt;
  const hx = mt2 * mt2 * ax + 2 * mt2 * pt * cx + pt * pt * bx;
  const hy = mt2 * mt2 * ay + 2 * mt2 * pt * cy + pt * pt * by;
  const r = 3.4 * z * (0.6 + 0.4 * env);
  const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 2.6);
  glow.addColorStop(0, withAlpha(paintTheme().ink1, 0.5 * env));
  glow.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(hx, hy, r * 2.6, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Incoming reactions' comet trails — a string of fading motes tracing the
 * SAME arc the thrown heart glyph flies (from the sender's Meshi to the
 * node's live position), so the DOM glyph reads as the comet's head and this
 * pass as its tail. Drawn last (topmost canvas layer) by BOTH cores.
 * `particleScale` is the tier governor's budget: 1 at T0, 0.5 at T1 halves
 * the motes, and T2 never calls this at all (fx off).
 */
export function drawReactionTrails(
  ctx: CanvasRenderingContext2D,
  o: {
    model: SceneModel;
    camera: Camera;
    width: number;
    height: number;
    time: number;
    trails?: ReactionTrail[];
  },
  particleScale: number,
): void {
  const trails = o.trails;
  if (!trails || trails.length === 0 || particleScale <= 0) return;
  const motes = particleScale >= 1 ? 7 : 4;
  const z = Math.max(0.7, o.camera.zoom);
  for (let i = 0; i < trails.length; i += 1) {
    const tr = trails[i];
    const target = o.model.nodes.get(tr.targetId);
    if (!target) continue;
    const t = (o.time - tr.born) / tr.dur;
    // The tail lingers briefly past the landing, then the sweep collects it.
    if (t <= 0 || t >= 1.2) continue;
    const cpx = (tr.fromX + target.dx) / 2;
    const cpy = (tr.fromY + target.dy) / 2 - 130;
    const head = Math.min(t, 1);
    const settle = t > 1 ? 1 - (t - 1) / 0.2 : 1;
    for (let k = 0; k < motes; k += 1) {
      const tt = head - (k + 1) * 0.055;
      if (tt <= 0) continue;
      const mt = 1 - tt;
      const wx = mt * mt * tr.fromX + 2 * mt * tt * cpx + tt * tt * target.dx;
      const wy = mt * mt * tr.fromY + 2 * mt * tt * cpy + tt * tt * target.dy;
      const s = projectPoint(o.camera, o.width, o.height, wx, wy);
      const fade = (1 - k / motes) * settle;
      ctx.beginPath();
      ctx.arc(s.x, s.y, (3.4 - k * 0.34) * z, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(paintTheme().warm, 0.32 * fade);
      ctx.fill();
    }
  }
}

/**
 * Arrival celebration for a node mid-birth: staggered ripple rings, a brief
 * four-point sparkle with a warm flash. `particleScale` trims the garnish by
 * tier (1 = full, 0.5 = one ring / two rays / no flash, 0 = nothing — the
 * node still springs in, so arrival semantics survive every tier).
 */
export function drawBirthFx(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  born: number,
  particleScale: number,
): void {
  if (particleScale <= 0) return;
  const rings = particleScale >= 1 ? 2 : 1;
  for (let ri = 0; ri < rings; ri += 1) {
    const rp = Math.min(1, Math.max(0, born * 1.35 - ri * 0.28));
    if (rp > 0 && rp < 1) {
      ctx.beginPath();
      ctx.arc(x, y, r * (1.1 + rp * 3.6), 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha(ri === 0 ? color : paintTheme().ink1, 0.5 * (1 - rp));
      ctx.lineWidth = (ri === 0 ? 2.2 : 1.2) * (1 - rp) + 0.4;
      ctx.stroke();
    }
  }
  if (born < 0.45) {
    const sp = born / 0.45;
    const rayLen = r * (1.6 + sp * 2.8);
    const rays = particleScale >= 1 ? 4 : 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sp * 0.9);
    ctx.strokeStyle = withAlpha(paintTheme().warning, 0.75 * (1 - sp));
    ctx.lineWidth = 1.4;
    for (let k = 0; k < rays; k += 1) {
      const a = (Math.PI / 2) * (4 / rays) * k + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
      ctx.lineTo(Math.cos(a) * rayLen, Math.sin(a) * rayLen);
      ctx.stroke();
    }
    ctx.restore();
    if (particleScale >= 1) {
      const flash = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
      const gold = paintTheme().warning;
      flash.addColorStop(0, withAlpha(gold, 0.5 * (1 - sp)));
      flash.addColorStop(1, withAlpha(gold, 0));
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
