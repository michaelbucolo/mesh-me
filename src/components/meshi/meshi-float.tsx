"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useAnimationControls, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import {
  Send, Search,
} from "lucide-react";
import {
  MeshiMascot,
  type MeshiAccessory,
  type MeshiBadge,
  type MeshiColor,
  type MeshiEyeStyle,
  type MeshiHair,
  type MeshiHat,
  type MeshiMood,
  type MeshiOutfit,
  type MeshiProp,
  PAGE_PROPS,
} from "./meshi-mascot";
import { MeshiChat } from "./meshi-chat";
import { MeshiActionsMenu } from "./meshi-actions-menu";
import { askMeshi, runMeshiAction } from "@/lib/meshi-client";
import type { MeshiAction, MeshiHistoryMessage } from "@/lib/meshi-shared";
import { getMeshGraphData, type MeshGraphEntity } from "@/lib/queries";
import { getMeshiPreference } from "@/lib/actions";
import {
  loadKnowledge, saveKnowledge, indexMeshData,
  getKnowledgeLevelDescription, type MeshiExplorationState,
} from "@/lib/meshi-knowledge";
import { impactFeedback } from "@/lib/native/haptics";
import { MESHI_OPEN_EVENT, type MeshiOpenMode } from "@/lib/meshi-events";
import { reactionFor, subscribeMeshiCause } from "@/lib/meshi-bus";
import { shouldHideGlobalMeshi } from "@/lib/meshi-routes";
import { cursorSpriteOwnsPointer } from "@/lib/pointer-modality";
import { MESHI_PREFERENCES_EVENT, type MeshiPreferences } from "@/hooks/use-meshi-preferences";
import type { MeshiContext } from "@/lib/meshi-shared";

// Meshi is the user's persistent bubble character.
// It follows page to page as their private vessel, represents their identity,
// and opens companion actions.

const GREETINGS: Record<string, { text: string; mood: MeshiMood }> = {
  "/mesh": { text: "I connect this world for you.", mood: "excited" },
  "/feed": { text: "I can send this back to your Mesh.", mood: "happy" },
  "/messages": { text: "I keep your conversations connected.", mood: "love" },
  "/communities": { text: "I can help groups move together.", mood: "excited" },
  "/notifications": { text: "I will sort what needs you.", mood: "thinking" },
  "/settings": { text: "I help protect your world.", mood: "happy" },
  "/analytics": { text: "I can explain what is changing.", mood: "thinking" },
  "/connected-accounts": { text: "I bridge platforms carefully.", mood: "cool" },
  "/explore": { text: "I can guide you across the internet.", mood: "excited" },
  "/search": { text: "I can find it across your Mesh.", mood: "thinking" },
  "/profile": { text: "I represent you here.", mood: "wink" },
  "/meshpro": { text: "I can make your world feel yours.", mood: "excited" },
};

function getGreetingForPath(pathname: string) {
  // Match most-specific first: "/meshpro" startsWith "/mesh", so without the
  // length sort the "/mesh" entry would shadow the dedicated "/meshpro" one.
  const matchedKey = Object.keys(GREETINGS)
    .sort((a, b) => b.length - a.length)
    .find((key) => pathname.startsWith(key));
  return matchedKey ? GREETINGS[matchedKey] : { text: "I am your bridge to the internet.", mood: "happy" as MeshiMood };
}

// The contextual prop for a route. Uses the same most-specific-first prefix
// match as the page-transition effect so sub-routes (e.g. "/feed/abc") keep the
// prop; indexing PAGE_PROPS by the exact pathname dropped it on every sub-route.
function getContextualProp(pathname: string): MeshiProp {
  const key = Object.keys(PAGE_PROPS)
    .sort((a, b) => b.length - a.length)
    .find((k) => pathname.startsWith(k));
  return key ? PAGE_PROPS[key] : "none";
}

// On the Mesh, the canvas renders the single living Meshi (the user's cursor/avatar
// inside the world). The floating DOM body must yield to it so only ONE Meshi is ever
// visible — they are the same entity. Chat/actions stay available as anchored overlays.
function isMeshSurfacePath(pathname: string) {
  return pathname === "/mesh" || pathname.startsWith("/mesh/");
}

const SEARCH_TRIGGERS = ["search", "find", "look for", "where", "show me"];

type MeshiView = "closed" | "actions" | "speech" | "chat";

const MESHI_SIZE = 48;
const MESHI_FOLLOW_RELEASE_MS = 2600;
const MESHI_UI_PADDING = 10;
const MESHI_VIEWPORT_GAP = 12;

const MESHI_AVOID_SELECTOR = [
  "[data-meshi-avoid]",
  "[data-sidebar]",
  ".bug-report-widget",
  ".mobile-bottom-nav",
  ".mobile-compose-fab",
  ".app-route-progress",
  ".app-command-bar",
  ".feed-x-topbar",
  ".mesh-action-bar",
  ".mesh-canvas-toolbar",
  "[role='dialog']",
  "[role='menu']",
  "dialog",
  "button",
  "a[href]",
  "input",
  "textarea",
  "select",
  "summary",
  "[contenteditable='true']",
  "[role='button']",
  "[role='link']",
  "[role='textbox']",
  "[data-meshi-zone]",
].join(", ");

type MeshiPoint = { x: number; y: number };
type FocusedContent = NonNullable<MeshiContext["focusedContent"]>;
type MeshiRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

const MESHI_CONTINUITY_KEY = "meshi-continuity-state";
const MESHI_INSTANCE_ID_KEY = "meshi-instance-id";
const MESHI_CONTINUITY_STATE_VERSION = 1 as const;
const MESHI_CONTINUITY_MAX_AGE_MS = 10 * 60 * 1000;
const MESHI_VIEW_VALUES = new Set<MeshiView>(["closed", "actions", "speech", "chat"]);

type MeshiContinuityState = {
  version: typeof MESHI_CONTINUITY_STATE_VERSION;
  instanceId: string;
  updatedAt: number;
  pathname: string;
  position: MeshiPoint;
  view: MeshiView;
  mood: MeshiMood;
  activeProp: MeshiProp;
};

