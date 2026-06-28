// Pure canvas rendering for the Mesh visualization.
// Takes state and draws to a canvas context — no React dependency.

import type { MeshNode, MeshEdge, FilterType, MeshVisualSettings } from "./mesh-types";
import { NODE_GLOW, STATUS_COLORS, getPostNodeSize, hexAlpha } from "./mesh-types";
import { drawMeshi, drawRemoteMeshis, type MeshiState, type RemoteMeshi } from "./meshi-on-mesh";

export interface ViewportState {
  zoom: number;
  pan: { x: number; y: number };
  center: { x: number; y: number };
  filter: FilterType;
  showLabels: boolean;
  time: number;
  /** Delta-time in seconds for frame-rate-independent animations */
  dt: number;
  /** 0→1 progress of the mesh formation animation. 1 = fully formed. */
  formationProgress?: number;
  /** Timestamp of a sync pulse ripple (performance.now), or null. */
  syncPulseTime?: number | null;
  /** Pro-only visual personalization applied to the Mesh canvas. */
  meshVisuals?: MeshVisualSettings;
}

export interface InteractionState {
  hoveredNode: MeshNode | null;
  selectedNode: MeshNode | null;
  meshiState?: MeshiState | null;
  remoteMeshis?: RemoteMeshi[];
}

type ResolvedMeshVisuals = {
  connectionRgb: string | null;
  nodeStyle: "clean" | "soft" | "glass" | "bold";
  motionFactor: number;
};

function hexToRgbTriplet(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const match = /^#?([a-f0-9]{6})$/i.exec(trimmed);
  if (!match) return null;
  const numeric = Number.parseInt(match[1], 16);
  const r = (numeric >> 16) & 255;
  const g = (numeric >> 8) & 255;
  const b = numeric & 255;
  return `${r}, ${g}, ${b}`;
}

function resolveMeshVisuals(visuals?: MeshVisualSettings): ResolvedMeshVisuals {
  const nodeStyle = visuals?.nodeStyle === "soft" || visuals?.nodeStyle === "glass" || visuals?.nodeStyle === "bold"
    ? visuals.nodeStyle
    : "clean";
  const motionFactor = visuals?.motionStyle === "minimal"
    ? 0.35
    : visuals?.motionStyle === "lively"
      ? 1.35
      : 1;

  return {
    connectionRgb: hexToRgbTriplet(visuals?.connectionColor),
    nodeStyle,
    motionFactor,
  };
}

function resolveEdgeColor(edgeType: string, visuals: ResolvedMeshVisuals) {
  return visuals.connectionRgb || EDGE_COLORS[edgeType] || "99, 102, 241";
}

function visualFillAlpha(base: number, visuals: ResolvedMeshVisuals) {
  if (visuals.nodeStyle === "glass") return base * 0.72;
  if (visuals.nodeStyle === "bold") return Math.min(1, base * 1.2);
  return base;
}

function visualLineWidth(base: number, visuals: ResolvedMeshVisuals) {
  if (visuals.nodeStyle === "bold") return base + 0.75;
  if (visuals.nodeStyle === "glass") return base + 0.25;
  return base;
}

