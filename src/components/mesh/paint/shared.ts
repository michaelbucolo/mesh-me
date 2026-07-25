// Shared drawing vocabulary for the layered painter — ported VERBATIM from
// scene/scene-render.ts so the new engine's T0 output is pixel-equivalent to
// the legacy painter's (the PR3 parity gate). The legacy file is retained
// (now deleted — this module is the single source of these ops); these
// helpers become the only copy then.

import { platformLogoDataUri } from "@/components/platform/platform-logo";
import type { SceneNode } from "../scene/scene-model";

// Rasterized brand marks (YouTube, Instagram, TikTok, …) for canvas drawing.
// Public brand SVGs only — never user content — so a module-level cache is
// safe; everything user-derived lives in per-engine caches.
const logoImages = new Map<string, HTMLImageElement | null>();

export function logoImage(platform?: string | null): HTMLImageElement | null {
  if (!platform || typeof Image === "undefined") return null;
  const key = platform.toLowerCase();
  const cached = logoImages.get(key);
  if (cached !== undefined) {
    return cached && cached.complete && cached.naturalWidth > 0 ? cached : null;
  }
  const uri = platformLogoDataUri(key, 48);
  if (!uri) {
    logoImages.set(key, null);
    return null;
  }
  const img = new Image();
  img.src = uri;
  logoImages.set(key, img);
  return null;
}

export function drawLogoTile(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  size: number,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  roundRectPath(ctx, x - size / 2, y - size / 2, size, size, size * 0.28);
  ctx.clip();
  ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
  ctx.restore();
}

// Lighten a #rrggbb hex toward white by amount (0..1 → white).
export function tint(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return hex.length === 7 ? hex + a : hex;
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// Custom-drawn meta glyphs (never emoji) so like/comment counts read as ours
// on every device. Drawn at (x, y) = left edge / vertical middle, size s.
export function drawGlyphHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  const t = y - s / 2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + s / 2, t + s);
  ctx.bezierCurveTo(x - s * 0.15, t + s * 0.62, x + s * 0.02, t, x + s / 2, t + s * 0.28);
  ctx.bezierCurveTo(x + s * 0.98, t, x + s * 1.15, t + s * 0.62, x + s / 2, t + s);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

export function drawGlyphBubble(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  const t = y - s / 2;
  const r = s * 0.28;
  const w = s;
  const h = s * 0.82;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, t);
  ctx.arcTo(x + w, t, x + w, t + h, r);
  ctx.arcTo(x + w, t + h, x, t + h, r);
  ctx.lineTo(x + s * 0.42, t + h);
  ctx.lineTo(x + s * 0.24, t + h + s * 0.22);
  ctx.lineTo(x + s * 0.3, t + h);
  ctx.arcTo(x, t + h, x, t, r);
  ctx.arcTo(x, t, x + w, t, r);
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.13);
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

export function metaValue(node: SceneNode, label: string): string | null {
  const entry = node.meta?.find((m) => m.label === label);
  return entry ? entry.value : null;
}

export function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid) + "…").width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo).trimEnd() + "…";
}

/** Split text into up to two lines that fit maxW; the last line is ellipsized. */
export function wrapTwoLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  if (ctx.measureText(text).width <= maxW) return [text];
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid)).width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  const breakAt = text.lastIndexOf(" ", lo) > lo * 0.6 ? text.lastIndexOf(" ", lo) : lo;
  const line1 = text.slice(0, breakAt).trimEnd();
  const rest = text.slice(breakAt).trim();
  return rest ? [line1, fitText(ctx, rest, maxW)] : [line1];
}

export function strandLabelFor(node: SceneNode): string | null {
  if (node.kind !== "branch") return null;
  if (node.branch === "platforms") return "Source";
  if (node.branch === "posts" || node.branch === "communities") return "Owner";
  return null;
}

