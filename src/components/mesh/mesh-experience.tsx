"use client";

import { AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  CircleHelp,
  Compass,
  Link2,
  LocateFixed,
  Loader2,
  MessageCircle,
  PenSquare,
  RefreshCw,
  Rss,
  Shield,
  UsersRound,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toggleReaction } from "@/lib/actions";
import { getPlatformActionCapability, normalizePlatformId } from "@/lib/platform-capabilities";
import { getPostPresenceKey } from "@/lib/presence-keys";
import { useToast } from "@/components/ui/toast";
import { ContentHub } from "./content-hub";
import { MeshCanvas } from "./mesh-canvas";
import {
  MeshActionBar,
  MeshFilterBar,
  MeshStatsBar,
  MeshZoomControls,
  type MeshPlatformFilterOption,
} from "./mesh-controls";
import { buildMeshData, applyViewMode, preloadNodeImages, type MeshApiResponse, type MeshViewMode } from "./mesh-data";
import { MeshEngine } from "./mesh-engine";
import { MeshCommandPalette } from "./mesh-command-palette";
import { MeshFootprint } from "./mesh-footprint";
import { MeshMiniMap } from "./mesh-mini-map";
import { MeshNodeDetail } from "./mesh-node-detail";
import { MeshPostComposer } from "./mesh-post-composer";
import { MeshPrivacyPanel } from "./mesh-privacy-panel";
import { MeshTutorial } from "./mesh-tutorial";
import { InAppBrowser } from "@/components/in-app-browser";
import { openMeshi } from "@/lib/meshi-events";
import type { MeshiAccessory, MeshiBadge, MeshiColor, MeshiEyeStyle, MeshiHair, MeshiHat, MeshiOutfit } from "@/components/meshi/meshi-mascot";
import type { RemoteMeshi } from "./meshi-on-mesh";
import { getPostNodeSize, type FilterType, type MeshEdge, type MeshNode, type MeshVisualSettings } from "./mesh-types";

type MeshStatus = "loading" | "ready" | "empty" | "error" | "unauthorized";

interface ViewportInfo {
  zoom: number;
  panX: number;
  panY: number;
  centerX: number;
  centerY: number;
  canvasWidth: number;
  canvasHeight: number;
}

interface PresenceResponse {
  presences?: Array<{
    userId: string;
    username: string;
    displayName: string;
    meshiColor: string;
    meshiHat: string;
    meshiHair?: string;
    meshiAccessory?: string;
    meshiEyeStyle?: string;
    meshiBadge?: string;
    meshiOutfit?: string;
    meshiMood: RemoteMeshi["mood"];
    position?: { x: number; y: number };
    viewportPosition?: { vx: number; vy: number };
    viewingMesh?: string;
    surface?: "mesh" | "feed";
    activePostId?: string | null;
    activeNodeId?: string | null;
    ghostMode?: boolean;
    isOnline: boolean;
  }>;
  summary?: {
    totalOnline: number;
    sameMeshOnline: number;
    connectedOnline: number;
  };
}

const STORAGE_KEYS = {
  hiddenNodes: "mesh:hidden-nodes",
  hiddenBranches: "mesh:hidden-branches",
  likedPosts: "mesh:liked-posts",
  viewMode: "mesh:view-mode",
};

function readStoredViewMode(): MeshViewMode {
  if (typeof window === "undefined") return "simplified";
  try {
    return window.localStorage.getItem(STORAGE_KEYS.viewMode) === "advanced" ? "advanced" : "simplified";
  } catch {
    return "simplified";
  }
}

const countTotalItems = (data: MeshApiResponse | null) => {
  if (!data) return 0;
  return (
    data.stats.followingCount +
    data.stats.followerCount +
    data.stats.communityCount +
    data.stats.postCount +
    data.stats.interestCount +
    data.stats.connectedPlatformCount +
    data.stats.alterEgoCount +
    (data.stats.activityCount || 0)
  );
};

function readStoredSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

function storeSet(key: string, value: Set<string>) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify([...value])); } catch { /* storage unavailable */ }
}

function cloneNodes(nodes: MeshNode[]) {
  return nodes.map((node) => ({ ...node, connections: [...node.connections] }));
}

function cloneEdges(edges: MeshEdge[]) {
  return edges.map((edge) => ({ ...edge }));
}

function buildPlatformButtons(data: MeshApiResponse | null) {
  if (!data) return [];
  return data.connectedAccounts.map((account) => ({
    id: account.id,
    label: account.platform,
    color: account.platform?.toLowerCase() === "youtube" ? "#ef4444" : "#60a5fa",
  }));
}

function buildConnectedPlatformAccounts(data: MeshApiResponse | null) {
  if (!data) return [];
  return data.connectedAccounts.map((account) => ({
    id: account.id,
    platform: account.platform,
  }));
}

function getPlatformKey(value?: string | null) {
  return normalizePlatformId(value) || value?.trim().toLowerCase() || "";
}

function nodeMatchesPlatform(node: MeshNode, platformOption: MeshPlatformFilterOption | null) {
  if (!platformOption || node.type === "self") return true;
  if (node.connectedAccountId === platformOption.id) return true;
  const nodePlatform = getPlatformKey(node.platform);
  const selectedPlatform = getPlatformKey(platformOption.platform);
  return Boolean(nodePlatform && selectedPlatform && nodePlatform === selectedPlatform);
}

function buildPlatformFilterOptions(
  data: MeshApiResponse | null,
  nodes: MeshNode[],
): MeshPlatformFilterOption[] {
  if (!data) return [];
  return data.connectedAccounts
    .map((account) => {
      const platform = account.platform || "Platform";
      const platformKey = getPlatformKey(platform);
      const accountNodeCount = nodes.filter((node) => {
        if (node.type === "self") return false;
        if (node.connectedAccountId === account.id) return true;
        return Boolean(platformKey && getPlatformKey(node.platform) === platformKey);
      }).length;

      return {
        id: account.id,
        platform,
        label: account.platformUsername ? `${platform} @${account.platformUsername}` : platform,
        color: account.platform?.toLowerCase() === "youtube" ? "#ef4444" : "#60a5fa",
        count: accountNodeCount,
      };
    })
    .filter((option) => option.count > 0);
}

