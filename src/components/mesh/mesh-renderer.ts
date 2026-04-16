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
  /** 0→1 progress of the mesh formation animation. 1 = fully formed. */
  formationProgress?: number;
  /** Timestamp of a sync pulse ripple (performance.now), or null. */
  syncPulseTime?: number | null;
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
  const { hoveredNode: hovered, selectedNode: selected, remoteMeshis } = interaction;
  const formationProgress = viewport.formationProgress ?? 1;

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

  // Formation flash — brief bright pulse at the start
  if (formationProgress > 0 && formationProgress < 0.3) {
    const flashAlpha = Math.sin((formationProgress / 0.3) * Math.PI) * 0.08;
    const flashGrad = ctx.createRadialGradient(logicalW / 2, logicalH / 2, 0, logicalW / 2, logicalH / 2, Math.max(logicalW, logicalH) * 0.5);
    flashGrad.addColorStop(0, `rgba(99, 102, 241, ${flashAlpha})`);
    flashGrad.addColorStop(1, "transparent");
    ctx.fillStyle = flashGrad;
    ctx.fillRect(0, 0, logicalW, logicalH);
  }

  ctx.save();
  ctx.translate(logicalW / 2 + p.x, logicalH / 2 + p.y);
  ctx.scale(z, z);
  ctx.translate(-center.x, -center.y);

  // During formation, apply global alpha to edges and particles
  if (formationProgress < 1) {
    ctx.globalAlpha = Math.max(0, formationProgress * 1.5 - 0.3);
  }

  // Draw orbit rings around self node
  const selfNode = nodes.find((n) => n.type === "self");
  if (selfNode) {
    drawOrbitRings(ctx, selfNode, time);
  }

  drawEdges(ctx, nodes, edges, f, hovered, selected, time);
  drawDataParticles(ctx, nodes, edges, f, time, hovered, selected);

  // Reset alpha for nodes
  ctx.globalAlpha = 1;

  drawSectionLabels(ctx, selfNode, z, nodes);
  drawNodes(ctx, nodes, edges, f, hovered, selected, labels, time, imageCache, formationProgress);

  // Sync pulse ripple effect
  if (viewport.syncPulseTime != null && selfNode) {
    const elapsed = (performance.now() - viewport.syncPulseTime) / 1000;
    if (elapsed < 2.5) {
      const rippleRadius = elapsed * 400;
      const rippleAlpha = Math.max(0, 1 - elapsed / 2.5) * 0.25;
      ctx.beginPath();
      ctx.arc(selfNode.x, selfNode.y, rippleRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(99, 102, 241, ${rippleAlpha})`;
      ctx.lineWidth = 3 - elapsed;
      ctx.stroke();
      // Second ripple, delayed
      if (elapsed > 0.3) {
        const r2 = (elapsed - 0.3) * 400;
        const a2 = Math.max(0, 1 - (elapsed - 0.3) / 2.2) * 0.15;
        ctx.beginPath();
        ctx.arc(selfNode.x, selfNode.y, r2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(139, 92, 246, ${a2})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  // Draw remote Meshis on the mesh (other users' presence)
  if (remoteMeshis && remoteMeshis.length > 0) {
    drawRemoteMeshis(ctx, remoteMeshis, time);
  }
  // Draw local user's Meshi on the mesh canvas
  if (interaction.meshiState) {
    drawMeshi(ctx, interaction.meshiState, time);
  }

  drawTooltip(ctx, hovered, z);

  ctx.restore();

  // Draw mini legend in bottom-left corner (screen space)
  drawLegend(ctx, logicalW, logicalH, f, nodes);
}

// --- Orbit rings around self ---

function drawOrbitRings(ctx: CanvasRenderingContext2D, self: MeshNode, time: number) {
  const rings = [
    { radius: 120, alpha: 0.04, dashLen: 4, label: "Alter Egos" },
    { radius: 240, alpha: 0.035, dashLen: 5, label: "Platforms" },
    { radius: 390, alpha: 0.03, dashLen: 6, label: "People" },
    { radius: 560, alpha: 0.025, dashLen: 8, label: "Communities" },
    { radius: 680, alpha: 0.02, dashLen: 10, label: "Interests" },
    { radius: 820, alpha: 0.015, dashLen: 12, label: "Posts" },
  ];

  for (const ring of rings) {
    const pulse = Math.sin(time * 0.15 + ring.radius * 0.008) * 0.006;
    ctx.beginPath();
    ctx.arc(self.x, self.y, ring.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(99, 102, 241, ${ring.alpha + pulse})`;
    ctx.setLineDash([ring.dashLen, ring.dashLen * 3]);
    ctx.lineDashOffset = -time * 3;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

// --- Section labels along orbit rings ---

function drawSectionLabels(
  ctx: CanvasRenderingContext2D,
  self: MeshNode | undefined,
  zoom: number,
  nodes?: MeshNode[],
) {
  if (!self || zoom < 0.25) return;

  const TYPE_MAP: Record<string, string> = {
    "Alter Egos": "alter-ego",
    "Platforms": "platform",
    "People": "user",
    "Communities": "community",
    "Interests": "tag",
    "Posts": "post",
  };

  const sections = [
    { radius: 120, label: "Alter Egos", angle: -Math.PI / 2 - 0.3, color: "192, 132, 252" },
    { radius: 240, label: "Platforms", angle: -Math.PI / 2 + 0.15, color: "245, 158, 11" },
    { radius: 390, label: "People", angle: -Math.PI / 2 - 0.1, color: "129, 140, 248" },
    { radius: 560, label: "Communities", angle: -Math.PI / 2 + 0.25, color: "236, 72, 153" },
    { radius: 680, label: "Interests", angle: -Math.PI / 2 - 0.2, color: "6, 182, 212" },
    { radius: 820, label: "Posts", angle: -Math.PI / 2 + 0.05, color: "16, 185, 129" },
  ];

  const fontSize = Math.max(11, Math.min(15, 13 / zoom));

  for (const sec of sections) {
    const lx = self.x + Math.cos(sec.angle) * sec.radius;
    const ly = self.y + Math.sin(sec.angle) * sec.radius;

    // Count nodes of this type
    const nodeType = TYPE_MAP[sec.label];
    const count = nodes ? nodes.filter((n) => n.type === nodeType).length : 0;
    const countText = count > 0 ? ` (${count})` : "";
    const fullLabel = sec.label + countText;

    ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Pill background — stronger contrast
    const tw = ctx.measureText(fullLabel).width;
    const px = 10, py = 5;
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(lx - tw / 2 - px, ly - fontSize / 2 - py, tw + px * 2, fontSize + py * 2, 10);
    ctx.fill();

    // Colored accent border
    ctx.strokeStyle = `rgba(${sec.color}, 0.25)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(lx - tw / 2 - px, ly - fontSize / 2 - py, tw + px * 2, fontSize + py * 2, 10);
    ctx.stroke();

    // Label text — brighter with color tint
    ctx.fillStyle = `rgba(${sec.color}, 0.7)`;
    ctx.fillText(sec.label, lx - (count > 0 ? ctx.measureText(countText).width / 2 : 0), ly);

    // Count in slightly dimmer color
    if (count > 0) {
      ctx.font = `500 ${fontSize - 1}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = `rgba(255, 255, 255, 0.4)`;
      const labelW = ctx.measureText(sec.label).width;
      ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
      const fullW = ctx.measureText(fullLabel).width;
      ctx.font = `500 ${fontSize - 1}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(countText, lx + fullW / 2 - ctx.measureText(countText).width / 2, ly);
    }
  }
}

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
    // Hide cross-edges unless one of their nodes is highlighted — reduces clutter
    if (isCross && !isHighlighted) continue;
    const baseAlpha = isHighlighted ? 0.35
      : 0.04 + edge.strength * 0.06;
    const pulseAlpha = Math.sin(time * 0.6 + edge.strength * 4) * 0.008;

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
    const interactionBoost = edge.interactionCount ? Math.min(edge.interactionCount * 0.2, 1.5) : 0;
    ctx.lineWidth = isHighlighted ? 2 + interactionBoost
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

    // Show particles only on highlighted edges for a cleaner look
    if (!isHighlighted) {
      continue;
    }

    const particleCount = 2;
    const speed = 0.35;
    const edgeColor = EDGE_COLORS[edge.type] || "99, 102, 241";
    const alpha = 0.6;
    const radius = 2;

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
  formationProgress: number = 1,
) {
  // Find center for formation animation
  const selfNode = nodes.find((n) => n.type === "self");
  const cx = selfNode?.x ?? 0;
  const cy = selfNode?.y ?? 0;

  for (let idx = 0; idx < nodes.length; idx++) {
    const node = nodes[idx];
    if (filter !== "all" && node.type !== filter && node.type !== "self") continue;

    // Per-node formation: stagger by index with easing
    let nodeFormation = 1;
    if (formationProgress < 1 && node.type !== "self") {
      const stagger = idx / Math.max(nodes.length, 1);
      const nodeStart = stagger * 0.4; // nodes start appearing at different times
      const raw = Math.max(0, (formationProgress - nodeStart) / (1 - nodeStart));
      nodeFormation = 1 - Math.pow(1 - Math.min(raw, 1), 3); // ease-out cubic
    }

    // During formation, interpolate position from center → target
    let drawX = node.x;
    let drawY = node.y;
    if (nodeFormation < 1) {
      drawX = cx + (node.x - cx) * nodeFormation;
      drawY = cy + (node.y - cy) * nodeFormation;
    }

    // During formation, temporarily override node position for all sub-drawing
    const origX = node.x;
    const origY = node.y;
    if (nodeFormation < 1) {
      node.x = drawX;
      node.y = drawY;
    }

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

    const nodeOpacity = (dimmed ? 0.2 : node.opacity) * nodeFormation;
    const connectionBoost = node.connections.length > 0 ? Math.min(node.connections.length * 0.6, 6) : 0;
    const baseNodeRadius = (node.radius + connectionBoost) * (0.3 + 0.7 * nodeFormation);
    const nodeRadius = isHovered ? baseNodeRadius * 1.15 : baseNodeRadius;
    const pulse = Math.sin(time * 1.5 + node.pulsePhase) * 0.5 + 0.5;

    const glowColor = node.type === "self" ? NODE_GLOW.self
      : node.isMutual ? NODE_GLOW.mutual
      : NODE_GLOW[node.type] || NODE_GLOW.user;

    // Glow — smooth multi-layer premium glow
    const glowRadius = nodeRadius * (1.7 + pulse * 0.15);
    const gradient = ctx.createRadialGradient(node.x, node.y, nodeRadius * 0.5, node.x, node.y, glowRadius);
    gradient.addColorStop(0, glowColor.replace(/[\d.]+\)$/, (0.15 * nodeOpacity) + ")"));
    gradient.addColorStop(0.4, glowColor.replace(/[\d.]+\)$/, (0.06 * nodeOpacity) + ")"));
    gradient.addColorStop(0.8, glowColor.replace(/[\d.]+\)$/, (0.02 * nodeOpacity) + ")"));
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    // Extra highlight halo for hovered/selected nodes
    if (isHovered || isSelected) {
      const haloR = nodeRadius * (isSelected ? 2.2 : 1.9);
      const halo = ctx.createRadialGradient(node.x, node.y, nodeRadius, node.x, node.y, haloR);
      halo.addColorStop(0, glowColor.replace(/[\d.]+\)$/, (0.18 * nodeOpacity) + ")"));
      halo.addColorStop(0.5, glowColor.replace(/[\d.]+\)$/, (0.06 * nodeOpacity) + ")"));
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(node.x, node.y, haloR, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();
    }

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

    // Activity pulse for online users — smooth breathing
    if (node.status === "online" && node.type === "user") {
      const activityPulse = Math.sin(time * 1.2 + node.pulsePhase) * 0.5 + 0.5;
      const activityRadius = nodeRadius + 3.5 + activityPulse * 3;
      ctx.beginPath();
      ctx.arc(node.x, node.y, activityRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(34, 197, 94, ${0.08 + activityPulse * 0.05})`;
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

    // Labels — always show for readability, larger font
    if (labels && nodeOpacity > 0.2) {
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

    // Restore original positions after formation drawing
    if (nodeFormation < 1) {
      node.x = origX;
      node.y = origY;
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
    // Different shapes per node type for visual differentiation
    if (node.type === "community") {
      // Rounded square for communities
      ctx.beginPath();
      ctx.roundRect(node.x - nodeRadius, node.y - nodeRadius, nodeRadius * 2, nodeRadius * 2, nodeRadius * 0.35);
      const fillGrad = ctx.createRadialGradient(node.x - nodeRadius * 0.3, node.y - nodeRadius * 0.3, 0, node.x, node.y, nodeRadius);
      fillGrad.addColorStop(0, node.color + hexAlpha(0.35 * nodeOpacity));
      fillGrad.addColorStop(1, node.color + hexAlpha(0.12 * nodeOpacity));
      ctx.fillStyle = fillGrad;
      ctx.fill();
      ctx.strokeStyle = node.color + hexAlpha((isHovered || isSelected ? 0.8 : 0.4) * nodeOpacity);
      ctx.lineWidth = isHovered || isSelected ? 1.5 : 1;
      ctx.stroke();
    } else if (node.type === "tag") {
      // Diamond shape for interest tags
      ctx.beginPath();
      ctx.moveTo(node.x, node.y - nodeRadius);
      ctx.lineTo(node.x + nodeRadius, node.y);
      ctx.lineTo(node.x, node.y + nodeRadius);
      ctx.lineTo(node.x - nodeRadius, node.y);
      ctx.closePath();
      const fillGrad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, nodeRadius);
      fillGrad.addColorStop(0, node.color + hexAlpha(0.35 * nodeOpacity));
      fillGrad.addColorStop(1, node.color + hexAlpha(0.12 * nodeOpacity));
      ctx.fillStyle = fillGrad;
      ctx.fill();
      ctx.strokeStyle = node.color + hexAlpha((isHovered || isSelected ? 0.8 : 0.4) * nodeOpacity);
      ctx.lineWidth = isHovered || isSelected ? 1.5 : 1;
      ctx.stroke();
    } else {
      // Default circle for all other node types
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
    }

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
  const fontSize = Math.max(11, Math.min(15, nodeRadius * 0.75));
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const labelY = node.y + nodeRadius + 12;
  const maxLabelWidth = 160;
  let labelText = node.label;
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
  if (ctx.measureText(labelText).width > maxLabelWidth) {
    while (ctx.measureText(labelText + "...").width > maxLabelWidth && labelText.length > 3) {
      labelText = labelText.slice(0, -1);
    }
    labelText += "...";
  }

  // Dark background pill behind label — stronger contrast for readability
  const tw = ctx.measureText(labelText).width;
  const pillPadX = 9, pillPadY = 4;
  ctx.fillStyle = `rgba(0, 0, 0, ${0.6 * nodeOpacity})`;
  ctx.beginPath();
  ctx.roundRect(node.x - tw / 2 - pillPadX, labelY - pillPadY, tw + pillPadX * 2, fontSize + pillPadY * 2, 8);
  ctx.fill();
  // Subtle border on pill for depth
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.06 * nodeOpacity})`;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.roundRect(node.x - tw / 2 - pillPadX, labelY - pillPadY, tw + pillPadX * 2, fontSize + pillPadY * 2, 8);
  ctx.stroke();

  ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * nodeOpacity})`;
  ctx.fillText(labelText, node.x, labelY);

  if (node.sublabel && showSublabel) {
    const subFontSize = Math.max(10, fontSize * 0.82);
    ctx.font = `500 ${subFontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = `rgba(200, 200, 220, ${0.8 * nodeOpacity})`;
    ctx.fillText(node.sublabel, node.x, labelY + fontSize + pillPadY * 2 + 4);
  }
}

// --- Tooltip ---

function drawTooltip(
  ctx: CanvasRenderingContext2D,
  hovered: MeshNode | null,
  zoom: number,
) {
  if (!hovered || zoom < 0.5) return;

  const ttX = hovered.x;
  const ttY = hovered.y - hovered.radius - 14;
  const ttPadX = 10, ttPadY = 6;
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

  const ttFontSize = 12;
  const ttSubFontSize = 11;
  const ttLineSpacing = 16;
  ctx.font = `${ttFontSize}px system-ui, -apple-system, sans-serif`;
  let maxW = 0;
  for (const line of ttLines) { maxW = Math.max(maxW, ctx.measureText(line).width); }
  const boxW = Math.min(maxW + ttPadX * 2 + 4, 280);
  const boxH = ttLines.length * ttLineSpacing + ttPadY * 2 + 4;
  const bx = ttX - boxW / 2;
  const by = ttY - boxH - 4;

  // Drop shadow
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "rgba(8, 8, 16, 0.96)";
  ctx.beginPath();
  ctx.roundRect(bx, by, boxW, boxH, 10);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Accent top edge
  ctx.fillStyle = hovered.color + "90";
  ctx.beginPath();
  ctx.roundRect(bx, by, boxW, 2.5, [10, 10, 0, 0]);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx, by, boxW, boxH, 10);
  ctx.stroke();

  // Arrow
  ctx.beginPath();
  ctx.moveTo(ttX - 6, ttY - 4);
  ctx.lineTo(ttX, ttY + 3);
  ctx.lineTo(ttX + 6, ttY - 4);
  ctx.fillStyle = "rgba(8, 8, 16, 0.96)";
  ctx.fill();

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (let li = 0; li < ttLines.length; li++) {
    if (li === 0) {
      ctx.font = `bold ${ttFontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
    } else if (li === ttLines.length - 1 && ttLines[li].includes("mesh connections")) {
      ctx.font = `${ttSubFontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = hovered.color + "a0";
    } else {
      ctx.font = `${ttSubFontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = "rgba(210, 210, 220, 0.85)";
    }
    ctx.fillText(ttLines[li], bx + ttPadX + 2, by + ttPadY + 4 + li * ttLineSpacing);
  }
}

// --- Mini legend ---

function drawLegend(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  activeFilter: FilterType,
  nodes?: MeshNode[],
) {
  const TYPE_MAP: Record<string, string> = {
    "People": "user",
    "Platforms": "platform",
    "Communities": "community",
    "Interests": "tag",
    "Posts": "post",
    "Alter Egos": "alter-ego",
  };

  const items = [
    { color: "#818cf8", label: "People" },
    { color: "#f59e0b", label: "Platforms" },
    { color: "#ec4899", label: "Communities" },
    { color: "#06b6d4", label: "Interests" },
    { color: "#10b981", label: "Posts" },
    { color: "#c084fc", label: "Alter Egos" },
  ];

  const fontSize = 11;
  const dotR = 4.5;
  const lineH = 22;
  const padX = 12, padY = 10;
  const boxX = 14;
  const boxY = h - padY * 2 - items.length * lineH - 55;

  // Measure max width including counts
  ctx.font = `500 ${fontSize}px system-ui, -apple-system, sans-serif`;
  let maxTextW = 0;
  for (const it of items) {
    const nodeType = TYPE_MAP[it.label];
    const count = nodes ? nodes.filter((n) => n.type === nodeType).length : 0;
    const text = count > 0 ? `${it.label}  ${count}` : it.label;
    maxTextW = Math.max(maxTextW, ctx.measureText(text).width);
  }
  const boxW = dotR * 2 + 10 + maxTextW + padX * 2;
  const boxH = items.length * lineH + padY * 2;

  // Background — stronger
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 10);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const iy = boxY + padY + i * lineH + lineH / 2;
    const filterKey = item.label.toLowerCase().replace(" ", "-");
    const isActive = activeFilter === "all" || filterKey.startsWith(activeFilter);
    const alpha = isActive ? 0.9 : 0.4;
    const nodeType = TYPE_MAP[item.label];
    const count = nodes ? nodes.filter((n) => n.type === nodeType).length : 0;

    // Dot — shape matches node type
    if (item.label === "Communities") {
      // Rounded square
      const s = dotR * 1.4;
      ctx.fillStyle = item.color + (isActive ? "dd" : "55");
      ctx.beginPath();
      ctx.roundRect(boxX + padX + dotR - s / 2, iy - s / 2, s, s, 2);
      ctx.fill();
    } else if (item.label === "Interests") {
      // Diamond
      ctx.fillStyle = item.color + (isActive ? "dd" : "55");
      ctx.beginPath();
      ctx.moveTo(boxX + padX + dotR, iy - dotR);
      ctx.lineTo(boxX + padX + dotR + dotR, iy);
      ctx.lineTo(boxX + padX + dotR, iy + dotR);
      ctx.lineTo(boxX + padX + dotR - dotR, iy);
      ctx.closePath();
      ctx.fill();
    } else {
      // Circle
      ctx.beginPath();
      ctx.arc(boxX + padX + dotR, iy, dotR, 0, Math.PI * 2);
      ctx.fillStyle = item.color + (isActive ? "dd" : "55");
      ctx.fill();
    }

    // Label
    ctx.font = `500 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillText(item.label, boxX + padX + dotR * 2 + 10, iy);

    // Count badge
    if (count > 0) {
      const labelW = ctx.measureText(item.label).width;
      ctx.font = `500 ${fontSize - 1}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = `rgba(255, 255, 255, ${isActive ? 0.45 : 0.25})`;
      ctx.fillText(`${count}`, boxX + padX + dotR * 2 + 10 + labelW + 8, iy);
    }
  }
}
