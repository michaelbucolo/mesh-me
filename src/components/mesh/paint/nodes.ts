// The node pass — orbs, avatar orbs, platform brand tiles, post cards, the
// self profile, labels. Drawing math is ported VERBATIM from
// scene/scene-render.ts (the T0 parity gate); what's new is WHERE the
// expensive pixels come from: in atlas mode the gradient/shadow/text-heavy
// node bodies are rasterized ONCE into sprites (keyed `id:contentHash:tier`)
// and blitted per frame, while the cheap transient garnish (birth fx,
// selection rings, presence chips, labels) stays immediate-mode on top.
//
// Hit-testing: this pass writes NO hit targets. It imports sim/hitmap's
// shared vocabulary (radii, birth, emphasis, the post-card LOD gate) so what
// is drawn and what is tappable derive from one set of decisions — paint and
// hit stay in lockstep, with sim/hitmap as the sole authority.
//
// Per-frame allocation: sprite keys are cached per node and rebuilt only
// when a visual input actually changes (emphasis is discrete, quantized
// sizes step ~4%), so a settled frame does Map lookups and drawImage calls,
// not string building or gradient allocation.

import type { QualityTier, TierParams } from "../core/motion";
import { projectPoint } from "../core/camera";
import {
  baseRadius,
  birthProgress,
  chainFrom,
  nodeEmphasis,
  postCardScale,
  postCardSize,
  POST_CARD_MIN_EMPH,
  POST_CARD_MIN_ZOOM,
} from "../sim/hitmap";
import { blitSprite, quantizeScale, type SpriteAtlas } from "./atlas";
import { drawBirthFx } from "./fx";
import {
  drawGlyphBubble,
  drawGlyphHeart,
  drawLogoTile,
  drawPill,
  fitText,
  logoImage,
  metaValue,
  roundRectPath,
  roundedImage,
  tint,
  withAlpha,
  wrapTwoLines,
} from "./shared";
import type { SceneNode, ScenePaintOptions } from "./types";
import { paintTheme } from "./theme";

// ---------------------------------------------------------------------------
// Verbatim node-body painters (legacy scene-render.ts math). Each paints at
// (x, y) so it serves both the direct path (screen coords — exact legacy op
// stream) and sprite rasterization (origin-anchored).
// ---------------------------------------------------------------------------

/** Clean luminous orb: soft halo, flat lit body, crisp rim. */
function paintOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  emph: number,
  style?: string | null,
): void {
  const haloMul = style === "soft" ? 1.7 : style === "bold" ? 1.25 : 1;
  const bodyMul = style === "glass" ? 0.68 : 1;
  const rimMul = style === "glass" ? 1.5 : style === "soft" ? 0.7 : 1;
  const rimWidth = style === "bold" ? 1.8 : 1;

  const halo = ctx.createRadialGradient(x, y, r * 0.7, x, y, r * 2.4);
  halo.addColorStop(0, withAlpha(color, Math.min(0.4, 0.22 * haloMul) * emph));
  halo.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createLinearGradient(x, y - r, x, y + r);
  body.addColorStop(0, withAlpha(tint(color, 0.18), (0.92 * emph + 0.08) * bodyMul));
  body.addColorStop(1, withAlpha(color, (0.92 * emph + 0.08) * bodyMul));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // The boundary is --edge, not a tint of the fill. The body gradient above
  // still lifts its top stop, which is where the "lit" reading comes from — but
  // a rim whose only job is to separate the object from the mat cannot be made
  // out of the object. See PaintTheme.edge for the measurements.
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(paintTheme().edge, Math.min(0.95, (0.62 * emph + 0.3) * rimMul));
  ctx.lineWidth = rimWidth;
  ctx.stroke();
}

