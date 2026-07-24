// The fx layer — a THIN pass of transient garnish: interaction pulses riding
// strands, and arrival (birth) celebrations. Everything here is decoration
// over state that already exists; skipping it (T2) or halving it (T1) never
// changes what the mesh MEANS, only how much it sparkles. Ops are ported
// verbatim from scene/scene-render.ts so the full-scale (T0) path is
// pixel-equivalent to the legacy painter.

import { withAlpha } from "./shared";

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
  glow.addColorStop(0, withAlpha("#fda4af", 0.85 * (1 - pt)));
  glow.addColorStop(1, withAlpha("#fda4af", 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(px2, py2, glowR * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px2, py2, glowR, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha("#fecdd3", 0.95 * (1 - pt * 0.6));
  ctx.fill();
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
      ctx.strokeStyle = withAlpha(ri === 0 ? color : "#ffffff", 0.5 * (1 - rp));
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
    ctx.strokeStyle = withAlpha("#fff7d6", 0.75 * (1 - sp));
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
      flash.addColorStop(0, withAlpha("#fff2c4", 0.5 * (1 - sp)));
      flash.addColorStop(1, withAlpha("#fff2c4", 0));
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
