// Pure canvas rendering for the Mesh visualization.
// Takes state and draws to a canvas context — no React dependency.

import type { MeshNode, MeshEdge, FilterType } from "./mesh-types";
import { NODE_GLOW, STATUS_COLORS, hexAlpha } from "./mesh-types";

export interface ViewportState {
  zoom: number;
  pan: { x: number; y: number };
  center: { x: number; y: number };
  filter: FilterType;
  showLabels: boolean;
  time: number;
}

export interface InteractionState {
  hoveredNode: MeshNode | null;
  selectedNode: MeshNode | null;
}

export function renderMesh(
  ctx: CanvasRenderingContext2D,
  nodes: MeshNode[],
  edges: MeshEdge[],
  viewport: ViewportState,
  interaction: InteractionState,
  imageCache: Map<string, HTMLImageElement | null>,
) {
  const { zoom: z, pan: p, center, filter: f, showLabels: labels, time } = viewport;
  const { hoveredNode: hovered, selectedNode: selected } = interaction;

  const dpr = window.devicePixelRatio || 1;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const logicalW = w / dpr;
  const logicalH = h / dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, logicalW, logicalH);

  // Subtle radial gradient background
  const bgGrad = ctx.createRadialGradient(logicalW / 2, logicalH / 2, 0, logicalW / 2, logicalH / 2, Math.max(logicalW, logicalH) * 0.7);
  bgGrad.addColorStop(0, "rgba(99, 102, 241, 0.03)");
  bgGrad.addColorStop(0.5, "rgba(99, 102, 241, 0.01)");
  bgGrad.addColorStop(1, "transparent");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, logicalW, logicalH);

  ctx.save();
  ctx.translate(logicalW / 2 + p.x, logicalH / 2 + p.y);
  ctx.scale(z, z);
  ctx.translate(-center.x, -center.y);

  drawEdges(ctx, nodes, edges, f, hovered, selected, time);
  drawNodes(ctx, nodes, edges, f, hovered, selected, labels, time, imageCache);
  drawTooltip(ctx, hovered, z, time);

  ctx.restore();
}

// --- Edges ---