/** The initial letter centred in a person/community orb. */
function paintOrbInitial(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  label: string,
  emph: number,
): void {
  const initial = (label || "?").trim().charAt(0).toUpperCase();
  ctx.fillStyle = withAlpha(paintTheme().ink1, 0.96 * emph + 0.08);
  ctx.font = `600 ${Math.round(r * 0.85)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initial, x, y + r * 0.04);
}

/** Avatar node: bloom behind the image, the image inside a lit rim. */
function paintAvatarNode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  emph: number,
  img: HTMLImageElement,
): void {
  const bloom = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 3);
  bloom.addColorStop(0, withAlpha(color, 0.3 * emph + 0.04));
  bloom.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(x, y, r * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.35 + 0.65 * emph;
  roundedImage(ctx, img, x, y, r);
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(paintTheme().edge, 0.6 * emph + 0.34);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Platform node wearing its real brand mark. */
function paintPlatformTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  emph: number,
  brand: HTMLImageElement,
): void {
  const halo = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.2);
  halo.addColorStop(0, withAlpha(color, 0.2 * emph));
  halo.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
  ctx.fill();
  drawLogoTile(ctx, brand, x, y, r * 1.9, 0.4 + 0.6 * emph);
  roundRectPath(ctx, x - r * 0.95, y - r * 0.95, r * 1.9, r * 1.9, r * 0.53);
  ctx.strokeStyle = withAlpha(paintTheme().edge, 0.5 * emph + 0.32);
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Rich floating card for post nodes: media, text, likes/comments, source chip. */
function paintPostCard(
  ctx: CanvasRenderingContext2D,
  node: SceneNode,
  cx: number,
  cy: number,
  scale: number,
  emph: number,
  isHover: boolean,
  isSelected: boolean,
  img: HTMLImageElement | undefined,
  shadows: boolean,
): void {
  const pad = 10 * scale;
  const headH = 22 * scale;
  const imgH = img ? 96 * scale : 0;
  const fontSize = Math.max(8, 10.5 * scale);
  // Outer box shared with sim/hitmap, so the tap target IS the drawn card.
  const { w, h } = postCardSize(scale, Boolean(img));
  const x = cx - w / 2;
  const y = cy - h / 2;
  const radius = 16 * scale;
  const alpha = (0.4 + 0.6 * emph) * (0.62 + 0.38 * (node.freshness ?? 1));
  const bodyFill = paintTheme().paper1;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Card body with soft, layered shadow (T1+ trims the shadow — the single
  // most expensive canvas op — but the card itself is identical).
  if (shadows) {
    ctx.shadowColor = paintTheme().shadow;
    ctx.shadowBlur = 22 * scale;
    ctx.shadowOffsetY = 8 * scale;
  }
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = bodyFill;
  ctx.fill();
  if (shadows) {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  // Header row: source logo/dot + name (+ verified) left, time right.
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
  ctx.fillStyle = paintTheme().ink1;
  const platform = node.sublabel || "Mesh.me";
  const headLabel = fitText(ctx, platform, w - pad * 2 - 44 * scale);
  ctx.fillText(headLabel, x + pad + 12 * scale, headCy + 0.5);
  const headLabelW = ctx.measureText(headLabel).width;
  if (node.isVerified) {
    const bx = x + pad + 12 * scale + headLabelW + 6 * scale;
    ctx.beginPath();
    ctx.arc(bx, headCy, 3.4 * scale, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(paintTheme().accent, 0.9);
    ctx.fill();
  }
  const timeText = metaValue(node, "Time") || metaValue(node, "Ago") || node.status || "";
  if (timeText) {
    ctx.font = `500 ${Math.max(7.5, 8.5 * scale)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = withAlpha(paintTheme().ink3, 0.9);
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
    fade.addColorStop(0, withAlpha(paintTheme().paper1, 0));
    fade.addColorStop(1, withAlpha(paintTheme().paper1, 0.9));
    ctx.fillStyle = fade;
    ctx.fillRect(x, mediaY + imgH - 22 * scale, w, 22 * scale);
    ctx.restore();
  }

  // Text snippet.
  const textY = mediaY + imgH + 7 * scale;
  ctx.font = `500 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = paintTheme().ink1;
  const lines = wrapTwoLines(ctx, node.content || node.label, w - pad * 2);
  ctx.fillText(lines[0], x + pad, textY);
  if (lines[1]) {
    ctx.fillStyle = withAlpha(paintTheme().ink2, 0.8);
    ctx.fillText(lines[1], x + pad, textY + fontSize + 3 * scale);
  }

  // Footer: likes · comments and a "Source" chip.
  const footH = 22 * scale;
  const footY = y + h - footH + footH / 2;
  const metaFont = Math.max(7.5, 9 * scale);
  ctx.font = `600 ${metaFont}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  const likes = metaValue(node, "Likes");
  const comments = metaValue(node, "Comments");
  const metaColor = withAlpha(paintTheme().ink3, 0.95);
  const gsz = Math.max(6, 7.5 * scale);
  const gap = 5 * scale;
  let mx = x + pad;
  if (likes != null) {
    drawGlyphHeart(ctx, mx, footY, gsz, withAlpha(paintTheme().warm, 0.95));
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
  ctx.fillStyle = withAlpha(paintTheme().ink1, 0.06);
  ctx.fill();
  ctx.strokeStyle = withAlpha(paintTheme().ink1, 0.16);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = withAlpha(paintTheme().ink3, 0.95);
  ctx.textAlign = "center";
  ctx.fillText(chipText, chipX + chipW / 2, footY + 0.5);

  // Border + soft glow.
  ctx.textAlign = "left";
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.strokeStyle = isSelected || isHover
    ? withAlpha(paintTheme().accent, isSelected ? 0.95 : 0.75)
    : withAlpha(paintTheme().ink1, 0.10 + 0.10 * emph);
  ctx.lineWidth = isSelected || isHover ? 1.8 : 1.1;
  ctx.stroke();

  // Arrived since your last visit — a bright, unmissable mark.
  if (node.isNew) {
    ctx.globalAlpha = 1;
    drawPill(ctx, x + 26 * scale, y, "New", withAlpha(paintTheme().warm, 0.94), withAlpha(paintTheme().warm, 0.9), paintTheme().inkInverse, Math.max(8, 9 * scale), 7);
  }

  ctx.restore();
}

/** The self node: avatar + glow, and (hover/selected) the profile panel.
 * Always immediate-mode — one node, and its panel is gate-shared with
 * sim/hitmap's mirrored button rect. Verbatim legacy math. */
function paintSelfProfile(
  o: ScenePaintOptions,
  node: SceneNode,
  x: number,
  y: number,
  emph: number,
  isHover: boolean,
  isSelected: boolean,
  shadows: boolean,
): void {
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

  // A person sitting on the table has WEIGHT, not an aura. What was a
  // periwinkle radial self-glow plus a violet halo ring is now one downward
  // contact shadow: emphasis comes from depth and scale, never from light.
  //
  // T1 and T2 set `shadows: false` and the render contract asserts they issue
  // ZERO ctx.shadow* calls — that is the single most expensive canvas op. So
  // depth degrades rather than disappearing: the lower tiers paint a soft
  // offset disc under the avatar, which costs one fill and still reads as
  // something resting ON the surface instead of floating in it.
  const th = paintTheme();
  ctx.save();
  if (shadows) {
    ctx.shadowColor = th.shadow;
    ctx.shadowBlur = (6 + 0.09 * avatarR) * (0.7 + 0.5 * emph);
    ctx.shadowOffsetY = 2 + 0.03 * avatarR;
    ctx.beginPath();
    ctx.arc(x, y, avatarR * 1.02, 0, Math.PI * 2);
    ctx.fillStyle = th.paper1;
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(x, y + avatarR * 0.14, avatarR * 1.05, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(th.dark ? "#000000" : "#261e14", 0.18 + 0.1 * emph);
    ctx.fill();
  }
  ctx.restore();

  const img = node.avatarUrl ? o.images.get(node.id) : undefined;
  if (img) {
    roundedImage(ctx, img, x, y, avatarR);
    ctx.beginPath();
    ctx.arc(x, y, avatarR, 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha(paintTheme().ink2, 0.5 + 0.35 * emph);
    ctx.lineWidth = Math.max(1.8, 2.2 * zoomScale);
    ctx.stroke();
  } else {
    // The one place the product's OWN colour belongs: the disc standing in for
    // you when there is no avatar. Reads --accent live, so it is cobalt at 3pm
    // and periwinkle at 3am — the node.color literal it replaced was a single
    // pale periwinkle that measured 1.66:1 against the Daylight mat.
    const fallback = ctx.createRadialGradient(x - avatarR * 0.18, y - avatarR * 0.18, 0, x, y, avatarR);
    fallback.addColorStop(0, withAlpha(th.accent, 0.35));
    fallback.addColorStop(0.45, th.accent);
    fallback.addColorStop(1, withAlpha(th.accent, 0.4));
    ctx.fillStyle = fallback;
    ctx.beginPath();
    ctx.arc(x, y, avatarR, 0, Math.PI * 2);
    ctx.fill();
  }

  // The profile panel appears only when the centre is hovered or selected —
  // sim/hitmap gates the button's hit rect on the same condition.
  if (!isHover && !isSelected) {
    ctx.restore();
    return;
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
  ctx.fillStyle = withAlpha(paintTheme().paper2, 0.86);
  ctx.fill();
  ctx.strokeStyle = withAlpha(paintTheme().ink4, 0.3);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = paintTheme().ink1;
  ctx.font = `700 ${nameFont}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(nameText, x, nameY);
  if (node.isVerified) {
    const badgeX = x + nameW / 2 + 12 * zoomScale;
    const badgeY = nameY + nameFont * 0.53;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 7 * zoomScale, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(paintTheme().accent, 0.18 + 0.48 * emph);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = withAlpha(paintTheme().accent, 0.8);
    ctx.stroke();
    // Vector checkmark (never a font glyph).
    const cr = 3.4 * zoomScale;
    ctx.strokeStyle = paintTheme().inkInverse;
    ctx.lineWidth = Math.max(1.2, 1.6 * zoomScale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(badgeX - cr, badgeY + 0.2);
    ctx.lineTo(badgeX - cr * 0.28, badgeY + cr * 0.82);
    ctx.lineTo(badgeX + cr, badgeY - cr * 0.72);
    ctx.stroke();
    ctx.textBaseline = 'top';
  }

  ctx.fillStyle = withAlpha(paintTheme().ink2, 0.88);
  ctx.font = `500 ${handleFont}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(node.sublabel || '', x, handleY);

  if (bioLines.length > 0) {
    ctx.fillStyle = withAlpha(paintTheme().ink2, 0.84);
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
  ctx.fillStyle = withAlpha(paintTheme().accent, isSelected || isHover ? 0.34 : 0.22);
  ctx.fill();
  ctx.strokeStyle = paintTheme().accentLine;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = paintTheme().ink1;
  ctx.font = `600 ${buttonFont}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  // sim/hitmap mirrors this button's rect exactly.
  ctx.fillText(buttonText, x, buttonRect.y + buttonRect.h / 2 + 0.5);

  let chipCursor = x - chipRowW / 2;
  for (const [index, chip] of chips.entries()) {
    const chipW = chipWidths[index];
    const chipRect = { x: chipCursor, y: chipsY, w: chipW, h: chipH };
    roundRectPath(ctx, chipRect.x, chipRect.y, chipRect.w, chipRect.h, chipH / 2);
    ctx.fillStyle = chip === 'Verified' ? withAlpha(paintTheme().accent, 0.16) : withAlpha(paintTheme().ink1, 0.05);
    ctx.fill();
    ctx.strokeStyle = chip === 'Verified' ? paintTheme().accentLine : withAlpha(paintTheme().ink1, 0.08);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = paintTheme().ink1;
    ctx.font = `600 ${chipFont}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(chip, chipRect.x + chipRect.w / 2, chipRect.y + chipRect.h / 2 + 0.5);
    chipCursor += chipW + 6 * zoomScale;
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Sprite keying — `id:contentHash:tier`, with the key string cached per node
// and rebuilt only when a visual input changes.
// ---------------------------------------------------------------------------

interface KeyState {
  key: string;
  q: number;
  emph: number;
  flags: number;
  imgW: number;
  tier: number;
  style: string | null;
  staticHash: string;
}

export interface NodePassResources {
  /** null = direct mode: paint immediately (the pixel/op-parity path). */
  atlas: SpriteAtlas | null;
  params: TierParams;
  tier: QualityTier;
  keyStates: Map<string, KeyState>;
  staticHashes: WeakMap<SceneNode, string>;
}

export function createNodePassResources(
  atlas: SpriteAtlas | null,
  params: TierParams,
  tier: QualityTier,
): NodePassResources {
  return { atlas, params, tier, keyStates: new Map(), staticHashes: new WeakMap() };
}

function staticHashOf(rc: NodePassResources, node: SceneNode): string {
  let hash = rc.staticHashes.get(node);
  if (hash === undefined) {
    const content = node.content ?? "";
    hash = [
      node.color,
      node.label,
      node.sublabel ?? "",
      `${content.length}:${content.slice(0, 80)}`,
      metaValue(node, "Likes") ?? "",
      metaValue(node, "Comments") ?? "",
      metaValue(node, "Time") ?? metaValue(node, "Ago") ?? node.status ?? "",
      node.isVerified ? "1" : "0",
      node.isNew ? "1" : "0",
      (node.freshness ?? 1).toFixed(3),
    ].join("");
    rc.staticHashes.set(node, hash);
  }
  return hash;
}

/** The cached sprite key for this node, rebuilt only on input change. */
function spriteKey(
  rc: NodePassResources,
  node: SceneNode,
  q: number,
  emph: number,
  flags: number,
  imgW: number,
  style: string | null,
): string {
  const staticHash = staticHashOf(rc, node);
  const prev = rc.keyStates.get(node.id);
  if (
    prev &&
    prev.q === q &&
    prev.emph === emph &&
    prev.flags === flags &&
    prev.imgW === imgW &&
    prev.tier === rc.tier &&
    prev.style === style &&
    prev.staticHash === staticHash
  ) {
    return prev.key;
  }
  const key = `${node.id}:${staticHash}${style ?? ""}${q.toFixed(3)},${emph},${flags},${imgW}:${rc.tier}`;
  rc.keyStates.set(node.id, { key, q, emph, flags, imgW, tier: rc.tier, style, staticHash });
  return key;
}

const FLAG_SELECTED = 1;
const FLAG_HOVER = 2;
const FLAG_LETTER = 4;

// ---------------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------------

export function drawNodesPass(o: ScenePaintOptions, rc: NodePassResources): void {
  const { ctx, model, width, height, time } = o;
  const nodes = model.nodes;
  const hoverChain = chainFrom(model, o.hoverId);
  const selChain = chainFrom(model, o.selectedId);
  const emphasisFor = (node: SceneNode): number =>
    nodeEmphasis(node, hoverChain, selChain, o.activeBranch);

  // Forget key state for nodes that left the model (bounded memory).
  if (rc.keyStates.size > nodes.size * 2 + 16) {
    for (const id of rc.keyStates.keys()) {
      if (!nodes.has(id)) rc.keyStates.delete(id);
    }
  }

  const labelQueue: { node: SceneNode; x: number; y: number; r: number; emph: number }[] = [];
  const selfQueue: { node: SceneNode; x: number; y: number; emph: number; isHover: boolean; isSelected: boolean }[] = [];

  nodes.forEach((node) => {
    const born = birthProgress(node, time);
    if (born <= 0 && node.kind !== "self") return;
    const p = projectPoint(o.camera, width, height, node.dx, node.dy);
    const r0 = Math.max(2.5, baseRadius(node) * Math.max(0.5, Math.min(o.camera.zoom, 2.2)));

    // Cull offscreen (cards are wide, so give them a larger margin) — same
    // margins as sim/hitmap, so tappable ⇔ drawn stays true.
    const cull = node.kind === "post" ? 170 : 80;
    if (p.x < -cull || p.x > width + cull || p.y < -cull || p.y > height + cull) return;

    // Arrival: fx garnish (tier-scaled) + a springy grow-in that settles at
    // full size (ease-out-back — the SEMANTIC part, present at every tier).
    let birthScale = 1;
    if (born < 1 && node.kind !== "self") {
      drawBirthFx(ctx, p.x, p.y, r0, node.color, born, rc.params.particleScale);
      const t1 = born - 1;
      birthScale = Math.max(0.12, 1 + 2.70158 * t1 * t1 * t1 + 1.70158 * t1 * t1);
    }
    const r = r0 * birthScale;

    const emph = emphasisFor(node);
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.002 + node.x * 0.02);
    const isSelected = o.selectedId === node.id;
    const isFocus = o.focusId === node.id;
    const isHover = o.hoverId === node.id;

    if (node.kind === "self") {
      selfQueue.push({ node, x: p.x, y: p.y, emph, isHover, isSelected });
      return;
    }

    // Posts float as rich cards only once the camera is close enough to READ
    // them (gate and box shared with sim/hitmap).
    if (node.kind === "post" && o.camera.zoom >= POST_CARD_MIN_ZOOM && emph > POST_CARD_MIN_EMPH) {
      const cardScale = postCardScale(o.camera.zoom, node.weight);
      const img = node.imageUrl ? o.images.get(node.id) : undefined;
      if (rc.atlas) {
        const scaleQ = quantizeScale(cardScale);
        const flags = (isSelected ? FLAG_SELECTED : 0) | (isHover ? FLAG_HOVER : 0);
        const imgW = img ? img.naturalWidth || img.width : 0;
        const key = spriteKey(rc, node, scaleQ, emph, flags, imgW, null);
        const size = postCardSize(scaleQ, Boolean(img));
        const sw = size.w + 60 * scaleQ;
        const sh = size.h + 68 * scaleQ;
        const sprite = rc.atlas.get(key, sw, sh, sw / 2, size.h / 2 + 30 * scaleQ, (sctx) => {
          paintPostCard(sctx, node, 0, 0, scaleQ, emph, isHover, isSelected, img, rc.params.shadows);
        });
        if (sprite) {
          blitSprite(ctx, sprite, p.x, p.y, cardScale / scaleQ);
          return;
        }
      }
      paintPostCard(ctx, node, p.x, p.y, cardScale, emph, isHover, isSelected, img, rc.params.shadows);
      return;
    }

    // Platform nodes wear their REAL brand mark.
    if (node.kind === "platform") {
      const brand = logoImage(node.label);
      if (brand) {
        if (rc.atlas) {
          const rQ = quantizeScale(r);
          const key = spriteKey(rc, node, rQ, emph, 0, brand.naturalWidth, null);
          const half = 2.2 * rQ + 2;
          const sprite = rc.atlas.get(key, half * 2, half * 2, half, half, (sctx) => {
            paintPlatformTile(sctx, 0, 0, rQ, node.color, emph, brand);
          });
          if (sprite) blitSprite(ctx, sprite, p.x, p.y, r / rQ);
          else paintPlatformTile(ctx, p.x, p.y, r, node.color, emph, brand);
        } else {
          paintPlatformTile(ctx, p.x, p.y, r, node.color, emph, brand);
        }
        if (isSelected || isFocus || isHover) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
          ctx.strokeStyle = withAlpha(paintTheme().ink1, isSelected ? 0.95 : isHover ? 0.65 : 0.4);
          ctx.lineWidth = isSelected ? 2 : 1.4;
          ctx.stroke();
        }
        const showBrandLabel =
          isSelected || isFocus || isHover || (o.activeBranch !== null && node.branch === o.activeBranch);
        if (showBrandLabel) labelQueue.push({ node, x: p.x, y: p.y, r, emph });
        return;
      }
    }

    const img = node.avatarUrl ? o.images.get(node.id) : node.imageUrl ? o.images.get(node.id) : undefined;

    if (img && (node.kind === "person" || node.kind === "persona" || node.kind === "activity" || node.kind === "post")) {
      // Bloom behind the avatar, then the image inside a lit rim.
      if (rc.atlas) {
        const rQ = quantizeScale(r);
        const key = spriteKey(rc, node, rQ, emph, 0, img.naturalWidth || img.width, null);
        const half = 3 * rQ + 2;
        const sprite = rc.atlas.get(key, half * 2, half * 2, half, half, (sctx) => {
          paintAvatarNode(sctx, 0, 0, rQ, node.color, emph, img);
        });
        if (sprite) blitSprite(ctx, sprite, p.x, p.y, r / rQ);
        else paintAvatarNode(ctx, p.x, p.y, r, node.color, emph, img);
      } else {
        paintAvatarNode(ctx, p.x, p.y, r, node.color, emph, img);
      }
    } else {
      // Everything else is a clean luminous orb.
      const style = o.visuals?.nodeStyle ?? null;
      const wantsLetter =
        (node.kind === "person" || node.kind === "persona" || node.kind === "community") && r >= 11;
      if (rc.atlas) {
        const rQ = quantizeScale(r);
        const flags = wantsLetter ? FLAG_LETTER : 0;
        const key = spriteKey(rc, node, rQ, emph, flags, 0, style);
        const half = 2.4 * rQ + 2;
        const sprite = rc.atlas.get(key, half * 2, half * 2, half, half, (sctx) => {
          paintOrb(sctx, 0, 0, rQ, node.color, emph, style);
          if (wantsLetter) paintOrbInitial(sctx, 0, 0, rQ, node.label, emph);
        });
        // The pulse breath rides the blit scale — the sprite stays cached.
        if (sprite) blitSprite(ctx, sprite, p.x, p.y, (r * (0.97 + 0.03 * pulse)) / rQ);
        else {
          paintOrb(ctx, p.x, p.y, r * (0.97 + 0.03 * pulse), node.color, emph, style);
          if (wantsLetter) paintOrbInitial(ctx, p.x, p.y, r, node.label, emph);
        }
      } else {
        paintOrb(ctx, p.x, p.y, r * (0.97 + 0.03 * pulse), node.color, emph, style);
        if (wantsLetter) paintOrbInitial(ctx, p.x, p.y, r, node.label, emph);
      }
    }

    // Aliveness: people online right now breathe (immediate — it animates
    // every frame and is two strokes + a dot).
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
      ctx.strokeStyle = withAlpha(paintTheme().success, 0.18 + 0.2 * (1 - breathe));
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x + r * 0.72, p.y + r * 0.72, Math.max(2.5, r * 0.28), 0, Math.PI * 2);
      ctx.fillStyle = paintTheme().success;
      ctx.strokeStyle = paintTheme().paper0;
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }

    // Where are they? A discrete chip above the node names the mesh they're
    // exploring right now.
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
      ctx.fillStyle = withAlpha(paintTheme().paper2, 0.86);
      ctx.fill();
      ctx.strokeStyle = withAlpha(paintTheme().success, 0.35);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx0 + padX + dotR, cy0 + h / 2, dotR, 0, Math.PI * 2);
      ctx.fillStyle = paintTheme().success;
      ctx.fill();
      ctx.fillStyle = withAlpha(paintTheme().ink1, 0.92);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cx0 + padX + dotR * 2 + 5, cy0 + h / 2 + 0.5);
      ctx.restore();
    }

    if (isSelected) {
      // Selection is unmistakable: a bright ring plus a slow color pulse.
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha(paintTheme().ink1, 0.95);
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
      ctx.strokeStyle = withAlpha(paintTheme().ink1, isHover ? 0.65 : 0.4);
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
      ctx.fillStyle = withAlpha(paintTheme().paper2, 0.8);
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
      // sim/hitmap mirrors this pill's rect (and the centre-avoid stacking).
      ctx.strokeStyle = withAlpha(node.color, 0.5);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = paintTheme().ink1;
      ctx.fillText(label, lx, ly + 3.5);
    } else {
      ctx.fillStyle = withAlpha(paintTheme().ink1, 0.7 + 0.3 * emph);
      if (rc.params.shadows) {
        ctx.shadowColor = paintTheme().paper0;
        ctx.shadowBlur = 4;
        ctx.fillText(label, x, ly);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillText(label, x, ly);
      }
    }
  }

  for (const item of selfQueue) {
    paintSelfProfile(o, item.node, item.x, item.y, item.emph, item.isHover, item.isSelected, rc.params.shadows);
  }
}
