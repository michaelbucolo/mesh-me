// Canvas painter for the constellation scene. Everything is projected to
// screen space manually (no ctx scale) so node sizes scale with zoom while
// strokes and labels stay crisp. The painter also records each node's screen
// hitbox for pointer hit-testing.

import type { BranchKey, SceneModel, SceneNode } from "./scene-model";

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
}

function project(node: { dx: number; dy: number }, o: RenderOptions) {
  return {
    x: o.width / 2 + o.camera.panX + node.dx * o.camera.zoom,
    y: o.height / 2 + o.camera.panY + node.dy * o.camera.zoom,
  };
}

const BIRTH_MS = 1150;

/** 0→1 arrival progress (easeOutCubic) for a freshly joined node; 1 if settled. */
function birthProgress(node: SceneNode, time: number): number {
  if (node.bornAt == null) return 1;
  const age = time - node.bornAt;
  if (age < 0 || age >= BIRTH_MS) return 1;
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
): void {
  // Soft ambient halo — single, gentle, so the node glows without smearing.
  const halo = ctx.createRadialGradient(x, y, r * 0.7, x, y, r * 2.4);
  halo.addColorStop(0, withAlpha(color, 0.22 * emph));
  halo.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
  ctx.fill();

  // Flat body with a subtle top-down sheen — reads as a solid, lit surface.
  const body = ctx.createLinearGradient(x, y - r, x, y + r);
  body.addColorStop(0, withAlpha(tint(color, 0.18), 0.92 * emph + 0.08));
  body.addColorStop(1, withAlpha(color, 0.92 * emph + 0.08));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Crisp lit hairline defines the edge cleanly.
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(light, 0.55 * emph + 0.12);
  ctx.lineWidth = 1;
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
  const alpha = 0.4 + 0.6 * emph;
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

  // Header row: platform dot + name (+ verified) left, time/handle right.
  const headCy = y + headH / 2;
  ctx.beginPath();
  ctx.arc(x + pad + 4 * scale, headCy, 4 * scale, 0, Math.PI * 2);
  ctx.fillStyle = node.color;
  ctx.fill();
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
  ctx.fillStyle = withAlpha("#9aa3bc", 0.95);
  const parts: string[] = [];
  if (likes != null) parts.push(`♥ ${likes}`);
  if (comments != null) parts.push(`💬 ${comments}`);
  if (parts.length) ctx.fillText(parts.join("   "), x + pad, footY);

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

const NEBULAE = [
  { hue: "#3b62c9", ax: 0.24, ay: 0.28, rad: 0.55, sp: 0.00007, a: 0.1 },
  { hue: "#7c3aed", ax: 0.78, ay: 0.34, rad: 0.5, sp: -0.00005, a: 0.09 },
  { hue: "#d6438f", ax: 0.6, ay: 0.82, rad: 0.6, sp: 0.00006, a: 0.07 },
];

export function drawScene(o: RenderOptions): void {
  const { ctx, model, width, height, time } = o;
  ctx.clearRect(0, 0, width, height);

  // Deep-space background with your core's glow anchored at centre.
  const gcx = width / 2 + o.camera.panX;
  const gcy = height / 2 + o.camera.panY;
  const bg = ctx.createRadialGradient(gcx, gcy, 0, width / 2, height / 2, Math.max(width, height) * 0.85);
  bg.addColorStop(0, "#0c1226");
  bg.addColorStop(0.55, "#070a16");
  bg.addColorStop(1, "#030409");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Drifting aurora nebulae in the brand hues — slow, additive, alive.
  ctx.globalCompositeOperation = "lighter";
  for (const n of NEBULAE) {
    const px = width * n.ax + Math.sin(time * n.sp) * width * 0.05 + o.camera.panX * 0.04;
    const py = height * n.ay + Math.cos(time * n.sp * 1.3) * height * 0.05 + o.camera.panY * 0.04;
    const rr = Math.max(width, height) * n.rad;
    const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
    g.addColorStop(0, withAlpha(n.hue, n.a));
    g.addColorStop(1, withAlpha(n.hue, 0));
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
    ctx.fillStyle = withAlpha("#aab4e8", 0.18 * tw);
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

  const nodes = model.nodes;
  o.pillHitboxes?.clear();
  o.profileHitboxes?.clear();

  // Chain of ids from the hovered node back to the center — these strands light up.
  const hoverChain = new Set<string>();
  if (o.hoverId) {
    let cursor: SceneNode | undefined = nodes.get(o.hoverId);
    while (cursor) {
      hoverChain.add(cursor.id);
      cursor = cursor.parentId ? nodes.get(cursor.parentId) : undefined;
    }
  }

  const emphasisFor = (node: SceneNode): number => {
    if (hoverChain.has(node.id)) return 1;
    if (o.selectedId === node.id) return 1;
    if (node.kind === "self" || node.kind === "branch") return 1;
    if (!o.activeBranch) return 0.62;
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
    const onHoverPath = hoverChain.has(node.id) && hoverChain.has(parent.id);
    const baseAlpha = node.depth === 1 ? 0.34 : node.depth === 2 ? 0.22 : 0.14;
    const alpha = onHoverPath ? 0.85 : baseAlpha * (0.35 + 0.65 * emph);
    const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    grad.addColorStop(0, withAlpha(parent.color, alpha));
    grad.addColorStop(1, withAlpha(node.color, alpha));
    ctx.strokeStyle = grad;
    ctx.lineWidth = (onHoverPath ? 2.4 : node.depth === 1 ? 1.6 : 1) * Math.max(0.7, o.camera.zoom);

    // When the child just joined the mesh, the strand draws itself out from the
    // parent to the new node, with a bright tip leading the way.
    const strandGrow = birthProgress(node, time);
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
      ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
      ctx.stroke();
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

    // A travelling spark that rides along the curved strand.
    if (emph > 0.7 && node.depth <= 2) {
      const t = (Math.sin(time * 0.0009 + node.x * 0.01 + node.y * 0.01) + 1) / 2;
      const mt = 1 - t;
      const sx = mt * mt * a.x + 2 * mt * t * c.x + t * t * b.x;
      const sy = mt * mt * a.y + 2 * mt * t * c.y + t * t * b.y;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.6 * Math.max(0.8, o.camera.zoom), 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(node.color, 0.6 * emph);
      ctx.fill();
    }
  });

  // --- Web cross-links ---
  // Beyond the parent→child spokes, weave faint threads between spatially near
  // nodes so the whole thing reads as one interconnected mesh — a living web,
  // not a spoke diagram. Post cards are excluded so the weave stays airy.
  const webNodes: { node: SceneNode; x: number; y: number }[] = [];
  nodes.forEach((node) => {
    if (node.kind === "self" || node.kind === "post") return;
    const p = project(node, o);
    if (p.x < -60 || p.x > width + 60 || p.y < -60 || p.y > height + 60) return;
    webNodes.push({ node, x: p.x, y: p.y });
  });
  const linkDist = 168 * Math.max(0.6, o.camera.zoom);
  for (let i = 0; i < webNodes.length; i += 1) {
    const A = webNodes[i];
    for (let j = i + 1; j < webNodes.length; j += 1) {
      const B = webNodes[j];
      // Skip pairs already joined by a spoke.
      if (A.node.parentId === B.node.id || B.node.parentId === A.node.id) continue;
      const dx = A.x - B.x;
      const dy = A.y - B.y;
      const d = Math.hypot(dx, dy);
      if (d > linkDist) continue;
      const emph = Math.min(emphasisFor(A.node), emphasisFor(B.node));
      const alpha = (1 - d / linkDist) * 0.14 * (0.35 + 0.65 * emph);
      if (alpha < 0.012) continue;
      const grad = ctx.createLinearGradient(A.x, A.y, B.x, B.y);
      grad.addColorStop(0, withAlpha(A.node.color, alpha));
      grad.addColorStop(1, withAlpha(B.node.color, alpha));
      ctx.strokeStyle = grad;
      ctx.lineWidth = 0.9 * Math.max(0.7, o.camera.zoom);
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.stroke();
    }
  }

  // --- Nodes ---
  const labelQueue: { node: SceneNode; x: number; y: number; r: number; emph: number }[] = [];
  const selfQueue: { node: SceneNode; x: number; y: number; emph: number; isHover: boolean; isSelected: boolean }[] = [];

  nodes.forEach((node) => {
    const p = project(node, o);
    let r = Math.max(2.5, baseRadius(node) * Math.max(0.5, Math.min(o.camera.zoom, 2.2)));
    o.hitboxes.set(node.id, { x: p.x, y: p.y, r: Math.max(r, 14) });

    // Cull offscreen (cards are wide, so give them a larger margin).
    const cull = node.kind === "post" ? 170 : 80;
    if (p.x < -cull || p.x > width + cull || p.y < -cull || p.y > height + cull) return;

    // Arrival: new content pops into its place with a grow + expanding burst
    // ring before its strands draw out to everything it connects to.
    const born = birthProgress(node, time);
    if (born < 1 && node.kind !== "self") {
      const burstR = r * (1.2 + born * 3.2);
      ctx.beginPath();
      ctx.arc(p.x, p.y, burstR, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha(node.color, 0.5 * (1 - born));
      ctx.lineWidth = 2 * (1 - born) + 0.5;
      ctx.stroke();
      // Overshoot grow-in.
      r *= 0.35 + 0.75 * born - 0.1 * Math.sin(born * Math.PI);
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

    // Posts float as rich cards once the camera is close enough to read them.
    if (node.kind === "post" && o.camera.zoom >= 0.32 && emph > 0.2) {
      const cardScale =
        Math.max(0.6, Math.min(o.camera.zoom, 1.35)) * (0.82 + node.weight * 0.36);
      const size = drawPostCard(o, node, p.x, p.y, cardScale, emph, isHover, isSelected);
      o.hitboxes.set(node.id, { x: p.x, y: p.y, r: Math.max(size.w, size.h) / 2 });
      return;
    }

    const light = tint(node.color, 0.72);
    const img = node.avatarUrl ? o.images.get(node.id) : node.imageUrl ? o.images.get(node.id) : undefined;

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
      drawOrb(ctx, p.x, p.y, r * (0.97 + 0.03 * pulse), node.color, emph, light);
      if ((node.kind === "person" || node.kind === "persona" || node.kind === "community") && r >= 11) {
        const initial = (node.label || "?").trim().charAt(0).toUpperCase();
        ctx.fillStyle = withAlpha("#ffffff", 0.96 * emph + 0.08);
        ctx.font = `600 ${Math.round(r)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initial, p.x, p.y + r * 0.04);
      }
    }

    // Online status dot for people.
    if ((node.kind === "person" || node.kind === "persona") && node.status === "online") {
      ctx.beginPath();
      ctx.arc(p.x + r * 0.72, p.y + r * 0.72, Math.max(2.5, r * 0.28), 0, Math.PI * 2);
      ctx.fillStyle = "#22c55e";
      ctx.strokeStyle = "#04050c";
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }

    if (isSelected || isFocus || isHover) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha("#ffffff", isSelected ? 0.9 : isHover ? 0.65 : 0.4);
      ctx.lineWidth = isSelected ? 2 : isHover ? 1.6 : 1.2;
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

export function projectNode(node: { dx: number; dy: number }, width: number, height: number, camera: Camera) {
  return {
    x: width / 2 + camera.panX + node.dx * camera.zoom,
    y: height / 2 + camera.panY + node.dy * camera.zoom,
  };
}