export function renderMesh(
  ctx: CanvasRenderingContext2D,
  nodes: MeshNode[],
  edges: MeshEdge[],
  viewport: ViewportState,
  interaction: InteractionState,
  imageCache: Map<string, HTMLImageElement | null>,
) {
  const { zoom: z, pan: p, center, filter: f, showLabels: labels, time, dt } = viewport;
  const { hoveredNode: hovered, selectedNode: selected, remoteMeshis } = interaction;
  const formationProgress = viewport.formationProgress ?? 1;
  const visuals = resolveMeshVisuals(viewport.meshVisuals);
  const motionTime = time * visuals.motionFactor;

  const dpr = window.devicePixelRatio || 1;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const logicalW = w / dpr;
  const logicalH = h / dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, logicalW, logicalH);

  // Ambient background glow
  const bgGrad = ctx.createRadialGradient(logicalW / 2, logicalH / 2, 0, logicalW / 2, logicalH / 2, Math.max(logicalW, logicalH) * 0.7);
  bgGrad.addColorStop(0, "rgba(47, 124, 255, 0.05)");
  bgGrad.addColorStop(0.3, "rgba(47, 124, 255, 0.025)");
  bgGrad.addColorStop(0.6, "rgba(88, 191, 255, 0.01)");
  bgGrad.addColorStop(1, "transparent");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, logicalW, logicalH);
  drawAmbientField(ctx, logicalW, logicalH, motionTime);

  // Formation flash — brief bright pulse at the start
  if (formationProgress > 0 && formationProgress < 0.3) {
    const flashAlpha = Math.sin((formationProgress / 0.3) * Math.PI) * 0.08;
    const flashGrad = ctx.createRadialGradient(logicalW / 2, logicalH / 2, 0, logicalW / 2, logicalH / 2, Math.max(logicalW, logicalH) * 0.5);
    flashGrad.addColorStop(0, `rgba(47, 124, 255, ${flashAlpha})`);
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

  const selfNode = nodes.find((n) => n.type === "self");

  drawEdges(ctx, nodes, edges, f, hovered, selected, motionTime, visuals);
  drawDataParticles(ctx, nodes, edges, f, motionTime, hovered, selected, visuals);
  const focusNode = selected?.type === "self" ? hovered : selected || hovered;
  drawFocusConstellation(ctx, nodes, edges, focusNode?.type === "self" ? null : focusNode, motionTime, visuals);

  // Reset alpha for nodes
  ctx.globalAlpha = 1;

  drawSectionLabels(ctx, selfNode, z, nodes);
  drawNodes(ctx, nodes, edges, f, hovered, selected, labels, motionTime, imageCache, formationProgress, dt, z, visuals);

  // Sync pulse stays subtle so the user's Meshi/self point never gets wrapped in rings.
  if (viewport.syncPulseTime != null && selfNode) {
    drawSyncPulseLines(ctx, selfNode, nodes, performance.now() - viewport.syncPulseTime);
  }

  // Draw remote Meshis on the mesh (other users' presence)
  if (remoteMeshis && remoteMeshis.length > 0) {
    drawRemoteMeshis(ctx, remoteMeshis, time);
  }
  // Draw local user's Meshi on the mesh canvas
  if (interaction.meshiState) {
    drawMeshi(ctx, interaction.meshiState);
  }

  drawTooltip(ctx, hovered, z);

  ctx.restore();

  // Draw mini legend in bottom-left corner (screen space). On narrow viewports the
  // filter bar at the top already conveys the same categories, and the legend would
  // collide with the action bar, so it is only drawn when there is room for it.
  if (logicalW >= 768) {
    drawLegend(ctx, logicalW, logicalH, f, nodes);
  }
}

// --- Ambient star field in screen space ---

function drawAmbientField(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  const starCount = Math.max(44, Math.min(130, Math.floor((w * h) / 12000)));

  ctx.save();
  for (let i = 0; i < starCount; i++) {
    const seedX = (i * 97 + 41) % 997;
    const seedY = (i * 193 + 17) % 991;
    const x = (seedX / 997) * w;
    const y = (seedY / 991) * h;
    const phase = Math.sin(time * (0.22 + (i % 7) * 0.018) + i * 0.71);
    const alpha = 0.035 + Math.max(0, phase) * 0.12;
    const radius = 0.55 + (i % 5) * 0.14;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(191, 219, 254, ${alpha})`;
    ctx.fill();

    if (i % 11 === 0) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 18 + (i % 4) * 9, y + 6 - (i % 3) * 5);
      ctx.strokeStyle = `rgba(96, 165, 250, ${alpha * 0.22})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }
  ctx.restore();
}

// --- Focus field around the selected/hovered node ---

