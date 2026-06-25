// Meshi avatar state for the mesh canvas.
// Manages Meshi's position, movement between nodes, reactions, and mood.
// Rendered directly on the canvas via mesh-renderer.ts — no React dependency.

import type { MeshNode } from "./mesh-types";

export type MeshiMoodCanvas = "happy" | "excited" | "searching" | "love" | "celebrating" | "thinking" | "wink" | "sleeping";

export interface MeshiState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  radius: number;
  color: string;
  hatColor: string;
  hat: string;
  hair: string;
  accessory: string;
  eyeStyle: string;
  badge: string;
  outfit: string;
  mood: MeshiMoodCanvas;
  targetNode: MeshNode | null;
  visitedNodes: Set<string>;
  currentReaction: string | null;
  reactionTimer: number;
  moveTimer: number;
  bobPhase: number;
  trailPoints: { x: number; y: number; alpha: number }[];
  isMoving: boolean;
  prop:
    | "none"
    | "magnifying-glass"
    | "heart"
    | "compass"
    | "paper"
    | "envelope"
    | "keyboard"
    | "rock"
    | "scissors"
    | "ball"
    | "grab";
  propTimer: number;
  username: string;
  lookAtX: number | null; // When set, Meshi's eyes look toward this point
  lookAtY: number | null;
  // Cursor-following state
  cursorX: number | null;
  cursorY: number | null;
  idleTimer: number; // Seconds since last cursor movement
  isTouch: boolean;  // True on touch-enabled devices
  isTablet: boolean; // True on tablet-sized touch devices (iPad-like)
  isMobile: boolean; // True on phone-sized touch devices
  followingCursor: boolean; // True when following cursor, false when exploring
  interactionX: number | null;
  interactionY: number | null;
  interactionTimer: number; // Seconds since last direct user interaction (tap/click)
}

function detectDeviceProfile() {
  if (typeof window === "undefined") {
    return { isTouch: false, isTablet: false, isMobile: false };
  }

  const width = window.innerWidth;
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const hasHover = window.matchMedia?.("(hover: hover)").matches ?? true;

  const isMobile = hasTouch && coarsePointer && width < 768;
  const isTablet = hasTouch && !isMobile && (coarsePointer || !hasHover);

  return { isTouch: hasTouch, isTablet, isMobile };
}