function drawEdges(
  ctx: CanvasRenderingContext2D,
  nodes: MeshNode[],
  edges: MeshEdge[],
  filter: FilterType,
  hovered: MeshNode | null,
  selected: MeshNode | null,
  time: number,
) {
  // Build a quick lookup for node by id
  const nodeMap = new Map<string, MeshNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;
    if (filter !== "all" && target.type !== filter && source.type !== filter && source.type !== "self" && target.type !== "self") continue;

    const isHighlighted = (hovered && (hovered.id === source.id || hovered.id === target.id))
      || (selected && (selected.id === source.id || selected.id === target.id));

    const baseAlpha = isHighlighted ? 0.25 : 0.04 + edge.strength * 0.06;
    const pulseAlpha = Math.sin(time * 1.2 + edge.strength * 5) * 0.015;

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    if (edge.type === "mutual") {
      const mx = (source.x + target.x) / 2;
      const my = (source.y + target.y) / 2;
      const edx = target.x - source.x;
      const edy = target.y - source.y;
      ctx.quadraticCurveTo(mx - edy * 0.15, my + edx * 0.15, target.x, target.y);
    } else {
      ctx.lineTo(target.x, target.y);
    }

    const edgeColor = EDGE_COLORS[edge.type] || "99, 102, 241";
    ctx.strokeStyle = `rgba(${edgeColor}, ${baseAlpha + pulseAlpha})`;
    const interactionBoost = edge.interactionCount ? Math.min(edge.interactionCount * 0.3, 2.5) : 0;
    ctx.lineWidth = isHighlighted ? 2 + interactionBoost : 0.5 + edge.strength * 0.5 + interactionBoost;
    ctx.stroke();

    // Animated particle on highlighted mutual edges
    if (edge.type === "mutual" && isHighlighted) {
      const t = (time * 0.5) % 1;
      const px = source.x + (target.x - source.x) * t;
      const py = source.y + (target.y - source.y) * t;
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${edgeColor}, 0.8)`;
      ctx.fill();
    }
  }
}

const EDGE_COLORS: Record<string, string> = {
  mutual: "167, 139, 250",
  community: "236, 72, 153",
  interest: "6, 182, 212",
  post: "16, 185, 129",
  platform: "245, 158, 11",
  follow: "99, 102, 241",
  "alter-ego": "192, 132, 252",
};

// --- Nodes ---

function drawNodes(
  ctx: CanvasRenderingContext2D,
  nodes: MeshNode[],
  edges: MeshEdge[],
  filter: FilterType,
  hovered: MeshNode | null,
  selected: MeshNode | null,
  labels: boolean,
  time: number,
  imageCache: Map<string, HTMLImageElement | null>,
) {
  for (const node of nodes) {
    if (filter !== "all" && node.type !== filter && node.type !== "self") continue;

    const isHovered = hovered?.id === node.id;
    const isSelected = selected?.id === node.id;
    const isConnectedToHovered = hovered && edges.some((e) =>
      (e.source === hovered.id && e.target === node.id) || (e.target === hovered.id && e.source === node.id)
    );
    const isConnectedToSelected = selected && edges.some((e) =>
      (e.source === selected.id && e.target === node.id) || (e.target === selected.id && e.source === node.id)
    );

    const highlight = isHovered || isSelected || isConnectedToHovered || isConnectedToSelected;
    const dimmed = (hovered || selected) && !highlight && node.type !== "self";

    const nodeOpacity = dimmed ? 0.25 : node.opacity;
    const connectionBoost = node.connections.length > 0 ? Math.min(node.connections.length * 0.8, 8) : 0;
    const baseNodeRadius = node.radius + connectionBoost;
    const nodeRadius = isHovered ? baseNodeRadius * 1.15 : baseNodeRadius;
    const pulse = Math.sin(time * 1.5 + node.pulsePhase) * 0.5 + 0.5;

    const glowColor = node.type === "self" ? NODE_GLOW.self
      : node.isMutual ? NODE_GLOW.mutual
      : NODE_GLOW[node.type] || NODE_GLOW.user;

    // Glow
    const glowRadius = nodeRadius * (1.8 + pulse * 0.3);
    const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);
    gradient.addColorStop(0, glowColor.replace(/[\d.]+\)$/, (0.15 * nodeOpacity) + ")"));
    gradient.addColorStop(0.6, glowColor.replace(/[\d.]+\)$/, (0.04 * nodeOpacity) + ")"));
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Self node rings
    if (node.type === "self") {
      const ringRadius = nodeRadius + 5 + pulse * 2;
      ctx.beginPath();
      ctx.arc(node.x, node.y, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(99, 102, 241, ${0.18 + pulse * 0.08})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(node.x, node.y, ringRadius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(99, 102, 241, ${0.06 + pulse * 0.03})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Node body
    drawNodeBody(ctx, node, nodeRadius, nodeOpacity, isHovered, isSelected, imageCache);

    // Mutual badge
    if (node.isMutual && node.type === "user") {
      const badgeX = node.x + nodeRadius * 0.7;
      const badgeY = node.y - nodeRadius * 0.7;
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#818cf8";
      ctx.fill();
      ctx.strokeStyle = "#09090b";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Labels
    if (labels && nodeOpacity > 0.3) {
      drawLabel(ctx, node, nodeRadius, nodeOpacity, isHovered || isSelected);
    }

    // Status indicator dot
    if ((node.type === "user" || node.type === "self") && node.status) {
      const statusColor = STATUS_COLORS[node.status] || STATUS_COLORS.offline;
      const dotR = Math.max(3, nodeRadius * 0.2);
      const dotX = node.x + nodeRadius * 0.7;
      const dotY = node.y + nodeRadius * 0.7;
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotR + 1.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = statusColor;
      ctx.fill();
    }
  }
}

function drawNodeBody(
  ctx: CanvasRenderingContext2D,
  node: MeshNode,
  nodeRadius: number,
  nodeOpacity: number,
  isHovered: boolean,
  isSelected: boolean,
  imageCache: Map<string, HTMLImageElement | null>,
) {
  const cachedImg = imageCache.get(node.id);
  const hasImage = cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0;

  if (hasImage) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = nodeOpacity;
    ctx.drawImage(cachedImg, node.x - nodeRadius, node.y - nodeRadius, nodeRadius * 2, nodeRadius * 2);
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
    ctx.strokeStyle = node.color + hexAlpha((isHovered || isSelected ? 0.9 : 0.5) * nodeOpacity);
    ctx.lineWidth = isHovered || isSelected ? 2.5 : 1.5;
    ctx.stroke();
    if (isHovered || isSelected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius + 2, 0, Math.PI * 2);
      ctx.strokeStyle = node.color + hexAlpha(0.3 * nodeOpacity);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
    const fillGrad = ctx.createRadialGradient(node.x - nodeRadius * 0.3, node.y - nodeRadius * 0.3, 0, node.x, node.y, nodeRadius);
    fillGrad.addColorStop(0, node.color + hexAlpha(0.35 * nodeOpacity));
    fillGrad.addColorStop(1, node.color + hexAlpha(0.12 * nodeOpacity));
    ctx.fillStyle = fillGrad;
    ctx.fill();
    ctx.strokeStyle = node.color + hexAlpha((isHovered || isSelected ? 0.8 : 0.4) * nodeOpacity);
    ctx.lineWidth = isHovered || isSelected ? 1.5 : 1;
    ctx.stroke();

    // Fallback icon/letter
    ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * nodeOpacity})`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const ICON_MAP: Record<string, { text: string; sizeFactor: number }> = {
      self: { text: "", sizeFactor: 0.55 },
      community: { text: "", sizeFactor: 0.5 },
      tag: { text: "#", sizeFactor: 0.5 },
      post: { text: "\u2726", sizeFactor: 0.45 },
      platform: { text: "", sizeFactor: 0.5 },
    };
    const iconInfo = ICON_MAP[node.type];
    const fontSize = Math.max(9, nodeRadius * (iconInfo?.sizeFactor || 0.6));
    ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;

    if (node.type === "self") {
      const initials = node.label.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "ME";
      ctx.fillText(initials, node.x, node.y);
    } else if (iconInfo?.text) {
      ctx.fillText(iconInfo.text, node.x, node.y);
    } else if (node.type === "community") {
      ctx.fillText((node.label[0] || "C").toUpperCase(), node.x, node.y);
    } else {
      ctx.fillText((node.label[0] || "?").toUpperCase(), node.x, node.y);
    }
  }
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  node: MeshNode,
  nodeRadius: number,
  nodeOpacity: number,
  showSublabel: boolean,
) {
  ctx.fillStyle = `rgba(228, 228, 231, ${0.85 * nodeOpacity})`;
  ctx.font = `${Math.max(9, Math.min(12, nodeRadius * 0.55))}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const maxLabelWidth = 100;
  let labelText = node.label;
  if (ctx.measureText(labelText).width > maxLabelWidth) {
    while (ctx.measureText(labelText + "...").width > maxLabelWidth && labelText.length > 3) {
      labelText = labelText.slice(0, -1);
    }
    labelText += "...";
  }
  ctx.fillText(labelText, node.x, node.y + nodeRadius + 6);

  if (node.sublabel && showSublabel) {
    ctx.fillStyle = `rgba(161, 161, 170, ${0.7 * nodeOpacity})`;
    ctx.font = `${Math.max(8, nodeRadius * 0.4)}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(node.sublabel, node.x, node.y + nodeRadius + 20);
  }
}

