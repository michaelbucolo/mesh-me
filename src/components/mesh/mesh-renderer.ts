// Pure canvas rendering for the Mesh visualization.
// Takes state and draws to a canvas context — no React dependency.

import type { MeshNode, MeshEdge, FilterType } from "./mesh-types";
import { NODE_GLOW, STATUS_COLORS, hexAlpha } from "./mesh-types";
import { drawMeshi, drawRemoteMeshis, type MeshiState, type RemoteMeshi } from "./meshi-on-mesh";

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
  meshiState?: MeshiState | null;
  remoteMeshis?: RemoteMeshi[];
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
  const { hoveredNode: hovered, selectedNode: selected, meshiState, remoteMeshis } = interaction;

  const dpr = window.devicePixelRatio || 1;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const logicalW = w / dpr;
  const logicalH = h / dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, logicalW, logicalH);

  // Ambient background glow
  const bgGrad = ctx.createRadialGradient(logicalW / 2, logicalH / 2, 0, logicalW / 2, logicalH / 2, Math.max(logicalW, logicalH) * 0.7);
  bgGrad.addColorStop(0, "rgba(99, 102, 241, 0.04)");
  bgGrad.addColorStop(0.3, "rgba(99, 102, 241, 0.02)");
  bgGrad.addColorStop(0.6, "rgba(139, 92, 246, 0.01)");
  bgGrad.addColorStop(1, "transparent");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, logicalW, logicalH);

  ctx.save();
  ctx.translate(logicalW / 2 + p.x, logicalH / 2 + p.y);
  ctx.scale(z, z);
  ctx.translate(-center.x, -center.y);

  // Draw orbit rings around self node
  const selfNode = nodes.find((n) => n.type === "self");
  if (selfNode) {
    drawOrbitRings(ctx, selfNode, time);
  }

  drawEdges(ctx, nodes, edges, f, hovered, selected, time);
  drawDataParticles(ctx, nodes, edges, f, time, hovered, selected);
  drawNodes(ctx, nodes, edges, f, hovered, selected, labels, time, imageCache);

  // Draw Meshi avatars on the mesh (after nodes, before tooltip)
  if (remoteMeshis && remoteMeshis.length > 0) {
    drawRemoteMeshis(ctx, remoteMeshis, time);
  }
  if (meshiState) {
    drawMeshi(ctx, meshiState, time);
  }

  drawTooltip(ctx, hovered, z, time);

  ctx.restore();
}

// --- Orbit rings around self ---

