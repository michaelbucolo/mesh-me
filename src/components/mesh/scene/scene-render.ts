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
  images: Map<string, HTMLImageElement>;
  backgroundStars: { x: number; y: number; r: number; tw: number }[];
  /** Output: screen-space hitboxes keyed by node id. */
  hitboxes: Map<string, { x: number; y: number; r: number }>;
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

  const emphasisFor = (node: SceneNode): number => {
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
    const baseAlpha = node.depth === 1 ? 0.34 : node.depth === 2 ? 0.22 : 0.14;
    const alpha = baseAlpha * (0.35 + 0.65 * emph);
    const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    grad.addColorStop(0, withAlpha(parent.color, alpha));
    grad.addColorStop(1, withAlpha(node.color, alpha));
    ctx.strokeStyle = grad;
    ctx.lineWidth = (node.depth === 1 ? 1.6 : 1) * Math.max(0.7, o.camera.zoom);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

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

  nodes.forEach((node) => {
    const p = project(node, o);
    const r = Math.max(2.5, baseRadius(node) * Math.max(0.5, Math.min(o.camera.zoom, 2.2)));
    o.hitboxes.set(node.id, { x: p.x, y: p.y, r: Math.max(r, 14) });

    // Cull offscreen.
    if (p.x < -80 || p.x > width + 80 || p.y < -80 || p.y > height + 80) return;

    const emph = emphasisFor(node);
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.002 + node.x * 0.02);
    const isSelected = o.selectedId === node.id;
    const isFocus = o.focusId === node.id;

    // Glow halo.
    const glowR = r * (node.kind === "self" ? 3.4 : 2.6);
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
    glow.addColorStop(0, withAlpha(node.color, 0.42 * emph));
    glow.addColorStop(1, withAlpha(node.color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
    ctx.fill();

    const img = node.avatarUrl ? o.images.get(node.id) : node.imageUrl ? o.images.get(node.id) : undefined;

    if (img && (node.kind === "person" || node.kind === "persona" || node.kind === "self" || node.kind === "activity")) {
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

    if (isSelected || isFocus) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha("#ffffff", isSelected ? 0.9 : 0.4);
      ctx.lineWidth = isSelected ? 2 : 1.2;
      ctx.stroke();
    }

    const showLabel =
      node.kind === "self" ||
      node.kind === "branch" ||
      isSelected ||
      isFocus ||
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
}

export function projectNode(node: { dx: number; dy: number }, width: number, height: number, camera: Camera) {
  return {
    x: width / 2 + camera.panX + node.dx * camera.zoom,
    y: height / 2 + camera.panY + node.dy * camera.zoom,
  };
}