export interface RemoteMeshi {
  userId: string;
  username: string;
  displayName: string;
  x: number;
  y: number;
  color: string;
  hat: string;
  hair?: string;
  accessory?: string;
  eyeStyle?: string;
  badge?: string;
  outfit?: string;
  mood: MeshiMoodCanvas;
  isOnline: boolean;
  surface?: "mesh" | "feed";
  activePostId?: string | null;
  activeNodeId?: string | null;
  viewingMesh?: string | null;
  ghostMode?: boolean;
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
const WANDER_INTERVAL_MIN = 5;
const WANDER_INTERVAL_MAX = 10;
// Movement speed (pixels per second at 60fps baseline)
const MOVE_SPEED = 100;
// Idle threshold — after this many seconds of no cursor movement, Meshi explores freely
const IDLE_THRESHOLD = 5;
// Cursor follow offset — Meshi acts as the user's cursor on the mesh
const CURSOR_OFFSET = 6;

export function createMeshiState(
  cx: number,
  cy: number,
  color: string,
  hat: string,
  username: string,
  hair = "none",
  accessory = "none",
  eyeStyle = "regular",
  badge = "none",
  outfit = "none",
): MeshiState {
  const { isTouch, isTablet, isMobile } = detectDeviceProfile();
  return {
    x: cx,
    y: cy,
    targetX: cx,
    targetY: cy,
    radius: 14,
    color: MESHI_COLORS[color] || MESHI_COLORS.blue,
    hatColor: MESHI_COLORS[color] || MESHI_COLORS.blue,
    hat,
    hair,
    accessory,
    eyeStyle,
    badge,
    outfit,
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
    cursorX: null,
    cursorY: null,
    idleTimer: IDLE_THRESHOLD + 1, // Start in exploring mode
    isTouch,
    isTablet,
    isMobile,
    followingCursor: false,
    interactionX: null,
    interactionY: null,
    interactionTimer: IDLE_THRESHOLD + 1,
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

/** Update Meshi's cursor position — call from mousemove handler */
export function updateMeshiCursor(state: MeshiState, canvasX: number, canvasY: number): void {
  state.cursorX = canvasX;
  state.cursorY = canvasY;
  state.idleTimer = 0;
  state.followingCursor = true;
}

/** Explicit interaction target (tap/click) — especially useful for touch devices */
export function updateMeshiInteraction(state: MeshiState, canvasX: number, canvasY: number): void {
  state.interactionX = canvasX;
  state.interactionY = canvasY;
  state.interactionTimer = 0;
  state.idleTimer = 0;
  state.followingCursor = true;
}

/** Tick Meshi state — call each frame */
export function tickMeshi(
  state: MeshiState,
  nodes: MeshNode[],
  dt: number,
  canvasWidth?: number,
  canvasHeight?: number,
  remoteMeshis: Array<{ x: number; y: number; isOnline: boolean }> = [],
): void {
  state.bobPhase += dt * 2.5;
  if (state.reactionTimer > 0) state.reactionTimer -= dt;
  else { state.currentReaction = null; }
  if (state.propTimer > 0) state.propTimer -= dt;
  else { state.prop = "none"; }

  // Track idle time
  state.idleTimer += dt;
  state.interactionTimer += dt;
  const isIdle = state.idleTimer > IDLE_THRESHOLD;

  // Determine behavior mode
  if (state.isMobile) {
    // Mobile: Meshi IS the user's finger/cursor on the mesh — follows touch directly
    if (state.interactionX !== null && state.interactionY !== null && state.interactionTimer < 2) {
      // Snap to where user is touching
      state.targetX = state.interactionX;
      state.targetY = state.interactionY;
      state.followingCursor = true;
      state.targetNode = null;
      state.moveTimer = 3;
      if (!state.isMoving) state.mood = "happy";
    } else {
      // No active touch — sit at center of screen as user's avatar
      const cx = (canvasWidth || 800) / 2;
      const cy = (canvasHeight || 600) / 2;
      const idleBobX = Math.sin(state.bobPhase * 0.25) * 8;
      const idleBobY = Math.cos(state.bobPhase * 0.18) * 6;
      state.targetX = cx + idleBobX;
      state.targetY = cy + idleBobY;
      state.followingCursor = false;

      // When idle, explore nearby nodes
      state.moveTimer -= dt;
      if (state.moveTimer <= 0) {
        const w = canvasWidth || 800;
        const h = canvasHeight || 600;
        const visibleNodes = nodes.filter((n) => {
          if (n.type === "self") return false;
          return n.x > -w * 0.3 && n.x < w * 1.3 && n.y > -h * 0.3 && n.y < h * 1.3;
        });
        const next = visibleNodes.length > 0 ? pickNextTarget(state, visibleNodes) : null;
        if (next) {
          state.targetNode = next;
          state.targetX = next.x;
          state.targetY = next.y;
          state.isMoving = true;
          state.mood = "searching";
        }
        state.moveTimer = WANDER_INTERVAL_MIN + Math.random() * (WANDER_INTERVAL_MAX - WANDER_INTERVAL_MIN);
      }
    }
  } else if (state.isTablet && state.cursorX !== null && state.cursorY !== null && !isIdle) {
    // iPad/tablet: Meshi acts as cursor
    state.targetX = state.cursorX + CURSOR_OFFSET;
    state.targetY = state.cursorY + CURSOR_OFFSET;
    state.followingCursor = true;
    state.targetNode = null;
    state.moveTimer = 2;
    if (!state.isMoving) state.mood = "happy";
  } else if (state.isTablet && state.interactionX !== null && state.interactionY !== null && state.interactionTimer < 3) {
    // iPad/tablet touch: snap to tap point
    state.targetX = state.interactionX;
    state.targetY = state.interactionY;
    state.followingCursor = true;
    state.targetNode = null;
    state.moveTimer = 2;
    if (!state.isMoving) state.mood = "happy";
  } else if (!isIdle && state.cursorX !== null && state.cursorY !== null) {
    // Desktop: Meshi IS the cursor — follows mouse tightly
    state.targetX = state.cursorX + CURSOR_OFFSET;
    state.targetY = state.cursorY + CURSOR_OFFSET;
    state.followingCursor = true;
    state.targetNode = null;
    state.moveTimer = 2;
    if (!state.isMoving) state.mood = "happy";
  } else {
    // Desktop idle: explore freely
    state.followingCursor = false;
    state.moveTimer -= dt;

    if (state.moveTimer <= 0) {
      const visibleNodes = nodes.filter((n) => {
        if (n.type === "self") return false;
        const w = canvasWidth || 800;
        const h = canvasHeight || 600;
        return n.x > -w * 0.3 && n.x < w * 1.3 && n.y > -h * 0.3 && n.y < h * 1.3;
      });
      const next = visibleNodes.length > 0 ? pickNextTarget(state, visibleNodes) : pickNextTarget(state, nodes);
      if (next) {
        state.targetNode = next;
        state.targetX = next.x;
        state.targetY = next.y;
        state.isMoving = true;
        state.mood = "searching";
      }
      state.moveTimer = WANDER_INTERVAL_MIN + Math.random() * (WANDER_INTERVAL_MAX - WANDER_INTERVAL_MIN);
    }
  }

  // Keep local Meshi from overlapping remote online Meshis (soft separation for readability).
  for (const rm of remoteMeshis) {
    if (!rm.isOnline) continue;
    const dx = state.targetX - rm.x;
    const dy = state.targetY - rm.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    const minDist = state.radius * 3.2;
    if (dist < minDist) {
      const push = (minDist - dist) * 0.55;
      state.targetX += (dx / dist) * push;
      state.targetY += (dy / dist) * push;
    }
  }

  // Move toward target with smooth easing
  const dx = state.targetX - state.x;
  const dy = state.targetY - state.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Faster follow speed when acting as cursor — near-instant response
  const effectiveSpeed = state.followingCursor ? MOVE_SPEED * 3.5 : MOVE_SPEED;

  if (dist > state.radius + 5) {
    // Tight cursor tracking when following, natural ease when exploring
    const approachFactor = state.followingCursor ? 8.0 : 3.0;
    const speed = Math.min(effectiveSpeed, dist * approachFactor) * dt;
    state.x += (dx / dist) * speed;
    state.y += (dy / dist) * speed;
    state.isMoving = true;

    // Leave trail (less frequent when following cursor)
    const trailChance = state.followingCursor ? 0.12 : 0.25;
    if (state.trailPoints.length === 0 || Math.random() < trailChance) {
      state.trailPoints.push({ x: state.x, y: state.y, alpha: 0.35 });
      if (state.trailPoints.length > 10) state.trailPoints.shift();
    }
  } else if (state.isMoving && state.targetNode && !state.followingCursor) {
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
  } else if (state.followingCursor && dist <= state.radius + 5) {
    state.isMoving = false;
    state.mood = "happy";
  }

  // Fade trail (frame-rate independent) — smoother exponential decay
  const trailFade = Math.pow(0.94, dt * 60);
  for (const pt of state.trailPoints) {
    pt.alpha *= trailFade;
  }
  state.trailPoints = state.trailPoints.filter((pt) => pt.alpha > 0.015);
}

// --- SVG-based Meshi rendering (matches MeshiMascot component exactly) ---

// Color themes matching meshi-mascot.tsx COLOR_THEMES
const SVG_COLOR_THEMES: Record<string, { primary: string; bg: string }> = {
  blue: { primary: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)" },
  purple: { primary: "#8b5cf6", bg: "rgba(139, 92, 246, 0.1)" },
  pink: { primary: "#ec4899", bg: "rgba(236, 72, 153, 0.1)" },
  green: { primary: "#22c55e", bg: "rgba(34, 197, 94, 0.1)" },
  orange: { primary: "#f97316", bg: "rgba(249, 115, 22, 0.1)" },
  cyan: { primary: "#06b6d4", bg: "rgba(6, 182, 212, 0.1)" },
  gold: { primary: "#eab308", bg: "rgba(234, 179, 8, 0.1)" },
  rainbow: { primary: "#ec4899", bg: "rgba(139, 92, 246, 0.1)" },
  crimson: { primary: "#dc2626", bg: "rgba(220, 38, 38, 0.1)" },
  midnight: { primary: "#312e81", bg: "rgba(49, 46, 129, 0.15)" },
  rose: { primary: "#f43f5e", bg: "rgba(244, 63, 94, 0.1)" },
  emerald: { primary: "#059669", bg: "rgba(5, 150, 105, 0.1)" },
  arctic: { primary: "#7dd3fc", bg: "rgba(125, 211, 252, 0.1)" },
  obsidian: { primary: "#475569", bg: "rgba(71, 85, 105, 0.15)" },
};

// SVG eye markup matching MeshiMascot's SVG_FACES
function svgEyesForMood(mood: MeshiMoodCanvas, primary: string): string {
  switch (mood) {
    case "happy":
      return `<ellipse cx="-5" cy="0" rx="2.5" ry="3" fill="${primary}"/>
              <ellipse cx="5" cy="0" rx="2.5" ry="3" fill="${primary}"/>`;
    case "excited":
      return `<text x="-5" y="1" text-anchor="middle" dominant-baseline="central" font-size="8" fill="${primary}" font-family="system-ui">★</text>
              <text x="5" y="1" text-anchor="middle" dominant-baseline="central" font-size="8" fill="${primary}" font-family="system-ui">★</text>`;
    case "love":
      return `<text x="-5" y="1" text-anchor="middle" dominant-baseline="central" font-size="9" fill="${primary}" font-family="system-ui">♥</text>
              <text x="5" y="1" text-anchor="middle" dominant-baseline="central" font-size="9" fill="${primary}" font-family="system-ui">♥</text>`;
    case "searching":
      return `<ellipse cx="-5" cy="0" rx="2.5" ry="3" fill="${primary}"/>
              <ellipse cx="5" cy="0" rx="2.5" ry="3" fill="${primary}"/>`;
    case "celebrating":
      return `<path d="M -7.5 0 Q -5 -3 -2.5 0" fill="none" stroke="${primary}" stroke-width="2" stroke-linecap="round"/>
              <path d="M 2.5 0 Q 5 -3 7.5 0" fill="none" stroke="${primary}" stroke-width="2" stroke-linecap="round"/>`;
    case "thinking":
      return `<ellipse cx="-5" cy="-0.5" rx="2.2" ry="2.8" fill="${primary}"/>
              <ellipse cx="5" cy="-0.5" rx="2.8" ry="2.2" fill="${primary}"/>`;
    case "sleeping":
      return `<path d="M -7 0 L -3 0" fill="none" stroke="${primary}" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M 3 0 L 7 0" fill="none" stroke="${primary}" stroke-width="1.8" stroke-linecap="round"/>
              <text x="10" y="-6" text-anchor="middle" font-size="6" fill="${primary}" font-family="system-ui" opacity="0.6">z</text>
              <text x="13" y="-10" text-anchor="middle" font-size="5" fill="${primary}" font-family="system-ui" opacity="0.4">z</text>`;
    case "wink":
      return `<ellipse cx="-5" cy="0" rx="2.5" ry="3" fill="${primary}"/>
              <path d="M 2.5 0.5 Q 5 -2.5 7.5 0.5" fill="none" stroke="${primary}" stroke-width="1.8" stroke-linecap="round"/>`;
    default:
      return `<ellipse cx="-5" cy="0" rx="2.5" ry="3" fill="${primary}"/>
              <ellipse cx="5" cy="0" rx="2.5" ry="3" fill="${primary}"/>`;
  }
}

// SVG hat markup matching MeshiMascot's HATS
function svgHatMarkup(hat: string, primary: string): string {
  switch (hat) {
    case "tophat":
      return `<g transform="translate(0, -18)">
        <rect x="-12" y="-8" width="24" height="12" rx="2" fill="${primary}" opacity="0.9"/>
        <rect x="-16" y="2" width="32" height="4" rx="2" fill="${primary}" opacity="0.9"/>
      </g>`;
    case "crown":
      return `<g transform="translate(0, -16)">
        <polygon points="-12,4 -12,-4 -8,-1 -4,-8 0,-1 4,-8 8,-1 12,-4 12,4" fill="#fbbf24"/>
        <circle cx="-4" cy="-5" r="1.5" fill="#ef4444"/>
        <circle cx="4" cy="-5" r="1.5" fill="#3b82f6"/>
        <circle cx="0" cy="-2" r="1.5" fill="#22c55e"/>
      </g>`;
    case "beanie":
      return `<g transform="translate(0, -14)">
        <ellipse cx="0" cy="0" rx="14" ry="8" fill="${primary}" opacity="0.9"/>
        <circle cx="0" cy="-6" r="3" fill="${primary}" opacity="0.7"/>
      </g>`;
    case "cap":
      return `<g transform="translate(0, -12)">
        <path d="M-14,2 Q-14,-8 0,-10 Q14,-8 14,2 Z" fill="${primary}" opacity="0.9"/>
        <path d="M10,0 Q18,0 20,4 L14,4 Q12,2 10,2 Z" fill="${primary}" opacity="0.7"/>
      </g>`;
    case "party":
      return `<g transform="translate(0, -16)">
        <polygon points="0,-14 -8,2 8,2" fill="#ec4899"/>
        <circle cx="0" cy="-14" r="2" fill="#fbbf24"/>
        <circle cx="-3" cy="-6" r="1" fill="#3b82f6"/>
        <circle cx="3" cy="-4" r="1" fill="#22c55e"/>
        <circle cx="1" cy="-10" r="1" fill="#f97316"/>
      </g>`;
    case "flower":
      return `<g transform="translate(6, -14)">
        <circle cx="0" cy="0" r="3" fill="#fbbf24"/>
        ${[0, 60, 120, 180, 240, 300].map(deg => {
          const cx = Math.round(Math.cos(deg * Math.PI / 180) * 4 * 1000) / 1000;
          const cy = Math.round(Math.sin(deg * Math.PI / 180) * 4 * 1000) / 1000;
          return `<circle cx="${cx}" cy="${cy}" r="2.5" fill="#ec4899" opacity="0.8"/>`;
        }).join("")}
      </g>`;
    case "headphones":
      return `<g transform="translate(0, -12)">
        <path d="M-12,4 Q-12,-10 0,-12 Q12,-10 12,4" fill="none" stroke="#6b7280" stroke-width="3" stroke-linecap="round"/>
        <rect x="-15" y="0" width="6" height="8" rx="2" fill="#374151"/>
        <rect x="9" y="0" width="6" height="8" rx="2" fill="#374151"/>
      </g>`;
    case "halo":
      return `<g transform="translate(0, -20)">
        <ellipse cx="0" cy="0" rx="14" ry="4" fill="none" stroke="#fbbf24" stroke-width="2.5" opacity="0.9"/>
        <ellipse cx="0" cy="0" rx="14" ry="4" fill="none" stroke="#fde68a" stroke-width="1" opacity="0.4"/>
      </g>`;
    case "wizard":
      return `<g transform="translate(0, -16)">
        <polygon points="0,-18 -10,2 10,2" fill="#6366f1"/>
        <rect x="-14" y="0" width="28" height="4" rx="2" fill="#6366f1" opacity="0.8"/>
        <circle cx="0" cy="-14" r="2" fill="#fbbf24"/>
        <circle cx="-4" cy="-6" r="1.2" fill="#fbbf24" opacity="0.6"/>
        <circle cx="3" cy="-9" r="1" fill="#fbbf24" opacity="0.5"/>
      </g>`;
    case "astronaut":
      return `<g transform="translate(0, -14)">
        <ellipse cx="0" cy="0" rx="16" ry="12" fill="none" stroke="#e2e8f0" stroke-width="2.5"/>
        <ellipse cx="0" cy="0" rx="16" ry="12" fill="rgba(148, 163, 184, 0.15)"/>
        <ellipse cx="-4" cy="-2" rx="3" ry="2" fill="rgba(255,255,255,0.2)"/>
      </g>`;
    case "pirate":
      return `<g transform="translate(0, -14)">
        <path d="M-14,2 Q-14,-6 0,-8 Q14,-6 14,2 Z" fill="#1e1e2e"/>
        <rect x="-16" y="0" width="32" height="3" rx="1" fill="#1e1e2e"/>
        <path d="M-4,-4 L0,-6 L4,-4 L2,-2 L-2,-2 Z" fill="#e2e8f0" opacity="0.8"/>
      </g>`;
    case "chef":
      return `<g transform="translate(0, -16)">
        <ellipse cx="0" cy="0" rx="12" ry="10" fill="#f8fafc"/>
        <circle cx="-6" cy="-4" r="5" fill="#f8fafc"/>
        <circle cx="6" cy="-4" r="5" fill="#f8fafc"/>
        <circle cx="0" cy="-8" r="5" fill="#f8fafc"/>
        <rect x="-12" y="0" width="24" height="3" rx="1" fill="#e2e8f0"/>
      </g>`;
    default:
      return "";
  }
}

function svgHairMarkup(hair: string, primary: string): string {
  switch (hair) {
    case "fluffy":
      return `<g transform="translate(0, -13)"><path d="M-12,3 Q-10,-8 -4,-7 Q-1,-12 3,-8 Q8,-10 12,2" fill="${primary}" opacity="0.8"/></g>`;
    case "bangs":
      return `<g transform="translate(0, -12)"><path d="M-13,3 Q-9,-8 0,-8 Q9,-8 13,3 L9,3 Q7,-2 4,1 Q1,-2 -2,1 Q-5,-2 -8,3 Z" fill="${primary}" opacity="0.85"/></g>`;
    case "spikes":
      return `<g transform="translate(0, -13)"><polygon points="-12,3 -10,-7 -6,2 -2,-8 2,2 6,-7 10,2 12,3" fill="${primary}" opacity="0.85"/></g>`;
    case "curls":
      return `<g transform="translate(0, -12)">
        <circle cx="-8" cy="0" r="4" fill="${primary}" opacity="0.8"/>
        <circle cx="-2" cy="-2" r="4.5" fill="${primary}" opacity="0.82"/>
        <circle cx="5" cy="-1" r="4.2" fill="${primary}" opacity="0.8"/>
        <circle cx="10" cy="1" r="3.5" fill="${primary}" opacity="0.78"/>
      </g>`;
    default:
      return "";
  }
}

function svgAccessoryMarkup(accessory: string, primary: string): string {
  switch (accessory) {
    case "glasses":
      return `<g transform="translate(0, 0)">
        <rect x="-10" y="-4" width="7" height="5.5" rx="2" fill="none" stroke="${primary}" stroke-width="1.5"/>
        <rect x="3" y="-4" width="7" height="5.5" rx="2" fill="none" stroke="${primary}" stroke-width="1.5"/>
        <line x1="-3" y1="-1.25" x2="3" y2="-1.25" stroke="${primary}" stroke-width="1.5" stroke-linecap="round"/>
      </g>`;
    case "sunglasses":
      return `<g transform="translate(0, 0)">
        <rect x="-10" y="-4" width="7.5" height="5.5" rx="1.8" fill="${primary}" opacity="0.85"/>
        <rect x="2.5" y="-4" width="7.5" height="5.5" rx="1.8" fill="${primary}" opacity="0.85"/>
        <line x1="-2.5" y1="-1.2" x2="2.5" y2="-1.2" stroke="${primary}" stroke-width="1.4" stroke-linecap="round"/>
      </g>`;
    case "monocle":
      return `<g transform="translate(0, 0)">
        <circle cx="5.5" cy="-1.2" r="3.3" fill="none" stroke="${primary}" stroke-width="1.4"/>
        <line x1="8.6" y1="2" x2="10" y2="5.5" stroke="${primary}" stroke-width="1.2" stroke-linecap="round"/>
      </g>`;
    default:
      return "";
  }
}

function svgEyeStyleMarkup(eyeStyle: string, primary: string): string {
  if (eyeStyle !== "lashes") return "";
  return `<g transform="translate(0, 0)">
    <path d="M-8,-3 L-9.5,-5" stroke="${primary}" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M-6,-3 L-6,-5.4" stroke="${primary}" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M-4,-3 L-2.8,-5" stroke="${primary}" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M4,-3 L2.8,-5" stroke="${primary}" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M6,-3 L6,-5.4" stroke="${primary}" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M8,-3 L9.5,-5" stroke="${primary}" stroke-width="1.2" stroke-linecap="round"/>
  </g>`;
}

function svgBadgeMarkup(badge: string, primary: string): string {
  switch (badge) {
    case "spark":
      return `<g transform="translate(9, 8)">
        <circle cx="0" cy="0" r="4.2" fill="rgba(255,255,255,0.78)" stroke="${primary}" stroke-width="1.3"/>
        <path d="M0 -2.4 L0.8 -0.7 L2.5 0 L0.8 0.7 L0 2.4 L-0.8 0.7 L-2.5 0 L-0.8 -0.7 Z" fill="${primary}"/>
      </g>`;
    case "heart":
      return `<g transform="translate(9, 8)">
        <circle cx="0" cy="0" r="4.3" fill="rgba(255,255,255,0.78)" stroke="${primary}" stroke-width="1.3"/>
        <path d="M0 2.2 C-4 -0.5 -3.4 -3.1 -1.5 -3.1 C-0.5 -3.1 0 -2.2 0 -2.2 C0 -2.2 0.5 -3.1 1.5 -3.1 C3.4 -3.1 4 -0.5 0 2.2 Z" fill="${primary}"/>
      </g>`;
    case "shield":
      return `<g transform="translate(9, 8)">
        <circle cx="0" cy="0" r="4.3" fill="rgba(255,255,255,0.78)" stroke="${primary}" stroke-width="1.3"/>
        <path d="M0 -3.1 L2.5 -1.8 L2 1.4 L0 3 L-2 1.4 L-2.5 -1.8 Z" fill="${primary}" opacity="0.9"/>
      </g>`;
    case "verified":
      return `<g transform="translate(9, 8)">
        <circle cx="0" cy="0" r="4.4" fill="#2563eb" stroke="rgba(255,255,255,0.85)" stroke-width="1.2"/>
        <path d="M-2 -0.1 L-0.5 1.5 L2.4 -1.8" fill="none" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>`;
    case "creator":
      return `<g transform="translate(9, 8)">
        <circle cx="0" cy="0" r="4.4" fill="#f59e0b" stroke="rgba(255,255,255,0.85)" stroke-width="1.2"/>
        <path d="M0 -2.7 L0.8 -0.8 L2.8 -0.8 L1.2 0.5 L1.8 2.5 L0 1.4 L-1.8 2.5 L-1.2 0.5 L-2.8 -0.8 L-0.8 -0.8 Z" fill="white"/>
      </g>`;
    case "founder":
      return `<g transform="translate(9, 8)">
        <circle cx="0" cy="0" r="4.4" fill="#7c3aed" stroke="rgba(255,255,255,0.85)" stroke-width="1.2"/>
        <path d="M-2.6 1.9 L-1.8 -1.8 L0 -0.4 L1.8 -1.8 L2.6 1.9 Z" fill="white"/>
      </g>`;
    default:
      return "";
  }
}

function svgOutfitMarkup(outfit: string, primary: string): string {
  switch (outfit) {
    case "scarf":
      return `<g transform="translate(0, 7)">
        <path d="M-12 -1 Q0 3 12 -1 L12 3 Q0 7 -12 3 Z" fill="${primary}" opacity="0.85"/>
        <rect x="5" y="1" width="4" height="9" rx="1.4" fill="${primary}" opacity="0.72"/>
      </g>`;
    case "hoodie":
      return `<g transform="translate(0, 8)">
        <path d="M-13 -1 Q-9 -7 0 -7 Q9 -7 13 -1 L12 12 H-12 Z" fill="${primary}" opacity="0.28"/>
        <path d="M-6 -5 Q0 -1 6 -5" fill="none" stroke="${primary}" stroke-width="1.4" stroke-linecap="round" opacity="0.75"/>
        <line x1="-3" y1="-2" x2="-3" y2="4" stroke="${primary}" stroke-width="1" opacity="0.6"/>
        <line x1="3" y1="-2" x2="3" y2="4" stroke="${primary}" stroke-width="1" opacity="0.6"/>
      </g>`;
    case "jacket":
      return `<g transform="translate(0, 8)">
        <path d="M-14 0 Q-8 -5 0 -5 Q8 -5 14 0 L12 12 H-12 Z" fill="${primary}" opacity="0.24"/>
        <path d="M0 -5 L0 12" stroke="${primary}" stroke-width="1.5" opacity="0.7"/>
        <circle cx="-4" cy="1" r="1" fill="${primary}" opacity="0.75"/>
        <circle cx="4" cy="1" r="1" fill="${primary}" opacity="0.75"/>
      </g>`;
    case "overalls":
      return `<g transform="translate(0, 8)">
        <path d="M-10 -3 H10 L12 12 H-12 Z" fill="${primary}" opacity="0.3"/>
        <path d="M-6 -5 V4 M6 -5 V4" stroke="${primary}" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>
        <rect x="-4" y="1" width="8" height="5" rx="1" fill="rgba(255,255,255,0.28)" stroke="${primary}" stroke-width="0.8"/>
      </g>`;
    case "cape":
      return `<g transform="translate(0, 7)">
        <path d="M-13 -4 Q0 2 13 -4 L11 15 Q0 10 -11 15 Z" fill="#7c3aed" opacity="0.34"/>
        <circle cx="-5" cy="-2.5" r="1.2" fill="${primary}"/>
        <circle cx="5" cy="-2.5" r="1.2" fill="${primary}"/>
      </g>`;
    case "spacesuit":
      return `<g transform="translate(0, 8)">
        <path d="M-13 0 Q-7 -6 0 -6 Q7 -6 13 0 L12 12 H-12 Z" fill="rgba(226,232,240,0.48)" stroke="${primary}" stroke-width="1"/>
        <rect x="-4.5" y="-1.5" width="9" height="5" rx="1.5" fill="rgba(15,23,42,0.22)" stroke="${primary}" stroke-width="0.8"/>
        <circle cx="0" cy="1" r="1" fill="${primary}"/>
      </g>`;
    default:
      return "";
  }
}

// SVG prop markup matching MeshiMascot's hand-held PROP_SVGS
function svgPropMarkup(prop: string, primary: string): string {
  switch (prop) {
    case "magnifying-glass":
      return `<g transform="translate(17, 8) scale(0.52) rotate(-10)">
        <circle cx="0" cy="0" r="6" fill="none" stroke="${primary}" stroke-width="2.5"/>
        <line x1="4" y1="4" x2="10" y2="10" stroke="${primary}" stroke-width="2.5" stroke-linecap="round"/>
      </g>`;
    case "clipboard":
      return `<g transform="translate(16, 8) scale(0.48) rotate(4)">
        <rect x="-5" y="-2" width="10" height="14" rx="1.5" fill="none" stroke="${primary}" stroke-width="2"/>
        <rect x="-2" y="-4" width="4" height="3" rx="1" fill="${primary}"/>
        <line x1="-3" y1="3" x2="3" y2="3" stroke="${primary}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="-3" y1="6" x2="3" y2="6" stroke="${primary}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="-3" y1="9" x2="1" y2="9" stroke="${primary}" stroke-width="1.5" stroke-linecap="round"/>
      </g>`;
    case "paintbrush":
      return `<g transform="translate(17, 9) scale(0.52) rotate(-35)">
        <rect x="-1.5" y="-2" width="3" height="12" rx="1" fill="${primary}"/>
        <path d="M -2.5 10 Q 0 14 2.5 10" fill="${primary}" opacity="0.7"/>
      </g>`;
    case "megaphone":
      return `<g transform="translate(16, 8) scale(0.5) rotate(-8)">
        <path d="M -2 -4 L 8 -8 L 8 4 L -2 0 Z" fill="${primary}" opacity="0.8"/>
        <rect x="-4" y="-4" width="3" height="4" rx="1" fill="${primary}"/>
      </g>`;
    case "shield":
      return `<g transform="translate(16, 8) scale(0.48)">
        <path d="M 0 -7 L 7 -3 L 6 5 L 0 8 L -6 5 L -7 -3 Z" fill="none" stroke="${primary}" stroke-width="2"/>
        <path d="M 0 -2 L 3 1 L 0 4 L -3 1 Z" fill="${primary}" opacity="0.5"/>
      </g>`;
    case "compass":
      return `<g transform="translate(16, 8) scale(0.48)">
        <circle cx="0" cy="0" r="7" fill="none" stroke="${primary}" stroke-width="2"/>
        <polygon points="0,-5 2,0 0,5 -2,0" fill="${primary}" opacity="0.7"/>
        <circle cx="0" cy="0" r="1.5" fill="${primary}"/>
      </g>`;
    case "bell":
      return `<g transform="translate(16, 8) scale(0.5)">
        <path d="M -5 2 Q -5 -6 0 -7 Q 5 -6 5 2 L -5 2 Z" fill="${primary}" opacity="0.8"/>
        <rect x="-6" y="2" width="12" height="2" rx="1" fill="${primary}"/>
        <circle cx="0" cy="5" r="1.5" fill="${primary}"/>
      </g>`;
    case "heart":
      return `<g transform="translate(0, 15) scale(0.58)">
        <path d="M 0 3 C -8 -2 -8 -8 -4 -8 C -1 -8 0 -5 0 -5 C 0 -5 1 -8 4 -8 C 8 -8 8 -2 0 3 Z" fill="${primary}" opacity="0.8"/>
      </g>`;
    case "wrench":
      return `<g transform="translate(17, 8) scale(0.52) rotate(-48)">
        <rect x="-1.5" y="-2" width="3" height="14" rx="1" fill="${primary}"/>
        <circle cx="0" cy="-2" r="3" fill="none" stroke="${primary}" stroke-width="2"/>
      </g>`;
    case "notebook":
      return `<g transform="translate(0, 15) scale(0.46) rotate(2)">
        <rect x="-6" y="-2" width="12" height="14" rx="1.5" fill="none" stroke="${primary}" stroke-width="2"/>
        <line x1="-2" y1="-2" x2="-2" y2="12" stroke="${primary}" stroke-width="1.4" opacity="0.7"/>
        <line x1="0" y1="3" x2="4" y2="-1" stroke="${primary}" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="0.5" y1="3.5" x2="3" y2="6" stroke="${primary}" stroke-width="1.4" stroke-linecap="round" opacity="0.75"/>
      </g>`;
    case "paper":
      return `<g transform="translate(0, 15) scale(0.48) rotate(4)">
        <path d="M -6 -7 H 3 L 7 -3 V 9 H -6 Z" fill="rgba(255,255,255,0.72)" stroke="${primary}" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M 3 -7 V -3 H 7" fill="none" stroke="${primary}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
        <line x1="-3" y1="-1" x2="3" y2="-1" stroke="${primary}" stroke-width="1.2" stroke-linecap="round" opacity="0.65"/>
        <line x1="-3" y1="3" x2="4" y2="3" stroke="${primary}" stroke-width="1.2" stroke-linecap="round" opacity="0.65"/>
      </g>`;
    case "envelope":
      return `<g transform="translate(0, 15) scale(0.5) rotate(-2)">
        <rect x="-7" y="-4.5" width="14" height="10" rx="1.6" fill="rgba(255,255,255,0.7)" stroke="${primary}" stroke-width="1.8"/>
        <path d="M -6 -3.5 L 0 1 L 6 -3.5" fill="none" stroke="${primary}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
        <path d="M -6 5 L -1 1.2 M 6 5 L 1 1.2" fill="none" stroke="${primary}" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>
      </g>`;
    case "keyboard":
      return `<g transform="translate(0, 16) scale(0.5)">
        <rect x="-9" y="-5" width="18" height="12" rx="2.2" fill="rgba(255,255,255,0.58)" stroke="${primary}" stroke-width="1.9"/>
        <line x1="-5" y1="-1.8" x2="-5" y2="2.5" stroke="${primary}" stroke-width="1" opacity="0.65"/>
        <line x1="0" y1="-1.8" x2="0" y2="2.5" stroke="${primary}" stroke-width="1" opacity="0.65"/>
        <line x1="5" y1="-1.8" x2="5" y2="2.5" stroke="${primary}" stroke-width="1" opacity="0.65"/>
        <line x1="-6" y1="2.8" x2="6" y2="2.8" stroke="${primary}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      </g>`;
    case "rock":
      return `<g transform="translate(17, 8) scale(0.52)">
        <path d="M -5 1 C -7 -3 -4 -7 0 -7 C 5 -7 8 -3 6 2 C 5 6 1 8 -3 6 C -5 5 -6 3 -5 1 Z" fill="${primary}" opacity="0.72"/>
        <path d="M -3 -2 C 0 -4 3 -3 4 0" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1.1" stroke-linecap="round"/>
      </g>`;
    case "scissors":
      return `<g transform="translate(17, 8) scale(0.5) rotate(-18)">
        <circle cx="-4.5" cy="5" r="2.2" fill="none" stroke="${primary}" stroke-width="1.7"/>
        <circle cx="2.5" cy="5" r="2.2" fill="none" stroke="${primary}" stroke-width="1.7"/>
        <path d="M -2.5 3 L 7 -7 M 0.5 3 L -7 -7" stroke="${primary}" stroke-width="1.7" stroke-linecap="round"/>
      </g>`;
    case "ball":
      return `<g transform="translate(17, 8) scale(0.52)">
        <circle cx="0" cy="0" r="6" fill="rgba(255,255,255,0.58)" stroke="${primary}" stroke-width="1.9"/>
        <path d="M -5 -1 Q 0 -4 5 -1 M -5 2 Q 0 5 5 2" fill="none" stroke="${primary}" stroke-width="1.1" stroke-linecap="round" opacity="0.65"/>
      </g>`;
    case "grab":
      return `<g transform="translate(17, 8) scale(0.52)">
        <circle cx="0" cy="0" r="5.5" fill="none" stroke="${primary}" stroke-width="1.8" stroke-dasharray="2.2 2"/>
        <circle cx="0" cy="0" r="2" fill="${primary}" opacity="0.6"/>
      </g>`;
    default:
      return "";
  }
}

const SVG_TWO_HAND_PROPS = new Set(["keyboard", "notebook", "paper", "envelope", "heart"]);

function svgHoldingHands(prop: string) {
  if (SVG_TWO_HAND_PROPS.has(prop)) {
    return [
      { side: "left", shoulderX: -8.8, shoulderY: 8, elbowX: -11.6, elbowY: 11.6, handX: -10.6, handY: 15 },
      { side: "right", shoulderX: 8.8, shoulderY: 8, elbowX: 11.6, elbowY: 11.6, handX: 10.6, handY: 15 },
    ];
  }
  return [
    { side: "right", shoulderX: 11.8, shoulderY: 5, elbowX: 15.4, elbowY: 7.8, handX: 17, handY: 10 },
  ];
}

function svgHoldingArmsMarkup(prop: string, primary: string): string {
  return `<g>${svgHoldingHands(prop)
    .map((hand) => `<path d="M ${hand.shoulderX} ${hand.shoulderY} Q ${hand.elbowX} ${hand.elbowY} ${hand.handX} ${hand.handY}" fill="none" stroke="${primary}" stroke-width="1.7" stroke-linecap="round"/>`)
    .join("")}</g>`;
}

function svgHandsMarkup(prop: string, primary: string, bg: string): string {
  return `<g>${svgHoldingHands(prop)
    .map((hand) => `<g>
      <circle cx="${hand.handX}" cy="${hand.handY}" r="2.9" fill="${bg}" stroke="${primary}" stroke-width="1.45"/>
      <path d="M ${hand.handX - 1.25} ${hand.handY - 0.1} Q ${hand.handX} ${hand.handY - 1.35} ${hand.handX + 1.25} ${hand.handY - 0.1}" fill="none" stroke="${primary}" stroke-width="0.9" stroke-linecap="round" opacity="0.82"/>
    </g>`)
    .join("")}</g>`;
}

/** Generate a complete SVG string that matches MeshiMascot component closely */
function generateMeshiSvg(colorKey: string, hat: string, mood: MeshiMoodCanvas, hair = "none", accessory = "none", eyeStyle = "regular", badge = "none", outfit = "none", prop?: string): string {
  const theme = SVG_COLOR_THEMES[colorKey] || SVG_COLOR_THEMES.blue;
  const primary = theme.primary;
  const bg = theme.bg;
  const hatSvg = hat && hat !== "none" ? svgHatMarkup(hat, primary) : "";
  const hairSvg = hair && hair !== "none" ? svgHairMarkup(hair, primary) : "";
  const accessorySvg = accessory && accessory !== "none" ? svgAccessoryMarkup(accessory, primary) : "";
  const eyeStyleSvg = svgEyeStyleMarkup(eyeStyle, primary);
  const badgeSvg = badge && badge !== "none" ? svgBadgeMarkup(badge, primary) : "";
  const outfitSvg = outfit && outfit !== "none" ? svgOutfitMarkup(outfit, primary) : "";
  const eyesSvg = svgEyesForMood(mood, primary);
  const propSvg = prop && prop !== "none" ? svgPropMarkup(prop, primary) : "";
  const armsSvg = propSvg ? svgHoldingArmsMarkup(prop || "none", primary) : "";
  const handsSvg = propSvg ? svgHandsMarkup(prop || "none", primary, bg) : "";
  // Use unique clip-path ID per SVG variant to avoid collisions
  const clipId = `mc-${colorKey}-${hat}-${mood}-${hair}-${accessory}-${eyeStyle}-${badge}-${outfit}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="-32 -32 64 64">
    <defs>
      <clipPath id="${clipId}"><circle cx="0" cy="0" r="22"/></clipPath>
    </defs>

    <g clip-path="url(#${clipId})">
      <circle cx="0" cy="0" r="16" fill="${bg}" stroke="${primary}" stroke-width="2"/>
      ${outfitSvg}
      ${hairSvg}
      <g>${eyesSvg}</g>
      ${eyeStyleSvg}
      ${accessorySvg}
      ${badgeSvg}
    </g>
    <g style="color:${primary}">${hatSvg}</g>
    ${armsSvg}
    ${propSvg}
    ${handsSvg}
  </svg>`;
}

// Image cache for rendered SVG Meshis
const meshiImageCache = new Map<string, HTMLImageElement>();

function getMeshiImage(colorKey: string, hat: string, mood: MeshiMoodCanvas, hair = "none", accessory = "none", eyeStyle = "regular", badge = "none", outfit = "none", prop?: string): HTMLImageElement | null {
  const key = `${colorKey}-${hat}-${mood}-${hair}-${accessory}-${eyeStyle}-${badge}-${outfit}-${prop || "none"}`;
  const cached = meshiImageCache.get(key);
  if (cached && cached.complete) return cached;
  if (cached) return null; // Still loading

  const svg = generateMeshiSvg(colorKey, hat, mood, hair, accessory, eyeStyle, badge, outfit, prop);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => URL.revokeObjectURL(url);
  img.onerror = () => { meshiImageCache.delete(key); URL.revokeObjectURL(url); };
  img.src = url;
  meshiImageCache.set(key, img);
  return null; // Will be ready next frame
}

/** Resolve color key name from hex value */
function colorKeyFromHex(hex: string): string {
  for (const [key, val] of Object.entries(MESHI_COLORS)) {
    if (val === hex) return key;
  }
  return "blue";
}

/** Draw Meshi on the canvas using the same SVG model as the floating Meshi */
export function drawMeshi(ctx: CanvasRenderingContext2D, state: MeshiState): void {
  // Figure-8 bob pattern for more organic, satisfying movement
  const bobY = Math.sin(state.bobPhase) * 2.5;
  const bobX = Math.sin(state.bobPhase * 0.5) * 1.2;
  const mx = state.x + bobX;
  const my = state.y + bobY;
  const drawSize = state.radius * 3; // SVG rendered at 3x radius for detail

  // Trail sparkles with soft glow
  for (const pt of state.trailPoints) {
    const sparkleGlow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 3);
    sparkleGlow.addColorStop(0, `rgba(99, 102, 241, ${pt.alpha * 0.4})`);
    sparkleGlow.addColorStop(1, "rgba(99, 102, 241, 0)");
    ctx.fillStyle = sparkleGlow;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(99, 102, 241, ${pt.alpha * 0.55})`;
    ctx.fill();
  }

  const colorKey = colorKeyFromHex(state.color);

  // Draw SVG image
  const activeProp = state.prop !== "none" && state.propTimer > 0 ? state.prop : undefined;
  const img = getMeshiImage(colorKey, state.hat, state.mood, state.hair, state.accessory, state.eyeStyle, state.badge, state.outfit, activeProp);
  if (img) {
    ctx.drawImage(img, mx - drawSize / 2, my - drawSize / 2, drawSize, drawSize);
  }

  // Username label
  ctx.font = "bold 8px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  // Dark pill background for readability
  const textMetrics = ctx.measureText(state.username);
  const labelX = mx;
  const labelY = my + drawSize / 2 + 2;
  const padding = 4;
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.beginPath();
  ctx.roundRect(labelX - textMetrics.width / 2 - padding, labelY - 1, textMetrics.width + padding * 2, 12, 4);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText(state.username, labelX, labelY + 1);
}

/** Draw a ghost sprite for users in ghost mode */
function drawGhostMeshi(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number, phaseOffset: number) {
  const ghostAlpha = 0.3 + Math.sin(time * 1.5 + phaseOffset) * 0.1;
  ctx.save();
  ctx.globalAlpha = ghostAlpha;

  // Ghost body — rounded top, wavy bottom
  ctx.beginPath();
  ctx.arc(x, y - size * 0.15, size * 0.45, Math.PI, 0);
  const bodyBottom = y + size * 0.35;
  const waveCount = 4;
  const waveWidth = (size * 0.9) / waveCount;
  ctx.lineTo(x + size * 0.45, bodyBottom);
  for (let i = waveCount - 1; i >= 0; i--) {
    const wx = x - size * 0.45 + (i + 0.5) * waveWidth;
    const wy = bodyBottom + Math.sin(time * 3 + phaseOffset + i) * 3;
    const wx2 = x - size * 0.45 + i * waveWidth;
    ctx.quadraticCurveTo(wx, wy, wx2, bodyBottom);
  }
  ctx.closePath();

  const grad = ctx.createLinearGradient(x, y - size * 0.5, x, bodyBottom);
  grad.addColorStop(0, "rgba(200, 210, 230, 0.9)");
  grad.addColorStop(1, "rgba(160, 175, 200, 0.5)");
  ctx.fillStyle = grad;
  ctx.fill();

  // Eyes — classic ghost hollow circles
  const eyeY = y - size * 0.12;
  const eyeSpacing = size * 0.15;
  const eyeR = size * 0.07;
  ctx.fillStyle = "rgba(30, 30, 50, 0.8)";
  ctx.beginPath();
  ctx.arc(x - eyeSpacing, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + eyeSpacing, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();

  // Mouth — small "o"
  ctx.beginPath();
  ctx.arc(x, eyeY + size * 0.12, eyeR * 0.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Draw remote Meshi presences on the canvas using the same SVG model */
export function drawRemoteMeshis(ctx: CanvasRenderingContext2D, remoteMeshis: RemoteMeshi[], time: number): void {
  for (const rm of remoteMeshis) {
    // Ghost mode users get a special ghost sprite
    if (rm.ghostMode) {
      const phaseOffset = rm.userId.charCodeAt(0) + (rm.userId.charCodeAt(1) || 0) * 0.3;
      const bob = Math.sin(time * 1.2 + phaseOffset) * 3;
      drawGhostMeshi(ctx, rm.x, rm.y + bob, 30, time, phaseOffset);
      // Ghost label
      ctx.font = "bold 7px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "rgba(200, 210, 230, 0.6)";
      ctx.fillText("👻", rm.x, rm.y + 18);
      ctx.globalAlpha = 1;
      continue;
    }

    const isOffline = !rm.isOnline;
    const bobSpeed = isOffline ? 0.4 : 2;
    const bobAmplitude = isOffline ? 0.8 : 2;
    const phaseOffset = rm.userId.charCodeAt(0) + (rm.userId.charCodeAt(1) || 0) * 0.3;
    const bob = Math.sin(time * bobSpeed + phaseOffset) * bobAmplitude;
    const mx = rm.x;
    const my = rm.y + bob;
    const drawSize = isOffline ? 22 : 30;

    // Subtle glow (dimmer for offline)
    const color = MESHI_COLORS[rm.color] || MESHI_COLORS.blue;
    const colorKey = Object.entries(MESHI_COLORS).find(([, v]) => v === color)?.[0] || rm.color || "blue";
    const theme = SVG_COLOR_THEMES[colorKey] || SVG_COLOR_THEMES.blue;
    const glowAlpha = isOffline ? "08" : "20";
    const glowGrad = ctx.createRadialGradient(mx, my, 0, mx, my, drawSize);
    glowGrad.addColorStop(0, `${theme.primary}${glowAlpha}`);
    glowGrad.addColorStop(1, "transparent");
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(mx, my, drawSize, 0, Math.PI * 2);
    ctx.fill();

    // Draw SVG image — offline Meshis are dimmer and always sleeping
    const displayMood: MeshiMoodCanvas = isOffline ? "sleeping" : rm.mood;
    const img = getMeshiImage(colorKey, rm.hat, displayMood, rm.hair || "none", rm.accessory || "none", rm.eyeStyle || "regular", rm.badge || "none", rm.outfit || "none");
    if (img) {
      ctx.globalAlpha = isOffline ? 0.35 : 0.75;
      ctx.drawImage(img, mx - drawSize / 2, my - drawSize / 2, drawSize, drawSize);
      ctx.globalAlpha = 1;
    }

    // Floating "zzz" sleep bubbles for offline Meshis
    if (isOffline) {
      const zPhase = time * 0.8 + phaseOffset;
      for (let zi = 0; zi < 3; zi++) {
        const zProgress = ((zPhase + zi * 1.2) % 3.6) / 3.6; // 0→1 lifecycle
        const zAlpha = zProgress < 0.2 ? zProgress * 5 : zProgress > 0.7 ? (1 - zProgress) * 3.33 : 1;
        const zSize = 5 + zi * 1.5 + zProgress * 2;
        const zx = mx + drawSize / 2 + 3 + zi * 5 + zProgress * 4;
        const zy = my - drawSize / 2 - zProgress * 14 - zi * 3;
        ctx.globalAlpha = zAlpha * 0.4;
        ctx.font = `bold ${zSize}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = "rgba(180, 180, 220, 0.8)";
        ctx.textAlign = "center";
        ctx.fillText("z", zx, zy);
      }
      ctx.globalAlpha = 1;
    }

    // Username label with online/offline indicator
    ctx.font = "bold 7px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const labelText = rm.displayName;
    const textMetrics = ctx.measureText(labelText);
    const labelY = my + drawSize / 2 + 1;
    const padding = 3;
    const dotSize = 3;
    const totalWidth = dotSize + 3 + textMetrics.width + padding * 2;
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(mx - totalWidth / 2, labelY - 1, totalWidth, 10, 3);
    ctx.fill();

    // Status dot
    const dotX = mx - totalWidth / 2 + padding + dotSize / 2;
    const dotY = labelY + 4;
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = isOffline ? "rgba(100, 100, 100, 0.6)" : "#22c55e";
    ctx.fill();

    ctx.fillStyle = isOffline ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.6)";
    ctx.fillText(labelText, mx + dotSize / 2 + 1, labelY);
  }
}