export function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  fill: string,
  stroke: string,
  textColor: string,
  fontSize: number,
  padX: number,
) {
  ctx.save();
  ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  const textW = ctx.measureText(text).width;
  const h = fontSize + 8;
  const w = textW + padX * 2;
  const r = h / 2;
  const rx = x - w / 2;
  const ry = y - h / 2;
  ctx.beginPath();
  ctx.moveTo(rx + r, ry);
  ctx.arcTo(rx + w, ry, rx + w, ry + h, r);
  ctx.arcTo(rx + w, ry + h, rx, ry + h, r);
  ctx.arcTo(rx, ry + h, rx, ry, r);
  ctx.arcTo(rx, ry, rx + w, ry, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
  return { x: rx, y: ry, w, h };
}

export function roundedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  r: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const size = r * 2;
  ctx.drawImage(img, x - r, y - r, size, size);
  ctx.restore();
}

// Kept deliberately quiet: the world should read clean and professional,
// with content in front — not a light show behind it.
/**
 * Mesh Atmospheres — the sky palette of a mesh. "midnight" is the free
 * default; the rest are Mesh Pro skies.
 */
export interface AtmosphereSpec {
  id: string;
  label: string;
  pro: boolean;
  /** Vertical wash stops: top → middle → bottom. Light falls from above. */
  bg: [string, string, string];
  /** Ink the labels and hairlines are drawn in on this paper. */
  ink: string;
  /** How much tooth this paper has (0 = smooth, 1 = coarse). */
  grain: number;
}

// PAPERS. The mesh stopped being outer space and became a tabletop: these are
// the surfaces your mesh is laid out on, not skies it floats in.
//
// THE KEYS DO NOT CHANGE. `atmosphereOf()` falls back to `midnight` for any id
// it does not recognise, so renaming a key would silently reset the stored
// `mesh-theme-preset` of every Pro member who picked one. Labels and values
// move; ids are permanent. PAPER_ALIAS below gives new pickers readable names.
const ATMOSPHERES: Record<string, AtmosphereSpec> = {
  midnight: { id: "midnight", label: "Daylight", pro: false, bg: ["#fcf9f2", "#f4efe6", "#e7e1d3"], ink: "#6e685e", grain: 0.035 },
  aurora: { id: "aurora", label: "Botanical", pro: true, bg: ["#f4f6ee", "#e9eee0", "#dce4cf"], ink: "#5f6b52", grain: 0.04 },
  ember: { id: "ember", label: "Kraft", pro: true, bg: ["#f2e6d2", "#e8d9be", "#dbc8a6"], ink: "#7a6244", grain: 0.055 },
  ocean: { id: "ocean", label: "Blueprint", pro: true, bg: ["#e8eef4", "#dae3ee", "#c7d4e4"], ink: "#4e637a", grain: 0.03 },
  dawn: { id: "dawn", label: "Sunlit", pro: true, bg: ["#faf0e4", "#f2e2ce", "#e6d2b8"], ink: "#8a6247", grain: 0.045 },
};

/** The same five papers under one lamp. Chosen by the DOM theme, not stored. */
const ATMOSPHERES_DARK: Record<string, AtmosphereSpec> = {
  midnight: { id: "midnight", label: "Daylight", pro: false, bg: ["#1f1b17", "#1a1714", "#100e0c"], ink: "#948c80", grain: 0.05 },
  aurora: { id: "aurora", label: "Botanical", pro: true, bg: ["#1b1f18", "#171a14", "#0d0f0b"], ink: "#8a9680", grain: 0.055 },
  ember: { id: "ember", label: "Kraft", pro: true, bg: ["#281f16", "#221a12", "#110c08"], ink: "#b09472", grain: 0.07 },
  ocean: { id: "ocean", label: "Blueprint", pro: true, bg: ["#181f26", "#141a20", "#0b0e11"], ink: "#8fa6bd", grain: 0.045 },
  dawn: { id: "dawn", label: "Sunlit", pro: true, bg: ["#2a211c", "#241c18", "#100c0a"], ink: "#c09272", grain: 0.06 },
};

// A readable-id alias map (midnight->daylight, ember->kraft, ...) belongs here
// when a picker needs one. It is deliberately NOT written yet: an exported map
// nothing reads is just a second source of truth waiting to drift from the
// labels above.

/**
 * Resolve a stored preset id to its paper. `dark` picks the lamplit variant of
 * the SAME paper — a person's chosen paper does not change when the room does,
 * only the light falling on it.
 */
export function atmosphereOf(id?: string | null, dark = true): AtmosphereSpec {
  const table = dark ? ATMOSPHERES_DARK : ATMOSPHERES;
  return (id && table[id]) || table.midnight;
}