// --- Tooltip ---

function drawTooltip(
  ctx: CanvasRenderingContext2D,
  hovered: MeshNode | null,
  zoom: number,
  time: number,
) {
  if (!hovered || zoom < 0.5) return;
  // suppress unused var lint
  void time;

  const ttX = hovered.x;
  const ttY = hovered.y - hovered.radius - 12;
  const ttPadX = 10, ttPadY = 6, ttLineH = 14;
  const ttLines: string[] = [hovered.label];
  if (hovered.sublabel) ttLines.push(hovered.sublabel);

  if (hovered.type === "user") {
    const parts: string[] = [];
    if (hovered.followerCount !== undefined) parts.push(hovered.followerCount + " followers");
    if (hovered.postCount !== undefined) parts.push(hovered.postCount + " posts");
    if (hovered.isMutual) parts.push("Mutual");
    if (parts.length > 0) ttLines.push(parts.join(" \u00b7 "));
    if (hovered.sharedInterests && hovered.sharedInterests.length > 0)
      ttLines.push("Shared: " + hovered.sharedInterests.slice(0, 3).join(", "));
  } else if (hovered.type === "community") {
    if (hovered.memberCount !== undefined) ttLines.push(hovered.memberCount + " members");
  } else if (hovered.type === "post") {
    if (hovered.content) ttLines.push(hovered.content.slice(0, 50) + (hovered.content.length > 50 ? "..." : ""));
    const parts: string[] = [];
    if (hovered.likeCount !== undefined) parts.push(hovered.likeCount + " likes");
    if (hovered.commentCount !== undefined) parts.push(hovered.commentCount + " comments");
    if (parts.length > 0) ttLines.push(parts.join(" \u00b7 "));
  } else if (hovered.type === "platform") {
    ttLines.push("Connected platform");
  }

  ctx.font = "11px system-ui, -apple-system, sans-serif";
  let maxW = 0;
  for (const line of ttLines) { maxW = Math.max(maxW, ctx.measureText(line).width); }
  const boxW = maxW + ttPadX * 2;
  const boxH = ttLines.length * ttLineH + ttPadY * 2;
  const bx = ttX - boxW / 2;
  const by = ttY - boxH;

  ctx.fillStyle = "rgba(15, 15, 20, 0.92)";
  ctx.beginPath();
  ctx.roundRect(bx, by, boxW, boxH, 6);
  ctx.fill();
  ctx.strokeStyle = hovered.color + "60";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Arrow
  ctx.beginPath();
  ctx.moveTo(ttX - 5, ttY - 1);
  ctx.lineTo(ttX, ttY + 5);
  ctx.lineTo(ttX + 5, ttY - 1);
  ctx.fillStyle = "rgba(15, 15, 20, 0.92)";
  ctx.fill();

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (let li = 0; li < ttLines.length; li++) {
    if (li === 0) {
      ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    } else {
      ctx.font = "10px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "rgba(200, 200, 210, 0.8)";
    }
    ctx.fillText(ttLines[li], bx + ttPadX, by + ttPadY + li * ttLineH);
  }
}