function nodeMatchesFilter(node: MeshNode, nextFilter: FilterType) {
  return nextFilter === "all" || node.type === nextFilter || node.type === "self";
}

function getMeshNodePresenceKey(node: MeshNode | null) {
  if (!node || node.type !== "post") return null;
  return getPostPresenceKey({
    id: node.id,
    platform: node.platform,
    sourceId: node.sourceId,
    sourceType: node.sourceType,
  });
}

function remotePresenceOffset(userId: string) {
  const hash = [...userId].reduce((total, char) => total + char.charCodeAt(0), 0);
  const angle = (hash % 360) * (Math.PI / 180);
  const distance = 34 + (hash % 18);
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
  };
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

export function MeshExperience({ viewUserId }: { viewUserId?: string } = {}) {
  const router = useRouter();
  const { addToast } = useToast();
  const engineRef = useRef<MeshEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new MeshEngine();
  }

  const imageCache = useRef<Map<string, HTMLImageElement | null>>(new Map());
  const centerRef = useRef({ x: 600, y: 380 });
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const lastMeshiPositionRef = useRef({ x: 600, y: 380, mood: "happy" });
  const lastViewportRef = useRef<ViewportInfo | null>(null);

  const [status, setStatus] = useState<MeshStatus>("loading");
  const [apiData, setApiData] = useState<MeshApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [viewMode, setViewMode] = useState<MeshViewMode>(() => readStoredViewMode());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<MeshNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<MeshNode | null>(null);
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(() => readStoredSet(STORAGE_KEYS.hiddenNodes));
  const [hiddenBranches, setHiddenBranches] = useState<Set<string>>(() => readStoredSet(STORAGE_KEYS.hiddenBranches));
  const [likedPosts, setLikedPosts] = useState<Set<string>>(() => readStoredSet(STORAGE_KEYS.likedPosts));
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSession, setSearchSession] = useState(0);
  const [showFootprint, setShowFootprint] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [showContentHub, setShowContentHub] = useState(false);
  const [ghostMode, setGhostMode] = useState(false);
  const [remoteMeshis, setRemoteMeshis] = useState<RemoteMeshi[]>([]);
  const [presenceSummary, setPresenceSummary] = useState<PresenceResponse["summary"] | null>(null);
  const [syncPulseTime, setSyncPulseTime] = useState<number | null>(null);
  const [inAppUrl, setInAppUrl] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const loadMesh = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setStatus("loading");
    setError(null);
    try {
      const meshUrl = viewUserId ? `/api/mesh?user=${encodeURIComponent(viewUserId)}` : "/api/mesh";
      const response = await fetch(meshUrl, {
        credentials: "same-origin",
        cache: "no-store",
      });

      if (response.status === 401) {
        setStatus("unauthorized");
        setApiData(null);
        return;
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Failed to load your Mesh.");
      }

      const meshPayload = payload as MeshApiResponse;
      setApiData(meshPayload);
      setStatus(countTotalItems(meshPayload) > 0 ? "ready" : "empty");
      setSyncPulseTime(performance.now());
    } catch (err) {
      if (!silent) setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to load your Mesh.");
    }
  }, [viewUserId]);

  useEffect(() => {
    loadMesh();
  }, [loadMesh]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!document.hidden) void loadMesh({ silent: true });
    }, 30000);

    return () => window.clearInterval(interval);
  }, [loadMesh]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlOverflowX = document.documentElement.style.overflowX;
    const previousHtmlOverflowY = document.documentElement.style.overflowY;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverflowX = document.body.style.overflowX;
    const previousBodyOverflowY = document.body.style.overflowY;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyLeft = document.body.style.left;
    const previousBodyRight = document.body.style.right;
    const previousBodyWidth = document.body.style.width;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousHtmlDataset = document.documentElement.dataset.meshLocked;
    document.documentElement.dataset.meshLocked = "true";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overflowX = "hidden";
    document.documentElement.style.overflowY = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.overflowX = "hidden";
    document.body.style.overflowY = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = "0";
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.overscrollBehavior = "none";
    return () => {
      if (previousHtmlDataset === undefined) {
        delete document.documentElement.dataset.meshLocked;
      } else {
        document.documentElement.dataset.meshLocked = previousHtmlDataset;
      }
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.overflowX = previousHtmlOverflowX;
      document.documentElement.style.overflowY = previousHtmlOverflowY;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overflowX = previousBodyOverflowX;
      document.body.style.overflowY = previousBodyOverflowY;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.left = previousBodyLeft;
      document.body.style.right = previousBodyRight;
      document.body.style.width = previousBodyWidth;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, []);

  useEffect(() => {
    storeSet(STORAGE_KEYS.hiddenNodes, hiddenNodes);
  }, [hiddenNodes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(STORAGE_KEYS.viewMode, viewMode); } catch { /* storage unavailable */ }
  }, [viewMode]);

  useEffect(() => {
    storeSet(STORAGE_KEYS.hiddenBranches, hiddenBranches);
  }, [hiddenBranches]);

  useEffect(() => {
    storeSet(STORAGE_KEYS.likedPosts, likedPosts);
  }, [likedPosts]);

  const { nodes: allNodes, edges: allEdges } = useMemo(() => {
    if (!apiData) return { nodes: [], edges: [] };
    return buildMeshData(apiData, centerRef.current.x, centerRef.current.y);
  }, [apiData]);

  const meshVisuals = useMemo<MeshVisualSettings>(() => {
    const cosmetics = apiData?.meshCosmetics ?? [];
    const valueFor = (type: string) => cosmetics.find((cosmetic) => cosmetic.type === type && cosmetic.isActive !== false)?.value;
    return {
      connectionColor: valueFor("connectionColor"),
      nodeStyle: valueFor("nodeStyle"),
      motionStyle: valueFor("motionStyle"),
    };
  }, [apiData?.meshCosmetics]);

  const modeVisibleNodes = useMemo(
    () => applyViewMode(allNodes, viewMode),
    [allNodes, viewMode],
  );

  const privacyVisibleNodes = useMemo(() => {
    if (hiddenNodes.size === 0 && hiddenBranches.size === 0) return modeVisibleNodes;
    return modeVisibleNodes.filter((node) => {
      if (node.type === "self") return true;
      if (hiddenNodes.has(node.id)) return false;
      return !hiddenBranches.has(node.type);
    });
  }, [modeVisibleNodes, hiddenBranches, hiddenNodes]);

  const platformOptions = useMemo(
    () => buildPlatformFilterOptions(apiData, privacyVisibleNodes),
    [apiData, privacyVisibleNodes],
  );

  const activePlatformOption = useMemo(
    () => platformOptions.find((option) => option.id === platformFilter) || null,
    [platformFilter, platformOptions],
  );

  const visibleNodes = useMemo(
    () => privacyVisibleNodes.filter((node) => nodeMatchesPlatform(node, activePlatformOption)),
    [activePlatformOption, privacyVisibleNodes],
  );

  const filteredVisibleNodes = useMemo(
    () => visibleNodes.filter((node) => nodeMatchesFilter(node, filter)),
    [filter, visibleNodes],
  );

  useEffect(() => {
    if (platformFilter && !platformOptions.some((option) => option.id === platformFilter)) {
      setPlatformFilter(null);
    }
  }, [platformFilter, platformOptions]);

  useEffect(() => {
    if (filter !== "all" && !modeVisibleNodes.some((node) => node.type === filter)) {
      setFilter("all");
    }
  }, [filter, modeVisibleNodes]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const visibleEdges = useMemo(
    () => allEdges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
    [allEdges, visibleNodeIds],
  );

  const nodesByPresenceKey = useMemo(() => {
    const map = new Map<string, MeshNode>();
    for (const node of visibleNodes) {
      const key = getMeshNodePresenceKey(node);
      if (key && !map.has(key)) map.set(key, node);
    }
    return map;
  }, [visibleNodes]);

  const activePresenceNode = selectedNode?.type === "post" ? selectedNode : hoveredNode?.type === "post" ? hoveredNode : null;
  const activePresencePostId = getMeshNodePresenceKey(activePresenceNode);

  useEffect(() => {
    const clonedNodes = cloneNodes(visibleNodes);
    const clonedEdges = cloneEdges(visibleEdges);
    engineRef.current?.setData(clonedNodes, clonedEdges);
    preloadNodeImages(clonedNodes, imageCache.current);
    setHoveredNode(null);
    setSelectedNode((current) => {
      if (!current) return null;
      return clonedNodes.find((node) => node.id === current.id) || null;
    });
  }, [visibleEdges, visibleNodes]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const connectedUserIds = useMemo(() => {
    if (!apiData) return [];
    const ids = new Set<string>();
    apiData.following.forEach((person) => ids.add(person.id));
    apiData.followers.forEach((person) => ids.add(person.id));
    return [...ids];
  }, [apiData]);

  const refreshPresence = useCallback(async () => {
    if (!apiData) return;
    try {
      const params = new URLSearchParams({
        meshOwner: apiData.user.id,
        connectedIds: connectedUserIds.join(","),
        surface: "mesh",
      });
      if (activePresencePostId) params.set("activePostId", activePresencePostId);
      const response = await fetch(`/api/mesh/presence?${params.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json().catch(() => ({}))) as PresenceResponse;
      setPresenceSummary(payload.summary || null);
      setRemoteMeshis(
        (payload.presences || []).map((presence) => {
          const isSameViewedMesh = presence.viewingMesh === apiData.user.id;
          const localActiveNode = presence.activePostId ? nodesByPresenceKey.get(presence.activePostId) : null;
          const offset = remotePresenceOffset(presence.userId);
          const x = isSameViewedMesh
            ? presence.position?.x ?? centerRef.current.x
            : localActiveNode
              ? localActiveNode.x + offset.x
              : presence.position?.x ?? centerRef.current.x;
          const y = isSameViewedMesh
            ? presence.position?.y ?? centerRef.current.y
            : localActiveNode
              ? localActiveNode.y + offset.y
              : presence.position?.y ?? centerRef.current.y;

          return {
            userId: presence.userId,
            username: presence.username,
            displayName: presence.displayName,
            x,
            y,
            color: presence.meshiColor || "blue",
            hat: presence.meshiHat || "none",
            hair: presence.meshiHair || "none",
            accessory: presence.meshiAccessory || "none",
            eyeStyle: presence.meshiEyeStyle || "regular",
            badge: presence.meshiBadge || "none",
            outfit: presence.meshiOutfit || "none",
            mood: presence.meshiMood || "happy",
            isOnline: presence.isOnline,
            surface: presence.surface || "mesh",
            activePostId: presence.activePostId || null,
            activeNodeId: presence.activeNodeId || null,
            viewingMesh: presence.viewingMesh || null,
            ghostMode: presence.ghostMode || false,
          };
        }),
      );
    } catch {
      // Presence is additive. The Mesh should remain usable if it is unavailable.
    }
  }, [activePresencePostId, apiData, connectedUserIds, nodesByPresenceKey]);

  const sendPresence = useCallback(async () => {
    if (!apiData) return;
    if (viewUserId) return;
    const lastViewport = lastViewportRef.current;
    const lastMeshi = lastMeshiPositionRef.current;
    const activity = selectedNode ? "exploring" : hoveredNode ? "traveling" : "idle";

    try {
      await fetch("/api/mesh/presence", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meshiColor: apiData.meshiPreference.colorTheme || "blue",
          meshiHat: apiData.meshiPreference.hatStyle || "none",
          meshiHair: apiData.meshiPreference.hairStyle || "none",
          meshiAccessory: apiData.meshiPreference.accessoryStyle || "none",
          meshiEyeStyle: apiData.meshiPreference.eyeStyle || "regular",
          meshiBadge: apiData.meshiPreference.badgeStyle || "none",
          meshiOutfit: apiData.meshiPreference.outfitStyle || "none",
          meshiMood: lastMeshi.mood,
          position: { x: lastMeshi.x, y: lastMeshi.y },
          viewportPosition: lastViewport
            ? {
                vx: Math.max(0, Math.min(1, (lastMeshi.x - lastViewport.centerX) / Math.max(1, lastViewport.canvasWidth) + 0.5)),
                vy: Math.max(0, Math.min(1, (lastMeshi.y - lastViewport.centerY) / Math.max(1, lastViewport.canvasHeight) + 0.5)),
              }
            : { vx: 0.5, vy: 0.5 },
          viewingMesh: apiData.user.id,
          surface: "mesh",
          activePostId: activePresencePostId,
          activeNodeId: activePresenceNode?.id || null,
          activeRoute: "/mesh",
          velocity: activity === "traveling" ? 1 : 0,
          activity,
          ghostMode,
        }),
      });
    } catch {
      // Presence is best-effort.
    }
  }, [activePresenceNode, activePresencePostId, apiData, ghostMode, hoveredNode, selectedNode, viewUserId]);

  useEffect(() => {
    if (!apiData) return;
    sendPresence();
    refreshPresence();
    const interval = window.setInterval(() => {
      sendPresence();
      refreshPresence();
    }, 2500);

    return () => {
      window.clearInterval(interval);
      fetch("/api/mesh/presence", {
        method: "DELETE",
        credentials: "same-origin",
        keepalive: true,
      }).catch(() => {});
    };
  }, [apiData, refreshPresence, sendPresence]);

  const handleMeshiPositionChange = useCallback((x: number, y: number, mood: string) => {
    lastMeshiPositionRef.current = { x, y, mood };
  }, []);

  const handleViewportInfoChange = useCallback((info: ViewportInfo) => {
    lastViewportRef.current = info;
    centerRef.current = { x: info.centerX, y: info.centerY };
  }, []);

  const handleZoomDelta = useCallback((delta: number) => {
    setZoom((current) => Math.max(0.2, Math.min(4, current + delta)));
  }, []);

  const fitViewToNodes = useCallback((nodesToFit: MeshNode[] = filteredVisibleNodes) => {
    const viewport = lastViewportRef.current;
    if (!viewport || nodesToFit.length === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      engineRef.current?.wake();
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodesToFit.forEach((node) => {
      const postSize = node.type === "post" ? getPostNodeSize(node) : null;
      const halfWidth = postSize ? postSize.width / 2 + 28 : Math.max(44, node.radius * 2);
      const halfHeight = postSize ? postSize.height / 2 + 28 : Math.max(44, node.radius * 2);
      minX = Math.min(minX, node.x - halfWidth);
      minY = Math.min(minY, node.y - halfHeight);
      maxX = Math.max(maxX, node.x + halfWidth);
      maxY = Math.max(maxY, node.y + halfHeight);
    });

    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);
    const padding = viewport.canvasWidth < 700 ? 70 : 120;
    const fitZoom = Math.max(
      0.28,
      Math.min(
        2.2,
        Math.min(
          Math.max(0.2, viewport.canvasWidth - padding * 2) / contentWidth,
          Math.max(0.2, viewport.canvasHeight - padding * 2) / contentHeight,
        ),
      ),
    );
    const focusX = minX + contentWidth / 2;
    const focusY = minY + contentHeight / 2;

    setZoom(fitZoom);
    setPan({
      x: -(focusX - viewport.centerX) * fitZoom,
      y: -(focusY - viewport.centerY) * fitZoom,
    });
    engineRef.current?.wake();
  }, [filteredVisibleNodes]);

  const resetView = useCallback(() => {
    setSelectedNode(null);
    fitViewToNodes(filteredVisibleNodes);
  }, [filteredVisibleNodes, fitViewToNodes]);

  const zoomToNode = useCallback((nodeId: string) => {
    const node = engineRef.current?.getNode(nodeId);
    if (!node) return;
    setZoom(1.45);
    setPan({
      x: -(node.x - centerRef.current.x) * 1.45,
      y: -(node.y - centerRef.current.y) * 1.45,
    });
    setSelectedNode(node);
  }, []);

  const focusNode = useCallback((node: MeshNode) => {
    zoomToNode(node.id);
    setHoveredNode(node);
  }, [zoomToNode]);

  const selectRelativeNode = useCallback((direction: 1 | -1) => {
    const selectableNodes = filteredVisibleNodes.filter((node) => node.type !== "self");
    if (selectableNodes.length === 0) return;

    const currentIndex = selectedNode
      ? selectableNodes.findIndex((node) => node.id === selectedNode.id)
      : -1;
    const nextIndex = currentIndex === -1
      ? direction === 1 ? 0 : selectableNodes.length - 1
      : (currentIndex + direction + selectableNodes.length) % selectableNodes.length;

    focusNode(selectableNodes[nextIndex]);
  }, [filteredVisibleNodes, focusNode, selectedNode]);

  const handleFilterChange = useCallback((nextFilter: FilterType) => {
    const nodesToFit = visibleNodes.filter((node) => nodeMatchesFilter(node, nextFilter));
    setFilter(nextFilter);
    setSelectedNode((current) => current && nodeMatchesFilter(current, nextFilter) ? current : null);
    fitViewToNodes(nodesToFit);
  }, [fitViewToNodes, visibleNodes]);

  const handlePlatformFilterChange = useCallback((nextPlatformId: string | null) => {
    const nextPlatformOption = platformOptions.find((option) => option.id === nextPlatformId) || null;
    const nodesToFit = privacyVisibleNodes
      .filter((node) => nodeMatchesPlatform(node, nextPlatformOption))
      .filter((node) => nodeMatchesFilter(node, filter));

    setPlatformFilter(nextPlatformId);
    setSelectedNode((current) => {
      if (!current) return null;
      return nodeMatchesPlatform(current, nextPlatformOption) && nodeMatchesFilter(current, filter)
        ? current
        : null;
    });
    fitViewToNodes(nodesToFit);
  }, [filter, fitViewToNodes, platformOptions, privacyVisibleNodes]);

  const openSearch = useCallback(() => {
    setSearchSession((current) => current + 1);
    setShowSearch(true);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchQuery("");
    setShowSearch(false);
  }, []);

  const handleNodeDoubleClick = useCallback((node: MeshNode | null) => {
    if (!node?.href) return;
    if (/^https?:\/\//i.test(node.href)) {
      setInAppUrl(node.href);
      return;
    }
    router.push(node.href);
  }, [router]);

  useEffect(() => {
    const onMeshShortcut = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSearch();
        setSelectedNode(null);
        setShowFootprint(false);
        setShowPrivacy(false);
        setShowContentHub(false);
        return;
      }

      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();

      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        openSearch();
        return;
      }

      if (key === "/" || key === "k") {
        event.preventDefault();
        openSearch();
      } else if (key === "f") {
        event.preventDefault();
        fitViewToNodes();
      } else if (key === "l") {
        event.preventDefault();
        setShowLabels((current) => !current);
      } else if (key === "s") {
        event.preventDefault();
        setShowStats((current) => !current);
      } else if (key === "p") {
        event.preventDefault();
        setShowPrivacy((current) => !current);
      } else if (key === "c") {
        event.preventDefault();
        setShowContentHub((current) => !current);
      } else if (key === "n") {
        event.preventDefault();
        setShowComposer(true);
      } else if (event.key === "?") {
        event.preventDefault();
        window.dispatchEvent(new Event("mesh:tutorial"));
      } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        selectRelativeNode(1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        selectRelativeNode(-1);
      } else if ((event.key === "Enter" || event.key === " ") && selectedNode) {
        event.preventDefault();
        handleNodeDoubleClick(selectedNode);
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        handleZoomDelta(0.18);
      } else if (event.key === "-") {
        event.preventDefault();
        handleZoomDelta(-0.18);
      } else if (event.key === "0") {
        event.preventDefault();
        resetView();
      }
    };

    window.addEventListener("keydown", onMeshShortcut);
    return () => window.removeEventListener("keydown", onMeshShortcut);
  }, [closeSearch, fitViewToNodes, handleNodeDoubleClick, handleZoomDelta, openSearch, resetView, selectRelativeNode, selectedNode]);

  const toggleNodeHidden = useCallback((nodeId: string) => {
    setHiddenNodes((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
    addToast("Mesh visibility updated.", "info");
  }, [addToast]);

  const toggleBranchHidden = useCallback((branchType: string) => {
    setHiddenBranches((current) => {
      const next = new Set(current);
      if (next.has(branchType)) next.delete(branchType);
      else next.add(branchType);
      return next;
    });
    addToast("Branch visibility updated.", "info");
  }, [addToast]);

  const showAllHidden = useCallback(() => {
    setHiddenNodes(new Set());
    setHiddenBranches(new Set());
    addToast("Everything is visible in your Mesh.", "success");
  }, [addToast]);

  const hideAllBranches = useCallback(() => {
    setHiddenBranches(new Set(["user", "alter-ego", "community", "tag", "post", "platform", "activity"]));
    setSelectedNode(null);
    setShowContentHub(false);
    addToast("Private Mesh view enabled.", "info");
  }, [addToast]);

  const handleToggleLike = useCallback(async (nodeId: string) => {
    const node = visibleNodes.find((item) => item.id === nodeId);
    if (!node || node.type !== "post") {
      addToast("Select a Mesh post before reacting.", "info");
      return;
    }

    const sourcePlatformId = normalizePlatformId(node.platform);
    const hasSourcePlatformConnected = node.sourceType !== "platform"
      || !sourcePlatformId
      || (apiData?.connectedAccounts || []).some((account) => normalizePlatformId(account.platform) === sourcePlatformId);

    if (!hasSourcePlatformConnected) {
      const params = new URLSearchParams({
        next: "/mesh",
        reason: likedPosts.has(nodeId) ? "unlike" : "like",
        platform: sourcePlatformId,
      });
      router.push(`/connected-accounts?${params.toString()}`);
      addToast(`Connect ${node.platform || "the source platform"} to react from Mesh.me.`, "info");
      return;
    }

    setActionLoading("like-" + nodeId);
    try {
      const action = likedPosts.has(nodeId) ? "unlike" : "like";
      if (node.sourceType === "platform") {
        if (!node.sourceId) {
          addToast("This platform post is missing its source record.", "error");
          return;
        }

        const capability = getPlatformActionCapability(node.platform, action);
        if (!capability.supported) {
          addToast(capability.reason, "info");
          return;
        }

        const response = await fetch("/api/platform-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ action, postId: node.sourceId }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.error) {
          addToast(result.error || "This platform did not accept the action.", "error");
          return;
        }
      } else {
        const postId = node.sourceId || node.id.replace("post-", "");
        const result = await toggleReaction(postId);
        if (result?.error) {
          addToast(result.error, "error");
          return;
        }
      }

      setLikedPosts((current) => {
        const next = new Set(current);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return next;
      });
      addToast(node.sourceType === "platform" ? "Reaction synced through the connected source account." : "Post reaction synced.", "success");
      if (node.sourceType === "platform") void loadMesh({ silent: true });
    } finally {
      setActionLoading(null);
    }
  }, [addToast, apiData?.connectedAccounts, likedPosts, loadMesh, router, visibleNodes]);

  const handleSyncAll = useCallback(async () => {
    if (isSyncingAll) return;
    setIsSyncingAll(true);
    try {
      const response = await fetch("/api/sync/auto", { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) {
        addToast(result.error || "Sync failed.", "error");
        return;
      }

      await loadMesh();
      const synced = typeof result.synced === "number" ? result.synced : 0;
      addToast(synced > 0 ? `${synced} connected platform${synced === 1 ? "" : "s"} synced.` : "All connected platforms are up to date.", "success");
    } finally {
      setIsSyncingAll(false);
    }
  }, [addToast, isSyncingAll, loadMesh]);

  const meshiColor = (apiData?.meshiPreference.colorTheme || "blue") as MeshiColor;
  const meshiHat = (apiData?.meshiPreference.hatStyle || "none") as MeshiHat;
  const hiddenCount = hiddenNodes.size + hiddenBranches.size;
  const engine = engineRef.current;
  const platformButtons = buildPlatformButtons(apiData);
  const connectedPlatformAccounts = buildConnectedPlatformAccounts(apiData);
  const liveCount = presenceSummary?.connectedOnline || remoteMeshis.filter((meshi) => meshi.isOnline).length;
  const hasLoadedData = status === "ready" || status === "empty";
  const selectedConnections = selectedNode
    ? visibleEdges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id).length
    : 0;
  const activePlatformLabel = activePlatformOption?.label || null;
  const activeBranchLabel = filter === "all"
    ? activePlatformLabel ? `${activePlatformLabel} branches` : "All branches"
    : `${activePlatformLabel ? `${activePlatformLabel} / ` : ""}${filter.replace("-", " ")} branch`;
  const dashboardActionClass = "mesh-dashboard-action group flex min-h-[4.15rem] min-w-0 flex-col justify-between rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)]/80 p-2.5 text-left backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--mesh-border-active)] hover:bg-[var(--mesh-panel-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mesh-blue)]/40 active:scale-[0.98] sm:p-3";
  const dashboardIconClass = "mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--mesh-blue)]/10 text-[var(--mesh-blue)] transition group-hover:scale-105";

  return (
    <section data-meshi-zone="mesh" className="mesh-experience mesh-experience-fullscreen flex h-full min-h-0 flex-col overflow-hidden" aria-labelledby="mesh-page-title">
      <div className="mesh-page-header mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--mesh-blue)]">
            <Waypoints className="h-3.5 w-3.5" />
            The Mesh
          </div>
          <h1 id="mesh-page-title" className="mt-1 text-xl font-bold text-[var(--mesh-text)] md:text-2xl">
            Your World
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {hasLoadedData && (
            <div className="hidden items-center gap-2 rounded-md border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)]/80 px-3 py-2 text-xs text-[var(--mesh-text-secondary)] sm:flex">
              <span className="mesh-live-dot" />
              {liveCount} live
            </div>
          )}
          {hasLoadedData && (
            <>
              <button
                type="button"
                onClick={() => fitViewToNodes()}
                className="mesh-choice hidden h-10 w-10 items-center justify-center rounded-md p-0 text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text)] sm:inline-flex"
                title="Fit the full Mesh into view"
                aria-label="Fit the full Mesh into view"
              >
                <LocateFixed className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("mesh:tutorial"))}
                className="mesh-choice inline-flex h-10 w-10 items-center justify-center rounded-md p-0 text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text)]"
                title="Open Mesh guide"
                aria-label="Open Mesh guide"
              >
                <CircleHelp className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => loadMesh()}
            className="mesh-choice inline-flex h-10 w-10 items-center justify-center rounded-md p-0 text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text)]"
            title="Refresh your Mesh"
            aria-label="Refresh your Mesh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {hasLoadedData && (
        <nav
          data-testid="mesh-dashboard-rail"
          className="mesh-dashboard-rail mesh-page-actions mb-3 grid grid-cols-4 gap-1.5 md:grid-cols-8"
          aria-label="Mesh dashboard actions"
        >
          <button
            type="button"
            onClick={() => setShowComposer(true)}
            className={dashboardActionClass}
            aria-label="Create a post from the Mesh dashboard"
          >
            <span className={dashboardIconClass}><PenSquare className="h-4 w-4" aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[var(--mesh-text)]">Create</span>
              <span className="hidden truncate text-[11px] font-semibold text-[var(--mesh-text-muted)] sm:block">Post anywhere</span>
            </span>
          </button>
          <Link href="/feed" className={dashboardActionClass} aria-label="Open the Feed from the Mesh dashboard">
            <span className={dashboardIconClass}><Rss className="h-4 w-4" aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[var(--mesh-text)]">Feed</span>
              <span className="hidden truncate text-[11px] font-semibold text-[var(--mesh-text-muted)] sm:block">Scroll</span>
            </span>
          </Link>
          <Link href="/messages" className={dashboardActionClass} aria-label="Open MeChat from the Mesh dashboard">
            <span className={dashboardIconClass}><MessageCircle className="h-4 w-4" aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[var(--mesh-text)]">MeChat</span>
              <span className="hidden truncate text-[11px] font-semibold text-[var(--mesh-text-muted)] sm:block">Messages</span>
            </span>
          </Link>
          <Link href="/notifications" className={dashboardActionClass} aria-label="Open notifications from the Mesh dashboard">
            <span className={dashboardIconClass}><Bell className="h-4 w-4" aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[var(--mesh-text)]">Alerts</span>
              <span className="hidden truncate text-[11px] font-semibold text-[var(--mesh-text-muted)] sm:block">Signals</span>
            </span>
          </Link>
          <Link href="/communities" className={dashboardActionClass} aria-label="Open communities from the Mesh dashboard">
            <span className={dashboardIconClass}><UsersRound className="h-4 w-4" aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[var(--mesh-text)]">Groups</span>
              <span className="hidden truncate text-[11px] font-semibold text-[var(--mesh-text-muted)] sm:block">Communities</span>
            </span>
          </Link>
          <Link href="/analytics" className={dashboardActionClass} aria-label="Open Analytics from the Mesh dashboard">
            <span className={dashboardIconClass}><BarChart3 className="h-4 w-4" aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[var(--mesh-text)]">Stats</span>
              <span className="hidden truncate text-[11px] font-semibold text-[var(--mesh-text-muted)] sm:block">Analytics</span>
            </span>
          </Link>
          <Link href="/connected-accounts" className={dashboardActionClass} aria-label="Open connected accounts from the Mesh dashboard">
            <span className={dashboardIconClass}><Link2 className="h-4 w-4" aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[var(--mesh-text)]">Connect</span>
              <span className="hidden truncate text-[11px] font-semibold text-[var(--mesh-text-muted)] sm:block">Platforms</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => openMeshi("speech")}
            className={dashboardActionClass}
            aria-label="Ask Meshi from the Mesh dashboard"
          >
            <span className={dashboardIconClass}><Bot className="h-4 w-4" aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[var(--mesh-text)]">Meshi</span>
              <span className="hidden truncate text-[11px] font-semibold text-[var(--mesh-text-muted)] sm:block">Ask</span>
            </span>
          </button>
        </nav>
      )}

      {hasLoadedData && (
        <div className="mesh-page-status mb-3 flex flex-wrap gap-2 text-xs text-[var(--mesh-text-secondary)] sm:overflow-x-auto sm:pb-1">
          <div className="flex items-center gap-2 rounded-md border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)]/60 px-3 py-1.5" aria-label={`${filteredVisibleNodes.length} visible nodes`}>
            <Waypoints className="h-3.5 w-3.5 text-[var(--mesh-blue)]" aria-hidden="true" />
            <span className="font-bold text-[var(--mesh-text)]">{filteredVisibleNodes.length}</span>
            <span>nodes</span>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)]/60 px-3 py-1.5" aria-label={`Showing ${activeBranchLabel}`}>
            <BarChart3 className="h-3.5 w-3.5 text-[var(--mesh-blue)]" aria-hidden="true" />
            <span className="truncate">{activeBranchLabel}</span>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)]/60 px-3 py-1.5" aria-label={hiddenCount > 0 ? `${hiddenCount} hidden Mesh items` : "Private by default"}>
            <Shield className="h-3.5 w-3.5 text-[var(--mesh-green)]" aria-hidden="true" />
            <span className="truncate">{hiddenCount > 0 ? `${hiddenCount} hidden` : "Private"}</span>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)]/60 px-3 py-1.5" aria-label={selectedNode ? `${selectedNode.label} has ${selectedConnections} links` : "Tap a node, drag to move, or press slash to search"}>
            <span className="truncate">
              {selectedNode ? `${selectedNode.label} · ${selectedConnections} links` : "Tap a node · Drag to move · / to search"}
            </span>
          </div>
        </div>
      )}

      <p id="mesh-canvas-instructions" className="sr-only">
        The Mesh is an interactive map of your people, posts, platforms, activity, interests, and groups. Drag to pan, scroll or pinch to zoom, use arrow keys to move between nodes, press Enter to open the selected node, press slash to search, F to fit the view, L for labels, S for stats, P for privacy, C for content, and Escape to close open panels.
      </p>
      <p id="mesh-selection-status" className="sr-only" aria-live="polite">
        {selectedNode ? `${selectedNode.label} selected. ${selectedConnections} connected links.` : `${filteredVisibleNodes.length} Mesh nodes visible. No node selected.`}
      </p>

      <div data-testid="mesh-canvas-shell" className="mesh-canvas-shell mesh-page-canvas relative min-h-0 flex-1 overflow-hidden rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-deep)]">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute inset-0 mesh-soft-grid" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(96,165,250,0.16),transparent_34%),radial-gradient(circle_at_78%_18%,rgba(34,197,94,0.12),transparent_24%),radial-gradient(circle_at_20%_80%,rgba(236,72,153,0.12),transparent_28%)]" />
        </div>

        {viewUserId && (
          <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between bg-[var(--mesh-bg-elevated)]/90 px-4 py-2 backdrop-blur-md border-b border-[var(--mesh-border)]">
            <span className="text-sm font-medium text-[var(--mesh-text-secondary)]">
              Visiting <span className="font-bold text-[var(--mesh-text)]">{apiData?.user.displayName || viewUserId}&apos;s</span> Mesh
            </span>
            <button
              onClick={() => router.push("/mesh")}
              className="rounded-lg bg-[var(--mesh-blue)] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[var(--mesh-blue)]/90"
            >
              Back to My Mesh
            </button>
          </div>
        )}

        {status === "loading" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--mesh-bg-deep)]/80 backdrop-blur-md">
            <div className="flex w-[min(92vw,28rem)] items-center gap-4 rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5">
              <Loader2 className="h-7 w-7 animate-spin text-[var(--mesh-blue)]" />
              <div>
                <p className="text-sm font-bold text-[var(--mesh-text)]">Building your Mesh</p>
                <p className="text-sm text-[var(--mesh-text-secondary)]">Posts, people, platforms, and Meshi are coming online.</p>
              </div>
            </div>
          </div>
        )}

        {status === "unauthorized" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--mesh-bg-deep)]/80 p-4 backdrop-blur-md">
            <div className="max-w-md rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-6 text-center">
              <Shield className="mx-auto h-8 w-8 text-[var(--mesh-blue)]" />
              <h2 className="mt-3 text-lg font-bold text-[var(--mesh-text)]">Sign in to use Mesh.me</h2>
              <p className="mt-2 text-sm text-[var(--mesh-text-secondary)]">
                The Mesh is private by default. Create an account or sign in before loading any personal data.
              </p>
              <Link href="/login" className="mt-5 inline-flex rounded-lg bg-[var(--mesh-blue)] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[var(--mesh-blue)]/90">
                Sign in
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--mesh-bg-deep)]/80 p-4 backdrop-blur-md">
            <div className="max-w-md rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-6 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-amber-400" />
              <h2 className="mt-3 text-lg font-bold text-[var(--mesh-text)]">The Mesh could not load</h2>
              <p className="mt-2 text-sm text-[var(--mesh-text-secondary)]">{error || "Try again in a moment."}</p>
              <button onClick={() => loadMesh()} className="mt-5 inline-flex rounded-lg bg-[var(--mesh-blue)] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[var(--mesh-blue)]/90">
                Try again
              </button>
            </div>
          </div>
        )}

        {status === "empty" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--mesh-bg-deep)]/70 p-4 backdrop-blur-sm">
            <div className="max-w-lg rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-6 text-center">
              <Compass className="mx-auto h-9 w-9 text-[var(--mesh-blue)]" />
              <h2 className="mt-3 text-xl font-bold text-[var(--mesh-text)]">Your Mesh is ready</h2>
              <p className="mt-2 text-sm text-[var(--mesh-text-secondary)]">
                Add a post, follow people, join a group, or connect a platform. Every action becomes a node in your private digital world.
              </p>
              <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                <Link href="/feed?compose=true" className="rounded-lg bg-[var(--mesh-blue)] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[var(--mesh-blue)]/90">
                  Create first post
                </Link>
                <Link href="/connected-accounts" className="rounded-lg border border-[var(--mesh-border)] px-5 py-2.5 text-sm font-bold text-[var(--mesh-text)] transition-colors hover:bg-[var(--mesh-panel-hover)]">
                  Connect accounts
                </Link>
              </div>
            </div>
          </div>
        )}

        {engine && (
          <MeshCanvas
            engine={engine}
            filter={filter}
            showLabels={showLabels}
            zoom={zoom}
            pan={pan}
            hoveredNode={hoveredNode}
            selectedNode={selectedNode}
            imageCache={imageCache}
            loading={status === "loading" || !apiData}
            meshiColor={apiData?.meshiPreference.colorTheme || "blue"}
            meshiHat={apiData?.meshiPreference.hatStyle || "none"}
            meshiHair={apiData?.meshiPreference.hairStyle || "none"}
            meshiAccessory={apiData?.meshiPreference.accessoryStyle || "none"}
            meshiEyeStyle={apiData?.meshiPreference.eyeStyle || "regular"}
            meshiBadge={apiData?.meshiPreference.badgeStyle || "none"}
            meshiOutfit={apiData?.meshiPreference.outfitStyle || "none"}
            meshiUsername={apiData?.user.username || "You"}
            meshVisuals={meshVisuals}
            remoteMeshis={remoteMeshis}
            syncPulseTime={syncPulseTime}
            onMeshiPositionChange={handleMeshiPositionChange}
            onViewportInfoChange={handleViewportInfoChange}
            onZoomChange={setZoom}
            onPanChange={setPan}
            onHoverChange={setHoveredNode}
            onClick={setSelectedNode}
            onDoubleClick={handleNodeDoubleClick}
          />
        )}

        {hasLoadedData && (
          <>
            <MeshFilterBar
              className="top-0 md:top-[5rem]"
              filter={filter}
              nodes={visibleNodes}
              platformOptions={platformOptions}
              platformFilter={platformFilter}
              onFilterChange={handleFilterChange}
              onPlatformFilterChange={handlePlatformFilterChange}
              onSearchOpen={openSearch}
              showFootprint={showFootprint}
              onToggleFootprint={() => setShowFootprint((current) => !current)}
            />
            <MeshZoomControls
              showLabels={showLabels}
              showStats={showStats}
              advancedView={viewMode === "advanced"}
              onZoom={handleZoomDelta}
              onReset={resetView}
              onToggleLabels={() => setShowLabels((current) => !current)}
              onToggleStats={() => setShowStats((current) => !current)}
              onToggleView={() => setViewMode((current) => (current === "advanced" ? "simplified" : "advanced"))}
            />
            <MeshStatsBar nodes={visibleNodes} zoom={zoom} visible={showStats} />
            <MeshActionBar
              showContentHub={showContentHub}
              showNodePrivacy={showPrivacy}
              ghostMode={ghostMode}
              hiddenCount={hiddenCount}
              isSyncingAll={isSyncingAll}
              onCreatePost={() => setShowComposer(true)}
              onConnectAccounts={() => router.push("/connected-accounts")}
              onSyncAll={handleSyncAll}
              onToggleContentHub={() => setShowContentHub((current) => !current)}
              onTogglePrivacy={() => setShowPrivacy((current) => !current)}
              onToggleGhostMode={() => setGhostMode((current) => !current)}
            />
            <MeshMiniMap
              nodes={visibleNodes}
              filter={filter}
              selectedNode={selectedNode}
              hoveredNode={hoveredNode}
              onFocusNode={focusNode}
              onFitView={() => fitViewToNodes()}
            />
          </>
        )}

        <AnimatePresence>
          {selectedNode && (
            <MeshNodeDetail
              key={`node-detail-${selectedNode.id}`}
              node={selectedNode}
              nodes={visibleNodes}
              edges={visibleEdges}
              hiddenNodes={hiddenNodes}
              hiddenBranches={hiddenBranches}
              likedPosts={likedPosts}
              actionLoading={actionLoading}
              connectedAccounts={connectedPlatformAccounts}
              onClose={() => setSelectedNode(null)}
              onToggleNodeHidden={toggleNodeHidden}
              onToggleBranchHidden={toggleBranchHidden}
              onToggleLike={handleToggleLike}
              onSetActionLoading={setActionLoading}
              onZoomToNode={zoomToNode}
              onRefreshMesh={loadMesh}
              onOpenNode={handleNodeDoubleClick}
            />
          )}

          {showSearch && (
            <MeshCommandPalette
              key={`mesh-command-palette-${searchSession}`}
              nodes={visibleNodes}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onClose={closeSearch}
              onSelectNode={setSelectedNode}
              onShowFootprint={() => setShowFootprint(true)}
              centerRef={centerRef}
              zoomRef={zoomRef}
              panRef={panRef}
              onPanChange={setPan}
            />
          )}

          {showFootprint && apiData && (
            <MeshFootprint
              key="mesh-footprint"
              meshStats={apiData.stats}
              meshiColor={meshiColor}
              meshiHat={meshiHat}
              meshiHair={(apiData?.meshiPreference.hairStyle || "none") as MeshiHair}
              meshiAccessory={(apiData?.meshiPreference.accessoryStyle || "none") as MeshiAccessory}
              meshiEyeStyle={(apiData?.meshiPreference.eyeStyle || "regular") as MeshiEyeStyle}
              meshiBadge={(apiData?.meshiPreference.badgeStyle || "none") as MeshiBadge}
              meshiOutfit={(apiData?.meshiPreference.outfitStyle || "none") as MeshiOutfit}
              onClose={() => setShowFootprint(false)}
            />
          )}

          {showPrivacy && (
            <MeshPrivacyPanel
              key="mesh-privacy-panel"
              hiddenNodes={hiddenNodes}
              hiddenBranches={hiddenBranches}
              onToggleBranchHidden={toggleBranchHidden}
              onHideAllBranches={hideAllBranches}
              onShowAll={showAllHidden}
              onClose={() => setShowPrivacy(false)}
            />
          )}

          {showComposer && (
            <MeshPostComposer
              key="mesh-post-composer"
              connectedPlatforms={platformButtons}
              onClose={() => setShowComposer(false)}
            />
          )}
        </AnimatePresence>

        <ContentHub
          isOpen={showContentHub}
          onClose={() => setShowContentHub(false)}
          onDeleteSuccess={loadMesh}
        />

        <InAppBrowser
          isOpen={Boolean(inAppUrl)}
          url={inAppUrl}
          title="Mesh content"
          onClose={() => setInAppUrl(null)}
        />
      </div>

      {hasLoadedData && <MeshTutorial />}
    </section>
  );
}