function drawFocusConstellation(
  ctx: CanvasRenderingContext2D,
  nodes: MeshNode[],
  edges: MeshEdge[],
  focus: MeshNode | null,
  time: number,
  visuals: ResolvedMeshVisuals,
) {
  if (!focus) return;

  const nodeMap = new Map<string, MeshNode>();
  for (const node of nodes) nodeMap.set(node.id, node);

  const relatedEdges = edges
    .filter((edge) => edge.source === focus.id || edge.target === focus.id)
    .slice(0, 24);

  if (relatedEdges.length === 0) return;

  const pulse = Math.sin(time * 1.6) * 0.5 + 0.5;
  const fieldRadius = Math.max(70, focus.radius * 3.8 + relatedEdges.length * 2.6);
  const focusGlow = ctx.createRadialGradient(focus.x, focus.y, focus.radius, focus.x, focus.y, fieldRadius);
  focusGlow.addColorStop(0, `${focus.color}22`);
  focusGlow.addColorStop(0.55, `${focus.color}0d`);
  focusGlow.addColorStop(1, "rgba(0,0,0,0)");

  ctx.save();
  ctx.beginPath();
  ctx.arc(focus.x, focus.y, fieldRadius, 0, Math.PI * 2);
  ctx.fillStyle = focusGlow;
  ctx.fill();

  relatedEdges.forEach((edge, index) => {
    const otherId = edge.source === focus.id ? edge.target : edge.source;
    const other = nodeMap.get(otherId);
    if (!other) return;

    const edgeColor = resolveEdgeColor(edge.type, visuals);
    const alpha = 0.055 + pulse * 0.035 + Math.min(0.08, (edge.interactionCount || 0) * 0.01);
    const offset = Math.sin(time * 0.8 + index) * 10;
    const midX = (focus.x + other.x) / 2 - (other.y - focus.y) * 0.025;
    const midY = (focus.y + other.y) / 2 + (other.x - focus.x) * 0.025 + offset;

    ctx.beginPath();
    ctx.moveTo(focus.x, focus.y);
    ctx.quadraticCurveTo(midX, midY, other.x, other.y);
    ctx.strokeStyle = `rgba(${edgeColor}, ${alpha})`;
    ctx.lineWidth = 4;
    ctx.stroke();
  });
  ctx.restore();
}

function drawSyncPulseLines(
  ctx: CanvasRenderingContext2D,
  selfNode: MeshNode,
  nodes: MeshNode[],
  elapsedMs: number,
) {
  const elapsed = elapsedMs / 1000;
  if (elapsed < 0 || elapsed > 1.8) return;

  const alpha = Math.max(0, 1 - elapsed / 1.8) * 0.16;
  const reach = Math.min(1, elapsed / 0.65);
  const targets = nodes
    .filter((node) => node.type !== "self")
    .sort((a, b) => (b.importance || 0) - (a.importance || 0))
    .slice(0, 18);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (const target of targets) {
    const dx = target.x - selfNode.x;
    const dy = target.y - selfNode.y;
    const endX = selfNode.x + dx * reach;
    const endY = selfNode.y + dy * reach;
    const gradient = ctx.createLinearGradient(selfNode.x, selfNode.y, endX, endY);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.18})`);
    gradient.addColorStop(0.55, `${target.color}${hexAlpha(alpha)}`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    ctx.beginPath();
    ctx.moveTo(selfNode.x, selfNode.y);
    ctx.quadraticCurveTo(
      (selfNode.x + endX) / 2 - dy * 0.025,
      (selfNode.y + endY) / 2 + dx * 0.025,
      endX,
      endY,
    );
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.15;
    ctx.stroke();
  }

  ctx.restore();
}

// --- Section labels near branch lanes ---

function drawSectionLabels(
  ctx: CanvasRenderingContext2D,
  self: MeshNode | undefined,
  zoom: number,
  nodes?: MeshNode[],
) {
  if (!self || zoom < 0.25) return;

  const TYPE_MAP: Record<string, string> = {
    "Alter Egos": "alter-ego",
    "Activity": "activity",
    "Platforms": "platform",
    "People": "user",
    "Communities": "community",
    "Interests": "tag",
    "Posts": "post",
  };

  const sections = [
    { radius: 180, label: "Alter Egos", angle: -Math.PI / 2 - 0.3, color: "192, 132, 252" },
    { radius: 260, label: "Activity", angle: -Math.PI / 2 + 0.45, color: "56, 189, 248" },
    { radius: 340, label: "Platforms", angle: -Math.PI / 2 + 0.15, color: "245, 158, 11" },
    { radius: 575, label: "People", angle: -Math.PI / 2 - 0.1, color: "129, 140, 248" },
    { radius: 800, label: "Communities", angle: -Math.PI / 2 + 0.25, color: "236, 72, 153" },
    { radius: 960, label: "Interests", angle: -Math.PI / 2 - 0.2, color: "6, 182, 212" },
    { radius: 1140, label: "Posts", angle: -Math.PI / 2 + 0.05, color: "16, 185, 129" },
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
      ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
      const fullW = ctx.measureText(fullLabel).width;
      ctx.font = `500 ${fontSize - 1}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = `rgba(255, 255, 255, 0.4)`;
      ctx.fillText(countText, lx + fullW / 2 - ctx.measureText(countText).width / 2, ly);
    }
  }
}