function getOrCreateMeshiInstanceId() {
  if (typeof window === "undefined") return "meshi-server-instance";
  const existing = window.localStorage.getItem(MESHI_INSTANCE_ID_KEY);
  if (existing) return existing;

  const next =
    window.crypto?.randomUUID?.() ||
    `meshi-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(MESHI_INSTANCE_ID_KEY, next);
  return next;
}

function readMeshiContinuityState(): MeshiContinuityState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MESHI_CONTINUITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MeshiContinuityState>;
    const position = parsed.position;
    const age = Date.now() - (typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0);

    if (
      parsed.version !== MESHI_CONTINUITY_STATE_VERSION ||
      !parsed.instanceId ||
      age > MESHI_CONTINUITY_MAX_AGE_MS ||
      !position ||
      typeof position.x !== "number" ||
      typeof position.y !== "number"
    ) {
      return null;
    }

    return {
      version: MESHI_CONTINUITY_STATE_VERSION,
      instanceId: parsed.instanceId,
      updatedAt: parsed.updatedAt || Date.now(),
      pathname: typeof parsed.pathname === "string" ? parsed.pathname : "",
      position,
      view: MESHI_VIEW_VALUES.has(parsed.view as MeshiView) ? (parsed.view as MeshiView) : "closed",
      mood: (parsed.mood || "happy") as MeshiMood,
      activeProp: (parsed.activeProp || "none") as MeshiProp,
    };
  } catch {
    return null;
  }
}

function writeMeshiContinuityState(state: MeshiContinuityState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MESHI_CONTINUITY_KEY, JSON.stringify(state));
  } catch {
    // Continuity is nice to have; storage limits should never break Meshi.
  }
}

function getFocusedContentFromElement(element: Element | null): FocusedContent | null {
  const card = element?.closest?.("[data-meshi-content-card='true']") as HTMLElement | null;
  if (!card) return null;

  const mediaTypes = (card.dataset.meshiContentMedia || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const mediaSignals = (card.dataset.meshiContentMediaSignals || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    id: card.dataset.meshiContentId,
    platform: card.dataset.meshiContentPlatform || "meshme",
    author: card.dataset.meshiContentAuthor,
    text: card.dataset.meshiContentText,
    mediaTypes,
    externalUrl: card.dataset.meshiContentUrl,
    contentRating: card.dataset.meshiContentRating || "general",
    mediaSignals,
  };
}

function getVisibleFocusedContent(): FocusedContent | null {
  if (typeof document === "undefined") return null;
  const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-meshi-content-card='true']"));
  const viewportHeight = window.innerHeight || 1;
  const targetY = viewportHeight * 0.45;
  let bestCard: HTMLElement | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  cards.forEach((card) => {
    const rect = card.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= viewportHeight || rect.width <= 0 || rect.height <= 0) return;
    const visibleTop = Math.max(0, rect.top);
    const visibleBottom = Math.min(viewportHeight, rect.bottom);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const centerDistance = Math.abs((rect.top + rect.bottom) / 2 - targetY);
    const score = visibleHeight - centerDistance * 0.35;
    if (score > bestScore) {
      bestScore = score;
      bestCard = card;
    }
  });

  return getFocusedContentFromElement(bestCard);
}

function areFocusedContentEqual(a: FocusedContent | null, b: FocusedContent | null) {
  if (!a && !b) return true;
  return Boolean(a && b && a.id === b.id && a.platform === b.platform && a.text === b.text);
}

function getFocusedContentPrompt(content: FocusedContent, mode: "summary" | "fact-check" | "verify") {
  const source = content.platform ? ` from ${content.platform}` : "";
  if (mode === "summary") return `Summarize the visible post${source}.`;
  if (mode === "verify") return `Check the visible post${source} for possible synthetic or digitally created photo or video signals.`;
  return `Fact-check the visible post${source}. Point out what is verified, what needs a source, and what I should be careful about.`;
}

function getViewportBounds() {
  if (typeof window === "undefined") {
    return { minX: 8, minY: 48, maxX: 900, maxY: 600 };
  }

  const isMobile = window.innerWidth < 1024;
  const isSpatial = typeof document !== "undefined" && document.body.classList.contains("platform-spatial");
  const sidebar = document.querySelector("[data-sidebar]");
  const sidebarWidth = !isMobile && sidebar ? sidebar.getBoundingClientRect().right : 0;
  const minX = Math.max(MESHI_VIEWPORT_GAP, sidebarWidth + MESHI_VIEWPORT_GAP);
  const minY = isMobile ? 72 : isSpatial ? 72 : 48;
  const maxX = Math.max(minX, window.innerWidth - MESHI_SIZE - (isSpatial ? 32 : MESHI_VIEWPORT_GAP));
  const maxY = Math.max(minY, window.innerHeight - MESHI_SIZE - (isMobile ? 80 : isSpatial ? 32 : MESHI_VIEWPORT_GAP));

  return {
    minX,
    minY,
    maxX,
    maxY,
  };
}

function clampMeshiPosition(point: MeshiPoint): MeshiPoint {
  if (typeof window === "undefined") return point;
  const bounds = getViewportBounds();

  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y)),
  };
}

function getDefaultDockPosition(): MeshiPoint {
  const bounds = getViewportBounds();
  return { x: bounds.maxX, y: bounds.maxY };
}

function getMeshiRect(point: MeshiPoint): MeshiRect {
  return {
    left: point.x,
    top: point.y,
    right: point.x + MESHI_SIZE,
    bottom: point.y + MESHI_SIZE,
    width: MESHI_SIZE,
    height: MESHI_SIZE,
  };
}

function toMeshiRect(rect: DOMRect): MeshiRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function rectsOverlap(a: MeshiRect, b: MeshiRect, padding = 0) {
  return !(
    a.right <= b.left - padding ||
    a.left >= b.right + padding ||
    a.bottom <= b.top - padding ||
    a.top >= b.bottom + padding
  );
}

function overlapArea(a: MeshiRect, b: MeshiRect, padding = 0) {
  const left = Math.max(a.left, b.left - padding);
  const top = Math.max(a.top, b.top - padding);
  const right = Math.min(a.right, b.right + padding);
  const bottom = Math.min(a.bottom, b.bottom + padding);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function isAvoidElementVisible(element: Element, rect: MeshiRect) {
  if (rect.width < 2 || rect.height < 2) return false;
  if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth) return false;
  if (element.closest("[data-meshi-owned], [data-meshi-primary]")) return false;

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;

  const isStructuralChrome = element.matches("[data-sidebar], .bug-report-widget, .mobile-bottom-nav, .mobile-compose-fab, .app-route-progress, .app-command-bar, .feed-x-topbar, .mesh-action-bar, .mesh-canvas-toolbar, [role='dialog'], dialog, [data-meshi-avoid]");
  if (style.pointerEvents === "none" && !isStructuralChrome) return false;

  const coversMostViewport = rect.width > window.innerWidth * 0.82 && rect.height > window.innerHeight * 0.66;
  const isBroadPageZone = element.matches("[data-meshi-zone]") && (rect.width > window.innerWidth * 0.64 || rect.height > window.innerHeight * 0.52);

  return !((coversMostViewport || isBroadPageZone) && !isStructuralChrome);
}

function getMeshiAvoidRects(): MeshiRect[] {
  if (typeof document === "undefined") return [];

  const seen = new Set<Element>();
  const rects: MeshiRect[] = [];

  document.querySelectorAll(MESHI_AVOID_SELECTOR).forEach((element) => {
    if (seen.has(element)) return;
    seen.add(element);
    const rect = toMeshiRect(element.getBoundingClientRect());
    if (!isAvoidElementVisible(element, rect)) return;
    rects.push(rect);
  });

  return rects;
}

function hasUiCollision(point: MeshiPoint, avoidRects = getMeshiAvoidRects()) {
  const rect = getMeshiRect(point);
  return avoidRects.some((avoidRect) => rectsOverlap(rect, avoidRect, MESHI_UI_PADDING));
}

function findSafeMeshiPosition(candidate: MeshiPoint, avoidRects = getMeshiAvoidRects()): MeshiPoint {
  if (typeof window === "undefined") return candidate;

  const clamped = clampMeshiPosition(candidate);
  if (!hasUiCollision(clamped, avoidRects)) return clamped;

  const bounds = getViewportBounds();
  const candidateRect = getMeshiRect(clamped);
  const collisions = avoidRects.filter((rect) => rectsOverlap(candidateRect, rect, MESHI_UI_PADDING));
  const candidates: MeshiPoint[] = [
    clamped,
    getDefaultDockPosition(),
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY + (bounds.maxY - bounds.minY) * 0.42 },
    { x: bounds.maxX, y: bounds.minY + (bounds.maxY - bounds.minY) * 0.66 },
    { x: bounds.minX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.minY },
  ];

  collisions.forEach((rect) => {
    candidates.push(
      { x: rect.left - MESHI_SIZE - MESHI_UI_PADDING, y: clamped.y },
      { x: rect.right + MESHI_UI_PADDING, y: clamped.y },
      { x: clamped.x, y: rect.top - MESHI_SIZE - MESHI_UI_PADDING },
      { x: clamped.x, y: rect.bottom + MESHI_UI_PADDING },
      { x: rect.left - MESHI_SIZE - MESHI_UI_PADDING, y: rect.top - MESHI_SIZE - MESHI_UI_PADDING },
      { x: rect.right + MESHI_UI_PADDING, y: rect.bottom + MESHI_UI_PADDING },
    );
  });

  [56, 96, 144, 208].forEach((distance) => {
    candidates.push(
      { x: clamped.x + distance, y: clamped.y },
      { x: clamped.x - distance, y: clamped.y },
      { x: clamped.x, y: clamped.y + distance },
      { x: clamped.x, y: clamped.y - distance },
      { x: clamped.x + distance, y: clamped.y - distance },
      { x: clamped.x - distance, y: clamped.y - distance },
      { x: clamped.x + distance, y: clamped.y + distance },
      { x: clamped.x - distance, y: clamped.y + distance },
    );
  });

  for (let y = bounds.minY; y <= bounds.maxY; y += 72) {
    candidates.push({ x: bounds.maxX, y }, { x: bounds.minX, y });
  }
  for (let x = bounds.minX; x <= bounds.maxX; x += 96) {
    candidates.push({ x, y: bounds.maxY }, { x, y: bounds.minY });
  }

  let best = clamped;
  let bestScore = Number.POSITIVE_INFINITY;
  const seen = new Set<string>();

  candidates.forEach((candidatePoint) => {
    const point = clampMeshiPosition(candidatePoint);
    const key = `${Math.round(point.x)}:${Math.round(point.y)}`;
    if (seen.has(key)) return;
    seen.add(key);

    const rect = getMeshiRect(point);
    const area = avoidRects.reduce((sum, avoidRect) => sum + overlapArea(rect, avoidRect, MESHI_UI_PADDING), 0);
    const distanceFromTarget = Math.hypot(point.x - clamped.x, point.y - clamped.y);
    const distanceFromDock = Math.hypot(point.x - bounds.maxX, point.y - bounds.maxY);
    const score = area * 2000 + distanceFromTarget + distanceFromDock * 0.05;

    if (area === 0 && score < bestScore) {
      best = point;
      bestScore = score;
      return;
    }

    if (score < bestScore) {
      best = point;
      bestScore = score;
    }
  });

  return best;
}

// Safe insets: Meshi docks bottom-right but must never overlap UI.
// Detects app chrome, controls, dialogs, toolbars, and explicit Meshi avoid zones.
function getSafePosition() {
  if (typeof window === "undefined") return { x: 900, y: 600 };
  return findSafeMeshiPosition(getDefaultDockPosition());
}

function getPointerFollowPosition(clientX: number, clientY: number): MeshiPoint {
  if (typeof window === "undefined") return { x: clientX, y: clientY };
  const horizontalOffset = clientX > window.innerWidth * 0.55 ? -72 : 24;
  const verticalOffset = clientY > window.innerHeight * 0.55 ? -68 : 22;
  return findSafeMeshiPosition({
    x: clientX + horizontalOffset,
    y: clientY + verticalOffset,
  });
}

function overlapsImportantUi(point: MeshiPoint) {
  if (typeof document === "undefined") return false;
  if (hasUiCollision(point)) return true;

  const samplePoints = [
    { x: point.x + MESHI_SIZE / 2, y: point.y + MESHI_SIZE / 2 },
    { x: point.x + 8, y: point.y + 8 },
    { x: point.x + MESHI_SIZE - 8, y: point.y + 8 },
    { x: point.x + 8, y: point.y + MESHI_SIZE - 8 },
    { x: point.x + MESHI_SIZE - 8, y: point.y + MESHI_SIZE - 8 },
  ];

  return samplePoints.some((sample) => {
    return document.elementsFromPoint(sample.x, sample.y).some((element) => {
      if (element.closest("[data-meshi-owned], [data-meshi-primary]")) return false;
      return Boolean(element.closest(MESHI_AVOID_SELECTOR));
    });
  });
}

function getPageArrivalPosition(pathname: string): MeshiPoint {
  if (typeof window === "undefined") return { x: 900, y: 600 };
  const safe = getSafePosition();
  const rightRail = safe.x;
  const upper = window.innerHeight * 0.2;
  const middle = window.innerHeight * 0.42;
  const lower = window.innerHeight * 0.68;

  if (pathname.startsWith("/feed") || pathname.startsWith("/connected-accounts")) {
    return findSafeMeshiPosition({ x: rightRail, y: middle });
  }
  if (pathname.startsWith("/messages") || pathname.startsWith("/notifications")) {
    return findSafeMeshiPosition({ x: rightRail, y: upper });
  }
  if (pathname.startsWith("/settings") || pathname.startsWith("/analytics")) {
    return findSafeMeshiPosition({ x: rightRail, y: lower });
  }
  if (pathname.startsWith("/profile") || pathname.startsWith("/communities") || pathname.startsWith("/explore")) {
    return findSafeMeshiPosition({ x: rightRail, y: window.innerHeight * 0.32 });
  }

  return safe;
}

// Aurora tap-burst — a spring of periwinkle/cyan particles (plus a heart or two)
// flung radially from Meshi's center when the user taps it.
type MeshiBurstParticle = { id: string; dx: number; dy: number; color: string; size: number; heart: boolean };
type MeshiTapBurst = { id: string; particles: MeshiBurstParticle[] };

// Moulded plastics, not the rejected neon triple (#6e8bff/#34e4ea/#8b5cf6).
// A burst is bits of the same plastic the product is made of, so these are the
// mould faces — which is also why they need no theme variant: plastic does not
// change colour when the lamp goes off.
const MESHI_BURST_COLORS = ["#3b5ae0", "#157681", "#7448d4"];
const MESHI_HEART_COLOR = "#ec4899";

function createMeshiBurst(count: number): MeshiTapBurst {
  const total = Math.max(6, Math.min(10, count));
  const id = `burst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const heartCount = total >= 9 ? 2 : 1;
  const base = Math.random() * Math.PI * 2;
  const particles: MeshiBurstParticle[] = [];
  for (let i = 0; i < total; i += 1) {
    const angle = base + (i / total) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const dist = 28 + Math.random() * 22;
    const isHeart = i < heartCount;
    particles.push({
      id: `${id}-${i}`,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      color: isHeart ? MESHI_HEART_COLOR : MESHI_BURST_COLORS[i % MESHI_BURST_COLORS.length],
      size: isHeart ? 12 : 6 + Math.random() * 3,
      heart: isHeart,
    });
  }
  return { id, particles };
}

