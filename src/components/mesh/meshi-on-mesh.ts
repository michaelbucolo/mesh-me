// Meshi avatar state for the mesh canvas.
// Manages Meshi's position, movement between nodes, reactions, and mood.
// Rendered directly on the canvas via mesh-renderer.ts — no React dependency.

import type { MeshNode } from "./mesh-types";

export type MeshiMoodCanvas = "happy" | "excited" | "searching" | "love" | "celebrating" | "thinking" | "wink";

export interface MeshiState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  radius: number;
  color: string;
  hatColor: string;
  hat: string;
  mood: MeshiMoodCanvas;
  targetNode: MeshNode | null;
  visitedNodes: Set<string>;
  currentReaction: string | null;
  reactionTimer: number;
  moveTimer: number;
  bobPhase: number;
  trailPoints: { x: number; y: number; alpha: number }[];
  isMoving: boolean;
  prop: "none" | "magnifying-glass" | "heart" | "compass";
  propTimer: number;
  username: string;
  lookAtX: number | null; // When set, Meshi's eyes look toward this point
  lookAtY: number | null;
}

export interface RemoteMeshi {
  userId: string;
  username: string;
  displayName: string;
  x: number;
  y: number;
  color: string;
  hat: string;
  mood: MeshiMoodCanvas;
}

export const MESHI_COLORS: Record<string, string> = {
  blue: "#6366f1",
  purple: "#a855f7",
  pink: "#ec4899",
  green: "#10b981",
  orange: "#f97316",
  red: "#ef4444",
  cyan: "#06b6d4",
  yellow: "#eab308",
  white: "#e2e8f0",
  gold: "#eab308",
  rainbow: "#ec4899",
  // MeshPro exclusive colors
  crimson: "#dc2626",
  midnight: "#1e1b4b",
  rose: "#f43f5e",
  emerald: "#059669",
  arctic: "#7dd3fc",
  obsidian: "#18181b",
};

// How frequently Meshi picks a new node to visit (seconds)
const WANDER_INTERVAL_MIN = 4;
const WANDER_INTERVAL_MAX = 9;
// Movement speed (pixels per tick)
const MOVE_SPEED = 1.8;

export function createMeshiState(
  cx: number,
  cy: number,
  color: string,
  hat: string,
  username: string,
): MeshiState {
  return {
    x: cx,
    y: cy,
    targetX: cx,
    targetY: cy,
    radius: 14,
    color: MESHI_COLORS[color] || MESHI_COLORS.blue,
    hatColor: MESHI_COLORS[color] || MESHI_COLORS.blue,
    hat,
    mood: "happy",
    targetNode: null,
    visitedNodes: new Set(),
    currentReaction: null,
    reactionTimer: 0,
    moveTimer: 0,
    bobPhase: 0,
    trailPoints: [],
    isMoving: false,
    prop: "none",
    propTimer: 0,
    username,
    lookAtX: null,
    lookAtY: null,
  };
}