function getEdgeControlPoint(source: MeshNode, target: MeshNode, edge: MeshEdge, time: number) {
  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / dist;
  const ny = dx / dist;
  const sourceAnchorX = source.anchorX ?? source.x;
  const sourceAnchorY = source.anchorY ?? source.y;
  const targetAnchorX = target.anchorX ?? target.x;
  const targetAnchorY = target.anchorY ?? target.y;
  const anchorMidX = (sourceAnchorX + targetAnchorX) / 2;
  const anchorMidY = (sourceAnchorY + targetAnchorY) / 2;

  const curveByType: Record<string, number> = {
    mutual: 0.16,
    "cross-follow": 0.2,
    "shared-community": 0.18,
    community: 0.1,
    interest: 0.12,
    post: 0.08,
    "platform-content": 0.14,
    "platform-follower": 0.12,
    platform: 0.04,
    follow: 0.04,
    "alter-ego": 0.03,
    activity: 0.1,
  };

  const curve = dist * (curveByType[edge.type] ?? 0.08);
  const shimmer = Math.sin(time * 0.35 + edge.strength * 8) * Math.min(8, dist * 0.018);

  return {
    x: midX + nx * (curve + shimmer) + (anchorMidX - midX) * 0.22,
    y: midY + ny * (curve + shimmer) + (anchorMidY - midY) * 0.22,
  };
}

function drawOrganizedEdgePath(
  ctx: CanvasRenderingContext2D,
  source: MeshNode,
  target: MeshNode,
  edge: MeshEdge,
  time: number,
) {
  const control = getEdgeControlPoint(source, target, edge, time);
  ctx.beginPath();
  ctx.moveTo(source.x, source.y);
  ctx.quadraticCurveTo(control.x, control.y, target.x, target.y);
}

function getOrganizedEdgePoint(source: MeshNode, target: MeshNode, edge: MeshEdge, time: number, t: number) {
  const control = getEdgeControlPoint(source, target, edge, time);
  const inv = 1 - t;
  return {
    x: inv * inv * source.x + 2 * inv * t * control.x + t * t * target.x,
    y: inv * inv * source.y + 2 * inv * t * control.y + t * t * target.y,
  };
}