export function MeshiFloat() {
  const [initialContinuity] = useState<MeshiContinuityState | null>(() => readMeshiContinuityState());
  const [instanceId] = useState(() => getOrCreateMeshiInstanceId());

  const [isMounted, setIsMounted] = useState(false);
  const [meshiEnabled, setMeshiEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    try { return localStorage.getItem("meshiEnabled") !== "false"; } catch { return true; }
  });
  const [view, setView] = useState<MeshiView>(() => initialContinuity?.view ?? "closed");

  const [mood, setMood] = useState<MeshiMood>(() => {
    if (initialContinuity?.mood) return initialContinuity.mood;
    if (typeof window === "undefined") return "happy";
    try { return (localStorage.getItem("meshiFace") || "happy") as MeshiMood; } catch { return "happy" as MeshiMood; }
  });
  const [meshiColor, setMeshiColor] = useState<MeshiColor>(() => {
    if (typeof window === "undefined") return "blue";
    try { return (localStorage.getItem("meshiColor") || "blue") as MeshiColor; } catch { return "blue" as MeshiColor; }
  });
  const [meshiHat, setMeshiHat] = useState<MeshiHat>(() => {
    if (typeof window === "undefined") return "none";
    try { return (localStorage.getItem("meshiHat") || "none") as MeshiHat; } catch { return "none" as MeshiHat; }
  });
  const [meshiHair, setMeshiHair] = useState<MeshiHair>(() => {
    if (typeof window === "undefined") return "none";
    try { return (localStorage.getItem("meshiHair") || "none") as MeshiHair; } catch { return "none" as MeshiHair; }
  });
  const [meshiAccessory, setMeshiAccessory] = useState<MeshiAccessory>(() => {
    if (typeof window === "undefined") return "none";
    try {
      const storedAccessory = localStorage.getItem("meshiAccessory");
      return ((storedAccessory === "lashes" ? "none" : storedAccessory) || "none") as MeshiAccessory;
    } catch { return "none" as MeshiAccessory; }
  });
  const [meshiEye, setMeshiEye] = useState<MeshiEyeStyle>(() => {
    if (typeof window === "undefined") return "regular";
    try {
      return ((localStorage.getItem("meshiEye") || (localStorage.getItem("meshiAccessory") === "lashes" ? "lashes" : "")) || "regular") as MeshiEyeStyle;
    } catch { return "regular" as MeshiEyeStyle; }
  });
  const [meshiBadge, setMeshiBadge] = useState<MeshiBadge>(() => {
    if (typeof window === "undefined") return "none";
    try { return (localStorage.getItem("meshiBadge") || "none") as MeshiBadge; } catch { return "none" as MeshiBadge; }
  });
  const [meshiOutfit, setMeshiOutfit] = useState<MeshiOutfit>(() => {
    if (typeof window === "undefined") return "none";
    try { return (localStorage.getItem("meshiOutfit") || "none") as MeshiOutfit; } catch { return "none" as MeshiOutfit; }
  });
  const [showGreeting, setShowGreeting] = useState(false);
  const [greetingText, setGreetingText] = useState("");
  const [lastPath, setLastPath] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isFullscreenVideo, setIsFullscreenVideo] = useState(false);
  const [searchingText, setSearchingText] = useState("");
  const [focusedContent, setFocusedContent] = useState<FocusedContent | null>(null);
  const [contentInsightVisible, setContentInsightVisible] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ q: string; a: string; time: Date }>>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("meshi-chat-history");
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Array<{ q: string; a: string; time: string }>;
      return parsed.map((entry) => ({ ...entry, time: new Date(entry.time) }));
    } catch {
      return [];
    }
  });

  const [meshEntities, setMeshEntities] = useState<MeshGraphEntity[]>([]);
  const [meshStats, setMeshStats] = useState<{ followers: number; following: number; posts: number; communities: number; platforms: number }>({ followers: 0, following: 0, posts: 0, communities: 0, platforms: 0 });
  const [knowledge, setKnowledge] = useState<MeshiExplorationState>(() => {
    if (typeof window === "undefined") return { totalNodesVisited: 0, totalExplorations: 0, lastExplorationAt: 0, knowledgeLevel: 1, entries: {} };
    return loadKnowledge();
  });
  const [isExploring, setIsExploring] = useState(false);
  const [explorationProgress, setExplorationProgress] = useState(0);

  // Position starts in safe bottom-right zone (never overlapping UI)
  const [initialPosition] = useState<MeshiPoint>(() =>
    initialContinuity?.position
      ? findSafeMeshiPosition(initialContinuity.position)
      : getSafePosition()
  );
  const meshiX = useMotionValue(initialPosition.x);
  const meshiY = useMotionValue(initialPosition.y);
  const springX = useSpring(meshiX, { stiffness: 200, damping: 25, mass: 0.6 });
  const springY = useSpring(meshiY, { stiffness: 200, damping: 25, mass: 0.6 });

  // Magnetic lean: a small capped pull + tilt toward the cursor when it nears Meshi.
  const magnetX = useMotionValue(0);
  const magnetY = useMotionValue(0);
  const magnetRotate = useMotionValue(0);
  const magnetSpringX = useSpring(magnetX, { stiffness: 220, damping: 18, mass: 0.4 });
  const magnetSpringY = useSpring(magnetY, { stiffness: 220, damping: 18, mass: 0.4 });
  const magnetSpringRotate = useSpring(magnetRotate, { stiffness: 220, damping: 18, mass: 0.4 });

  const [isDragging, setIsDragging] = useState(false);
  const [isAvoidingUi, setIsAvoidingUi] = useState(false);
  const [wasDragged, setWasDragged] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const dragAvoidRectsRef = useRef<MeshiRect[]>([]);
  const avoidingUiTimerRef = useRef<number | null>(null);
  const followReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followFrameRef = useRef<number | null>(null);
  const lastFollowPointRef = useRef<MeshiPoint | null>(null);
  const focusedContentRef = useRef<FocusedContent | null>(null);
  const lastFocusedContentIdRef = useRef<string | null>(null);
  const contentInsightTimerRef = useRef<number | null>(null);
  const explorationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const speechBubbleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const [isIdle, setIsIdle] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [activeProp, setActiveProp] = useState<MeshiProp>("none");
  const [clickBurst, setClickBurst] = useState(false);
  const [tapBursts, setTapBursts] = useState<MeshiTapBurst[]>([]);
  const tapBurstTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const tapStreakRef = useRef<{ count: number; at: number }>({ count: 0, at: 0 });
  const tapSquashControls = useAnimationControls();
  const prefersReducedMotion = useReducedMotion();
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickBurstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasGreetedThisPage, setHasGreetedThisPage] = useState(false);
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const [isMeshTransition, setIsMeshTransition] = useState(false);
  const prevPathnameRef = useRef("");
  const [isFirstTimeMeshi, setIsFirstTimeMeshi] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return !localStorage.getItem("meshiInteracted"); } catch { return false; }
  });

  const [speechBubbles, setSpeechBubbles] = useState<Array<{
    id: string; text: string; role: "user" | "meshi"; timestamp: number;
  }>>([]);
  const [speechInput, setSpeechInput] = useState("");
  const [isMeshiTyping, setIsMeshiTyping] = useState(false);
  // A vessel action Meshi proposed in speech mode that still needs the user's
  // go-ahead (currently: posting on their behalf).
  const [pendingSpeechAction, setPendingSpeechAction] = useState<MeshiAction | null>(null);
  const speechInputRef = useRef<HTMLInputElement>(null);

  const pathname = usePathname();
  const isMeshSurface = isMeshSurfacePath(pathname);
  const isMeshSurfaceRef = useRef(isMeshSurface);
  useEffect(() => { isMeshSurfaceRef.current = isMeshSurface; }, [isMeshSurface]);

  // Flag the open chat/actions panel so the corner bug widget yields to it. The
  // flag must clear whenever the panel isn't actually visible — including when
  // Meshi is disabled or hidden on the current route — so it never lingers.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const panelVisible =
      isMounted &&
      meshiEnabled &&
      !shouldHideGlobalMeshi(pathname) &&
      (view === "chat" || view === "actions");
    if (panelVisible) {
      document.body.dataset.meshiPanel = "open";
    } else {
      delete document.body.dataset.meshiPanel;
    }
    return () => {
      delete document.body.dataset.meshiPanel;
    };
  }, [isMounted, meshiEnabled, pathname, view]);

  const persistContinuityState = useCallback(
    (patch: Partial<Omit<MeshiContinuityState, "version" | "instanceId" | "updatedAt">> = {}) => {
      if (!meshiEnabled) return;
      const position = patch.position || { x: meshiX.get(), y: meshiY.get() };
      writeMeshiContinuityState({
        version: MESHI_CONTINUITY_STATE_VERSION,
        instanceId,
        updatedAt: Date.now(),
        pathname: patch.pathname || pathname,
        position: findSafeMeshiPosition(clampMeshiPosition(position)),
        view: patch.view || view,
        mood: patch.mood || mood,
        activeProp: patch.activeProp || activeProp,
      });
    },
    [activeProp, instanceId, meshiEnabled, meshiX, meshiY, mood, pathname, view],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsMounted(true));
    const bubbleTimers = speechBubbleTimersRef.current;
    const tapTimers = tapBurstTimersRef.current;
    return () => {
      window.cancelAnimationFrame(frame);
      if (avoidingUiTimerRef.current) window.clearTimeout(avoidingUiTimerRef.current);
      if (contentInsightTimerRef.current) window.clearTimeout(contentInsightTimerRef.current);
      explorationTimersRef.current.forEach(clearTimeout);
      explorationTimersRef.current = [];
      for (const t of bubbleTimers.values()) clearTimeout(t);
      bubbleTimers.clear();
      for (const t of tapTimers.values()) clearTimeout(t);
      tapTimers.clear();
    };
  }, []);

  useEffect(() => {
    if (!isMounted || !meshiEnabled) return;
    persistContinuityState();
  }, [activeProp, isMounted, meshiEnabled, mood, pathname, persistContinuityState, view]);

  useEffect(() => {
    if (!meshiEnabled) return;

    const saveCurrentState = () => persistContinuityState();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") saveCurrentState();
    };

    window.addEventListener("pagehide", saveCurrentState);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", saveCurrentState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [meshiEnabled, persistContinuityState]);

  useEffect(() => {
    const detectFullscreenVideo = () => {
      const element = document.fullscreenElement as HTMLElement | null;
      const videoActive = Boolean(
        element &&
        (element.tagName.toLowerCase() === "video" || element.querySelector("video"))
      );
      setIsFullscreenVideo(videoActive);
      if (videoActive) {
        setView("closed");
        setMood("learning");
        setActiveProp("magnifying-glass");
        setContentInsightVisible(false);
        const fullscreenContext = getFocusedContentFromElement(element) || getVisibleFocusedContent();
        if (fullscreenContext) {
          focusedContentRef.current = fullscreenContext;
          setFocusedContent(fullscreenContext);
        }
        const safe = findSafeMeshiPosition({
          x: window.innerWidth - MESHI_SIZE - 16,
          y: window.innerHeight - MESHI_SIZE - 16,
        });
        meshiX.set(safe.x);
        meshiY.set(safe.y);
      }
    };

    document.addEventListener("fullscreenchange", detectFullscreenVideo);
    detectFullscreenVideo();
    return () => document.removeEventListener("fullscreenchange", detectFullscreenVideo);
  }, [meshiX, meshiY]);

  useEffect(() => {
    if (!meshiEnabled || shouldHideGlobalMeshi(pathname)) return;
    let frame: number | null = null;

    const showInsightBriefly = (content: FocusedContent) => {
      if (!content.id || lastFocusedContentIdRef.current === content.id) return;
      lastFocusedContentIdRef.current = content.id;
      if (view !== "closed" || isSearching || isDragging || isFullscreenVideo) return;
      setMood("learning");
      setActiveProp("notebook");
      setContentInsightVisible(true);
      if (contentInsightTimerRef.current) window.clearTimeout(contentInsightTimerRef.current);
      contentInsightTimerRef.current = window.setTimeout(() => setContentInsightVisible(false), 2800);
    };

    const updateFocusedContent = () => {
      frame = null;
      const next = getVisibleFocusedContent();
      if (areFocusedContentEqual(focusedContentRef.current, next)) return;
      focusedContentRef.current = next;
      setFocusedContent(next);
      if (next) showInsightBriefly(next);
    };

    const scheduleUpdate = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(updateFocusedContent);
    };

    scheduleUpdate();
    const interval = window.setInterval(scheduleUpdate, 2200);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [isDragging, isFullscreenVideo, isSearching, meshiEnabled, pathname, view]);

  useEffect(() => {
    if (!meshiEnabled) return;
    const timer = window.setTimeout(() => {
      getMeshiPreference().then((pref) => {
        if (pref) {
          if (pref.faceStyle) setMood(pref.faceStyle as MeshiMood);
          if (pref.colorTheme) setMeshiColor(pref.colorTheme as MeshiColor);
          if (pref.hatStyle) setMeshiHat(pref.hatStyle as MeshiHat);
          if (pref.hairStyle) setMeshiHair(pref.hairStyle as MeshiHair);
          if (pref.accessoryStyle) setMeshiAccessory(pref.accessoryStyle as MeshiAccessory);
          if (pref.eyeStyle) setMeshiEye(pref.eyeStyle as MeshiEyeStyle);
          if (pref.badgeStyle) setMeshiBadge(pref.badgeStyle as MeshiBadge);
          if (pref.outfitStyle) setMeshiOutfit(pref.outfitStyle as MeshiOutfit);
        }
      }).catch(() => {});
    }, 900);
    return () => window.clearTimeout(timer);
  }, [meshiEnabled]);

  // Persist Meshi conversation memory
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        "meshi-chat-history",
        JSON.stringify(chatHistory.map((entry) => ({ ...entry, time: entry.time.toISOString() })))
      );
    } catch {
      // ignore storage errors
    }
  }, [chatHistory]);

  useEffect(() => {
    const applyPrefs = (prefs: Partial<MeshiPreferences>) => {
      if (prefs.color) setMeshiColor(prefs.color);
      if (prefs.hat) setMeshiHat(prefs.hat);
      if (prefs.hair) setMeshiHair(prefs.hair);
      if (prefs.accessory) setMeshiAccessory(prefs.accessory);
      if (prefs.eye) setMeshiEye(prefs.eye);
      if (prefs.badge) setMeshiBadge(prefs.badge);
      if (prefs.outfit) setMeshiOutfit(prefs.outfit);
      if (prefs.face) setMood(prefs.face);
      if (typeof prefs.enabled === "boolean") setMeshiEnabled(prefs.enabled);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "meshiEnabled") setMeshiEnabled(e.newValue !== "false");
      if (e.key === "meshiColor") setMeshiColor((e.newValue || "blue") as MeshiColor);
      if (e.key === "meshiHat") setMeshiHat((e.newValue || "none") as MeshiHat);
      if (e.key === "meshiHair") setMeshiHair((e.newValue || "none") as MeshiHair);
      if (e.key === "meshiAccessory") setMeshiAccessory(((e.newValue === "lashes" ? "none" : e.newValue) || "none") as MeshiAccessory);
      if (e.key === "meshiEye") setMeshiEye((e.newValue || "regular") as MeshiEyeStyle);
      if (e.key === "meshiBadge") setMeshiBadge((e.newValue || "none") as MeshiBadge);
      if (e.key === "meshiOutfit") setMeshiOutfit((e.newValue || "none") as MeshiOutfit);
      if (e.key === "meshiFace") setMood((e.newValue || "happy") as MeshiMood);
    };
    const handlePreferenceEvent = (event: Event) => {
      const customEvent = event as CustomEvent<MeshiPreferences>;
      if (customEvent.detail) applyPrefs(customEvent.detail);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(MESHI_PREFERENCES_EVENT, handlePreferenceEvent as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(MESHI_PREFERENCES_EVENT, handlePreferenceEvent as EventListener);
    };
  }, []);

  // Load mesh data AND index it into knowledge system
  useEffect(() => {
    if (!meshiEnabled || view === "closed") return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      getMeshGraphData().then((data) => {
        if (!cancelled) {
          setMeshEntities(data.entities);
          setMeshStats(data.stats);
          // Auto-index mesh data into knowledge system
          if (data.entities.length > 0) {
            const nodes = data.entities.map((e) => ({
              id: e.id,
              type: e.type as "user" | "community" | "tag" | "post" | "platform",
              label: e.label,
              sublabel: e.sublabel || undefined,
              data: { followerCount: e.followerCount || 0, memberCount: e.memberCount || 0, isMutual: e.isMutual || false },
            }));
            setKnowledge((prev) => {
              const updated = indexMeshData(prev, nodes);
              saveKnowledge(updated);
              return updated;
            });
          }
        }
      }).catch(() => {});
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [meshiEnabled, view]);

  // Page transition bounce + contextual prop
  useEffect(() => {
    if (!meshiEnabled) return;
    // Set contextual prop based on current page
    const contextualProp = getContextualProp(pathname);
    queueMicrotask(() => setActiveProp(contextualProp));
    if (pathname !== lastPath && lastPath !== "") {
      const nextGreeting = getGreetingForPath(pathname);
      queueMicrotask(() => {
        setIsPageTransitioning(true);
        setMood(nextGreeting.mood);
        setLastPath(pathname);
        setHasGreetedThisPage(false);
      });
      if (pathname !== "/mesh") {
        const target = getPageArrivalPosition(pathname);
        requestAnimationFrame(() => {
          meshiX.set(target.x);
          meshiY.set(target.y);
        });
      }
      const timer = setTimeout(() => setIsPageTransitioning(false), 800);
      return () => clearTimeout(timer);
    }
    if (lastPath === "") queueMicrotask(() => setLastPath(pathname));
  }, [pathname, lastPath, meshiEnabled, meshiX, meshiY]);

  // Mesh page transition — animate Meshi toward canvas center when entering /mesh
  useEffect(() => {
    if (!meshiEnabled) return;
    const prev = prevPathnameRef.current;
    const enteringMesh = pathname === "/mesh" && prev !== "/mesh" && prev !== "";
    const leavingMesh = pathname !== "/mesh" && prev === "/mesh";

    if (enteringMesh) {
      queueMicrotask(() => setIsMeshTransition(true));
      const centerX = window.innerWidth / 2 - MESHI_SIZE / 2;
      const centerY = window.innerHeight / 2 - MESHI_SIZE / 2;
      meshiX.set(centerX);
      meshiY.set(centerY);
      const timer = setTimeout(() => setIsMeshTransition(false), 600);
      prevPathnameRef.current = pathname;
      return () => clearTimeout(timer);
    } else if (leavingMesh) {
      queueMicrotask(() => setIsMeshTransition(true));
      const target = getPageArrivalPosition(pathname);
      const centerX = window.innerWidth / 2 - MESHI_SIZE / 2;
      const centerY = window.innerHeight / 2 - MESHI_SIZE / 2;
      meshiX.set(centerX);
      meshiY.set(centerY);
      requestAnimationFrame(() => {
        meshiX.set(target.x);
        meshiY.set(target.y);
      });
      const timer = setTimeout(() => setIsMeshTransition(false), 600);
      prevPathnameRef.current = pathname;
      return () => clearTimeout(timer);
    }

    prevPathnameRef.current = pathname;
  }, [pathname, meshiEnabled, meshiX, meshiY]);
  useEffect(() => {
    if (!meshiEnabled || hasGreetedThisPage || view !== "closed") return;
    const greeting = getGreetingForPath(pathname);
    queueMicrotask(() => {
      setGreetingText(greeting.text);
      setMood(greeting.mood);
      setHasGreetedThisPage(true);
    });
    let hideTimer: ReturnType<typeof setTimeout>;
    const showTimer = setTimeout(() => {
      setShowGreeting(true);
      hideTimer = setTimeout(() => setShowGreeting(false), 2600);
    }, 900);
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
  }, [pathname, hasGreetedThisPage, view, meshiEnabled]);

  // User interaction reactions
  useEffect(() => {
    if (!meshiEnabled) return;
    const handleKeyDown = () => {
      if (!isTyping) setIsTyping(true);
      if (isIdle) setIsIdle(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setIsIdle(true), 20000);
      if (view === "closed") setMood("thinking");
    };
    const handleKeyUp = () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setIsTyping(false), 2000);
    };
    const handleClick = () => {
      setClickBurst(true);
      if (clickBurstTimerRef.current) clearTimeout(clickBurstTimerRef.current);
      clickBurstTimerRef.current = setTimeout(() => setClickBurst(false), 400);
      if (view === "closed") setMood("happy");
    };
    const handleMouseMove = () => {
      if (isIdle) setIsIdle(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setIsIdle(true), 20000);
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("keydown", handleKeyDown, { passive: true });
    window.addEventListener("keyup", handleKeyUp, { passive: true });
    window.addEventListener("click", handleClick, { passive: true });
    idleTimerRef.current = setTimeout(() => setIsIdle(true), 20000);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("click", handleClick);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (clickBurstTimerRef.current) clearTimeout(clickBurstTimerRef.current);
    };
  }, [meshiEnabled, isIdle, isTyping, view]);

  // Idle behavior
  useEffect(() => {
    if (!meshiEnabled || view !== "closed") return;
    if (isIdle) queueMicrotask(() => setMood("sleepy"));
    else if (isTyping) queueMicrotask(() => setMood("thinking"));
  }, [isIdle, isTyping, view, meshiEnabled]);

  // Dynamic follow behavior: Meshi trails attention, then docks safely.
  useEffect(() => {
    if (!meshiEnabled || view !== "closed" || isSearching || isDragging || isMeshTransition) return;
    // On a mouse or trackpad the cursor sprite IS Meshi and is already at the
    // pointer. Trailing it with a second Meshi is double vision by
    // construction — two drawings of one character converging on one point.
    // The companion keeps its dock (and its panels); only the chasing stops.
    if (cursorSpriteOwnsPointer()) return;

    const canFollow = () => view === "closed" && !isSearching && !isDragging && !isMeshTransition;
    const releaseToDock = () => {
      if (followReleaseTimerRef.current) clearTimeout(followReleaseTimerRef.current);
      followReleaseTimerRef.current = setTimeout(() => {
        if (!canFollow()) return;
        const safe = getSafePosition();
        meshiX.set(safe.x);
        meshiY.set(safe.y);
        setActiveProp(getContextualProp(pathname));
      }, MESHI_FOLLOW_RELEASE_MS);
    };
    const moveNear = (point: MeshiPoint, nextMood: MeshiMood, prop: MeshiProp = "none") => {
      if (!canFollow()) return;
      meshiX.set(point.x);
      meshiY.set(point.y);
      setMood(nextMood);
      if (prop !== "none") setActiveProp(prop);
      releaseToDock();
    };

    const handlePointerMove = (event: PointerEvent) => {
      // Gated on pointer TYPE, not viewport width: a 900px floor also excluded
      // small laptops, and width was never the right proxy for "has a mouse".
      if (event.pointerType !== "mouse" || !canFollow()) return;
      const last = lastFollowPointRef.current;
      const movedEnough = !last || Math.hypot(event.clientX - last.x, event.clientY - last.y) > 140;
      if (!movedEnough || followFrameRef.current !== null) return;

      lastFollowPointRef.current = { x: event.clientX, y: event.clientY };
      followFrameRef.current = window.requestAnimationFrame(() => {
        followFrameRef.current = null;
        moveNear(getPointerFollowPosition(event.clientX, event.clientY), "wink");
      });
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!canFollow()) return;
      const target = event.target as HTMLElement | null;
      if (!target?.matches("input, textarea, select, button, a, [role='button'], [data-meshi-follow]")) return;
      const rect = target.getBoundingClientRect();
      moveNear(getPointerFollowPosition(rect.right, rect.top + rect.height / 2), "thinking", getContextualProp(pathname));
    };

    const handleClick = (event: MouseEvent) => {
      if (!canFollow()) return;
      const target = event.target as HTMLElement | null;
      const isInteractive = Boolean(target?.closest("button, a, input, textarea, select, [role='button'], [data-meshi-follow]"));
      if (!isInteractive) return;
      moveNear(getPointerFollowPosition(event.clientX, event.clientY), "happy");
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("click", handleClick, { passive: true });
    releaseToDock();

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("click", handleClick);
      if (followReleaseTimerRef.current) clearTimeout(followReleaseTimerRef.current);
      if (followFrameRef.current !== null) window.cancelAnimationFrame(followFrameRef.current);
    };
  }, [meshiEnabled, view, isSearching, isDragging, isMeshTransition, meshiX, meshiY, pathname]);

  // Meshi reacts to things that actually happened.
  //
  // This replaced an eight-second `setInterval` that cycled a per-route list of
  // moods — a character pulling faces on a timer while the user sat still,
  // which is what made Meshi read as decoration rather than as representing
  // anyone. Nothing here fires unless the product published a cause, so the
  // answer to "whose hand caused this?" is always a real one.
  useEffect(() => {
    if (!meshiEnabled) return;
    let settle: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = subscribeMeshiCause((cause) => {
      // A reaction is only legible on a Meshi the user can see doing nothing
      // else. While a panel is open, or Meshi is being dragged, the face is not
      // what the user is looking at.
      if (view !== "closed" || isDragging) return;

      const { mood: next, holdMs } = reactionFor(cause.kind);
      setMood(next);
      if (settle) clearTimeout(settle);
      // Return to itself afterwards. A face that holds an expression is posing,
      // not reacting.
      settle = setTimeout(() => setMood("happy"), holdMs);
    });

    return () => {
      unsubscribe();
      if (settle) clearTimeout(settle);
    };
  }, [meshiEnabled, view, isDragging]);

  // Scroll reaction
  useEffect(() => {
    if (!meshiEnabled || view !== "closed") return;
    let lastScrollY = window.scrollY;
    let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleScrollDirection = () => {
      const delta = window.scrollY - lastScrollY;
      lastScrollY = window.scrollY;
      if (Math.abs(delta) > 50) {
        setMood(delta > 0 ? "cool" : "surprised");
        if (!isDragging && !isSearching) {
          const safe = getSafePosition();
          const target = findSafeMeshiPosition({
            x: safe.x,
            y: delta > 0 ? window.innerHeight * 0.66 : window.innerHeight * 0.26,
          });
          meshiX.set(target.x);
          meshiY.set(target.y);
        }
        if (pendingTimeout) clearTimeout(pendingTimeout);
        pendingTimeout = setTimeout(() => {
          const safe = getSafePosition();
          meshiX.set(safe.x);
          meshiY.set(safe.y);
          setMood("happy");
          pendingTimeout = null;
        }, 1200);
      }
    };
    window.addEventListener("scroll", handleScrollDirection, { passive: true });
    return () => { window.removeEventListener("scroll", handleScrollDirection); if (pendingTimeout) clearTimeout(pendingTimeout); };
  }, [meshiEnabled, view, isDragging, isSearching, meshiX, meshiY]);

  // Keep Meshi in safe zone on resize — snap to safe position if out of bounds
  useEffect(() => {
    const handleResize = () => {
      const safe = getSafePosition();
      const curX = meshiX.get();
      const curY = meshiY.get();
      const clamped = clampMeshiPosition({ x: curX, y: curY });
      const resolved = findSafeMeshiPosition(clamped);
      const outOfBounds = Math.abs(clamped.x - curX) > 1 || Math.abs(clamped.y - curY) > 1;
      const overlapsUi = Math.abs(resolved.x - clamped.x) > 1 || Math.abs(resolved.y - clamped.y) > 1 || overlapsImportantUi(clamped);

      // SSR starts MotionValues with a desktop fallback. Correct it as soon as
      // the real viewport exists, then keep it inside mobile/tablet bounds.
      if (outOfBounds || overlapsUi || curX > window.innerWidth || curY > window.innerHeight) {
        const target = overlapsUi ? resolved : safe;
        meshiX.set(target.x);
        meshiY.set(target.y);
      }
    };
    handleResize();
    const settleTimer = window.setTimeout(handleResize, 250);
    window.addEventListener("resize", handleResize);
    return () => {
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", handleResize);
    };
  }, [meshiX, meshiY]);

  // Magnetic lean — Meshi leans a few pixels + a slight tilt toward the cursor as
  // it draws near, then relaxes. Capped small; skipped entirely under reduced motion.
  useEffect(() => {
    if (!meshiEnabled || prefersReducedMotion || typeof window === "undefined") return;
    const RADIUS = 220;
    const MAX_PULL = 5;
    const MAX_TILT = 6;
    let frame: number | null = null;
    let pending: { x: number; y: number } | null = null;

    const relax = () => {
      magnetX.set(0);
      magnetY.set(0);
      magnetRotate.set(0);
    };

    const apply = () => {
      frame = null;
      if (!pending || isDragging) {
        relax();
        return;
      }
      const cx = meshiX.get() + MESHI_SIZE / 2;
      const cy = meshiY.get() + MESHI_SIZE / 2;
      const dx = pending.x - cx;
      const dy = pending.y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist >= RADIUS || dist < 0.001) {
        relax();
        return;
      }
      const strength = 1 - dist / RADIUS;
      const offX = (dx / dist) * MAX_PULL * strength;
      const offY = (dy / dist) * MAX_PULL * strength;
      magnetX.set(offX);
      magnetY.set(offY);
      magnetRotate.set((offX / MAX_PULL) * MAX_TILT);
    };

    const handleMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pending = { x: event.clientX, y: event.clientY };
      if (frame === null) frame = window.requestAnimationFrame(apply);
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handleMove);
      if (frame !== null) window.cancelAnimationFrame(frame);
      relax();
    };
  }, [meshiEnabled, prefersReducedMotion, isDragging, magnetX, magnetY, magnetRotate, meshiX, meshiY]);

  const addSpeechBubble = useCallback((role: "user" | "meshi", text: string) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setSpeechBubbles((prev) => [...prev.slice(-4), { id, text, role, timestamp: Date.now() }]);
    const timer = setTimeout(() => {
      setSpeechBubbles((prev) => prev.filter((b) => b.id !== id));
      speechBubbleTimersRef.current.delete(id);
    }, 12000);
    speechBubbleTimersRef.current.set(id, timer);
  }, []);

  // Meshi exploration animation — travels through mesh nodes and indexes them
  const triggerExploration = useCallback(() => {
    setIsExploring(true);
    setIsSearching(true);
    setSearchingText("Exploring your mesh...");
    setMood("searching" as MeshiMood);
    setView("closed");
    setExplorationProgress(0);

    const totalSteps = 5;
    const stepDuration = 800;
    const messages = [
      "Discovering connections...",
      "Indexing posts & communities...",
      "Mapping your digital universe...",
      "Learning about your mesh...",
      "Almost done!",
    ];

    explorationTimersRef.current.forEach(clearTimeout);
    explorationTimersRef.current = [];

    messages.forEach((msg, i) => {
      const t = setTimeout(() => {
        setSearchingText(msg);
        setExplorationProgress(((i + 1) / totalSteps) * 100);
        if (i === 1) setMood("learning" as MeshiMood);
        if (i === 3) setMood("thinking");
      }, i * stepDuration);
      explorationTimersRef.current.push(t);
    });

    const finishTimer = setTimeout(() => {
      setIsSearching(false);
      setIsExploring(false);
      setExplorationProgress(0);
      const stats = meshStats;
      const kLevel = knowledge.knowledgeLevel;
      const levelDesc = getKnowledgeLevelDescription(kLevel);
      const summary = stats.followers + stats.following + stats.posts > 0
        ? `Exploration complete! Found ${stats.followers} followers, ${stats.following} following, ${stats.posts} posts, ${stats.communities} communities across ${stats.platforms} platforms. Knowledge Level: ${kLevel}/10 (${levelDesc})`
        : "Your mesh is just getting started! Connect some platforms to see it grow.";
      setMood("celebrating" as MeshiMood);
      setView("speech");
      addSpeechBubble("meshi", summary);
      const moodTimer = setTimeout(() => setMood("excited"), 2000);
      explorationTimersRef.current.push(moodTimer);
    }, totalSteps * stepDuration);
    explorationTimersRef.current.push(finishTimer);
  }, [meshStats, knowledge.knowledgeLevel, addSpeechBubble]);

  // Legacy triggerSearch now uses exploration
  const triggerSearch = triggerExploration;

  const submitSpeechPrompt = useCallback((rawText: string) => {
    const text = rawText.trim();
    if (!text || isMeshiTyping) return;
    addSpeechBubble("user", text);
    setMood("thinking");
    setIsMeshiTyping(true);
    // A new prompt supersedes any unconfirmed vessel action from the last one.
    setPendingSpeechAction(null);

    const q = text.toLowerCase();
    const isSearchQuery = SEARCH_TRIGGERS.some((trigger) => q.includes(trigger));
    const isExploreQuery = q.includes("explore") || q.includes("index") || q.includes("learn more");
    const isFocusedContentQuery = Boolean(focusedContent && (
      q.includes("this post") ||
      q.includes("visible post") ||
      q.includes("this video") ||
      q.includes("this photo") ||
      q.includes("this image") ||
      q.includes("fact") ||
      q.includes("summar") ||
      q.includes("verify") ||
      q.includes("generated") ||
      q.includes("media") ||
      q.includes("authenticity")
    ));
    const isMeshQuery = q.includes("how many") || q.includes("who is") || q.includes("find ") || q.includes("@") ||
      q.includes("tell me about my mesh") || q.includes("summary") || q.includes("what do you know") || q.includes("knowledge level");
    const isInspectQuery = (pathname === "/mesh") && (
      text.toLowerCase().includes("who is") ||
      text.toLowerCase().includes("tell me about") ||
      text.toLowerCase().includes("inspect") ||
      text.toLowerCase().includes("look up")
    );

    const shouldAnimateSearch = !isSearching && (isMeshQuery || isSearchQuery || isExploreQuery || isInspectQuery || isFocusedContentQuery);
    if (shouldAnimateSearch) {
      setIsSearching(true);
      setSearchingText(isFocusedContentQuery ? "Checking visible content..." : isExploreQuery ? "Exploring your mesh..." : "Searching with Meshi...");
      setMood("searching" as MeshiMood);
      setView("closed");
      setActiveProp("magnifying-glass");
      setTimeout(() => {
        setSearchingText(isFocusedContentQuery ? "Reviewing source and media clues..." : "Reasoning...");
        setActiveProp(isFocusedContentQuery ? "notebook" : PAGE_PROPS["/mesh"] || "compass");
        setMood("learning" as MeshiMood);
      }, 700);
    }

    const history: MeshiHistoryMessage[] = chatHistory.slice(-6).flatMap((entry) => [
      { role: "user" as const, content: entry.q },
      { role: "meshi" as const, content: entry.a },
    ]);

    const startedAt = Date.now();
    void (async () => {
      const response = await askMeshi({
        message: text,
        context: {
          meshData: meshStats,
          meshEntities: meshEntities.slice(0, 50),
          focusedContent: focusedContent || undefined,
          currentPage: pathname,
        },
        history,
      });

      const elapsed = Date.now() - startedAt;
      if (shouldAnimateSearch && elapsed < 900) {
        await new Promise((resolve) => setTimeout(resolve, 900 - elapsed));
      }

      if (shouldAnimateSearch) {
        setIsSearching(false);
        setIsExploring(false);
        setExplorationProgress(0);
        setView("speech");
      }

      setMood(response.mood as MeshiMood);
      addSpeechBubble("meshi", response.content);
      setIsMeshiTyping(false);
      setChatHistory((prev) => [...prev.slice(-49), { q: text, a: response.content, time: new Date() }]);

      // Vessel actions: suggestions are read-only so Meshi runs them right away;
      // a ready-to-send post waits for explicit confirmation.
      if (response.action?.type === "suggest") {
        setIsMeshiTyping(true);
        const result = await runMeshiAction({
          action: "suggest",
          suggestionType: (response.action.suggestionType as "people" | "communities" | "content") || "people",
        });
        setMood(result.mood);
        addSpeechBubble("meshi", result.message);
        setIsMeshiTyping(false);
      } else if (response.action?.type === "post" && response.action.content) {
        setPendingSpeechAction(response.action);
      }

      setTimeout(() => setMood("happy"), 3000);
    })();
  }, [isMeshiTyping, addSpeechBubble, focusedContent, isSearching, chatHistory, meshStats, meshEntities, pathname]);

  const confirmPendingSpeechAction = useCallback(() => {
    const content = pendingSpeechAction?.content;
    if (!content || isMeshiTyping) return;
    setPendingSpeechAction(null);
    setIsMeshiTyping(true);
    setMood("thinking");
    void (async () => {
      const result = await runMeshiAction({ action: "post", content });
      setMood(result.mood);
      addSpeechBubble("meshi", result.message);
      setIsMeshiTyping(false);
      if (result.success) void impactFeedback("MEDIUM");
    })();
  }, [pendingSpeechAction, isMeshiTyping, addSpeechBubble]);

  const handleSpeechSend = useCallback(() => {
    const text = speechInput.trim();
    if (!text || isMeshiTyping) return;
    setSpeechInput("");
    submitSpeechPrompt(text);
  }, [isMeshiTyping, speechInput, submitSpeechPrompt]);

  const handleFocusedContentPrompt = useCallback((mode: "summary" | "fact-check" | "verify") => {
    if (!focusedContent || isMeshiTyping) return;
    setView("speech");
    setContentInsightVisible(false);
    submitSpeechPrompt(getFocusedContentPrompt(focusedContent, mode));
  }, [focusedContent, isMeshiTyping, submitSpeechPrompt]);

  useEffect(() => {
    if (view === "speech") setTimeout(() => speechInputRef.current?.focus(), 100);
  }, [view]);

  // Aurora payoff on tap: escalating particle burst + one-shot elastic squash.
  const emitTapBurst = useCallback(() => {
    const now = Date.now();
    const streak = now - tapStreakRef.current.at < 900 ? tapStreakRef.current.count + 1 : 1;
    tapStreakRef.current = { count: streak, at: now };
    const burst = createMeshiBurst(5 + streak);
    setTapBursts((prev) => [...prev.slice(-3), burst]);
    const timer = setTimeout(() => {
      setTapBursts((prev) => prev.filter((b) => b.id !== burst.id));
      tapBurstTimersRef.current.delete(burst.id);
    }, 760);
    tapBurstTimersRef.current.set(burst.id, timer);
    tapSquashControls.start({
      scale: [0.86, 1.18, 1],
      transition: { duration: 0.44, ease: [0.22, 1.61, 0.36, 1], times: [0, 0.45, 1] },
    });
  }, [tapSquashControls]);

  const handleMeshiClick = useCallback(() => {
    if (wasDragged) return;
    emitTapBurst();
    // void: impactFeedback is async and rejects when the native bridge is
    // unavailable — every other call site guards it, so match them here.
    void impactFeedback("MEDIUM");
    // Mark first-time interaction
    if (isFirstTimeMeshi) {
      setIsFirstTimeMeshi(false);
      try { localStorage.setItem("meshiInteracted", "true"); } catch { /* storage unavailable */ }
    }
    if (view === "closed") { setView("actions"); setMood("excited"); }
    else if (view === "actions") { setView("closed"); }
    else if (view === "speech") { setView("closed"); setSpeechBubbles([]); }
    else { setView("closed"); }
  }, [view, wasDragged, isFirstTimeMeshi, emitTapBurst]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY, px: springX.get(), py: springY.get() };
    dragAvoidRectsRef.current = getMeshiAvoidRects();
    setWasDragged(false);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [springX, springY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { setIsDragging(true); setWasDragged(true); }
    const raw = clampMeshiPosition({ x: dragStartRef.current.px + dx, y: dragStartRef.current.py + dy });
    const safe = findSafeMeshiPosition(raw, dragAvoidRectsRef.current);
    const adjusted = Math.abs(raw.x - safe.x) > 1 || Math.abs(raw.y - safe.y) > 1;

    if (adjusted !== isAvoidingUi) setIsAvoidingUi(adjusted);
    if (adjusted) setMood("surprised");

    meshiX.set(safe.x);
    meshiY.set(safe.y);
  }, [isAvoidingUi, meshiX, meshiY]);

  const handlePointerUp = useCallback(() => {
    dragStartRef.current = null;
    setIsDragging(false);
    const curX = meshiX.get();
    const curY = meshiY.get();
    const clamped = clampMeshiPosition({ x: curX, y: curY });
    const safe = findSafeMeshiPosition(clamped);
    const adjusted = Math.abs(clamped.x - safe.x) > 1 || Math.abs(clamped.y - safe.y) > 1 || overlapsImportantUi(clamped);

    meshiX.set(safe.x);
    meshiY.set(safe.y);
    persistContinuityState({ position: safe });
    dragAvoidRectsRef.current = [];

    if (avoidingUiTimerRef.current) window.clearTimeout(avoidingUiTimerRef.current);
    setIsAvoidingUi(adjusted);
    if (adjusted) {
      avoidingUiTimerRef.current = window.setTimeout(() => setIsAvoidingUi(false), 700);
    }
}, [meshiX, meshiY, persistContinuityState]);

  const closeAll = useCallback(() => { setView("closed"); setSpeechBubbles([]); setPendingSpeechAction(null); }, []);

  // Global Meshi entrypoint so any screen can open Meshi in a specific mode.
  useEffect(() => {
    const handleMeshiOpen = (event: Event) => {
      const customEvent = event as CustomEvent<MeshiOpenMode>;
      const mode = customEvent.detail || "actions";
      // On the Mesh the floating body is hidden, so anchored modes (speech/actions)
      // have nothing to attach to — open the full chat modal instead.
      if (isMeshSurfaceRef.current) {
        setView("chat");
        setMood("happy");
        return;
      }
      if (mode === "speech") {
        setView("speech");
        setMood("thinking");
      } else if (mode === "chat") {
        setView("chat");
        setMood("happy");
      } else {
        setView("actions");
        setMood("excited");
      }
    };

    window.addEventListener(MESHI_OPEN_EVENT, handleMeshiOpen as EventListener);
    return () => window.removeEventListener(MESHI_OPEN_EVENT, handleMeshiOpen as EventListener);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + M toggles Meshi menu
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "m") {
        e.preventDefault();
        setView((prev) => (prev !== "closed" ? "closed" : isMeshSurfaceRef.current ? "chat" : "actions"));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (!isMounted || !meshiEnabled || shouldHideGlobalMeshi(pathname)) return null;

  const activeHeldProp: MeshiProp =
    isFullscreenVideo || isSearching
      ? "magnifying-glass"
      : contentInsightVisible && focusedContent
        ? "notebook"
      : isTyping || isMeshiTyping
        ? "keyboard"
        : view === "actions" || view === "speech" || view === "chat" || isDragging
          ? activeProp
          : "none";

  return (
    <>
      {/* Search Overlay. It explains what the single floating Meshi is doing without rendering another Meshi body. */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center"
          >
            <motion.div className="flex flex-col items-center gap-3"
              animate={{ x: [0, 100, -80, 60, -40, 0], y: [0, -50, 30, -60, 20, 0] }}
              transition={{ duration: 4, ease: "easeInOut" }}>
              {/* Magnifying glass icon */}
              <motion.div
                animate={{ rotate: [-15, 15, -15], scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="text-2xl"
              >
                <Search className="h-8 w-8" style={{ color: "var(--accent)" }} />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="px-4 py-2 rounded-xl text-sm font-medium shadow-xl flex flex-col items-center gap-1"
                style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--accent)" }}>
                <span>{searchingText}</span>
                {isExploring && explorationProgress > 0 && (
                  <div className="w-32 h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "var(--accent)" }}
                      animate={{ width: `${explorationProgress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                )}
                <span className="text-[10px] text-[var(--text-muted)]">Knowledge Level {knowledge.knowledgeLevel}/10</span>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* THE ONE MESHI - standalone floating entity.
          On the Mesh the canvas draws this same entity as the user's cursor/avatar,
          so the floating body yields there to keep Meshi a strict singleton. */}
      {!isMeshSurface && (
      <AnimatePresence>
        <motion.div
          data-meshi-float="true"
          data-meshi-singleton="true"
          data-meshi-instance-id={instanceId}
          data-meshi-owned="true"
          data-meshi-avoiding={isAvoidingUi ? "true" : undefined}
          className="meshi-float-shell fixed z-40"
          style={{ left: springX, top: springY }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{
            opacity: isFullscreenVideo ? 0.46 : 1,
            scale: isFullscreenVideo ? 0.56 : isMeshTransition ? [1, 1.14, 1] : 1,
            y: isAvoidingUi ? [0, -4, 0] : 0,
          }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}>
            {isFullscreenVideo && view === "closed" && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.92 }}
                animate={{ opacity: 0.82, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.92 }}
                className="absolute bottom-full right-0 mb-1 flex items-center gap-1 rounded-full border border-[var(--accent)]/20 bg-[var(--bg-elevated)]/72 px-2 py-1 text-[10px] font-semibold text-[var(--text-primary)] shadow-md backdrop-blur"
              >
                <span className="text-[var(--accent)]">Check</span>
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleFocusedContentPrompt("summary");
                  }}
                  className="rounded-full px-1.5 py-0.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                >
                  Sum
                </button>
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleFocusedContentPrompt("fact-check");
                  }}
                  className="rounded-full px-1.5 py-0.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                >
                  Facts
                </button>
              </motion.div>
            )}
            {contentInsightVisible && focusedContent && view === "closed" && !isFullscreenVideo && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.94 }}
                className="absolute bottom-full right-0 mb-2 w-[15rem] rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)]/94 px-3 py-2 text-[11px] font-semibold text-[var(--text-primary)] shadow-lg backdrop-blur"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[var(--text-primary)]">
                      Fact-check ready
                      {focusedContent.platform ? <span className="text-[var(--text-muted)]"> - {focusedContent.platform}</span> : null}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-4 text-[var(--text-muted)]">
                      I can summarize, check claims, or look for media authenticity clues using visible metadata.
                    </p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1">
                  {([
                    ["summary", "Sum"],
                    ["fact-check", "Facts"],
                    ["verify", "Verify"],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleFocusedContentPrompt(mode);
                      }}
                      className="rounded-lg bg-[var(--bg-tertiary)] px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
            {isSearching && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.94 }}
                className="absolute bottom-full right-0 mb-2 min-w-[11rem] rounded-xl border border-[var(--accent)]/40 bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-lg"
              >
                <span className="block">{searchingText || "Meshi is working..."}</span>
                {isExploring && explorationProgress > 0 && (
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                    <motion.span
                      className="block h-full rounded-full bg-[var(--accent)]"
                      animate={{ width: `${explorationProgress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </span>
                )}
              </motion.div>
            )}
            {/* Speech bubbles above Meshi */}
            {view === "speech" && (
              <div className="absolute bottom-full right-0 mb-2 flex flex-col items-end gap-2 w-[280px]">
                <AnimatePresence>
                  {speechBubbles.slice(-3).map((bubble) => (
                    <motion.div key={bubble.id}
                      initial={{ opacity: 0, y: 15, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.9 }}
                      transition={{ type: "spring", damping: 20, stiffness: 300 }}
                      className={`max-w-[260px] px-3 py-2 rounded-2xl text-xs shadow-lg ${
                        bubble.role === "user"
                          ? "brand-button text-white rounded-br-sm self-end"
                          : "bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-bl-sm"
                      }`}>
                      {bubble.role === "meshi" && (
                        <div className="mb-1 flex items-start gap-1.5">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                          <span className="text-[10px] font-medium text-[var(--accent)]">Meshi</span>
                        </div>
                      )}
                      <p className="leading-relaxed">{bubble.text}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isMeshiTyping && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    className="px-3 py-2 rounded-2xl rounded-bl-sm bg-[var(--bg-elevated)] border border-[var(--border-primary)] shadow-lg">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
                          animate={{ y: [0, -3, 0] }} transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }} />
                      ))}
                    </div>
                  </motion.div>
                )}
                {pendingSpeechAction?.type === "post" && pendingSpeechAction.content && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="w-full rounded-2xl rounded-bl-sm border border-[var(--accent)]/40 bg-[var(--bg-elevated)] px-3 py-2 shadow-lg">
                    <p className="mb-2 text-[10px] font-medium text-[var(--accent)]">Ready to post for you</p>
                    <p className="mb-2 max-h-20 overflow-y-auto text-xs leading-relaxed text-[var(--text-primary)]">
                      {pendingSpeechAction.content}
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={confirmPendingSpeechAction}
                        className="rounded-lg brand-button px-2.5 py-1 text-[11px] font-semibold text-white shadow">
                        Post it
                      </button>
                      <button
                        onClick={() => setPendingSpeechAction(null)}
                        className="rounded-lg bg-[var(--bg-tertiary)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)]">
                        Not now
                      </button>
                    </div>
                  </motion.div>
                )}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 w-full">
                  <input ref={speechInputRef} type="text" value={speechInput}
                    onChange={(e) => setSpeechInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSpeechSend()}
                    placeholder="Ask me anything..."
                    className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] shadow-lg" />
                  <button onClick={handleSpeechSend} disabled={!speechInput.trim()}
                    className="p-2 rounded-xl brand-button text-white disabled:opacity-40 shadow-lg">
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              </div>
            )}

            {/* Greeting tooltip */}
            <AnimatePresence>
              {showGreeting && view === "closed" && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.95 }}
                  className="absolute bottom-full right-0 mb-2 px-3 py-2 rounded-xl text-xs max-w-[160px] shadow-lg pointer-events-none"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-primary)" }}>
                  <p>{greetingText}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* MESHI ENTITY - the user's persistent bubble character */}
            <motion.div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onClick={handleMeshiClick}
              className={`relative cursor-pointer select-none rounded-full ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
              style={{ touchAction: "none", width: MESHI_SIZE, height: MESHI_SIZE }}
              data-meshi-primary="true"
              role="button"
              aria-label="Open Meshi"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleMeshiClick();
                }
              }}
              animate={{
                scale: clickBurst ? [1, 1.15, 1] : isPageTransitioning ? [1, 1.2, 0.9, 1.1, 1] : 1,
                rotate: isPageTransitioning ? [0, 10, -10, 5, 0] : isDragging ? [0, 3, -3, 0] : 0,
              }}
              transition={{ duration: isPageTransitioning ? 0.6 : 0.3, ease: "easeOut" }}>
              {/* Elastic squash + magnetic lean layer (composes with the bob below) */}
              <motion.div
                className="h-full w-full"
                animate={tapSquashControls}
                style={{
                  transformOrigin: "center",
                  x: magnetSpringX,
                  y: magnetSpringY,
                  rotate: magnetSpringRotate,
                }}>
              <motion.div
                animate={
                  isDragging
                    ? { rotate: [0, 8, -8, 8, 0] }
                    : isIdle
                      ? { y: [0, -1, 0], opacity: [1, 0.7, 1] }
                      : { y: [0, -3, 0, -1, 0], rotate: [0, 1, -1, 0.5, 0] }
                }
                transition={
                  isDragging
                    ? { duration: 0.5, repeat: Infinity }
                    : isIdle
                      ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 4, repeat: Infinity, ease: "easeInOut" }
                }>
                <motion.span
                  className="absolute inset-[-6px] -z-10 rounded-full bg-[var(--bg-primary)]/45 shadow-[0_10px_32px_rgba(96,165,250,0.18)] backdrop-blur"
                  animate={{
                    scale: view === "closed" ? [1, 1.05, 1] : [1, 1.16, 1],
                    opacity: view === "closed" ? [0.64, 0.82, 0.64] : [0.82, 0.45, 0.82],
                  }}
                  transition={{ duration: view === "closed" ? 4 : 1.8, repeat: Infinity, ease: "easeInOut" }}
                  aria-hidden="true"
                />
                <motion.span
                  className="absolute inset-[-14px] -z-20 rounded-full bg-[var(--accent)]/5"
                  animate={{
                    scale: view !== "closed" ? [1, 1.24, 1] : [1, 1.08, 1],
                    opacity: view !== "closed" ? [0.5, 0.06, 0.5] : [0.16, 0.03, 0.16],
                  }}
                  transition={{ duration: view !== "closed" ? 1.8 : 5, repeat: Infinity, ease: "easeOut" }}
                  aria-hidden="true"
                />
                <MeshiMascot
                  size={MESHI_SIZE}
                  mood={isFullscreenVideo || contentInsightVisible ? "learning" : isSearching ? "searching" as MeshiMood : isDragging ? "excited" : mood}
                  color={meshiColor}
                  hat={meshiHat}
                  hair={meshiHair}
                  accessory={isFullscreenVideo || isSearching || contentInsightVisible ? "glasses" : meshiAccessory}
                  eyeStyle={meshiEye}
                  badge={meshiBadge}
                  outfit={meshiOutfit}
                  showGlow={view !== "closed" || isSearching || isFullscreenVideo || contentInsightVisible}
                  interactive
                  prop={activeHeldProp}
                  bouncy={isIdle}
                />
              </motion.div>
              </motion.div>

              {/* Aurora tap burst — particles flung radially from Meshi's center */}
              {tapBursts.length > 0 && (
                <span className="pointer-events-none absolute left-1/2 top-1/2 z-20" aria-hidden="true">
                  {tapBursts.map((burst) => (
                    <span key={burst.id} className="absolute left-0 top-0">
                      {burst.particles.map((particle) => (
                        <motion.span
                          key={particle.id}
                          className="absolute left-0 top-0 block"
                          initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
                          animate={{ x: particle.dx, y: particle.dy, scale: 1, opacity: 0 }}
                          transition={{
                            default: { type: "spring", stiffness: 340, damping: 20, mass: 0.5 },
                            opacity: { duration: 0.62, ease: "easeOut" },
                          }}
                        >
                          {particle.heart ? (
                            <span
                              className="block"
                              style={{
                                marginLeft: -particle.size / 2,
                                marginTop: -particle.size / 2,
                                fontSize: particle.size,
                                lineHeight: 1,
                                color: particle.color,
                              }}
                            >
                              ♥
                            </span>
                          ) : (
                            <span
                              className="block rounded-full"
                              style={{
                                width: particle.size,
                                height: particle.size,
                                marginLeft: -particle.size / 2,
                                marginTop: -particle.size / 2,
                                background: particle.color,
                                boxShadow: `0 0 8px ${particle.color}`,
                              }}
                            />
                          )}
                        </motion.span>
                      ))}
                    </span>
                  ))}
                </span>
              )}

              {/* Active ring when actions/speech open */}
              {view !== "closed" && view !== "chat" && (
                <motion.div className="absolute inset-0 rounded-full pointer-events-none"
                  style={{ border: "2px solid var(--accent)" }}
                  animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.2, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }} />
              )}

              {/* First-time pulse indicator — draws attention to Meshi for new users */}
              {isFirstTimeMeshi && view === "closed" && (
                <>
                  <motion.div
                    className="absolute -inset-2 rounded-full pointer-events-none"
                    style={{ border: "2px solid var(--accent)" }}
                    animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                  />
                  <motion.div
                    className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[8px] font-semibold text-white pointer-events-none shadow-lg"
                    style={{ background: "var(--accent)" }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    Tap
                  </motion.div>
                </>
              )}
            </motion.div>
          </motion.div>
      </AnimatePresence>
      )}

      {/* Actions Menu — hidden on mesh page */}
      <AnimatePresence>
        {view === "actions" && (
          <MeshiActionsMenu
            meshiColor={meshiColor}
            meshiHat={meshiHat}
            onClose={closeAll}
            onAskMeshi={() => setView("speech")}
            onSearchMesh={() => triggerSearch()}
            onOpenChat={() => setView("chat")}
          />
        )}
      </AnimatePresence>

      {/* Full Meshi Chat */}
      <MeshiChat
        isOpen={view === "chat"}
        onClose={closeAll}
        hat={meshiHat}
        color={meshiColor}
        hair={meshiHair}
        accessory={meshiAccessory}
        faceStyle={mood}
        meshData={meshStats}
        meshEntities={meshEntities}
        focusedContent={focusedContent || undefined}
      />
    </>
  );
}