function drawOrbitRings(ctx: CanvasRenderingContext2D, self: MeshNode, time: number) {
  const rings = [
    { radius: 180, alpha: 0.025, dashLen: 8 },
    { radius: 340, alpha: 0.018, dashLen: 10 },
    { radius: 500, alpha: 0.012, dashLen: 14 },
  ];

  for (const ring of rings) {
    const pulse = Math.sin(time * 0.2 + ring.radius * 0.01) * 0.005;
    ctx.beginPath();
    ctx.arc(self.x, self.y, ring.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(99, 102, 241, ${ring.alpha + pulse})`;
    ctx.setLineDash([ring.dashLen, ring.dashLen * 2.5]);
    ctx.lineDashOffset = -time * 5;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  ctx.setLineDash([]);
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
  const nodeMap = new Map<string, MeshNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;
    if (filter !== "all" && target.type !== filter && source.type !== filter && source.type !== "self" && target.type !== "self") continue;

    const isHighlighted = (hovered && (hovered.id === source.id || hovered.id === target.id))
      || (selected && (selected.id === source.id || selected.id === target.id));

    const isCross = edge.type === "shared-community" || edge.type === "cross-follow";
    const baseAlpha = isHighlighted ? 0.3
      : isCross ? 0.02 + edge.strength * 0.04
      : 0.04 + edge.strength * 0.06;
    const pulseAlpha = Math.sin(time * 0.8 + edge.strength * 5) * 0.008;

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);

    if (edge.type === "mutual" || edge.type === "cross-follow") {
      // Curved lines for mutual/cross edges
      const mx = (source.x + target.x) / 2;
      const my = (source.y + target.y) / 2;
      const edx = target.x - source.x;
      const edy = target.y - source.y;
      const curveFactor = edge.type === "cross-follow" ? 0.1 : 0.15;
      ctx.quadraticCurveTo(mx - edy * curveFactor, my + edx * curveFactor, target.x, target.y);
    } else {
      ctx.lineTo(target.x, target.y);
    }

    const edgeColor = EDGE_COLORS[edge.type] || "99, 102, 241";
    ctx.strokeStyle = `rgba(${edgeColor}, ${baseAlpha + pulseAlpha})`;
    const interactionBoost = edge.interactionCount ? Math.min(edge.interactionCount * 0.3, 2.5) : 0;
    ctx.lineWidth = isHighlighted ? 2 + interactionBoost
      : isCross ? 0.3 + edge.strength * 0.3
      : 0.5 + edge.strength * 0.5 + interactionBoost;
    ctx.stroke();
  }
}

// --- Data particles flowing along edges ---

function drawDataParticles(
  ctx: CanvasRenderingContext2D,
  nodes: MeshNode[],
  edges: MeshEdge[],
  filter: FilterType,
  time: number,
  hovered: MeshNode | null,
  selected: MeshNode | null,
) {
  const nodeMap = new Map<string, MeshNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  for (let ei = 0; ei < edges.length; ei++) {
    const edge = edges[ei];
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;
    if (filter !== "all" && target.type !== filter && source.type !== filter && source.type !== "self" && target.type !== "self") continue;

    const isHighlighted = (hovered && (hovered.id === source.id || hovered.id === target.id))
      || (selected && (selected.id === source.id || selected.id === target.id));
    const isCross = edge.type === "shared-community" || edge.type === "cross-follow";

    // Show particles only on highlighted and mutual edges for a cleaner look
    const showParticle = isHighlighted || (edge.type === "mutual" && ei % 2 === 0);
    if (!showParticle && !isCross) {
      continue;
    }
    if (isCross && !isHighlighted) continue; // Skip particles on cross edges unless highlighted

    const particleCount = isHighlighted ? 2 : 1;
    const speed = isHighlighted ? 0.35 : 0.18;
    const edgeColor = EDGE_COLORS[edge.type] || "99, 102, 241";
    const alpha = isHighlighted ? 0.5 : 0.2;
    const radius = isHighlighted ? 1.8 : 1;

    for (let pi = 0; pi < particleCount; pi++) {
      const t = ((time * speed + ei * 0.37 + pi * 0.5) % 1);
      const px = source.x + (target.x - source.x) * t;
      const py = source.y + (target.y - source.y) * t;

      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${edgeColor}, ${alpha})`;
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
  "shared-community": "200, 120, 200",
  "cross-follow": "140, 140, 250",
  "platform-content": "245, 158, 11",
  "platform-follower": "220, 160, 50",
};

// --- Platform icon emojis ---
const PLATFORM_ICONS: Record<string, string> = {
  instagram: "\ud83d\udcf7",
  youtube: "\u25b6",
  tiktok: "\ud83c\udfb5",
  twitter: "\ud83d\udc26",
  twitch: "\ud83c\udfae",
  spotify: "\ud83c\udfa7",
  soundcloud: "\u2601",
  linkedin: "\ud83d\udcbc",
  github: "\ud83d\udc31",
  discord: "\ud83d\udcac",
  snapchat: "\ud83d\udc7b",
  pinterest: "\ud83d\udccc",
  reddit: "\ud83e\udd16",
  facebook: "\ud83d\udc64",
  threads: "\ud83e\uddf5",
  bluesky: "\ud83e\ude77",
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

    const nodeOpacity = dimmed ? 0.2 : node.opacity;
    const connectionBoost = node.connections.length > 0 ? Math.min(node.connections.length * 0.6, 6) : 0;
    const baseNodeRadius = node.radius + connectionBoost;
    const nodeRadius = isHovered ? baseNodeRadius * 1.15 : baseNodeRadius;
    const pulse = Math.sin(time * 1.5 + node.pulsePhase) * 0.5 + 0.5;

    const glowColor = node.type === "self" ? NODE_GLOW.self
      : node.isMutual ? NODE_GLOW.mutual
      : NODE_GLOW[node.type] || NODE_GLOW.user;

    // Glow — subtle and premium
    const glowRadius = nodeRadius * (1.6 + pulse * 0.2);
    const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);
    gradient.addColorStop(0, glowColor.replace(/[\d.]+\)$/, (0.12 * nodeOpacity) + ")"));
    gradient.addColorStop(0.5, glowColor.replace(/[\d.]+\)$/, (0.04 * nodeOpacity) + ")"));
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
      ctx.strokeStyle = `rgba(99, 102, 241, ${0.15 + pulse * 0.06})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(node.x, node.y, ringRadius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(99, 102, 241, ${0.05 + pulse * 0.03})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Activity pulse for online users
    if (node.status === "online" && node.type === "user") {
      const activityPulse = Math.sin(time * 1.5 + node.pulsePhase) * 0.5 + 0.5;
      const activityRadius = nodeRadius + 3 + activityPulse * 2.5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, activityRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(34, 197, 94, ${0.06 + activityPulse * 0.04})`;
      ctx.lineWidth = 0.8;
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

    // Platform icon badge for platform nodes
    if (node.type === "platform" && node.platform) {
      const emoji = PLATFORM_ICONS[node.platform.toLowerCase()];
      if (emoji) {
        ctx.font = `${Math.max(10, nodeRadius * 0.7)}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(emoji, node.x, node.y);
      }
    }

    // Engagement indicator (small bar under high-engagement nodes)
    if (node.engagementScore && node.engagementScore > 5 && node.type === "user") {
      const barWidth = Math.min(node.engagementScore * 0.4, nodeRadius * 1.5);
      const barX = node.x - barWidth / 2;
      const barY = node.y + nodeRadius + 2;
      ctx.fillStyle = `rgba(99, 102, 241, ${0.15 * nodeOpacity})`;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barWidth, 2, 1);
      ctx.fill();
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

    // Platform nodes get emoji icons handled above; skip letter fallback for them
    if (node.type === "platform") return;

    // Fallback icon/letter
    ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * nodeOpacity})`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const ICON_MAP: Record<string, { text: string; sizeFactor: number }> = {
      self: { text: "", sizeFactor: 0.55 },
      community: { text: "", sizeFactor: 0.5 },
      tag: { text: "#", sizeFactor: 0.5 },
      post: { text: "\u2726", sizeFactor: 0.45 },
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
  _time: number,
) {
  if (!hovered || zoom < 0.5) return;

  const ttX = hovered.x;
  const ttY = hovered.y - hovered.radius - 14;
  const ttPadX = 10, ttPadY = 6, ttLineH = 14;
  const ttLines: string[] = [];

  // Platform nodes get emoji-prefixed label; others get plain label + sublabel
  if (hovered.type === "platform") {
    const emoji = PLATFORM_ICONS[(hovered.platform || "").toLowerCase()] || "";
    ttLines.push(emoji + " " + (hovered.platform || "Platform"));
    if (hovered.sublabel) ttLines.push(hovered.sublabel);
  } else {
    ttLines.push(hovered.label);
    if (hovered.sublabel) ttLines.push(hovered.sublabel);
  }

  if (hovered.type === "self") {
    const parts: string[] = [];
    if (hovered.followerCount !== undefined) parts.push(hovered.followerCount + " followers");
    if (hovered.postCount !== undefined) parts.push(hovered.postCount + " posts");
    if (hovered.platformCount) parts.push(hovered.platformCount + " platforms");
    if (parts.length > 0) ttLines.push(parts.join(" \u00b7 "));
    if (hovered.description) ttLines.push(hovered.description.slice(0, 60) + (hovered.description.length > 60 ? "..." : ""));
    ttLines.push("Your digital universe");
  } else if (hovered.type === "user") {
    const parts: string[] = [];
    if (hovered.followerCount !== undefined) parts.push(hovered.followerCount + " followers");
    if (hovered.postCount !== undefined) parts.push(hovered.postCount + " posts");
    if (hovered.isMutual) parts.push("\u2728 Mutual");
    if (hovered.interactionCount) parts.push(hovered.interactionCount + " interactions");
    if (parts.length > 0) ttLines.push(parts.join(" \u00b7 "));
    if (hovered.sharedInterests && hovered.sharedInterests.length > 0)
      ttLines.push("Shared: " + hovered.sharedInterests.slice(0, 4).join(", "));
    if (hovered.sharedCommunities && hovered.sharedCommunities.length > 0)
      ttLines.push(hovered.sharedCommunities.length + " shared communities");
    if (hovered.status === "online") ttLines.push("\ud83d\udfe2 Online now");
  } else if (hovered.type === "community") {
    const parts: string[] = [];
    if (hovered.memberCount !== undefined) parts.push(hovered.memberCount + " members");
    if (hovered.postCount !== undefined) parts.push(hovered.postCount + " posts");
    if (parts.length > 0) ttLines.push(parts.join(" \u00b7 "));
    if (hovered.category) ttLines.push("Category: " + hovered.category);
    if (hovered.description) ttLines.push(hovered.description.slice(0, 50) + (hovered.description.length > 50 ? "..." : ""));
  } else if (hovered.type === "post") {
    if (hovered.platform) {
      const pEmoji = PLATFORM_ICONS[hovered.platform.toLowerCase()] || "";
      ttLines.push(pEmoji + " " + hovered.platform);
    }
    if (hovered.content) ttLines.push(hovered.content.slice(0, 60) + (hovered.content.length > 60 ? "..." : ""));
    const parts: string[] = [];
    if (hovered.likeCount !== undefined) parts.push("\u2764 " + hovered.likeCount);
    if (hovered.commentCount !== undefined) parts.push("\ud83d\udcac " + hovered.commentCount);
    if (hovered.repostCount !== undefined) parts.push("\ud83d\udd01 " + hovered.repostCount);
    if (parts.length > 0) ttLines.push(parts.join("  "));
  } else if (hovered.type === "platform") {
    const parts: string[] = [];
    if (hovered.followerCount) parts.push(hovered.followerCount + " followers");
    if (hovered.postCount) parts.push(hovered.postCount + " posts");
    if (parts.length > 0) ttLines.push(parts.join(" \u00b7 "));
    if (hovered.likeCount) ttLines.push("\u2764 " + hovered.likeCount + " total likes");
    if (hovered.description) ttLines.push(hovered.description);
    ttLines.push("Click to manage connections");
  } else if (hovered.type === "tag") {
    ttLines.push("Interest tag");
    ttLines.push("Click to explore related content");
  } else if (hovered.type === "alter-ego") {
    ttLines.push("Alter ego persona");
    if (hovered.description) ttLines.push(hovered.description.slice(0, 50) + (hovered.description.length > 50 ? "..." : ""));
  }

  // Connection count
  if (hovered.connections.length > 0) {
    ttLines.push(hovered.connections.length + " mesh connections");
  }

  ctx.font = "11px system-ui, -apple-system, sans-serif";
  let maxW = 0;
  for (const line of ttLines) { maxW = Math.max(maxW, ctx.measureText(line).width); }
  const boxW = maxW + ttPadX * 2;
  const boxH = ttLines.length * ttLineH + ttPadY * 2;
  const bx = ttX - boxW / 2;
  const by = ttY - boxH;

  ctx.fillStyle = "rgba(12, 12, 18, 0.94)";
  ctx.beginPath();
  ctx.roundRect(bx, by, boxW, boxH, 8);
  ctx.fill();
  ctx.strokeStyle = hovered.color + "40";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Arrow
  ctx.beginPath();
  ctx.moveTo(ttX - 5, ttY - 1);
  ctx.lineTo(ttX, ttY + 5);
  ctx.lineTo(ttX + 5, ttY - 1);
  ctx.fillStyle = "rgba(12, 12, 18, 0.94)";
  ctx.fill();

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (let li = 0; li < ttLines.length; li++) {
    if (li === 0) {
      ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    } else if (li === ttLines.length - 1 && ttLines[li].includes("mesh connections")) {
      ctx.font = "10px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "rgba(99, 102, 241, 0.7)";
    } else {
      ctx.font = "10px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "rgba(200, 200, 210, 0.8)";
    }
    ctx.fillText(ttLines[li], bx + ttPadX, by + ttPadY + li * ttLineH);
  }
}