function drawEdges(
  ctx: CanvasRenderingContext2D,
  nodes: MeshNode[],
  edges: MeshEdge[],
  filter: FilterType,
  hovered: MeshNode | null,
  selected: MeshNode | null,
  time: number,
  visuals: ResolvedMeshVisuals,
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

    // Smoother alpha transitions — highlighted edges glow softly
    const baseAlpha = isHighlighted ? 0.4
      : 0.035 + edge.strength * 0.055;
    const pulseAlpha = Math.sin(time * 0.5 + edge.strength * 4) * 0.006;

    const edgeColor = resolveEdgeColor(edge.type, visuals);
    const interactionBoost = edge.interactionCount ? Math.min(edge.interactionCount * 0.15, 1.2) : 0;

    // Gradient edge — flows from source to target for visual direction
    if (isHighlighted) {
      const grad = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
      grad.addColorStop(0, `rgba(${edgeColor}, ${(baseAlpha + pulseAlpha) * 0.6})`);
      grad.addColorStop(0.5, `rgba(${edgeColor}, ${baseAlpha + pulseAlpha})`);
      grad.addColorStop(1, `rgba(${edgeColor}, ${(baseAlpha + pulseAlpha) * 0.6})`);
      ctx.strokeStyle = grad;
    } else {
      ctx.strokeStyle = `rgba(${edgeColor}, ${baseAlpha + pulseAlpha})`;
    }

    drawOrganizedEdgePath(ctx, source, target, edge, time);

    ctx.lineWidth = visualLineWidth(
      isHighlighted ? 1.8 + interactionBoost : 0.4 + edge.strength * 0.4 + interactionBoost,
      visuals,
    );
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
  visuals: ResolvedMeshVisuals,
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

    const particleCount = 3;
    const speed = 0.3;
    const edgeColor = resolveEdgeColor(edge.type, visuals);

    for (let pi = 0; pi < particleCount; pi++) {
      const t = ((time * speed + ei * 0.37 + pi * (1 / particleCount)) % 1);
      const point = getOrganizedEdgePoint(source, target, edge, time, t);
      const px = point.x;
      const py = point.y;

      // Smooth fade in/out at edges for satisfying flow
      const fadeIn = Math.min(1, t * 4);
      const fadeOut = Math.min(1, (1 - t) * 4);
      const alpha = 0.55 * fadeIn * fadeOut;
      const radius = 1.5 + fadeIn * fadeOut * 1;

      // Soft glow around particle
      const glow = ctx.createRadialGradient(px, py, 0, px, py, radius * 2.5);
      glow.addColorStop(0, `rgba(${edgeColor}, ${alpha * 0.4})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(px, py, radius * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

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
  activity: "56, 189, 248",
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

// Per-node animated scale for smooth hover transitions (persists across frames)
const nodeScaleMap = new Map<string, number>();

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
  dt: number = 0.016,
  zoom: number = 1,
  visuals: ResolvedMeshVisuals = resolveMeshVisuals(),
) {
  // Prune stale entries from nodeScaleMap to prevent memory leaks across mesh navigations
  if (nodeScaleMap.size > nodes.length * 2) {
    const currentIds = new Set(nodes.map((n) => n.id));
    for (const id of nodeScaleMap.keys()) {
      if (!currentIds.has(id)) nodeScaleMap.delete(id);
    }
  }

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

    if (node.type === "self") {
      // Draw prominent profile picture at center of mesh
      drawSelfNode(ctx, node, node.radius, imageCache, time);
      // Restore original position if modified during formation
      if (nodeFormation < 1) {
        node.x = origX;
        node.y = origY;
      }
      continue;
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
    const dimmed = (hovered || selected) && !highlight;

    // Smooth elastic hover scale — interpolate toward target instead of instant jump
    const targetScale = isHovered ? 1.15 : isSelected ? 1.08 : 1.0;
    const currentScale = nodeScaleMap.get(node.id) ?? 1.0;
    // Spring-like interpolation: fast approach with slight overshoot feel
    const lerpSpeed = 12;
    const newScale = currentScale + (targetScale - currentScale) * Math.min(1, lerpSpeed * dt);
    nodeScaleMap.set(node.id, newScale);

    const nodeOpacity = (dimmed ? 0.2 : node.opacity) * nodeFormation;
    const connectionBoost = node.connections.length > 0 ? Math.min(node.connections.length * 0.6, 6) : 0;
    const baseNodeRadius = (node.radius + connectionBoost) * (0.3 + 0.7 * nodeFormation);
    const nodeRadius = baseNodeRadius * newScale;
    const pulse = Math.sin(time * 1.5 + node.pulsePhase) * 0.5 + 0.5;

    const glowColor = node.isMutual ? NODE_GLOW.mutual
      : NODE_GLOW[node.type] || NODE_GLOW.user;

    // Glow — smooth multi-layer premium glow
    const postSize = node.type === "post" ? getPostNodeSize(node, nodeRadius) : null;
    const glowRadius = node.type === "post" && postSize
      ? Math.max(postSize.width, postSize.height) * (0.72 + pulse * 0.04)
      : nodeRadius * (1.7 + pulse * 0.15);
    const gradient = ctx.createRadialGradient(node.x, node.y, Math.max(1, nodeRadius * 0.5), node.x, node.y, glowRadius);
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


    // Node body
    drawNodeBody(ctx, node, nodeRadius, nodeOpacity, isHovered, isSelected, imageCache, visuals);

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
      ctx.fillStyle = `rgba(47, 124, 255, ${0.15 * nodeOpacity})`;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barWidth, 2, 1);
      ctx.fill();
    }

    const labelPriority = isHovered
      || isSelected
      || Boolean(isConnectedToHovered)
      || Boolean(isConnectedToSelected)
      || (node.importance ?? 0) > 0.62
      || (zoom > 0.72 && (node.type === "platform" || node.type === "alter-ego"))
      || zoom > 1.05;

    // Labels are prioritized so the Mesh stays readable when zoomed out.
    if (labels && nodeOpacity > 0.2 && labelPriority) {
      const labelOffset = postSize ? postSize.height / 2 : nodeRadius;
      drawLabel(ctx, node, labelOffset, nodeOpacity, isHovered || isSelected);
    }

    // Status indicator dot
    if (node.type === "user" && node.status) {
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

/** Draw the user's profile as a prominent centered node */
function drawSelfNode(
  ctx: CanvasRenderingContext2D,
  node: MeshNode,
  baseRadius: number,
  imageCache: Map<string, HTMLImageElement | null>,
  time: number,
) {
  const r = Math.max(baseRadius, 48);
  const pulse = Math.sin(time * 0.6) * 0.5 + 0.5;

  // Subtle outer glow — clean, not flashy
  const glowR = r * 1.8 + pulse * 3;
  const glow = ctx.createRadialGradient(node.x, node.y, r * 0.7, node.x, node.y, glowR);
  glow.addColorStop(0, "rgba(47, 124, 255, 0.08)");
  glow.addColorStop(0.6, "rgba(47, 124, 255, 0.03)");
  glow.addColorStop(1, "rgba(47, 124, 255, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
  ctx.fill();

  // Clean border ring
  ctx.beginPath();
  ctx.arc(node.x, node.y, r + 2.5, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(47, 124, 255, ${0.45 + pulse * 0.1})`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Profile picture circle
  const cachedImg = imageCache.get(node.id);
  const hasImage = cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0;

  if (hasImage) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(cachedImg!, node.x - r, node.y - r, r * 2, r * 2);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(node.x - r * 0.3, node.y - r * 0.3, 0, node.x, node.y, r);
    grad.addColorStop(0, "rgba(47, 124, 255, 0.30)");
    grad.addColorStop(1, "rgba(47, 124, 255, 0.10)");
    ctx.fillStyle = grad;
    ctx.fill();

    const initials = node.label.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "ME";
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = `bold ${Math.max(16, r * 0.45)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, node.x, node.y);
  }

  // Subtle inner highlight
  ctx.beginPath();
  ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Username label below — clean pill
  const displayName = node.label || "";
  const handle = node.sublabel || "";
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const nameMetrics = ctx.measureText(displayName);
  const handleMetrics = ctx.measureText(handle);
  const labelW = Math.max(nameMetrics.width, handleMetrics.width);
  const labelY = node.y + r + 10;
  const pad = 8;
  const labelH = handle ? 28 : 16;
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.beginPath();
  ctx.roundRect(node.x - labelW / 2 - pad, labelY - 3, labelW + pad * 2, labelH, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fillText(displayName, node.x, labelY);
  if (handle) {
    ctx.font = "500 9px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText(handle, node.x, labelY + 13);
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
  visuals: ResolvedMeshVisuals,
) {
  const cachedImg = imageCache.get(node.id);
  const hasImage = cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0;

  if (node.type === "post") {
    drawPostNodeBody(ctx, node, nodeRadius, nodeOpacity, isHovered, isSelected, cachedImg, visuals);
    return;
  }

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
    ctx.strokeStyle = node.color + hexAlpha(visualFillAlpha((isHovered || isSelected ? 0.9 : 0.5) * nodeOpacity, visuals));
    ctx.lineWidth = visualLineWidth(isHovered || isSelected ? 2.5 : 1.5, visuals);
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
      fillGrad.addColorStop(0, node.color + hexAlpha(visualFillAlpha(0.35 * nodeOpacity, visuals)));
      fillGrad.addColorStop(1, node.color + hexAlpha(visualFillAlpha(0.12 * nodeOpacity, visuals)));
      ctx.fillStyle = fillGrad;
      ctx.fill();
      ctx.strokeStyle = node.color + hexAlpha(visualFillAlpha((isHovered || isSelected ? 0.8 : 0.4) * nodeOpacity, visuals));
      ctx.lineWidth = visualLineWidth(isHovered || isSelected ? 1.5 : 1, visuals);
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
      fillGrad.addColorStop(0, node.color + hexAlpha(visualFillAlpha(0.35 * nodeOpacity, visuals)));
      fillGrad.addColorStop(1, node.color + hexAlpha(visualFillAlpha(0.12 * nodeOpacity, visuals)));
      ctx.fillStyle = fillGrad;
      ctx.fill();
      ctx.strokeStyle = node.color + hexAlpha(visualFillAlpha((isHovered || isSelected ? 0.8 : 0.4) * nodeOpacity, visuals));
      ctx.lineWidth = visualLineWidth(isHovered || isSelected ? 1.5 : 1, visuals);
      ctx.stroke();
    } else {
      // Default circle for all other node types
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
      const fillGrad = ctx.createRadialGradient(node.x - nodeRadius * 0.3, node.y - nodeRadius * 0.3, 0, node.x, node.y, nodeRadius);
      fillGrad.addColorStop(0, node.color + hexAlpha(visualFillAlpha(0.35 * nodeOpacity, visuals)));
      fillGrad.addColorStop(1, node.color + hexAlpha(visualFillAlpha(0.12 * nodeOpacity, visuals)));
      ctx.fillStyle = fillGrad;
      ctx.fill();
      ctx.strokeStyle = node.color + hexAlpha(visualFillAlpha((isHovered || isSelected ? 0.8 : 0.4) * nodeOpacity, visuals));
      ctx.lineWidth = visualLineWidth(isHovered || isSelected ? 1.5 : 1, visuals);
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
        activity: { text: "\u2022", sizeFactor: 0.95 },
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

function drawPostNodeBody(
  ctx: CanvasRenderingContext2D,
  node: MeshNode,
  nodeRadius: number,
  nodeOpacity: number,
  isHovered: boolean,
  isSelected: boolean,
  cachedImg: HTMLImageElement | null | undefined,
  visuals: ResolvedMeshVisuals,
) {
  const { width, height } = getPostNodeSize(node, nodeRadius);
  const x = node.x - width / 2;
  const y = node.y - height / 2;
  const radius = Math.min(14, Math.max(7, Math.min(width, height) * 0.16));
  const hasImage = cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0;
  const active = isHovered || isSelected;

  ctx.save();
  ctx.shadowColor = node.color + hexAlpha((active ? 0.45 : 0.22) * nodeOpacity);
  const shadowMultiplier = visuals.nodeStyle === "soft" ? 1.35 : visuals.nodeStyle === "bold" ? 1.15 : 1;
  ctx.shadowBlur = (active ? 18 : 10) * shadowMultiplier;
  ctx.shadowOffsetY = active ? 5 : 3;

  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = `rgba(5, 8, 14, ${0.9 * nodeOpacity})`;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  if (hasImage) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.clip();
    ctx.globalAlpha = nodeOpacity;
    drawCoverImage(ctx, cachedImg, x, y, width, height);
    ctx.globalAlpha = 1;

    const shade = ctx.createLinearGradient(x, y, x, y + height);
    shade.addColorStop(0, "rgba(0,0,0,0.08)");
    shade.addColorStop(0.72, "rgba(0,0,0,0.1)");
    shade.addColorStop(1, "rgba(0,0,0,0.58)");
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  } else {
    const fillGrad = ctx.createLinearGradient(x, y, x + width, y + height);
    fillGrad.addColorStop(0, node.color + hexAlpha(0.34 * nodeOpacity));
    fillGrad.addColorStop(0.48, "rgba(17, 24, 39, 0.78)");
    fillGrad.addColorStop(1, node.color + hexAlpha(0.14 * nodeOpacity));
    ctx.fillStyle = fillGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();

    const text = node.content || node.label || "Post";
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 6, y + 6, width - 12, height - 12, Math.max(5, radius - 4));
    ctx.clip();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.86 * nodeOpacity})`;
    ctx.font = `700 ${Math.max(8, Math.min(12, width / 8))}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    wrapCanvasText(ctx, text, x + 10, y + 10, width - 20, Math.max(10, Math.min(14, height / 4)), Math.max(2, Math.floor((height - 18) / 14)));
    ctx.restore();
  }

  if (node.mediaType === "video") {
    drawPlayBadge(ctx, node.x, node.y, Math.min(width, height));
  } else if (node.mediaType === "audio") {
    drawMediaBadge(ctx, x + width - 17, y + 15, "\u266a", nodeOpacity);
  } else if (node.mediaType === "link") {
    drawMediaBadge(ctx, x + width - 17, y + 15, "\u2197", nodeOpacity);
  }

  const topLine = ctx.createLinearGradient(x, y, x + width, y);
  topLine.addColorStop(0, node.color + hexAlpha(0.3 * nodeOpacity));
  topLine.addColorStop(0.5, node.color + hexAlpha((active ? 0.95 : 0.58) * nodeOpacity));
  topLine.addColorStop(1, node.color + hexAlpha(0.3 * nodeOpacity));

  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.strokeStyle = topLine;
  ctx.lineWidth = visualLineWidth(active ? 2.4 : 1.35, visuals);
  ctx.stroke();

  const metric = node.likeCount ?? node.commentCount ?? node.repostCount;
  if (metric !== undefined) {
    const pill = metric > 999 ? `${Math.round(metric / 100) / 10}k` : String(metric);
    ctx.font = "700 8.5px system-ui, -apple-system, sans-serif";
    const pillW = Math.max(20, ctx.measureText(pill).width + 12);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.62 * nodeOpacity})`;
    ctx.beginPath();
    ctx.roundRect(x + 6, y + height - 18, pillW, 12, 6);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.92 * nodeOpacity})`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pill, x + 6 + pillW / 2, y + height - 12);
  }

  ctx.restore();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const imageRatio = image.naturalWidth / Math.max(1, image.naturalHeight);
  const frameRatio = width / Math.max(1, height);
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;

  if (imageRatio > frameRatio) {
    sourceWidth = image.naturalHeight * frameRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / frameRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawPlayBadge(ctx: CanvasRenderingContext2D, x: number, y: number, frameSize: number) {
  const badgeRadius = Math.max(9, Math.min(16, frameSize * 0.18));
  ctx.fillStyle = "rgba(0, 0, 0, 0.48)";
  ctx.beginPath();
  ctx.arc(x, y, badgeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.beginPath();
  ctx.moveTo(x - badgeRadius * 0.25, y - badgeRadius * 0.45);
  ctx.lineTo(x - badgeRadius * 0.25, y + badgeRadius * 0.45);
  ctx.lineTo(x + badgeRadius * 0.52, y);
  ctx.closePath();
  ctx.fill();
}

function drawMediaBadge(ctx: CanvasRenderingContext2D, x: number, y: number, symbol: string, opacity: number) {
  ctx.fillStyle = `rgba(0, 0, 0, ${0.56 * opacity})`;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * opacity})`;
  ctx.font = "800 10px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(symbol, x, y + 0.5);
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  let line = "";
  let lineIndex = 0;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      line = testLine;
      continue;
    }

    if (line) {
      ctx.fillText(lineIndex === maxLines - 1 ? truncateCanvasText(ctx, line, maxWidth) : line, x, y + lineIndex * lineHeight);
      lineIndex += 1;
    }
    line = word;
    if (lineIndex >= maxLines) return;
  }

  if (line && lineIndex < maxLines) {
    ctx.fillText(lineIndex === maxLines - 1 ? truncateCanvasText(ctx, line, maxWidth) : line, x, y + lineIndex * lineHeight);
  }
}

function truncateCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  let output = text;
  while (output.length > 3 && ctx.measureText(`${output}...`).width > maxWidth) {
    output = output.slice(0, -1);
  }
  return output.length < text.length ? `${output}...` : output;
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
    } else if (hovered.type === "activity") {
      if (hovered.description) ttLines.push(hovered.description.slice(0, 70) + (hovered.description.length > 70 ? "..." : ""));
      if (hovered.activityType) ttLines.push(hovered.activityType.replace(/-/g, " "));
      if (hovered.isUnread) ttLines.push("Unread signal");
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
    "Activity": "activity",
  };

  const items = [
    { color: "#818cf8", label: "People" },
    { color: "#f59e0b", label: "Platforms" },
    { color: "#ec4899", label: "Communities" },
    { color: "#06b6d4", label: "Interests" },
    { color: "#10b981", label: "Posts" },
    { color: "#c084fc", label: "Alter Egos" },
    { color: "#38bdf8", label: "Activity" },
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
    const nodeType = TYPE_MAP[item.label];
    const isActive = activeFilter === "all" || activeFilter === nodeType;
    const alpha = isActive ? 0.9 : 0.4;
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