/** Pick the next node for Meshi to visit — prefers unvisited, nearby nodes */
function pickNextTarget(state: MeshiState, nodes: MeshNode[]): MeshNode | null {
  const candidates = nodes.filter(
    (n) => n.type !== "self" && n.id !== state.targetNode?.id,
  );
  if (candidates.length === 0) return null;

  // Prefer unvisited nodes
  const unvisited = candidates.filter((n) => !state.visitedNodes.has(n.id));
  const pool = unvisited.length > 0 ? unvisited : candidates;

  // Weight by proximity (closer nodes more likely) — but add randomness
  const weights = pool.map((n) => {
    const dx = n.x - state.x;
    const dy = n.y - state.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 1;
    return 1 / (dist * 0.01 + 0.5);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** Choose reaction based on node type — eyes-only expressions, no emojis */
function getReactionForNode(node: MeshNode): { mood: MeshiMoodCanvas; reaction: string | null; prop: MeshiState["prop"] } {
  switch (node.type) {
    case "post":
      return { mood: "searching", reaction: null, prop: "magnifying-glass" };
    case "user":
      return {
        mood: node.isMutual ? "love" : node.status === "online" ? "excited" : "wink",
        reaction: null,
        prop: "none",
      };
    case "community":
      return { mood: "celebrating", reaction: null, prop: "none" };
    case "platform":
      return { mood: "excited", reaction: null, prop: "compass" };
    case "tag":
      return { mood: "thinking", reaction: null, prop: "none" };
    case "alter-ego":
      return { mood: "wink", reaction: null, prop: "none" };
    default:
      return { mood: "happy", reaction: null, prop: "none" };
  }
}

/** Tick Meshi state — call each frame */
export function tickMeshi(state: MeshiState, nodes: MeshNode[], dt: number): void {
  state.bobPhase += dt * 2.5;
  state.moveTimer -= dt;
  if (state.reactionTimer > 0) state.reactionTimer -= dt;
  else { state.currentReaction = null; }
  if (state.propTimer > 0) state.propTimer -= dt;
  else { state.prop = "none"; }

  // Pick new target when timer expires
  if (state.moveTimer <= 0) {
    const next = pickNextTarget(state, nodes);
    if (next) {
      state.targetNode = next;
      state.targetX = next.x;
      state.targetY = next.y;
      state.isMoving = true;
      state.mood = "searching";
    }
    state.moveTimer = WANDER_INTERVAL_MIN + Math.random() * (WANDER_INTERVAL_MAX - WANDER_INTERVAL_MIN);
  }

  // Move toward target
  const dx = state.targetX - state.x;
  const dy = state.targetY - state.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > state.radius + 5) {
    const speed = Math.min(MOVE_SPEED, dist * 0.06) * dt * 60;
    state.x += (dx / dist) * speed;
    state.y += (dy / dist) * speed;
    state.isMoving = true;

    // Leave trail
    if (state.trailPoints.length === 0 || Math.random() < 0.3) {
      state.trailPoints.push({ x: state.x, y: state.y, alpha: 0.4 });
      if (state.trailPoints.length > 12) state.trailPoints.shift();
    }
  } else if (state.isMoving && state.targetNode) {
    // Arrived at target node — react
    state.isMoving = false;
    state.visitedNodes.add(state.targetNode.id);
    const reaction = getReactionForNode(state.targetNode);
    state.mood = reaction.mood;
    state.currentReaction = reaction.reaction;
    state.reactionTimer = 2.5;
    state.prop = reaction.prop;
    state.propTimer = 3;

    // Reset visited set if we've seen most nodes
    if (state.visitedNodes.size > nodes.length * 0.7) {
      state.visitedNodes.clear();
    }
  }

  // Fade trail
  for (const pt of state.trailPoints) {
    pt.alpha *= 0.96;
  }
  state.trailPoints = state.trailPoints.filter((pt) => pt.alpha > 0.02);
}

/** Draw Meshi on the canvas */
export function drawMeshi(ctx: CanvasRenderingContext2D, state: MeshiState, time: number): void {
  const bob = Math.sin(state.bobPhase) * 3;
  const mx = state.x;
  const my = state.y + bob;

  // Trail sparkles
  for (const pt of state.trailPoints) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(99, 102, 241, ${pt.alpha * 0.5})`;
    ctx.fill();
  }

  // Glow
  const glowGrad = ctx.createRadialGradient(mx, my, 0, mx, my, state.radius * 2.5);
  glowGrad.addColorStop(0, `${state.color}40`);
  glowGrad.addColorStop(0.5, `${state.color}15`);
  glowGrad.addColorStop(1, "transparent");
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(mx, my, state.radius * 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.beginPath();
  ctx.arc(mx, my, state.radius, 0, Math.PI * 2);
  const bodyGrad = ctx.createRadialGradient(mx - 3, my - 3, 0, mx, my, state.radius);
  bodyGrad.addColorStop(0, lightenColor(state.color, 30));
  bodyGrad.addColorStop(1, state.color);
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = `${state.color}80`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Shine highlight
  ctx.beginPath();
  ctx.arc(mx - state.radius * 0.25, my - state.radius * 0.3, state.radius * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.fill();

  // Eyes
  drawMeshiEyes(ctx, mx, my, state.mood, state.radius, time, state.lookAtX, state.lookAtY);

  // Hat
  if (state.hat && state.hat !== "none") {
    drawMeshiHat(ctx, mx, my, state.hat, state.radius, state.hatColor);
  }

  // Prop (magnifying glass, compass, etc.)
  if (state.prop !== "none" && state.propTimer > 0) {
    drawMeshiProp(ctx, mx, my, state.prop, state.radius, state.color);
  }

  // Username label
  ctx.font = "bold 8px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.fillText(state.username, mx, my + state.radius + 4);
}

/** Draw remote Meshi presences on the canvas */
export function drawRemoteMeshis(ctx: CanvasRenderingContext2D, remoteMeshis: RemoteMeshi[], time: number): void {
  for (const rm of remoteMeshis) {
    const bob = Math.sin(time * 2 + rm.userId.charCodeAt(0)) * 2;
    const mx = rm.x;
    const my = rm.y + bob;
    const radius = 11;
    const color = MESHI_COLORS[rm.color] || MESHI_COLORS.blue;

    // Semi-transparent glow
    const glowGrad = ctx.createRadialGradient(mx, my, 0, mx, my, radius * 2);
    glowGrad.addColorStop(0, `${color}25`);
    glowGrad.addColorStop(1, "transparent");
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(mx, my, radius * 2, 0, Math.PI * 2);
    ctx.fill();

    // Body (slightly transparent)
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(mx, my, radius, 0, Math.PI * 2);
    const bodyGrad = ctx.createRadialGradient(mx - 2, my - 2, 0, mx, my, radius);
    bodyGrad.addColorStop(0, lightenColor(color, 25));
    bodyGrad.addColorStop(1, color);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = `${color}60`;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Eyes
    drawMeshiEyes(ctx, mx, my, rm.mood, radius, time);

    // Hat
    if (rm.hat && rm.hat !== "none") {
      drawMeshiHat(ctx, mx, my, rm.hat, radius, color);
    }
    ctx.globalAlpha = 1;

    // Username
    ctx.font = "bold 7px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText(rm.displayName, mx, my + radius + 3);
  }
}

// --- Drawing helpers ---

function drawMeshiEyes(ctx: CanvasRenderingContext2D, x: number, y: number, mood: MeshiMoodCanvas, radius: number, time: number, lookAtX?: number | null, lookAtY?: number | null) {
  const eyeSpacing = radius * 0.35;
  const eyeY = y - radius * 0.1;
  const eyeRadius = radius * 0.18;

  // Calculate pupil offset if Meshi is looking at something
  let pupilOffX = 0;
  let pupilOffY = 0;
  if (lookAtX != null && lookAtY != null) {
    const dx = lookAtX - x;
    const dy = lookAtY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 5) {
      const maxOff = eyeRadius * 0.5;
      pupilOffX = (dx / dist) * maxOff;
      pupilOffY = (dy / dist) * maxOff;
    }
  }

  switch (mood) {
    case "happy":
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.ellipse(x - eyeSpacing, eyeY, eyeRadius, eyeRadius * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + eyeSpacing, eyeY, eyeRadius, eyeRadius * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pupils that track lookAt target
      if (pupilOffX !== 0 || pupilOffY !== 0) {
        ctx.fillStyle = "#1e1b4b";
        ctx.beginPath();
        ctx.arc(x - eyeSpacing + pupilOffX, eyeY + pupilOffY, eyeRadius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + eyeSpacing + pupilOffX, eyeY + pupilOffY, eyeRadius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "excited":
      ctx.font = `${radius * 0.5}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "white";
      ctx.fillText("★", x - eyeSpacing, eyeY);
      ctx.fillText("★", x + eyeSpacing, eyeY);
      break;
    case "love":
      ctx.font = `${radius * 0.55}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ff6b9d";
      ctx.fillText("♥", x - eyeSpacing, eyeY);
      ctx.fillText("♥", x + eyeSpacing, eyeY);
      break;
    case "searching": {
      // Squinting eyes that look around
      const lookX = Math.sin(time * 3) * 1.5;
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.ellipse(x - eyeSpacing + lookX, eyeY, eyeRadius * 1.3, eyeRadius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + eyeSpacing + lookX, eyeY, eyeRadius * 1.3, eyeRadius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pupils
      ctx.fillStyle = state_color_for_mood();
      ctx.beginPath();
      ctx.arc(x - eyeSpacing + lookX + 0.5, eyeY, eyeRadius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + eyeSpacing + lookX + 0.5, eyeY, eyeRadius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "celebrating":
      // Happy curved lines
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(x - eyeSpacing, eyeY + 1, eyeRadius, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + eyeSpacing, eyeY + 1, eyeRadius, Math.PI, 0);
      ctx.stroke();
      break;
    case "thinking":
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.ellipse(x - eyeSpacing - 1, eyeY, eyeRadius * 0.9, eyeRadius * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + eyeSpacing + 1, eyeY, eyeRadius * 1.1, eyeRadius * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "wink":
      // One open eye, one closed
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.ellipse(x - eyeSpacing, eyeY, eyeRadius, eyeRadius * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(x + eyeSpacing, eyeY + 1, eyeRadius, Math.PI * 0.8, Math.PI * 0.2, true);
      ctx.stroke();
      break;
  }
}

function state_color_for_mood(): string {
  return "rgba(30, 30, 50, 0.8)";
}

function drawMeshiHat(ctx: CanvasRenderingContext2D, x: number, y: number, hat: string, radius: number, color: string) {
  const hatY = y - radius - 1;
  switch (hat) {
    case "beanie":
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, hatY, radius * 0.85, radius * 0.5, 0, Math.PI, 0);
      ctx.fill();
      // Pom pom
      ctx.beginPath();
      ctx.arc(x, hatY - radius * 0.45, radius * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = lightenColor(color, 40);
      ctx.fill();
      break;
    case "crown":
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.moveTo(x - radius * 0.6, hatY);
      ctx.lineTo(x - radius * 0.5, hatY - radius * 0.5);
      ctx.lineTo(x - radius * 0.2, hatY - radius * 0.25);
      ctx.lineTo(x, hatY - radius * 0.55);
      ctx.lineTo(x + radius * 0.2, hatY - radius * 0.25);
      ctx.lineTo(x + radius * 0.5, hatY - radius * 0.5);
      ctx.lineTo(x + radius * 0.6, hatY);
      ctx.closePath();
      ctx.fill();
      break;
    case "flower":
      // Flower on top
      const petalR = radius * 0.15;
      ctx.fillStyle = "#f472b6";
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(angle) * petalR * 1.5, hatY - radius * 0.15 + Math.sin(angle) * petalR * 1.5, petalR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(x, hatY - radius * 0.15, petalR * 0.7, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "cap":
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, hatY + 1, radius * 0.8, radius * 0.35, 0, Math.PI, 0);
      ctx.fill();
      // Brim
      ctx.beginPath();
      ctx.ellipse(x + radius * 0.3, hatY + 1, radius * 0.65, radius * 0.12, 0.15, 0, Math.PI * 2);
      ctx.fillStyle = darkenColor(color, 20);
      ctx.fill();
      break;
    case "tophat":
      ctx.fillStyle = "#1e1e2e";
      ctx.fillRect(x - radius * 0.45, hatY - radius * 0.7, radius * 0.9, radius * 0.7);
      ctx.fillRect(x - radius * 0.65, hatY, radius * 1.3, radius * 0.12);
      break;
    case "party":
      ctx.fillStyle = "#ec4899";
      ctx.beginPath();
      ctx.moveTo(x, hatY - radius * 0.7);
      ctx.lineTo(x - radius * 0.4, hatY);
      ctx.lineTo(x + radius * 0.4, hatY);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, hatY - radius * 0.7, radius * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
      break;
    case "headphones":
      ctx.strokeStyle = "#6b7280";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, hatY + radius * 0.2, radius * 0.7, Math.PI, 0);
      ctx.stroke();
      // Ear cups
      ctx.fillStyle = "#374151";
      ctx.fillRect(x - radius * 0.85, hatY + radius * 0.05, radius * 0.3, radius * 0.4);
      ctx.fillRect(x + radius * 0.55, hatY + radius * 0.05, radius * 0.3, radius * 0.4);
      break;
    case "halo":
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(x, hatY - radius * 0.4, radius * 0.75, radius * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 0.6;
      ctx.stroke();
      break;
    case "wizard":
      ctx.fillStyle = "#6366f1";
      ctx.beginPath();
      ctx.moveTo(x, hatY - radius * 0.9);
      ctx.lineTo(x - radius * 0.5, hatY);
      ctx.lineTo(x + radius * 0.5, hatY);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x - radius * 0.7, hatY, radius * 1.4, radius * 0.15);
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(x, hatY - radius * 0.75, radius * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "astronaut":
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, hatY, radius * 0.9, radius * 0.65, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(148, 163, 184, 0.1)";
      ctx.fill();
      break;
    case "pirate":
      ctx.fillStyle = "#1e1e2e";
      ctx.beginPath();
      ctx.ellipse(x, hatY + 1, radius * 0.8, radius * 0.35, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x - radius * 0.85, hatY, radius * 1.7, radius * 0.12);
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.moveTo(x - radius * 0.2, hatY - radius * 0.2);
      ctx.lineTo(x, hatY - radius * 0.35);
      ctx.lineTo(x + radius * 0.2, hatY - radius * 0.2);
      ctx.lineTo(x + radius * 0.1, hatY - radius * 0.05);
      ctx.lineTo(x - radius * 0.1, hatY - radius * 0.05);
      ctx.closePath();
      ctx.fill();
      break;
    case "chef":
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(x, hatY - radius * 0.15, radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - radius * 0.3, hatY - radius * 0.05, radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + radius * 0.3, hatY - radius * 0.05, radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(x - radius * 0.6, hatY, radius * 1.2, radius * 0.1);
      break;
  }
}

function drawMeshiProp(ctx: CanvasRenderingContext2D, x: number, y: number, prop: string, radius: number, color: string) {
  const px = x + radius + 4;
  const py = y - 4;
  const scale = radius * 0.06;

  ctx.save();
  ctx.translate(px, py);
  ctx.scale(scale, scale);

  switch (prop) {
    case "magnifying-glass":
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5 / scale;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(4, 4);
      ctx.lineTo(10, 10);
      ctx.stroke();
      break;
    case "compass":
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 / scale;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(2, 0);
      ctx.lineTo(0, 5);
      ctx.lineTo(-2, 0);
      ctx.closePath();
      ctx.fill();
      break;
    case "heart":
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.bezierCurveTo(-8, -2, -8, -8, -4, -8);
      ctx.bezierCurveTo(-1, -8, 0, -5, 0, -5);
      ctx.bezierCurveTo(0, -5, 1, -8, 4, -8);
      ctx.bezierCurveTo(8, -8, 8, -2, 0, 3);
      ctx.fill();
      break;
  }

  ctx.restore();
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + Math.round(255 * percent / 100));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * percent / 100));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * percent / 100));
  return `rgb(${r}, ${g}, ${b})`;
}

function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - Math.round(255 * percent / 100));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * percent / 100));
  const b = Math.max(0, (num & 0xff) - Math.round(255 * percent / 100));
  return `rgb(${r}, ${g}, ${b})`;
}
