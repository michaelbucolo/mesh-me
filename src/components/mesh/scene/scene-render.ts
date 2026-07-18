// Canvas painter for the constellation scene. Everything is projected to
// screen space manually (no ctx scale) so node sizes scale with zoom while
// strokes and labels stay crisp. The painter also records each node's screen
// hitbox for pointer hit-testing.

import { platformLogoDataUri } from "@/components/platform/platform-logo";
import { GUIDE_RINGS } from "./scene-layout";
import type { BranchKey, SceneModel, SceneNode } from "./scene-model";

// Rasterized brand marks (YouTube, Instagram, TikTok, …) for canvas drawing.
// Built lazily from the same SVGs the DOM uses; null = no mark for that
// platform (fall back to the colored dot/orb).
const logoImages = new Map<string, HTMLImageElement | null>();

function logoImage(platform?: string | null): HTMLImageElement | null {
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

function drawLogoTile(
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

export interface Camera {
  panX: number;
  panY: number;
  zoom: number;
}

export interface RenderOptions {
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
  /** Output: screen-space hitboxes keyed by node id. */
  hitboxes: Map<string, { x: number; y: number; r: number }>;
  /** Output: screen-space label-pill rects keyed by node id (branch/self). */
  pillHitboxes?: Map<string, { x: number; y: number; w: number; h: number }>;
  /** Output: screen-space hitbox for the self-node profile button. */
  profileHitboxes?: Map<string, { x: number; y: number; w: number; h: number }>;
  /** Keep labels clear of the screen center (where the pinned Meshi sits). */
  avoidCenter?: boolean;
  isOwnMesh?: boolean;
  /** Live strand control points from physics, keyed "parent>child". */
  strands?: Map<string, { mx: number; my: number }>;
  /** Interaction pulses riding strands (edge key → start time): a liked post
   * sends a bright wave down its strand to its maker. */
  strandPulses?: Map<string, number>;
  /** Connections online right now but NOT in this room, keyed by userId.
   * `where` is the mesh owner's userId they're exploring (null = elsewhere
   * on mesh.me); `route` is their app route when off the mesh surface.
   * Drawn as discrete indicators at their node. */
  livePresence?: Map<string, { where: string | null; route?: string | null }>;
}

function project(node: { dx: number; dy: number }, o: RenderOptions) {
  return {
    x: o.width / 2 + o.camera.panX + node.dx * o.camera.zoom,
    y: o.height / 2 + o.camera.panY + node.dy * o.camera.zoom,
  };
}

const BIRTH_MS = 1150;

/**
 * 0→1 arrival progress (easeOutCubic) for a freshly joined node; 1 if
 * settled. Nodes whose birth moment hasn't arrived yet return 0 and are not
 * drawn at all — this is what lets the world FORM in choreographed waves
 * instead of appearing all at once.
 */
function birthProgress(node: SceneNode, time: number): number {
  if (node.bornAt == null) return 1;
  const age = time - node.bornAt;
  if (age < 0) return 0;
  if (age >= BIRTH_MS) return 1;
  return 1 - Math.pow(1 - age / BIRTH_MS, 3);
}

/**
 * Draw a node as a clean luminous orb: a soft ambient halo, a flat solid body
 * in the node's colour with a barely-there top sheen for form, and a crisp
 * lit hairline on the rim. Restrained and modern — a point of light on the
 * web, not a glossy gemstone.
 */
function drawOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  emph: number,
  light: string,
  style?: string | null,
): void {
  // Mesh Pro node styles reshape the same three layers — halo, body, rim —
  // rather than adding new effects, so every style stays clean.
  const haloMul = style === "soft" ? 1.7 : style === "bold" ? 1.25 : 1;
  const bodyMul = style === "glass" ? 0.68 : 1;
  const rimMul = style === "glass" ? 1.5 : style === "soft" ? 0.7 : 1;
  const rimWidth = style === "bold" ? 1.8 : 1;

  // Soft ambient halo — single, gentle, so the node glows without smearing.
  const halo = ctx.createRadialGradient(x, y, r * 0.7, x, y, r * 2.4);
  halo.addColorStop(0, withAlpha(color, Math.min(0.4, 0.22 * haloMul) * emph));
  halo.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
  ctx.fill();

  // Flat body with a subtle top-down sheen — reads as a solid, lit surface.
  const body = ctx.createLinearGradient(x, y - r, x, y + r);
  body.addColorStop(0, withAlpha(tint(color, 0.18), (0.92 * emph + 0.08) * bodyMul));
  body.addColorStop(1, withAlpha(color, (0.92 * emph + 0.08) * bodyMul));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Crisp lit hairline defines the edge cleanly.
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(light, Math.min(0.95, (0.55 * emph + 0.12) * rimMul));
  ctx.lineWidth = rimWidth;
  ctx.stroke();
}

// Lighten a #rrggbb hex toward white by amount (0..1 → white).
function tint(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// Custom-drawn meta glyphs (never emoji) so like/comment counts read as ours
// on every device. Drawn at (x, y) = left edge / vertical middle, size s.
function drawGlyphHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
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

function drawGlyphBubble(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
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

function baseRadius(node: SceneNode): number {
  switch (node.kind) {
    case "self":
      return 30;
    case "branch":
      return 18;
    case "person":
    case "persona":
      return 16 + node.weight * 14;
    case "platform":
      return 13 + node.weight * 11;
    case "community":
      return 14 + node.weight * 11;
    case "interest":
      return 10 + node.weight * 10;
    default:
      return 8 + node.weight * 10;
  }
}

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return hex.length === 7 ? hex + a : hex;
}

function roundRectPath(
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

function metaValue(node: SceneNode, label: string): string | null {
  const entry = node.meta?.find((m) => m.label === label);
  return entry ? entry.value : null;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
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
function wrapTwoLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
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

function strandLabelFor(node: SceneNode): string | null {
  if (node.kind !== "branch") return null;
  if (node.branch === "platforms") return "Source";
  if (node.branch === "posts" || node.branch === "communities") return "Owner";
  return null;
}

function drawPill(
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


function drawSelfProfile(
  o: RenderOptions,
  node: SceneNode,
  x: number,
  y: number,
  emph: number,
  isHover: boolean,
  isSelected: boolean,
): { w: number; h: number; profileRect: { x: number; y: number; w: number; h: number } | null; avatarRadius: number } {
  const { ctx } = o;
  const zoomScale = Math.max(0.68, Math.min(1.18, o.camera.zoom * 1.08));
  const avatarR = 31 * zoomScale;
  const bodyMaxW = 272 * zoomScale;
  const nameFont = Math.max(16, 18 * zoomScale);
  const handleFont = Math.max(11, 12 * zoomScale);
  const bioFont = Math.max(11, 12 * zoomScale);
  const chipFont = Math.max(9, 9.5 * zoomScale);
  const buttonFont = Math.max(11, 11.5 * zoomScale);

  ctx.save();

  const glow = ctx.createRadialGradient(x, y, 0, x, y, avatarR * 2.15);
  glow.addColorStop(0, withAlpha('#8aa1ff', 0.55 * emph));
  glow.addColorStop(0.52, withAlpha('#6e8bff', 0.18 * emph));
  glow.addColorStop(1, 'rgba(47,124,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, avatarR * 2.15, 0, Math.PI * 2);
  ctx.fill();

  const ring = ctx.createRadialGradient(x, y, avatarR * 0.52, x, y, avatarR * 1.38);
  ring.addColorStop(0, 'rgba(255,255,255,0.1)');
  ring.addColorStop(0.5, withAlpha('#8aa1ff', 0.65 * emph));
  ring.addColorStop(1, withAlpha('#8b5cf6', 0.14 * emph));
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(x, y, avatarR * 1.34, 0, Math.PI * 2);
  ctx.fill();

  const img = node.avatarUrl ? o.images.get(node.id) : undefined;
  if (img) {
    roundedImage(ctx, img, x, y, avatarR);
    ctx.beginPath();
    ctx.arc(x, y, avatarR, 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha('#c7d2fe', 0.5 + 0.35 * emph);
    ctx.lineWidth = Math.max(1.8, 2.2 * zoomScale);
    ctx.stroke();
  } else {
    const fallback = ctx.createRadialGradient(x - avatarR * 0.18, y - avatarR * 0.18, 0, x, y, avatarR);
    fallback.addColorStop(0, '#ffffff');
    fallback.addColorStop(0.45, node.color);
    fallback.addColorStop(1, withAlpha(node.color, 0.4));
    ctx.fillStyle = fallback;
    ctx.beginPath();
    ctx.arc(x, y, avatarR, 0, Math.PI * 2);
    ctx.fill();
  }

  // The profile panel (name, bio, View Profile, chips) appears only when the
  // center is hovered or selected — at rest the heart of the mesh is just the
  // living Meshi, not a floating ID card.
  if (!isHover && !isSelected) {
    o.profileHitboxes?.delete(node.id);
    ctx.restore();
    return { w: avatarR * 2, h: avatarR * 2, profileRect: null, avatarRadius: avatarR };
  }

  const contentTop = y + avatarR + 18 * zoomScale;
  const chips: string[] = [];
  if (node.isVerified) chips.push('Verified');
  if (o.isOwnMesh) chips.push('Owner', 'Private by default');

  const chipWidths = chips.map((chip) => {
    ctx.font = `600 ${chipFont}px ui-sans-serif, system-ui, sans-serif`;
    return ctx.measureText(chip).width + 18;
  });
  const chipRowW = chipWidths.reduce((sum, value) => sum + value, 0) + Math.max(0, chipWidths.length - 1) * (6 * zoomScale);
  const chipH = chipFont + 8;

  const nameText = node.label;
  ctx.font = `700 ${nameFont}px ui-sans-serif, system-ui, sans-serif`;
  const nameW = ctx.measureText(nameText).width;
  const buttonText = 'View Profile';
  ctx.font = `600 ${buttonFont}px ui-sans-serif, system-ui, sans-serif`;
  const buttonW = ctx.measureText(buttonText).width + 28;
  const buttonH = buttonFont + 12;

  const bio = node.description || '';
  ctx.font = `500 ${bioFont}px ui-sans-serif, system-ui, sans-serif`;
  const bioLines = bio ? wrapTwoLines(ctx, bio, bodyMaxW).slice(0, 2) : [];
  const bioHeight = bioLines.length > 0 ? bioLines.length * (bioFont + 4 * zoomScale) - 4 * zoomScale : 0;

  const textBlockW = Math.max(bodyMaxW, buttonW, chipRowW);
  const panelW = textBlockW + 40 * zoomScale;
  const panelTop = contentTop - 12 * zoomScale;
  const nameY = contentTop;
  const handleY = nameY + nameFont + 9 * zoomScale;
  const bioY = handleY + handleFont + 12 * zoomScale;
  const buttonY = bioY + bioHeight + (bioLines.length > 0 ? 18 * zoomScale : 12 * zoomScale);
  const chipsY = buttonY + buttonH + 16 * zoomScale;
  const panelBottom = chipsY + chipH + 10 * zoomScale;
  const panelRect = {
    x: x - panelW / 2,
    y: panelTop,
    w: panelW,
    h: panelBottom - panelTop,
  };

  roundRectPath(ctx, panelRect.x, panelRect.y, panelRect.w, panelRect.h, 22 * zoomScale);
  ctx.fillStyle = 'rgba(7, 11, 22, 0.42)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f2f5ff';
  ctx.font = `700 ${nameFont}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(nameText, x, nameY);
  if (node.isVerified) {
    const badgeX = x + nameW / 2 + 12 * zoomScale;
    const badgeY = nameY + nameFont * 0.53;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 7 * zoomScale, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha('#60a5fa', 0.18 + 0.48 * emph);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = withAlpha('#93c5fd', 0.8);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.max(8, 9 * zoomScale)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText('✓', badgeX, badgeY + 0.5);
    ctx.textBaseline = 'top';
  }

  ctx.fillStyle = withAlpha('#d2d9ff', 0.88);
  ctx.font = `500 ${handleFont}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(node.sublabel || '', x, handleY);

  if (bioLines.length > 0) {
    ctx.fillStyle = withAlpha('#e4e8ff', 0.84);
    ctx.font = `500 ${bioFont}px ui-sans-serif, system-ui, sans-serif`;
    bioLines.forEach((line, index) => {
      ctx.fillText(line, x, bioY + index * (bioFont + 4 * zoomScale));
    });
  }

  const buttonRect = {
    x: x - buttonW / 2,
    y: buttonY,
    w: buttonW,
    h: buttonH,
  };
  roundRectPath(ctx, buttonRect.x, buttonRect.y, buttonRect.w, buttonRect.h, buttonH / 2);
  ctx.fillStyle = isSelected || isHover ? 'rgba(69,126,255,0.34)' : 'rgba(69,126,255,0.22)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(124,172,255,0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${buttonFont}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(buttonText, x, buttonRect.y + buttonRect.h / 2 + 0.5);
  o.profileHitboxes?.set(node.id, buttonRect);

  let chipCursor = x - chipRowW / 2;
  for (const [index, chip] of chips.entries()) {
    const chipW = chipWidths[index];
    const chipRect = { x: chipCursor, y: chipsY, w: chipW, h: chipH };
    roundRectPath(ctx, chipRect.x, chipRect.y, chipRect.w, chipRect.h, chipH / 2);
    ctx.fillStyle = chip === 'Verified' ? 'rgba(74,144,255,0.16)' : 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.strokeStyle = chip === 'Verified' ? 'rgba(114,174,255,0.42)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#f3f6ff';
    ctx.font = `600 ${chipFont}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(chip, chipRect.x + chipRect.w / 2, chipRect.y + chipRect.h / 2 + 0.5);
    chipCursor += chipW + 6 * zoomScale;
  }

  ctx.restore();
  return { w: panelW, h: panelRect.h, profileRect: buttonRect, avatarRadius: avatarR };
}
/** Rich floating card for post nodes: media, text, likes/comments, source chip. */
function drawPostCard(
  o: RenderOptions,
  node: SceneNode,
  cx: number,
  cy: number,
  scale: number,
  emph: number,
  isHover: boolean,
  isSelected: boolean,
): { w: number; h: number } {
  const { ctx } = o;
  const img = node.imageUrl ? o.images.get(node.id) : undefined;
  const pad = 10 * scale;
  const w = 172 * scale;
  const headH = 22 * scale;
  const imgH = img ? 96 * scale : 0;
  const fontSize = Math.max(8, 10.5 * scale);
  const textH = 32 * scale;
  const footH = 22 * scale;
  const h = headH + imgH + textH + footH;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const radius = 16 * scale;
  // Time flows outward AND fades: fresh work is vivid, old work recedes like
  // memory — but never below readable.
  const alpha = (0.4 + 0.6 * emph) * (0.62 + 0.38 * (node.freshness ?? 1));
  const bodyFill = "rgba(13, 17, 30, 0.94)";

  ctx.save();
  ctx.globalAlpha = alpha;

  // Card body with soft, layered shadow (matches the glass card language).
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 22 * scale;
  ctx.shadowOffsetY = 8 * scale;
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = bodyFill;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Header row: the source's REAL logo (falls back to its color dot) + name
  // (+ verified) left, time/handle right.
  const headCy = y + headH / 2;
  const headLogo = logoImage(node.sublabel);
  if (headLogo) {
    drawLogoTile(ctx, headLogo, x + pad + 4.5 * scale, headCy, 10.5 * scale, 1);
  } else {
    ctx.beginPath();
    ctx.arc(x + pad + 4 * scale, headCy, 4 * scale, 0, Math.PI * 2);
    ctx.fillStyle = node.color;
    ctx.fill();
  }
  const headFont = Math.max(8, 9.5 * scale);
  ctx.font = `700 ${headFont}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#eef2ff";
  const platform = node.sublabel || "Mesh.me";
  const headLabel = fitText(ctx, platform, w - pad * 2 - 44 * scale);
  ctx.fillText(headLabel, x + pad + 12 * scale, headCy + 0.5);
  const headLabelW = ctx.measureText(headLabel).width;
  if (node.isVerified) {
    const bx = x + pad + 12 * scale + headLabelW + 6 * scale;
    ctx.beginPath();
    ctx.arc(bx, headCy, 3.4 * scale, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha("#6e8bff", 0.9);
    ctx.fill();
  }
  const timeText = metaValue(node, "Time") || metaValue(node, "Ago") || node.status || "";
  if (timeText) {
    ctx.font = `500 ${Math.max(7.5, 8.5 * scale)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = withAlpha("#9aa3bc", 0.9);
    ctx.textAlign = "right";
    ctx.fillText(fitText(ctx, timeText, w * 0.32), x + w - pad, headCy + 0.5);
  }

  // Media region (below header).
  const mediaY = y + headH;
  if (img) {
    ctx.save();
    roundRectPath(ctx, x + 1, mediaY, w - 2, imgH, 2 * scale);
    ctx.clip();
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (iw > 0 && ih > 0) {
      const cover = Math.max(w / iw, imgH / ih);
      const sw = w / cover;
      const sh = imgH / cover;
      ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, mediaY, w, imgH);
    }
    const fade = ctx.createLinearGradient(0, mediaY + imgH - 22 * scale, 0, mediaY + imgH);
    fade.addColorStop(0, "rgba(13,17,30,0)");
    fade.addColorStop(1, "rgba(13,17,30,0.9)");
    ctx.fillStyle = fade;
    ctx.fillRect(x, mediaY + imgH - 22 * scale, w, 22 * scale);
    ctx.restore();
  }

  // Text snippet.
  const textY = mediaY + imgH + 7 * scale;
  ctx.font = `500 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#eef2ff";
  const lines = wrapTwoLines(ctx, node.content || node.label, w - pad * 2);
  ctx.fillText(lines[0], x + pad, textY);
  if (lines[1]) {
    ctx.fillStyle = withAlpha("#c8cfe6", 0.8);
    ctx.fillText(lines[1], x + pad, textY + fontSize + 3 * scale);
  }

  // Footer: likes · comments and a "Source" chip.
  const footY = y + h - footH + footH / 2;
  const metaFont = Math.max(7.5, 9 * scale);
  ctx.font = `600 ${metaFont}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  const likes = metaValue(node, "Likes");
  const comments = metaValue(node, "Comments");
  const metaColor = withAlpha("#9aa3bc", 0.95);
  const gsz = Math.max(6, 7.5 * scale);
  const gap = 5 * scale;
  let mx = x + pad;
  if (likes != null) {
    drawGlyphHeart(ctx, mx, footY, gsz, withAlpha("#f472b6", 0.95));
    mx += gsz + gap * 0.7;
    ctx.fillStyle = metaColor;
    const s = String(likes);
    ctx.fillText(s, mx, footY);
    mx += ctx.measureText(s).width + gap * 2.2;
  }
  if (comments != null) {
    drawGlyphBubble(ctx, mx, footY, gsz, metaColor);
    mx += gsz + gap * 0.7;
    ctx.fillStyle = metaColor;
    ctx.fillText(String(comments), mx, footY);
  }

  // Source chip (pill) on the right.
  const chipText = "Source";
  ctx.font = `600 ${Math.max(7, 8 * scale)}px ui-sans-serif, system-ui, sans-serif`;
  const chipTW = ctx.measureText(chipText).width;
  const chipPadX = 6 * scale;
  const chipW = chipTW + chipPadX * 2;
  const chipH = 13 * scale;
  const chipX = x + w - pad - chipW;
  const chipY = footY - chipH / 2;
  roundRectPath(ctx, chipX, chipY, chipW, chipH, chipH / 2);
  ctx.fillStyle = withAlpha(node.color, 0.16);
  ctx.fill();
  ctx.strokeStyle = withAlpha(node.color, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = withAlpha(node.color, 0.95);
  ctx.textAlign = "center";
  ctx.fillText(chipText, chipX + chipW / 2, footY + 0.5);

  // Border + soft glow.
  ctx.textAlign = "left";
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.strokeStyle = withAlpha(node.color, isSelected ? 0.95 : isHover ? 0.8 : 0.32 * emph + 0.14);
  ctx.lineWidth = isSelected || isHover ? 1.8 : 1.1;
  ctx.stroke();

  // Arrived since your last visit — a bright, unmissable mark.
  if (node.isNew) {
    ctx.globalAlpha = 1;
    drawPill(ctx, x + 26 * scale, y, "New", "rgba(34,211,238,0.94)", "rgba(165,243,252,0.9)", "#032830", Math.max(8, 9 * scale), 7);
  }

  ctx.restore();
  return { w, h };
}

function roundedImage(
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
const NEBULA_FIELD = [
  { ax: 0.24, ay: 0.28, rad: 0.55, sp: 0.00007, a: 0.06 },
  { ax: 0.78, ay: 0.34, rad: 0.5, sp: -0.00005, a: 0.05 },
  { ax: 0.6, ay: 0.82, rad: 0.6, sp: 0.00006, a: 0.04 },
];

/**
 * Mesh Atmospheres — the sky palette of a mesh. "midnight" is the free
 * default; the rest are Mesh Pro skies. Every palette keeps the same quiet
 * alpha budget, so a Pro sky changes the mood, never the readability.
 */
interface AtmosphereSpec {
  id: string;
  label: string;
  pro: boolean;
  /** Radial background stops: centre → mid → rim. */
  bg: [string, string, string];
  /** Hues for the three drifting nebulae. */
  nebulae: [string, string, string];
  /** Star tint. */
  star: string;
}

const ATMOSPHERES: Record<string, AtmosphereSpec> = {
  midnight: { id: "midnight", label: "Midnight", pro: false, bg: ["#0c1226", "#070a16", "#030409"], nebulae: ["#3b62c9", "#7c3aed", "#d6438f"], star: "#aab4e8" },
  aurora: { id: "aurora", label: "Aurora", pro: true, bg: ["#0a1f28", "#06121b", "#02070c"], nebulae: ["#14b8a6", "#22c55e", "#3b62c9"], star: "#a7e8d0" },
  ember: { id: "ember", label: "Ember", pro: true, bg: ["#241318", "#140b10", "#080406"], nebulae: ["#f97316", "#e11d48", "#7c3aed"], star: "#f5c9a8" },
  ocean: { id: "ocean", label: "Ocean", pro: true, bg: ["#0a1a30", "#051224", "#02060d"], nebulae: ["#0284c7", "#06b6d4", "#4f46e5"], star: "#a5d8f0" },
  dawn: { id: "dawn", label: "Dawn", pro: true, bg: ["#1d1330", "#100a1c", "#06040a"], nebulae: ["#c026d3", "#f59e0b", "#3b62c9"], star: "#e8c9f0" },
};

function atmosphereOf(id?: string | null): AtmosphereSpec {
  return (id && ATMOSPHERES[id]) || ATMOSPHERES.midnight;
}

export function drawScene(o: RenderOptions): void {
  const { ctx, model, width, height, time } = o;
  ctx.clearRect(0, 0, width, height);

  // Deep-space background in the owner's atmosphere, with your core's glow
  // anchored at centre.
  const atmo = atmosphereOf(o.visuals?.atmosphere);
  const gcx = width / 2 + o.camera.panX;
  const gcy = height / 2 + o.camera.panY;
  const bg = ctx.createRadialGradient(gcx, gcy, 0, width / 2, height / 2, Math.max(width, height) * 0.85);
  bg.addColorStop(0, atmo.bg[0]);
  bg.addColorStop(0.55, atmo.bg[1]);
  bg.addColorStop(1, atmo.bg[2]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Drifting aurora nebulae in the atmosphere's hues — slow, additive, alive.
  // Pro skies get a slightly richer color budget so the change of mood is
  // unmistakable, while content still sits clearly in front.
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
  for (const s of o.backgroundStars) {
    const sx = (s.x + o.camera.panX * 0.05) % width;
    const sy = (s.y + o.camera.panY * 0.05) % height;
    const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * 0.0012 + s.tw));
    ctx.beginPath();
    ctx.arc(sx < 0 ? sx + width : sx, sy < 0 ? sy + height : sy, s.r, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(atmo.star, 0.12 * tw);
    ctx.fill();
  }

  // Focal vignette — the outer field falls into shadow so the eye is drawn to
  // the living center. Drawn over the sky but under the nodes, so stars fade at
  // the rim while every node stays crisp and lit.
  const vig = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.32,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72,
  );
  vig.addColorStop(0, "rgba(3,4,9,0)");
  vig.addColorStop(1, "rgba(2,3,7,0.45)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);

  // --- Closeness guide rings: quiet geometry only — the welcome note says
  // closeness = distance once; the world shouldn't caption itself.
  if (o.isOwnMesh && o.camera.zoom <= 1.15 && model.nodes.size > 1) {
    ctx.save();
    for (const ring of GUIDE_RINGS) {
      const rr = ring.radius * o.camera.zoom;
      ctx.beginPath();
      ctx.setLineDash([3, 9]);
      ctx.arc(gcx, gcy, rr, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(148,163,184,0.10)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  const nodes = model.nodes;
  o.pillHitboxes?.clear();
  o.profileHitboxes?.clear();

  // Chain of ids from the hovered node back to the center — these strands light up.
  const chainFrom = (id: string | null | undefined): Set<string> => {
    const chain = new Set<string>();
    if (!id) return chain;
    let cursor: SceneNode | undefined = nodes.get(id);
    while (cursor) {
      chain.add(cursor.id);
      cursor = cursor.parentId ? nodes.get(cursor.parentId) : undefined;
    }
    return chain;
  };
  const hoverChain = chainFrom(o.hoverId);
  // Selecting something focuses the world on its lineage: the selected node,
  // its maker, and you stay lit; everything unrelated recedes. This is how
  // "what am I looking at, and where did it come from" stays unmistakable.
  const selChain = chainFrom(o.selectedId);

  const emphasisFor = (node: SceneNode): number => {
    if (hoverChain.has(node.id) || selChain.has(node.id)) return 1;
    if (node.kind === "self" || node.kind === "branch") return 1;
    if (selChain.size > 0) return 0.24;
    // At rest the mesh should read as CONTENT, not dim geometry — posts and
    // people stay bright enough to recognize without focusing a branch.
    if (!o.activeBranch) return 0.8;
    return node.branch === o.activeBranch ? 1 : 0.18;
  };

  // --- Edges (constellation strands) ---
  ctx.lineCap = "round";
  nodes.forEach((node) => {
    if (!node.parentId) return;
    const parent = nodes.get(node.parentId);
    if (!parent) return;
    const a = project(parent, o);
    const b = project(node, o);
    // Physical strand: bend the line through its live control point so it
    // droops and sways like an elastic filament instead of a rigid spoke.
    const sp = o.strands?.get(`${parent.id}>${node.id}`);
    const c = sp ? project({ dx: sp.mx, dy: sp.my }, o) : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const emph = Math.min(emphasisFor(node), emphasisFor(parent));
    const onHoverPath =
      (hoverChain.has(node.id) && hoverChain.has(parent.id)) ||
      (selChain.has(node.id) && selChain.has(parent.id));
    // Two kinds of strand, two visual languages: dotted thread = a
    // relationship (you↔person, you↔platform); solid line = authorship
    // (maker→work). Every line on the mesh means exactly one of those.
    const isRelationship = parent.kind === "self" && node.kind !== "post";
    const baseAlpha = node.depth === 1 ? 0.34 : node.depth === 2 ? 0.22 : 0.14;
    const alpha = onHoverPath ? 0.85 : baseAlpha * (0.35 + 0.65 * emph);
    // Mesh Pro: the owner can dye their relationship threads a signature color.
    const threadColor = isRelationship ? o.visuals?.connectionColor || null : null;
    const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    grad.addColorStop(0, withAlpha(threadColor ?? parent.color, alpha));
    grad.addColorStop(1, withAlpha(threadColor ?? node.color, alpha));
    ctx.strokeStyle = grad;
    ctx.lineWidth = (onHoverPath ? 2.4 : node.depth === 1 ? 1.6 : 1) * Math.max(0.7, o.camera.zoom);

    // When the child just joined the mesh, the strand draws itself out from the
    // parent to the new node, with a bright tip leading the way. Not yet born
    // means not yet drawn.
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

    // Relationship pills only appear when you're tracing that strand — the
    // resting mesh stays clean.
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
        "rgba(8, 12, 24, 0.82)",
        withAlpha(node.color, 0.56),
        "#f3f6ff",
        Math.max(9, 9.5 * o.camera.zoom),
        8,
      );
    }

    // Interaction pulse: when someone hearts this node, a bright wave rides
    // the strand from the work back to its maker — the relationship visibly
    // carrying the interaction.
    const pulseStart = o.strandPulses?.get(`${parent.id}>${node.id}`);
    if (pulseStart != null) {
      const pt = (time - pulseStart) / 900;
      if (pt >= 0 && pt < 1) {
        const t = 1 - pt; // travels child → parent
        const mt = 1 - t;
        const px2 = mt * mt * a.x + 2 * mt * t * c.x + t * t * b.x;
        const py2 = mt * mt * a.y + 2 * mt * t * c.y + t * t * b.y;
        const glowR = 5 * Math.max(0.8, o.camera.zoom) * (1 - pt * 0.5);
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
    }

  });

  // --- Nodes ---
  const labelQueue: { node: SceneNode; x: number; y: number; r: number; emph: number }[] = [];
  const selfQueue: { node: SceneNode; x: number; y: number; emph: number; isHover: boolean; isSelected: boolean }[] = [];

  nodes.forEach((node) => {
    const bornNow = birthProgress(node, time);
    if (bornNow <= 0 && node.kind !== "self") {
      o.hitboxes.delete(node.id);
      return;
    }
    const p = project(node, o);
    let r = Math.max(2.5, baseRadius(node) * Math.max(0.5, Math.min(o.camera.zoom, 2.2)));
    o.hitboxes.set(node.id, { x: p.x, y: p.y, r: Math.max(r, 14) });

    // Cull offscreen (cards are wide, so give them a larger margin).
    const cull = node.kind === "post" ? 170 : 80;
    if (p.x < -cull || p.x > width + cull || p.y < -cull || p.y > height + cull) return;

    // Arrival: something new joining the mesh is a small celebration — two
    // staggered ripple rings, a brief four-point sparkle with a warm flash,
    // and a springy grow-in that settles exactly at full size.
    const born = birthProgress(node, time);
    if (born < 1 && node.kind !== "self") {
      for (let ri = 0; ri < 2; ri += 1) {
        const rp = Math.min(1, Math.max(0, born * 1.35 - ri * 0.28));
        if (rp > 0 && rp < 1) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * (1.1 + rp * 3.6), 0, Math.PI * 2);
          ctx.strokeStyle = withAlpha(ri === 0 ? node.color : "#ffffff", 0.5 * (1 - rp));
          ctx.lineWidth = (ri === 0 ? 2.2 : 1.2) * (1 - rp) + 0.4;
          ctx.stroke();
        }
      }
      if (born < 0.45) {
        const sp = born / 0.45;
        const rayLen = r * (1.6 + sp * 2.8);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(sp * 0.9);
        ctx.strokeStyle = withAlpha("#fff7d6", 0.75 * (1 - sp));
        ctx.lineWidth = 1.4;
        for (let k = 0; k < 4; k += 1) {
          const a = (Math.PI / 2) * k + Math.PI / 4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
          ctx.lineTo(Math.cos(a) * rayLen, Math.sin(a) * rayLen);
          ctx.stroke();
        }
        ctx.restore();
        const flash = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.4);
        flash.addColorStop(0, withAlpha("#fff2c4", 0.5 * (1 - sp)));
        flash.addColorStop(1, withAlpha("#fff2c4", 0));
        ctx.fillStyle = flash;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      // Ease-out-back: overshoots ~9% mid-flight and lands exactly at 1.
      const t1 = born - 1;
      r *= Math.max(0.12, 1 + 2.70158 * t1 * t1 * t1 + 1.70158 * t1 * t1);
    }

    const emph = emphasisFor(node);
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.002 + node.x * 0.02);
    const isSelected = o.selectedId === node.id;
    const isFocus = o.focusId === node.id;
    const isHover = o.hoverId === node.id;

    if (node.kind === "self") {
      o.hitboxes.set(node.id, { x: p.x, y: p.y, r: Math.max(baseRadius(node) * Math.max(0.5, Math.min(o.camera.zoom, 2.2)), 44) });
      selfQueue.push({ node, x: p.x, y: p.y, emph, isHover, isSelected });
      return;
    }

    // Posts float as rich cards only once the camera is close enough to READ
    // them — zoomed out they collapse to compact thumbnails/orbs, so a busy
    // mesh reads as a constellation, not a wall of cards.
    if (node.kind === "post" && o.camera.zoom >= 0.42 && emph > 0.2) {
      const cardScale =
        Math.max(0.78, Math.min(o.camera.zoom, 1.35)) * (0.82 + node.weight * 0.36);
      const size = drawPostCard(o, node, p.x, p.y, cardScale, emph, isHover, isSelected);
      o.hitboxes.set(node.id, { x: p.x, y: p.y, r: Math.max(size.w, size.h) / 2 });
      return;
    }

    const light = tint(node.color, 0.72);
    const img = node.avatarUrl ? o.images.get(node.id) : node.imageUrl ? o.images.get(node.id) : undefined;

    // Platform nodes wear their REAL brand mark — a YouTube node looks like
    // YouTube, not an abstract colored ball.
    if (node.kind === "platform") {
      const brand = logoImage(node.label);
      if (brand) {
        const halo = ctx.createRadialGradient(p.x, p.y, r * 0.6, p.x, p.y, r * 2.2);
        halo.addColorStop(0, withAlpha(node.color, 0.2 * emph));
        halo.addColorStop(1, withAlpha(node.color, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2);
        ctx.fill();
        drawLogoTile(ctx, brand, p.x, p.y, r * 1.9, 0.4 + 0.6 * emph);
        roundRectPath(ctx, p.x - r * 0.95, p.y - r * 0.95, r * 1.9, r * 1.9, r * 0.53);
        ctx.strokeStyle = withAlpha(light, 0.5 * emph + 0.15);
        ctx.lineWidth = 1;
        ctx.stroke();
        if (isSelected || isFocus || isHover) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
          ctx.strokeStyle = withAlpha("#ffffff", isSelected ? 0.95 : isHover ? 0.65 : 0.4);
          ctx.lineWidth = isSelected ? 2 : 1.4;
          ctx.stroke();
        }
        const showBrandLabel =
          isSelected || isFocus || isHover || (o.activeBranch !== null && node.branch === o.activeBranch);
        if (showBrandLabel) labelQueue.push({ node, x: p.x, y: p.y, r, emph });
        return;
      }
    }

    if (img && (node.kind === "person" || node.kind === "persona" || node.kind === "activity" || node.kind === "post")) {
      // Bloom behind the avatar, then the image inside a lit rim.
      const bloom = ctx.createRadialGradient(p.x, p.y, r * 0.4, p.x, p.y, r * 3);
      bloom.addColorStop(0, withAlpha(node.color, 0.3 * emph + 0.04));
      bloom.addColorStop(1, withAlpha(node.color, 0));
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.35 + 0.65 * emph;
      roundedImage(ctx, img, p.x, p.y, r);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha(light, 0.6 * emph + 0.18);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // Everything else is a clean luminous orb.
      drawOrb(ctx, p.x, p.y, r * (0.97 + 0.03 * pulse), node.color, emph, light, o.visuals?.nodeStyle);
      if ((node.kind === "person" || node.kind === "persona" || node.kind === "community") && r >= 11) {
        const initial = (node.label || "?").trim().charAt(0).toUpperCase();
        ctx.fillStyle = withAlpha("#ffffff", 0.96 * emph + 0.08);
        ctx.font = `600 ${Math.round(r)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initial, p.x, p.y + r * 0.04);
      }
    }

    // Aliveness: people online right now breathe — a soft green pulse ring
    // plus the status dot, so the living parts of your world stand out.
    // Live presence (heartbeats) is the truth; the snapshot status backs it.
    const personUid =
      node.kind === "person" || node.kind === "persona"
        ? node.id.startsWith("person:")
          ? node.id.slice(7)
          : null
        : null;
    const live = personUid ? o.livePresence?.get(personUid) : undefined;
    if (personUid && (live || node.status === "online")) {
      const breathe = 0.5 + 0.5 * Math.sin(time * 0.0035 + node.x * 0.05);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 5 + 3 * breathe, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha("#22c55e", 0.18 + 0.2 * (1 - breathe));
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x + r * 0.72, p.y + r * 0.72, Math.max(2.5, r * 0.28), 0, Math.PI * 2);
      ctx.fillStyle = "#22c55e";
      ctx.strokeStyle = "#04050c";
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }

    // Where are they? A discrete chip above the node names the mesh they're
    // exploring right now — no Meshi hovering, just a quiet, readable status.
    if (live && emph > 0.3 && o.camera.zoom >= 0.4) {
      let text = "online";
      if (live.where) {
        if (live.where === personUid) {
          text = "on their mesh";
        } else {
          const whereNode = nodes.get(`person:${live.where}`);
          text = whereNode ? `in ${whereNode.label}'s mesh` : "exploring a mesh";
        }
      } else if (live.route) {
        // Off the mesh surface, their route still says what they're up to.
        if (live.route.startsWith("/flow")) text = "watching the Flow";
        else if (live.route.startsWith("/messages")) text = "in MeChat";
        else if (live.route.startsWith("/explore")) text = "exploring";
        else if (live.route.startsWith("/trail")) text = "on their Trail";
      }
      ctx.save();
      const chipFont = 9.5;
      ctx.font = `600 ${chipFont}px ui-sans-serif, system-ui, sans-serif`;
      const label = fitText(ctx, text, 118);
      const textW = ctx.measureText(label).width;
      const dotR = 2.6;
      const padX = 7;
      const h = chipFont + 8;
      const w = textW + padX * 2 + dotR * 2 + 5;
      const cx0 = p.x - w / 2;
      const cy0 = p.y - r - h - 9;
      roundRectPath(ctx, cx0, cy0, w, h, h / 2);
      ctx.fillStyle = "rgba(6, 10, 20, 0.78)";
      ctx.fill();
      ctx.strokeStyle = "rgba(74, 222, 128, 0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx0 + padX + dotR, cy0 + h / 2, dotR, 0, Math.PI * 2);
      ctx.fillStyle = "#4ade80";
      ctx.fill();
      ctx.fillStyle = "rgba(226, 236, 255, 0.92)";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cx0 + padX + dotR * 2 + 5, cy0 + h / 2 + 0.5);
      ctx.restore();
    }

    if (isSelected) {
      // Selection is unmistakable: a bright ring plus a slow color pulse.
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha("#ffffff", 0.95);
      ctx.lineWidth = 2;
      ctx.stroke();
      const selPulse = 0.5 + 0.5 * Math.sin(time * 0.005);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 11 + selPulse * 3, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha(node.color, 0.35 + 0.35 * selPulse);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    } else if (isFocus || isHover) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha("#ffffff", isHover ? 0.65 : 0.4);
      ctx.lineWidth = isHover ? 1.6 : 1.2;
      ctx.stroke();
    }

    const showLabel =
      node.kind === "branch" ||
      isSelected ||
      isFocus ||
      isHover ||
      (o.activeBranch !== null && node.branch === o.activeBranch && node.depth <= 2);
    if (showLabel) labelQueue.push({ node, x: p.x, y: p.y, r, emph });
  });

  // --- Labels (drawn last, crisp) ---
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  let avoidStack = 0;
  for (const { node, x, y, r, emph } of labelQueue) {
    const isBranch = node.kind === "branch";
    const isSelf = node.kind === "self";
    const fontSize = isSelf ? 14 : isBranch ? 13 : 11;
    ctx.font = `${isBranch || isSelf ? 600 : 500} ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
    const label = isBranch && node.count != null ? `${node.label} · ${node.count}` : node.label;
    let ly = y + r + 6;

    const textW = ctx.measureText(label).width;
    // Keep pills fully on screen and clear of the center-pinned Meshi.
    let lx = x;
    if (isBranch || isSelf) {
      const halfW = textW / 2 + 9;
      lx = Math.max(halfW + 4, Math.min(width - halfW - 4, lx));
      if (o.avoidCenter) {
        const cx = width / 2;
        const cy = height / 2;
        const pillCy = ly + (fontSize + 7) / 2;
        if (Math.hypot(lx - cx, pillCy - cy) < 66) {
          ly = cy + 52 + avoidStack;
          avoidStack += fontSize + 14;
        }
      }
    }
    if (isBranch || isSelf) {
      ctx.fillStyle = withAlpha("#0b1020", 0.7);
      const padX = 7;
      const h = fontSize + 7;
      ctx.beginPath();
      const rx = lx - textW / 2 - padX;
      const radius = h / 2;
      ctx.moveTo(rx + radius, ly);
      ctx.arcTo(rx + textW + padX * 2, ly, rx + textW + padX * 2, ly + h, radius);
      ctx.arcTo(rx + textW + padX * 2, ly + h, rx, ly + h, radius);
      ctx.arcTo(rx, ly + h, rx, ly, radius);
      ctx.arcTo(rx, ly, rx + textW + padX * 2, ly, radius);
      ctx.closePath();
      ctx.fill();
      o.pillHitboxes?.set(node.id, { x: rx, y: ly, w: textW + padX * 2, h });
      ctx.strokeStyle = withAlpha(node.color, 0.5);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#eef1ff";
      ctx.fillText(label, lx, ly + 3.5);
    } else {
      ctx.fillStyle = withAlpha("#e7ebff", 0.7 + 0.3 * emph);
      ctx.shadowColor = "#04050c";
      ctx.shadowBlur = 4;
      ctx.fillText(label, x, ly);
      ctx.shadowBlur = 0;
    }
  }

  for (const item of selfQueue) {
    const card = drawSelfProfile(o, item.node, item.x, item.y, item.emph, item.isHover, item.isSelected);
    o.hitboxes.set(item.node.id, { x: item.x, y: item.y, r: Math.max(card.avatarRadius * 1.12, 26) });
  }
}
