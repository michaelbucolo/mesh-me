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
}

function project(node: { dx: number; dy: number }, o: RenderOptions) {
  return {
    x: o.width / 2 + o.camera.panX + node.dx * o.camera.zoom,
    y: o.height / 2 + o.camera.panY + node.dy * o.camera.zoom,
  };
}

function baseRadius(node: SceneNode): number {
  switch (node.kind) {
    case "self":
      return 26;
    case "branch":
      return 15;
    case "person":
    case "persona":
      return 11 + node.weight * 12;
    case "platform":
      return 9 + node.weight * 10;
    case "community":
      return 9 + node.weight * 9;
    default:
      return 5 + node.weight * 9;
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
): { w: number; h: number; profileRect: { x: number; y: number; w: number; h: number } | null } {
  const { ctx } = o;
  const zoomScale = Math.max(0.9, Math.min(1.18, o.camera.zoom * 1.08));
  const avatarR = 31 * zoomScale;
  const bodyMaxW = 272 * zoomScale;
  const nameFont = Math.max(16, 18 * zoomScale);
  const handleFont = Math.max(11, 12 * zoomScale);
  const bioFont = Math.max(11, 12 * zoomScale);
  const chipFont = Math.max(9, 9.5 * zoomScale);
  const buttonFont = Math.max(11, 11.5 * zoomScale);

  ctx.save();

  const glow = ctx.createRadialGradient(x, y, 0, x, y, avatarR * 2.15);
  glow.addColorStop(0, withAlpha('#7cc0ff', 0.55 * emph));
  glow.addColorStop(0.52, withAlpha('#3b82f6', 0.18 * emph));
  glow.addColorStop(1, 'rgba(47,124,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, avatarR * 2.15, 0, Math.PI * 2);
  ctx.fill();

  const ring = ctx.createRadialGradient(x, y, avatarR * 0.52, x, y, avatarR * 1.38);
  ring.addColorStop(0, 'rgba(255,255,255,0.1)');
  ring.addColorStop(0.5, withAlpha('#7cc0ff', 0.65 * emph));
  ring.addColorStop(1, withAlpha('#3b82f6', 0.12 * emph));
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

  const contentTop = y + avatarR + 18 * zoomScale;
  const chips: string[] = [];
  if (node.isVerified) chips.push('Verified');
  chips.push('Owner', 'Private by default');

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
  return { w: panelW, h: panelRect.h, profileRect: buttonRect };
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
  const w = 148 * scale;
  const imgH = img ? 82 * scale : 0;
  const textH = 34 * scale;
  const footH = 20 * scale;
  const h = imgH + textH + footH;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const radius = 12 * scale;
  const alpha = 0.35 + 0.65 * emph;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Card body with soft shadow.
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 14 * scale;
  ctx.shadowOffsetY = 3 * scale;
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = "rgba(14, 19, 38, 0.92)";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Media region.
  if (img) {
    ctx.save();
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.clip();
    // Cover-crop the media so it fills the region without distortion.
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (iw > 0 && ih > 0) {
      const cover = Math.max(w / iw, imgH / ih);
      const sw = w / cover;
      const sh = imgH / cover;
      ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, imgH);
    }
    const fade = ctx.createLinearGradient(0, y + imgH - 18 * scale, 0, y + imgH);
    fade.addColorStop(0, "rgba(14,19,38,0)");
    fade.addColorStop(1, "rgba(14,19,38,0.85)");
    ctx.fillStyle = fade;
    ctx.fillRect(x, y + imgH - 18 * scale, w, 18 * scale);
    ctx.restore();
  }

  // Text snippet.
  const pad = 9 * scale;
  const fontSize = Math.max(8, 10.5 * scale);
  ctx.font = `500 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#e7ebff";
  const lines = wrapTwoLines(ctx, node.content || node.label, w - pad * 2);
  ctx.fillText(lines[0], x + pad, y + imgH + 6 * scale);
  if (lines[1]) {
    ctx.fillStyle = withAlpha("#e7ebff", 0.75);
    ctx.fillText(lines[1], x + pad, y + imgH + 6 * scale + fontSize + 3 * scale);
  }

  // Footer: likes · comments and source chip.
  const footY = y + h - footH + 2 * scale;
  const metaFont = Math.max(7.5, 9 * scale);
  ctx.font = `600 ${metaFont}px ui-sans-serif, system-ui, sans-serif`;
  const likes = metaValue(node, "Likes");
  const comments = metaValue(node, "Comments");
  ctx.fillStyle = withAlpha("#aab4e8", 0.95);
  const parts: string[] = [];
  if (likes != null) parts.push(`♥ ${likes}`);
  if (comments != null) parts.push(`💬 ${comments}`);
  if (parts.length) ctx.fillText(parts.join("   "), x + pad, footY);

  if (node.sublabel) {
    const chip = fitText(ctx, node.sublabel, w * 0.42);
    ctx.fillStyle = withAlpha(node.color, 0.9);
    ctx.textAlign = "right";
    ctx.fillText(chip, x + w - pad, footY);
    ctx.textAlign = "left";
  }

  // Border glow.
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.strokeStyle = withAlpha(node.color, isSelected ? 0.95 : isHover ? 0.8 : 0.4 * emph + 0.15);
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

export function drawScene(o: RenderOptions): void {
  const { ctx, model, width, height, time } = o;
  ctx.clearRect(0, 0, width, height);

  // Deep-space background.
  const bg = ctx.createRadialGradient(
    width / 2 + o.camera.panX * 0.3,
    height / 2 + o.camera.panY * 0.3,
    0,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.8,
  );
  bg.addColorStop(0, "#0b1020");
  bg.addColorStop(0.6, "#070a16");
  bg.addColorStop(1, "#04050c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Faint static sky stars (parallax with pan).
  for (const s of o.backgroundStars) {
    const sx = (s.x + o.camera.panX * 0.05) % width;
    const sy = (s.y + o.camera.panY * 0.05) % height;
    const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * 0.0012 + s.tw));
    ctx.beginPath();
    ctx.arc(sx < 0 ? sx + width : sx, sy < 0 ? sy + height : sy, s.r, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha("#aab4e8", 0.18 * tw);
    ctx.fill();
  }

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
    const emph = Math.min(emphasisFor(node), emphasisFor(parent));
    const onHoverPath = hoverChain.has(node.id) && hoverChain.has(parent.id);
    const baseAlpha = node.depth === 1 ? 0.34 : node.depth === 2 ? 0.22 : 0.14;
    const alpha = onHoverPath ? 0.85 : baseAlpha * (0.35 + 0.65 * emph);
    const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    grad.addColorStop(0, withAlpha(parent.color, alpha));
    grad.addColorStop(1, withAlpha(node.color, alpha));
    ctx.strokeStyle = grad;
    ctx.lineWidth = (onHoverPath ? 2.4 : node.depth === 1 ? 1.6 : 1) * Math.max(0.7, o.camera.zoom);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    const label = parent.kind === "self" ? strandLabelFor(node) : null;
    if (label && o.camera.zoom >= 0.42) {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
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

    // A travelling spark on active strands.
    if (emph > 0.7 && node.depth <= 2) {
      const t = (Math.sin(time * 0.0009 + node.x * 0.01 + node.y * 0.01) + 1) / 2;
      const sx = a.x + (b.x - a.x) * t;
      const sy = a.y + (b.y - a.y) * t;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.6 * Math.max(0.8, o.camera.zoom), 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(node.color, 0.6 * emph);
      ctx.fill();
    }
  });

  // --- Nodes ---
  const labelQueue: { node: SceneNode; x: number; y: number; r: number; emph: number }[] = [];
  const selfQueue: { node: SceneNode; x: number; y: number; emph: number; isHover: boolean; isSelected: boolean }[] = [];

  nodes.forEach((node) => {
    const p = project(node, o);
    const r = Math.max(2.5, baseRadius(node) * Math.max(0.5, Math.min(o.camera.zoom, 2.2)));
    o.hitboxes.set(node.id, { x: p.x, y: p.y, r: Math.max(r, 14) });

    // Cull offscreen (cards are wide, so give them a larger margin).
    const cull = node.kind === "post" ? 170 : 80;
    if (p.x < -cull || p.x > width + cull || p.y < -cull || p.y > height + cull) return;

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

    // Glow halo.
    const glowR = r * 2.6;
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
    glow.addColorStop(0, withAlpha(node.color, 0.42 * emph));
    glow.addColorStop(1, withAlpha(node.color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
    ctx.fill();

    const img = node.avatarUrl ? o.images.get(node.id) : node.imageUrl ? o.images.get(node.id) : undefined;

    if (img && (node.kind === "person" || node.kind === "persona" || node.kind === "activity")) {
      ctx.globalAlpha = 0.3 + 0.7 * emph;
      roundedImage(ctx, img, p.x, p.y, r);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha(node.color, 0.7 * emph + 0.2);
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (img && node.kind === "post") {
      ctx.globalAlpha = 0.3 + 0.7 * emph;
      roundedImage(ctx, img, p.x, p.y, r);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha(node.color, 0.5 * emph);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    } else {
      // Star core.
      const core = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      core.addColorStop(0, withAlpha("#ffffff", 0.85 * emph + 0.1));
      core.addColorStop(0.4, withAlpha(node.color, emph));
      core.addColorStop(1, withAlpha(node.color, 0.15 * emph));
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * (0.9 + 0.1 * pulse), 0, Math.PI * 2);
      ctx.fill();
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
    o.hitboxes.set(item.node.id, { x: item.x, y: item.y, r: Math.max(card.w / 2, 44) });
  }
}

export function projectNode(node: { dx: number; dy: number }, width: number, height: number, camera: Camera) {
  return {
    x: width / 2 + camera.panX + node.dx * camera.zoom,
    y: height / 2 + camera.panY + node.dy * camera.zoom,
  };
}
