"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Users,
  Hash,
  Globe,
  MessageCircle,
  X,
  ChevronRight,
  FileText,
  Heart,
  Link2,
  Sparkles,
  RotateCcw,
  Eye,
  EyeOff,
  Info,
  Layers,
  UserPlus,
  UserMinus,
  Send,
  Trash2,
  Shield,
  Lock,
  Fingerprint,
  ExternalLink,
  PenSquare,
  Search,
  EyeOff as HideIcon,
  Share2,
  ThumbsUp,
  MessageSquare,
  Plus,
  Home,
  Gamepad2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toggleFollow, deletePost } from "@/lib/actions";
import { MeshiChat } from "@/components/meshi/meshi-chat";
import { MeshiMascot, MeshiLogo } from "@/components/meshi/meshi-mascot";

// --- Types ---

interface MeshNode {
  id: string;
  type: "self" | "user" | "community" | "tag" | "post" | "platform" | "alter-ego";
  label: string;
  sublabel?: string;
  avatarUrl?: string | null;
  href?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  opacity: number;
  pulsePhase: number;
  connections: string[];
  isMutual?: boolean;
  followerCount?: number;
  postCount?: number;
  memberCount?: number;
  likeCount?: number;
  commentCount?: number;
  content?: string;
  sharedInterests?: string[];
  category?: string;
  platform?: string;
  imageUrl?: string | null;
  interactionCount?: number;
  status?: "online" | "dnd" | "busy" | "offline";
}

interface MeshEdge {
  source: string;
  target: string;
  strength: number;
  type: "follow" | "mutual" | "community" | "interest" | "post" | "platform" | "alter-ego";
  interactionCount?: number;
  status?: "online" | "dnd" | "busy" | "offline";
}

// --- Constants ---

// Vibrant, colorful node palette for a satisfying visual experience
const NODE_COLORS: Record<string, string> = {
  self: "#3b82f6",
  user: "#60a5fa",
  mutual: "#818cf8",
  community: "#f472b6",
  tag: "#22d3ee",
  post: "#34d399",
  platform: "#fbbf24",
  "alter-ego": "#a78bfa",
};

const NODE_GLOW: Record<string, string> = {
  self: "rgba(59, 130, 246, 0.25)",
  user: "rgba(96, 165, 250, 0.15)",
  mutual: "rgba(129, 140, 248, 0.18)",
  community: "rgba(244, 114, 182, 0.15)",
  tag: "rgba(34, 211, 238, 0.15)",
  post: "rgba(52, 211, 153, 0.12)",
  platform: "rgba(251, 191, 36, 0.15)",
  "alter-ego": "rgba(167, 139, 250, 0.2)",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E4405F",
  youtube: "#FF0000",
  tiktok: "#69C9D0",
  twitter: "#1DA1F2",
  twitch: "#9146FF",
  spotify: "#1DB954",
  soundcloud: "#FF5500",
  linkedin: "#0A66C2",
  github: "#8B5CF6",
  discord: "#5865F2",
  snapchat: "#FFFC00",
  pinterest: "#E60023",
  reddit: "#FF4500",
  facebook: "#1877F2",
  threads: "#ffffff",
  bluesky: "#0085FF",
};



// Status indicator colors (Feature #1: Online/DND/Busy/Offline)
const STATUS_COLORS: Record<string, string> = {
  online: "#22c55e",
  dnd: "#ef4444",
  busy: "#f59e0b",
  offline: "#6b7280",
};
type FilterType = "all" | "user" | "community" | "tag" | "post" | "platform" | "alter-ego";

// --- Helpers ---

function hexAlpha(opacity: number): string {
  const clamped = Math.max(0, Math.min(1, opacity));
  return Math.round(clamped * 255).toString(16).padStart(2, "0");
}

// --- Component ---

export default function MeshPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  // Image cache for profile pics and post thumbnails
  const imageCache = useRef<Map<string, HTMLImageElement | null>>(new Map());
  const [nodes, setNodes] = useState<MeshNode[]>([]);
  const [edges, setEdges] = useState<MeshEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<MeshNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<MeshNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFootprint, setShowFootprint] = useState(false);
  const [meshStats, setMeshStats] = useState<{
    followingCount: number; followerCount: number; mutualCount: number;
    communityCount: number; postCount: number; interestCount: number;
    connectedPlatformCount: number;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");
  const [showMeshiChat, setShowMeshiChat] = useState(false);
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set());
  const [hiddenBranches, setHiddenBranches] = useState<Set<string>>(new Set());
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [crossPostPlatforms, setCrossPostPlatforms] = useState<Set<string>>(new Set());
  const [showNodePrivacy, setShowNodePrivacy] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const router = useRouter();

  // --- Meshi roaming state ---
  // Meshi is NOT a node — it's a living entity that roams the mesh
  const meshiRef = useRef<{
    x: number; y: number;
    targetX: number; targetY: number;
    currentTargetNodeId: string | null;
    speed: number;
    idleTimer: number;
    state: "launching" | "roaming" | "idle" | "delivering" | "returning";
    // Launch animation (Meshi jumps from house into mesh)
    launchProgress: number; // 0-1 arc progress
    launchFrom: { x: number; y: number };
    launchTo: { x: number; y: number };
    // Delivery animation
    envelopeProgress: number; // 0-1 progress along delivery path
    deliveryFrom: { x: number; y: number } | null;
    deliveryTo: { x: number; y: number } | null;
    hasEnvelope: boolean;
    bobPhase: number;
    glowPulse: number;
  }>({
    x: -999, y: -999, targetX: 0, targetY: 0,
    currentTargetNodeId: null, speed: 1.2,
    idleTimer: 0, state: "launching",
    launchProgress: 0,
    launchFrom: { x: 0, y: 0 },
    launchTo: { x: 0, y: 0 },
    envelopeProgress: 0,
    deliveryFrom: null, deliveryTo: null,
    hasEnvelope: false,
    bobPhase: 0, glowPulse: 0,
  });
  const [meshiDeliveries, setMeshiDeliveries] = useState<Array<{
    id: string; fromNodeId: string; toNodeId: string; timestamp: number;
  }>>([]);

  // === Feature: Meshi House (clickable home, lock option) ===
  const [meshiHouseLocked, setMeshiHouseLocked] = useState(false);
  const [showMeshiHouseMenu, setShowMeshiHouseMenu] = useState(false);
  
  // === Feature: Meshi Exploration (magnifying glass animation) ===
  const [meshiExploring, setMeshiExploring] = useState(false);
  const [meshiExploreTarget, setMeshiExploreTarget] = useState<string | null>(null);
  const [meshiDiscoveries, setMeshiDiscoveries] = useState<Array<{ nodeId: string; summary: string; timestamp: number }>>([]);
  
  // === Feature: Meshi-to-Meshi interactions ===
  const [showRpsGame, setShowRpsGame] = useState(false);
  const [rpsChoice, setRpsChoice] = useState<"rock" | "paper" | "scissors" | null>(null);
  const [rpsResult, setRpsResult] = useState<{ playerChoice: string; meshiChoice: string; result: "win" | "lose" | "draw" } | null>(null);
  
  // === Feature: Profile preview on node click ===
  const [profilePreview, setProfilePreview] = useState<MeshNode | null>(null);
  
  // === Meshi custom color from user preferences ===
  const meshiColorRef = useRef<{ primary: string; glow: string }>({ primary: "#818cf8", glow: "rgba(99, 102, 241, 0.3)" });

  // Load Meshi house lock state from localStorage
  useEffect(() => {
    try {
      const locked = localStorage.getItem("meshiHouseLocked");
      if (locked === "true") setMeshiHouseLocked(true);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem("meshiHouseLocked", meshiHouseLocked ? "true" : "false");
  }, [meshiHouseLocked]);

  // Load hidden nodes from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("meshHiddenNodes");
      if (saved) setHiddenNodes(new Set(JSON.parse(saved)));
      const savedBranches = localStorage.getItem("meshHiddenBranches");
      if (savedBranches) setHiddenBranches(new Set(JSON.parse(savedBranches)));
    } catch { /* ignore */ }
  }, []);

  // Persist hidden nodes
  useEffect(() => {
    if (hiddenNodes.size > 0) localStorage.setItem("meshHiddenNodes", JSON.stringify([...hiddenNodes]));
    else localStorage.removeItem("meshHiddenNodes");
  }, [hiddenNodes]);

  useEffect(() => {
    if (hiddenBranches.size > 0) localStorage.setItem("meshHiddenBranches", JSON.stringify([...hiddenBranches]));
    else localStorage.removeItem("meshHiddenBranches");
  }, [hiddenBranches]);

  const toggleNodeHidden = (nodeId: string) => {
    setHiddenNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const toggleBranchHidden = (branchType: string) => {
    setHiddenBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branchType)) next.delete(branchType);
      else next.add(branchType);
      return next;
    });
  };

  const toggleLike = (postId: string) => {
    setLikedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  // Get visible nodes (respecting privacy/hidden settings)
  const visibleNodes = nodes.filter((n) => {
    if (n.type === "self" || n.type === "alter-ego") return true;
    if (hiddenNodes.has(n.id)) return false;
    if (hiddenBranches.has(n.type)) return false;
    return true;
  });

  // Refs for animation loop (avoid stale closures)
  const nodesRef = useRef<MeshNode[]>([]);
  const edgesRef = useRef<MeshEdge[]>([]);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const filterRef = useRef<FilterType>("all");
  const showLabelsRef = useRef(true);
  const hoveredNodeRef = useRef<MeshNode | null>(null);
  const selectedNodeRef = useRef<MeshNode | null>(null);
  const timeRef = useRef(0);
  const centerRef = useRef({ x: 600, y: 400 });
  const dragActiveRef = useRef(false);

  useEffect(() => { filterRef.current = filter; }, [filter]);
  useEffect(() => { showLabelsRef.current = showLabels; }, [showLabels]);
  useEffect(() => { hoveredNodeRef.current = hoveredNode; }, [hoveredNode]);
  useEffect(() => { selectedNodeRef.current = selectedNode; }, [selectedNode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K for command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
        return;
      }
      // Escape to deselect / close panels
      if (e.key === "Escape") {
        if (selectedNodeRef.current) {
          setSelectedNode(null);
        } else if (showCommandPalette) {
          setShowCommandPalette(false);
        }
        return;
      }
      // Don't handle shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // R to reset view
      if (e.key === "r" || e.key === "R") {
        setZoom(1);
        setPan({ x: 0, y: 0 });
        zoomRef.current = 1;
        panRef.current = { x: 0, y: 0 };
        setSelectedNode(null);
        return;
      }
      // L to toggle labels
      if (e.key === "l" || e.key === "L") {
        setShowLabels((prev) => !prev);
        return;
      }
      // S to toggle stats
      if (e.key === "s" || e.key === "S") {
        setShowStats((prev) => !prev);
        return;
      }
      // F to toggle footprint
      if (e.key === "f" || e.key === "F") {
        setShowFootprint((prev) => !prev);
        return;
      }
      // +/= to zoom in, - to zoom out
      if (e.key === "+" || e.key === "=") {
        const newZoom = Math.min(4, zoomRef.current + 0.3);
        setZoom(newZoom);
        zoomRef.current = newZoom;
        return;
      }
      if (e.key === "-") {
        const newZoom = Math.max(0.2, zoomRef.current - 0.3);
        setZoom(newZoom);
        zoomRef.current = newZoom;
        return;
      }
      // 1-7 for filter shortcuts
      const filterKeys: Record<string, FilterType> = { "1": "all", "2": "user", "3": "alter-ego", "4": "community", "5": "tag", "6": "post", "7": "platform" };
      if (filterKeys[e.key]) {
        setFilter(filterKeys[e.key]);
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCommandPalette]);

  // --- Load mesh data ---

  useEffect(() => {
    async function loadMeshData() {
      try {
        const res = await fetch("/api/mesh");
        if (!res.ok) throw new Error("Failed to load mesh data");
        const data = await res.json();

        const cx = centerRef.current.x || 600, cy = centerRef.current.y || 400;
        const meshNodes: MeshNode[] = [];
        const meshEdges: MeshEdge[] = [];

        // Self node at center
        meshNodes.push({
          id: data.user.id, type: "self", label: data.user.displayName,
          sublabel: "@" + data.user.username, avatarUrl: data.user.avatarUrl,
          href: "/profile/" + data.user.username,
          x: cx, y: cy, vx: 0, vy: 0, radius: 35, color: NODE_COLORS.self,
          opacity: 1, pulsePhase: 0, connections: [],
          content: data.user.bio || undefined,
        });

        // Following nodes — with interaction-based proximity
        const followingCount = data.following?.length || 0;
        // Apply user's Meshi color preference to canvas rendering
        const meshiPref = data.meshiPreference;
        if (meshiPref?.colorTheme) {
          const colorMap: Record<string, { primary: string; glow: string }> = {
            blue: { primary: "#3b82f6", glow: "rgba(59, 130, 246, 0.3)" },
            purple: { primary: "#8b5cf6", glow: "rgba(139, 92, 246, 0.3)" },
            pink: { primary: "#ec4899", glow: "rgba(236, 72, 153, 0.3)" },
            green: { primary: "#22c55e", glow: "rgba(34, 197, 94, 0.3)" },
            orange: { primary: "#f97316", glow: "rgba(249, 115, 22, 0.3)" },
            cyan: { primary: "#06b6d4", glow: "rgba(6, 182, 212, 0.3)" },
            gold: { primary: "#eab308", glow: "rgba(234, 179, 8, 0.3)" },
            rainbow: { primary: "#ec4899", glow: "rgba(236, 72, 153, 0.3)" },
          };
          const theme = colorMap[meshiPref.colorTheme] || colorMap.blue;
          meshiColorRef.current = theme;
        }

        (data.following || []).forEach((f: {
          id: string; username: string; displayName: string; avatarUrl: string | null;
          isMutual: boolean; sharedCommunities: string[]; sharedInterests: string[];
          followerCount: number; postCount: number; interactionCount?: number;
          status?: string;
        }, i: number) => {
          const angle = (i / Math.max(followingCount, 1)) * Math.PI * 2;
          // Interaction-based proximity: more interactions = closer to self node
          const interactions = f.interactionCount || 0;
          const proximityFactor = 1 / (1 + interactions * 0.15);
          const baseDist = 160 + Math.random() * 60;
          const dist = baseDist * proximityFactor;
          const isMutual = f.isMutual;
          meshNodes.push({
            id: f.id, type: "user", label: f.displayName,
            sublabel: "@" + f.username,
            avatarUrl: f.avatarUrl, href: "/profile/" + f.username,
            x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
            vx: 0, vy: 0, radius: isMutual ? 20 : 16,
            color: isMutual ? NODE_COLORS.mutual : NODE_COLORS.user,
            opacity: 1, pulsePhase: Math.random() * Math.PI * 2,
            connections: [data.user.id],
            isMutual, followerCount: f.followerCount, postCount: f.postCount,
            sharedInterests: f.sharedInterests,
            status: (f.status as MeshNode["status"]) || undefined,
          });
          meshEdges.push({
            source: data.user.id, target: f.id,
            strength: isMutual ? 1.0 : 0.7,
            type: isMutual ? "mutual" : "follow",
          });
          (f.sharedCommunities || []).forEach((cId: string) => {
            meshEdges.push({
              source: f.id, target: "community-" + cId,
              strength: 0.4, type: "community",
            });
          });
        });

        // Follower-only nodes — with interaction-based proximity
        const followingIds = new Set((data.following || []).map((f: { id: string }) => f.id));
        (data.followers || []).forEach((f: {
          id: string; username: string; displayName: string; avatarUrl: string | null;
          isMutual: boolean; followerCount: number; postCount: number; interactionCount?: number;
          status?: string;
        }, i: number) => {
          if (followingIds.has(f.id)) return;
          const angle = (i / Math.max(data.followers.length, 1)) * Math.PI * 2 + 0.5;
          const interactions = f.interactionCount || 0;
          const proximityFactor = 1 / (1 + interactions * 0.15);
          const dist = (230 + Math.random() * 80) * proximityFactor;
          meshNodes.push({
            id: "follower-" + f.id, type: "user", label: f.displayName,
            sublabel: "@" + f.username,
            avatarUrl: f.avatarUrl, href: "/profile/" + f.username,
            x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
            vx: 0, vy: 0, radius: 12, color: NODE_COLORS.user,
            opacity: 0.7, pulsePhase: Math.random() * Math.PI * 2,
            connections: [data.user.id],
            followerCount: f.followerCount, postCount: f.postCount,
            status: (f.status as MeshNode["status"]) || undefined,
          });
          meshEdges.push({
            source: data.user.id, target: "follower-" + f.id,
            strength: 0.3, type: "follow",
          });
        });

        // Community nodes
        (data.communities || []).forEach((c: {
          id: string; name: string; slug: string; description: string | null;
          category: string | null; memberCount: number; postCount: number;
        }, i: number) => {
          const angle = (i / Math.max(data.communities.length, 1)) * Math.PI * 2 + 1;
          const dist = 280 + Math.random() * 50;
          meshNodes.push({
            id: "community-" + c.id, type: "community", label: c.name,
            sublabel: c.memberCount + " members",
            href: "/communities/" + c.slug,
            x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
            vx: 0, vy: 0, radius: 24, color: NODE_COLORS.community,
            opacity: 1, pulsePhase: Math.random() * Math.PI * 2,
            connections: [data.user.id],
            memberCount: c.memberCount, content: c.description || undefined,
            category: c.category || undefined,
          });
          meshEdges.push({
            source: data.user.id, target: "community-" + c.id,
            strength: 0.6, type: "community",
          });
        });

        // Interest / tag nodes
        (data.interests || []).forEach((tag: string, i: number) => {
          const angle = (i / Math.max(data.interests.length, 1)) * Math.PI * 2 + 2;
          const dist = 340 + Math.random() * 60;
          meshNodes.push({
            id: "tag-" + tag, type: "tag", label: "#" + tag,
            href: "/search?q=" + encodeURIComponent(tag),
            x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
            vx: 0, vy: 0, radius: 12, color: NODE_COLORS.tag,
            opacity: 0.85, pulsePhase: Math.random() * Math.PI * 2,
            connections: [data.user.id],
          });
          meshEdges.push({
            source: data.user.id, target: "tag-" + tag,
            strength: 0.25, type: "interest",
          });
        });

        // Post nodes
        (data.posts || []).forEach((p: {
          id: string; content: string; communityId: string | null;
          tags: string[]; likeCount: number; commentCount: number;
        }, i: number) => {
          const angle = (i / Math.max(data.posts.length, 1)) * Math.PI * 2 + 3;
          const dist = 200 + Math.random() * 100;
          const engagement = p.likeCount + p.commentCount;
          meshNodes.push({
            id: "post-" + p.id, type: "post",
            label: p.content.length > 30 ? p.content.slice(0, 30) + "..." : p.content,
            sublabel: p.likeCount + " likes \u00b7 " + p.commentCount + " comments",
            x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
            vx: 0, vy: 0, radius: 8 + Math.min(engagement, 10),
            color: NODE_COLORS.post,
            opacity: 0.8, pulsePhase: Math.random() * Math.PI * 2,
            connections: [data.user.id],
            likeCount: p.likeCount, commentCount: p.commentCount,
            content: p.content,
          });
          meshEdges.push({
            source: data.user.id, target: "post-" + p.id,
            strength: 0.15, type: "post",
          });
          if (p.communityId) {
            meshEdges.push({
              source: "post-" + p.id, target: "community-" + p.communityId,
              strength: 0.3, type: "community",
            });
          }
          (p.tags || []).forEach((ptag: string) => {
            meshEdges.push({
              source: "post-" + p.id, target: "tag-" + ptag,
              strength: 0.2, type: "interest",
            });
          });
        });

        // Alter ego nodes — separate personas positioned near the self node
        (data.alterEgos || []).forEach((ego: {
          id: string; username: string; displayName: string; bio: string | null; avatarUrl: string | null;
        }, i: number) => {
          const angle = (i / Math.max(data.alterEgos?.length || 1, 1)) * Math.PI * 2 - Math.PI / 2;
          const dist = 90 + i * 30;
          meshNodes.push({
            id: "alter-ego-" + ego.id, type: "alter-ego",
            label: ego.displayName,
            sublabel: "@" + ego.username,
            avatarUrl: ego.avatarUrl,
            x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
            vx: 0, vy: 0, radius: 22,
            color: NODE_COLORS["alter-ego"],
            opacity: 1, pulsePhase: Math.random() * Math.PI * 2,
            connections: [data.user.id],
            content: ego.bio || undefined,
          });
          meshEdges.push({
            source: data.user.id, target: "alter-ego-" + ego.id,
            strength: 0.9, type: "alter-ego",
          });
        });

        // Meshi is NOT a node — it roams the mesh as a living entity
        // Initialize Meshi position near the self node
        meshiRef.current.x = cx + 60;
        meshiRef.current.y = cy - 60;
        meshiRef.current.targetX = cx + 60;
        meshiRef.current.targetY = cy - 60;
        meshiRef.current.state = "roaming";
        meshiRef.current.idleTimer = 0;

        // Connected platform nodes
        (data.connectedAccounts || []).forEach((acc: { id: string; platform: string; platformUsername: string | null }, i: number) => {
          const angle = (i / Math.max(data.connectedAccounts.length, 1)) * Math.PI * 2 + 4;
          const dist = 120 + Math.random() * 40;
          meshNodes.push({
            id: "platform-" + acc.platform, type: "platform",
            label: acc.platform.charAt(0).toUpperCase() + acc.platform.slice(1),
            sublabel: acc.platformUsername ? "@" + acc.platformUsername : "Connected",
            x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
            vx: 0, vy: 0, radius: 14,
            color: PLATFORM_COLORS[acc.platform] || NODE_COLORS.platform,
            opacity: 0.9, pulsePhase: Math.random() * Math.PI * 2,
            connections: [data.user.id],
            platform: acc.platform,
          });
          meshEdges.push({
            source: data.user.id, target: "platform-" + acc.platform,
            strength: 0.5, type: "platform",
          });
        });

        // Preload images for nodes with avatars or post images
        for (const node of meshNodes) {
          const imgUrl = node.avatarUrl || node.imageUrl;
          if (imgUrl && !imageCache.current.has(node.id)) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => { imageCache.current.set(node.id, img); };
            img.onerror = () => { imageCache.current.set(node.id, null); };
            img.src = imgUrl;
            imageCache.current.set(node.id, null); // placeholder while loading
          }
        }

        setNodes(meshNodes);
        setEdges(meshEdges);
        nodesRef.current = meshNodes;
        edgesRef.current = meshEdges;
        setMeshStats(data.stats || null);
      } catch {
        setError("Failed to load your mesh. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    loadMeshData();
  }, []);

  // --- Physics simulation ---

  const simulate = useCallback(() => {
    const ns = nodesRef.current;
    const es = edgesRef.current;
    if (ns.length === 0) return;
    const cx = centerRef.current.x, cy = centerRef.current.y;
    timeRef.current += 0.016;

    for (let i = 0; i < ns.length; i++) {
      const node = ns[i];
      for (let j = i + 1; j < ns.length; j++) {
        const other = ns[j];
        const dx = other.x - node.x;
        const dy = other.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = node.radius + other.radius + 60;
        if (dist < minDist * 2.5) {
          const force = (minDist * 2.5 - dist) * 0.0015;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (node.type !== "self") { node.vx -= fx; node.vy -= fy; }
          if (other.type !== "self") { other.vx += fx; other.vy += fy; }
        }
      }

      if (node.type !== "self") {
        // Gentle center gravity only — NO orbit/tangential force
        // This creates an organic, static web that settles in place
        node.vx += (cx - node.x) * 0.00008;
        node.vy += (cy - node.y) * 0.00008;
      }

      // Heavy damping for organic web feel — nodes settle quickly
      node.vx *= 0.92;
      node.vy *= 0.92;

      if (node.type !== "self") {
        node.x += node.vx;
        node.y += node.vy;
      }
    }

    for (const edge of es) {
      const source = ns.find((n) => n.id === edge.source);
      const target = ns.find((n) => n.id === edge.target);
      if (!source || !target) continue;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      // Interaction-based proximity: edges with higher interaction counts pull nodes closer
      const interactions = edge.interactionCount || 0;
      const interactionProximity = 1 / (1 + interactions * 0.1);
      const baseIdealDist = source.radius + target.radius + 80 + (1 - edge.strength) * 120;
      // Alter-ego edges are kept very tight to self node
      const idealDist = edge.type === "alter-ego"
        ? source.radius + target.radius + 40
        : baseIdealDist * interactionProximity;
      const diff = dist - idealDist;
      if (Math.abs(diff) > 5) {
        const force = diff * 0.001 * edge.strength;
        const fx = (dx / dist) * force;
        if (target.type !== "self") { target.vx -= fx; target.vy -= (dy / dist) * force; }
        if (source.type !== "self") { source.vx += fx; source.vy += (dy / dist) * force; }
      }
    }

    // --- Meshi roaming behavior ---
    const m = meshiRef.current;
    m.bobPhase += 0.05;
    m.glowPulse += 0.03;

    // Launch animation: Meshi jumps from his house into the mesh like going to work
    if (m.state === "launching") {
      // Initialize launch on first frame
      if (m.launchProgress === 0 && m.x === -999) {
        // House is bottom-left of canvas in screen coords — convert to world coords
        const canvasEl = canvasRef.current;
        if (canvasEl) {
          const logW = canvasEl.offsetWidth;
          const logH = canvasEl.offsetHeight;
          // Start position: bottom-left (house area) in world coords
          m.launchFrom = { x: cx - logW * 0.35, y: cy + logH * 0.35 };
          // Land near the self node
          const selfNode = ns.find((n) => n.type === "self");
          if (selfNode) {
            m.launchTo = { x: selfNode.x + 30, y: selfNode.y - 20 };
          } else {
            m.launchTo = { x: cx, y: cy };
          }
          m.x = m.launchFrom.x;
          m.y = m.launchFrom.y;
        }
      }
      m.launchProgress += 0.012; // ~5 seconds for full arc
      const t = Math.min(m.launchProgress, 1);
      // Smooth ease-out curve
      const ease = 1 - Math.pow(1 - t, 3);
      // Parabolic arc height (peaks at t=0.5)
      const arcHeight = -180 * Math.sin(t * Math.PI);
      m.x = m.launchFrom.x + (m.launchTo.x - m.launchFrom.x) * ease;
      m.y = m.launchFrom.y + (m.launchTo.y - m.launchFrom.y) * ease + arcHeight;
      if (t >= 1) {
        // Landing complete — transition to roaming
        m.state = "roaming";
        m.x = m.launchTo.x;
        m.y = m.launchTo.y;
        m.targetX = m.launchTo.x;
        m.targetY = m.launchTo.y;
        m.idleTimer = 0;
      }
    } else if (m.state === "delivering") {
      // Move along delivery path
      m.envelopeProgress += 0.008;
      if (m.deliveryFrom && m.deliveryTo) {
        m.x = m.deliveryFrom.x + (m.deliveryTo.x - m.deliveryFrom.x) * m.envelopeProgress;
        m.y = m.deliveryFrom.y + (m.deliveryTo.y - m.deliveryFrom.y) * m.envelopeProgress;
      }
      if (m.envelopeProgress >= 1) {
        m.state = "returning";
        m.hasEnvelope = false;
        m.envelopeProgress = 0;
        // Return to self node
        const selfNode = ns.find((n) => n.type === "self");
        if (selfNode) {
          m.targetX = selfNode.x + (Math.random() - 0.5) * 80;
          m.targetY = selfNode.y + (Math.random() - 0.5) * 80;
        }
      }
    } else if (m.state === "returning") {
      // Smoothly return near self node
      const retDx = m.targetX - m.x;
      const retDy = m.targetY - m.y;
      const retDist = Math.sqrt(retDx * retDx + retDy * retDy);
      if (retDist > 3) {
        m.x += (retDx / retDist) * m.speed * 1.5;
        m.y += (retDy / retDist) * m.speed * 1.5;
      } else {
        m.state = "roaming";
        m.idleTimer = 0;
      }
    } else {
      // Roaming / idle behavior
      const mDx = m.targetX - m.x;
      const mDy = m.targetY - m.y;
      const mDist = Math.sqrt(mDx * mDx + mDy * mDy);

      if (mDist > 3) {
        // Move toward target
        m.x += (mDx / mDist) * m.speed;
        m.y += (mDy / mDist) * m.speed;
        m.state = "roaming";
      } else {
        // Arrived at target — idle briefly, then pick new target
        m.state = "idle";
        m.idleTimer += 0.016;

        if (m.idleTimer > 2 + Math.random() * 3) {
          // Pick a random node to visit
          const candidates = ns.filter((n) => n.type !== "self" && n.id !== m.currentTargetNodeId);
          if (candidates.length > 0) {
            const target = candidates[Math.floor(Math.random() * candidates.length)];
            m.targetX = target.x + (Math.random() - 0.5) * 20;
            m.targetY = target.y + (Math.random() - 0.5) * 20;
            m.currentTargetNodeId = target.id;
          } else {
            // Fall back to wandering near self
            const selfNode = ns.find((n) => n.type === "self");
            if (selfNode) {
              m.targetX = selfNode.x + (Math.random() - 0.5) * 150;
              m.targetY = selfNode.y + (Math.random() - 0.5) * 150;
            }
          }
          m.idleTimer = 0;
          m.state = "roaming";
        }
      }
    }
  }, []);

  // --- Canvas rendering ---

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      simulate();
      const w = canvas.width, h = canvas.height;
      const dpr = window.devicePixelRatio || 1;
      const logicalW = w / dpr, logicalH = h / dpr;
      const z = zoomRef.current;
      const p = panRef.current;
      const ns = nodesRef.current;
      const es = edgesRef.current;
      const f = filterRef.current;
      const time = timeRef.current;
      const hovered = hoveredNodeRef.current;
      const selected = selectedNodeRef.current;
      const labels = showLabelsRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, logicalW, logicalH);

      ctx.save();
      ctx.translate(logicalW / 2 + p.x, logicalH / 2 + p.y);
      ctx.scale(z, z);
      ctx.translate(-centerRef.current.x, -centerRef.current.y);

      // Draw edges (only for visible nodes)
      for (const edge of es) {
        const source = ns.find((n) => n.id === edge.source);
        const target = ns.find((n) => n.id === edge.target);
        if (!source || !target) continue;
        if (f !== "all" && target.type !== f && source.type !== f && source.type !== "self" && target.type !== "self") continue;

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
          const cpx = mx - edy * 0.15;
          const cpy = my + edx * 0.15;
          ctx.quadraticCurveTo(cpx, cpy, target.x, target.y);
        } else {
          ctx.lineTo(target.x, target.y);
        }

        const edgeColor = edge.type === "mutual" ? "129, 140, 248"
          : edge.type === "community" ? "236, 72, 153"
          : edge.type === "interest" ? "6, 182, 212"
          : edge.type === "post" ? "34, 197, 94"
          : edge.type === "platform" ? "245, 158, 11"
          : "59, 130, 246";

        ctx.strokeStyle = "rgba(" + edgeColor + ", " + (baseAlpha + pulseAlpha) + ")";
        ctx.lineWidth = isHighlighted ? 1.5 : 0.5 + edge.strength * 0.5;
        ctx.stroke();

        if (edge.type === "mutual" && isHighlighted) {
          const t = (time * 0.5) % 1;
          const px = source.x + (target.x - source.x) * t;
          const py = source.y + (target.y - source.y) * t;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(" + edgeColor + ", 0.8)";
          ctx.fill();
        }
      }

      // Draw nodes (only visible ones)
      for (const node of ns) {
        if (f !== "all" && node.type !== f && node.type !== "self") continue;

        const isHovered = hovered?.id === node.id;
        const isSelected = selected?.id === node.id;
        const isConnectedToHovered = hovered && es.some((e) =>
          (e.source === hovered.id && e.target === node.id) ||
          (e.target === hovered.id && e.source === node.id)
        );
        const isConnectedToSelected = selected && es.some((e) =>
          (e.source === selected.id && e.target === node.id) ||
          (e.target === selected.id && e.source === node.id)
        );

        const highlight = isHovered || isSelected || isConnectedToHovered || isConnectedToSelected;
        const dimmed = (hovered || selected) && !highlight && node.type !== "self";

        const nodeOpacity = dimmed ? 0.25 : node.opacity;
        const nodeRadius = isHovered ? node.radius * 1.15 : node.radius;
        const pulse = Math.sin(time * 1.5 + node.pulsePhase) * 0.5 + 0.5;

        const glowColor = node.type === "self" ? NODE_GLOW.self
          : node.isMutual ? NODE_GLOW.mutual
          : NODE_GLOW[node.type] || NODE_GLOW.user;

        const glowRadius = nodeRadius * (1.8 + pulse * 0.3);
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);
        gradient.addColorStop(0, glowColor.replace(/[\d.]+\)$/, (0.15 * nodeOpacity) + ")"));
        gradient.addColorStop(0.6, glowColor.replace(/[\d.]+\)$/, (0.04 * nodeOpacity) + ")"));
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        if (node.type === "self") {
          // Double ring for profile center node — invites clicking
          const ringRadius = nodeRadius + 5 + pulse * 2;
          ctx.beginPath();
          ctx.arc(node.x, node.y, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(59, 130, 246, " + (0.12 + pulse * 0.06) + ")";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // Outer glow ring
          const outerRing = ringRadius + 4;
          ctx.beginPath();
          ctx.arc(node.x, node.y, outerRing, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(59, 130, 246, " + (0.04 + pulse * 0.02) + ")";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }

        // Check if we have a loaded image for this node
        const cachedImg = imageCache.current.get(node.id);
        const hasImage = cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0;

        if (hasImage) {
          // Draw image clipped to circle (profile pic or post thumbnail IS the node)
          ctx.save();
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
          ctx.clip();
          ctx.globalAlpha = nodeOpacity;
          ctx.drawImage(
            cachedImg,
            node.x - nodeRadius, node.y - nodeRadius,
            nodeRadius * 2, nodeRadius * 2
          );
          ctx.globalAlpha = 1;
          ctx.restore();

          // Draw colored border ring around image node
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
          ctx.strokeStyle = node.color + hexAlpha((isHovered || isSelected ? 0.9 : 0.5) * nodeOpacity);
          ctx.lineWidth = isHovered || isSelected ? 2.5 : 1.5;
          ctx.stroke();

          // Optional: subtle inner shadow for depth
          if (isHovered || isSelected) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeRadius + 2, 0, Math.PI * 2);
            ctx.strokeStyle = node.color + hexAlpha(0.3 * nodeOpacity);
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        } else {
          // Fallback: colored circle with initial/icon (no image available)
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
          const fillGrad = ctx.createRadialGradient(
            node.x - nodeRadius * 0.3, node.y - nodeRadius * 0.3, 0,
            node.x, node.y, nodeRadius
          );
          fillGrad.addColorStop(0, node.color + hexAlpha(0.35 * nodeOpacity));
          fillGrad.addColorStop(1, node.color + hexAlpha(0.12 * nodeOpacity));
          ctx.fillStyle = fillGrad;
          ctx.fill();

          ctx.strokeStyle = node.color + hexAlpha((isHovered || isSelected ? 0.8 : 0.4) * nodeOpacity);
          ctx.lineWidth = isHovered || isSelected ? 1.5 : 1;
          ctx.stroke();

          ctx.fillStyle = "rgba(255, 255, 255, " + (0.85 * nodeOpacity) + ")";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          if (node.type === "self") {
            const initials = node.label.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "ME";
            ctx.font = "bold " + (nodeRadius * 0.55) + "px system-ui, -apple-system, sans-serif";
            ctx.fillText(initials, node.x, node.y);
          } else if (node.type === "community") {
            ctx.font = Math.max(9, nodeRadius * 0.5) + "px system-ui, -apple-system, sans-serif";
            ctx.fillText((node.label[0] || "C").toUpperCase(), node.x, node.y);
          } else if (node.type === "tag") {
            ctx.font = Math.max(9, nodeRadius * 0.5) + "px system-ui, -apple-system, sans-serif";
            ctx.fillText("#", node.x, node.y);
          } else if (node.type === "post") {
            ctx.font = Math.max(7, nodeRadius * 0.45) + "px system-ui, -apple-system, sans-serif";
            ctx.fillText("\u2726", node.x, node.y);
          } else if (node.type === "platform") {
            ctx.font = "bold " + (nodeRadius * 0.5) + "px system-ui, -apple-system, sans-serif";
            ctx.fillText(node.label[0], node.x, node.y);
          } else {
            ctx.font = "bold " + (nodeRadius * 0.6) + "px system-ui, -apple-system, sans-serif";
            ctx.fillText((node.label[0] || "?").toUpperCase(), node.x, node.y);
          }
        }

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

        if (labels && nodeOpacity > 0.3) {
          ctx.fillStyle = "rgba(228, 228, 231, " + (0.85 * nodeOpacity) + ")";
          ctx.font = Math.max(9, Math.min(12, nodeRadius * 0.55)) + "px system-ui, -apple-system, sans-serif";
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

          if (node.sublabel && (isHovered || isSelected)) {
            ctx.fillStyle = "rgba(161, 161, 170, " + (0.7 * nodeOpacity) + ")";
            ctx.font = Math.max(8, nodeRadius * 0.4) + "px system-ui, -apple-system, sans-serif";
            ctx.fillText(node.sublabel, node.x, node.y + nodeRadius + 20);
          }
        }

        // === Status indicator dot (online/dnd/busy/offline) ===
        if ((node.type === "user" || node.type === "self") && node.status) {
          const statusColor = STATUS_COLORS[node.status] || STATUS_COLORS.offline;
          const dotR = Math.max(3, nodeRadius * 0.2);
          const dotX = node.x + nodeRadius * 0.7;
          const dotY = node.y + nodeRadius * 0.7;
          // White outline
          ctx.beginPath();
          ctx.arc(dotX, dotY, dotR + 1.5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0,0,0,0.8)";
          ctx.fill();
          // Status color
          ctx.beginPath();
          ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
          ctx.fillStyle = statusColor;
          ctx.fill();
        }
      }

      // --- Draw Meshi as a roaming entity ---
      const m = meshiRef.current;
      const meshiSize = 16;
      const meshiBob = m.state === "launching" ? 0 : Math.sin(m.bobPhase) * 3;
      const meshiGlow = 0.3 + Math.sin(m.glowPulse) * 0.15;
      const meshiX = m.x;
      const meshiY = m.y + meshiBob;

      // Launch trail sparkles — draw a fading arc trail when Meshi is jumping from home
      if (m.state === "launching" && m.launchProgress > 0.05) {
        const trailCount = 8;
        for (let ti = 0; ti < trailCount; ti++) {
          const trailT = Math.max(0, m.launchProgress - ti * 0.04);
          if (trailT <= 0) continue;
          const trailEase = 1 - Math.pow(1 - trailT, 3);
          const trailArc = -180 * Math.sin(trailT * Math.PI);
          const tx = m.launchFrom.x + (m.launchTo.x - m.launchFrom.x) * trailEase;
          const ty = m.launchFrom.y + (m.launchTo.y - m.launchFrom.y) * trailEase + trailArc;
          const alpha = (1 - ti / trailCount) * 0.5;
          const sparkleSize = 2 + Math.sin(time * 8 + ti) * 1;
          ctx.beginPath();
          ctx.arc(tx, ty, sparkleSize, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(165, 180, 252, " + alpha + ")";
          ctx.fill();
        }
        // Draw a "woosh" line from recent trail
        if (m.launchProgress < 0.9) {
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          const prevT = Math.max(0, m.launchProgress - 0.1);
          const prevEase = 1 - Math.pow(1 - prevT, 3);
          const prevArc = -180 * Math.sin(prevT * Math.PI);
          const prevX = m.launchFrom.x + (m.launchTo.x - m.launchFrom.x) * prevEase;
          const prevY = m.launchFrom.y + (m.launchTo.y - m.launchFrom.y) * prevEase + prevArc;
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(meshiX, meshiY);
          ctx.strokeStyle = "rgba(129, 140, 248, 0.6)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      // Soft glow around Meshi (uses user's custom color)
      const mColor = meshiColorRef.current;
      const meshiGlowGrad = ctx.createRadialGradient(meshiX, meshiY, 0, meshiX, meshiY, meshiSize * 2.5);
      meshiGlowGrad.addColorStop(0, mColor.glow.replace(/[\d.]+\)$/, meshiGlow + ")"));
      meshiGlowGrad.addColorStop(0.5, mColor.glow.replace(/[\d.]+\)$/, (meshiGlow * 0.3) + ")"));
      meshiGlowGrad.addColorStop(1, mColor.glow.replace(/[\d.]+\)$/, "0)"));
      ctx.beginPath();
      ctx.arc(meshiX, meshiY, meshiSize * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = meshiGlowGrad;
      ctx.fill();

      // Meshi body (circle with gradient — uses user's custom color)
      const meshiBodyGrad = ctx.createRadialGradient(
        meshiX - meshiSize * 0.2, meshiY - meshiSize * 0.2, 0,
        meshiX, meshiY, meshiSize
      );
      // Lighten the primary color for the highlight, darken for the base
      meshiBodyGrad.addColorStop(0, mColor.primary + "cc");
      meshiBodyGrad.addColorStop(1, mColor.primary);
      ctx.beginPath();
      ctx.arc(meshiX, meshiY, meshiSize, 0, Math.PI * 2);
      ctx.fillStyle = meshiBodyGrad;
      ctx.fill();

      // Meshi border ring
      ctx.strokeStyle = "rgba(165, 180, 252, 0.6)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Meshi eyes (◕ ◕ style — large oval white eyes with dark pupils)
      const eyeOffsetX = meshiSize * 0.28;
      const eyeY = meshiY - meshiSize * 0.08;
      const eyeRadiusX = meshiSize * 0.22;
      const eyeRadiusY = meshiSize * 0.28;

      // Left eye white
      ctx.beginPath();
      ctx.ellipse(meshiX - eyeOffsetX, eyeY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();
      // Left eye pupil
      ctx.beginPath();
      ctx.arc(meshiX - eyeOffsetX + 1, eyeY + 1, eyeRadiusX * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = "#1e1b4b";
      ctx.fill();
      // Left eye shine
      ctx.beginPath();
      ctx.arc(meshiX - eyeOffsetX - 0.5, eyeY - 1.5, eyeRadiusX * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();

      // Right eye white
      ctx.beginPath();
      ctx.ellipse(meshiX + eyeOffsetX, eyeY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();
      // Right eye pupil
      ctx.beginPath();
      ctx.arc(meshiX + eyeOffsetX + 1, eyeY + 1, eyeRadiusX * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = "#1e1b4b";
      ctx.fill();
      // Right eye shine
      ctx.beginPath();
      ctx.arc(meshiX + eyeOffsetX - 0.5, eyeY - 1.5, eyeRadiusX * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();

      // Draw envelope if Meshi is delivering a message
      if (m.hasEnvelope && m.state === "delivering") {
        const envX = meshiX + meshiSize * 0.8;
        const envY = meshiY - meshiSize * 0.6;
        const envW = 10;
        const envH = 7;
        // Envelope body
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect(envX - envW / 2, envY - envH / 2, envW, envH);
        ctx.strokeStyle = "#d97706";
        ctx.lineWidth = 0.8;
        ctx.strokeRect(envX - envW / 2, envY - envH / 2, envW, envH);
        // Envelope flap (triangle)
        ctx.beginPath();
        ctx.moveTo(envX - envW / 2, envY - envH / 2);
        ctx.lineTo(envX, envY + 1);
        ctx.lineTo(envX + envW / 2, envY - envH / 2);
        ctx.strokeStyle = "#d97706";
        ctx.lineWidth = 0.8;
        ctx.stroke();
        // Small sparkle on envelope
        const sparklePhase = time * 3;
        const sparkleAlpha = 0.5 + Math.sin(sparklePhase) * 0.5;
        ctx.fillStyle = "rgba(255, 255, 255, " + sparkleAlpha + ")";
        ctx.font = "6px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("✦", envX + envW / 2 + 3, envY - envH / 2 - 2);
      }

      // Delivery trail (fading dotted line from origin to Meshi during delivery)
      if (m.state === "delivering" && m.deliveryFrom) {
        ctx.save();
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(m.deliveryFrom.x, m.deliveryFrom.y);
        ctx.lineTo(meshiX, meshiY);
        ctx.strokeStyle = "rgba(99, 102, 241, 0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Meshi label
      ctx.fillStyle = "rgba(165, 180, 252, 0.85)";
      ctx.font = "9px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("Meshi", meshiX, meshiY + meshiSize + 4);

      // === Magnifying glass when Meshi is exploring ===
      if (meshiExploring) {
        const mgX = meshiX + meshiSize * 0.9;
        const mgY = meshiY - meshiSize * 0.5;
        const mgR = 5;
        const mgBob = Math.sin(time * 4) * 1.5;
        // Glass circle
        ctx.beginPath();
        ctx.arc(mgX, mgY + mgBob, mgR, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(251, 191, 36, 0.9)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = "rgba(251, 191, 36, 0.15)";
        ctx.fill();
        // Handle
        ctx.beginPath();
        ctx.moveTo(mgX + mgR * 0.7, mgY + mgBob + mgR * 0.7);
        ctx.lineTo(mgX + mgR * 1.6, mgY + mgBob + mgR * 1.6);
        ctx.strokeStyle = "rgba(251, 191, 36, 0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // State indicator (small text below name)
      if (m.state === "delivering") {
        ctx.fillStyle = "rgba(251, 191, 36, 0.7)";
        ctx.font = "7px system-ui";
        ctx.fillText("delivering...", meshiX, meshiY + meshiSize + 15);
      }

      ctx.restore();
      animationRef.current = requestAnimationFrame(render);
    };

    // Set canvas dimensions before first render
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width === 0 || canvas.height === 0) {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      centerRef.current = { x: canvas.offsetWidth / 2, y: canvas.offsetHeight / 2 };
    }

    render();
    return () => cancelAnimationFrame(animationRef.current);
  }, [simulate, loading]); // re-run when loading finishes and canvas appears

  // --- Canvas resize ---

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      centerRef.current = { x: canvas.offsetWidth / 2, y: canvas.offsetHeight / 2 };
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [loading]); // re-run when loading changes so canvas gets sized after mount

  // --- Interaction handlers ---

  const getWorldCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const z = zoomRef.current;
    const p = panRef.current;
    const ccx = centerRef.current.x;
    const ccy = centerRef.current.y;
    const worldX = (mx - canvas.offsetWidth / 2 - p.x) / z + ccx;
    const worldY = (my - canvas.offsetHeight / 2 - p.y) / z + ccy;
    return { x: worldX, y: worldY };
  }, []);

  const findNodeAt = useCallback((worldX: number, worldY: number): MeshNode | null => {
    const ns = nodesRef.current;
    for (let i = ns.length - 1; i >= 0; i--) {
      const node = ns[i];
      if (filterRef.current !== "all" && node.type !== filterRef.current && node.type !== "self") continue;
      const dx = worldX - node.x;
      const dy = worldY - node.y;
      const hitRadius = node.radius * 1.5;
      if (dx * dx + dy * dy < hitRadius * hitRadius) return node;
    }
    return null;
  }, []);

  // Ref to hold zoomToNode so handleCanvasClick can use it without circular dependency
  const zoomToNodeRef = useRef<(nodeId: string) => void>(() => {});

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragActiveRef.current) return;
    const coords = getWorldCoords(e.clientX, e.clientY);
    const node = findNodeAt(coords.x, coords.y);
    // Clicking center "self" node → navigate to profile page
    if (node?.type === "self" && node.href) {
      router.push(node.href);
      return;
    }
    // Feature #7: Click user node -> profile preview + center their mesh
    if (node?.type === "user") {
      setProfilePreview(node);
      zoomToNodeRef.current(node.id);
    }
    setSelectedNode(node);
  }, [getWorldCoords, findNodeAt, router]);

  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getWorldCoords(e.clientX, e.clientY);
    const node = findNodeAt(coords.x, coords.y);
    if (node?.href) {
      window.location.href = node.href;
    }
  }, [getWorldCoords, findNodeAt]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      dragActiveRef.current = true;
      const newPan = { x: e.clientX - dragStart.x, y: e.clientY - dragStart.y };
      setPan(newPan);
      panRef.current = newPan;
      return;
    }
    const coords = getWorldCoords(e.clientX, e.clientY);
    const node = findNodeAt(coords.x, coords.y);
    setHoveredNode(node);

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = node ? "pointer" : "grab";
    }
  }, [isDragging, dragStart, getWorldCoords, findNodeAt]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragActiveRef.current = false;
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setTimeout(() => { dragActiveRef.current = false; }, 50);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newZoom = Math.max(0.2, Math.min(4, zoomRef.current + delta));
    setZoom(newZoom);
    zoomRef.current = newZoom;
  }, []);

  const lastTouchRef = useRef<{ x: number; y: number; dist?: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      lastTouchRef.current = { x: touch.clientX - panRef.current.x, y: touch.clientY - panRef.current.y };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchRef.current = { x: 0, y: 0, dist: Math.sqrt(dx * dx + dy * dy) };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 1 && lastTouchRef.current && lastTouchRef.current.dist === undefined) {
      const touch = e.touches[0];
      const newPan = { x: touch.clientX - lastTouchRef.current.x, y: touch.clientY - lastTouchRef.current.y };
      setPan(newPan);
      panRef.current = newPan;
    } else if (e.touches.length === 2 && lastTouchRef.current && lastTouchRef.current.dist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.sqrt(dx * dx + dy * dy);
      const scale = newDist / lastTouchRef.current.dist;
      const newZoom = Math.max(0.2, Math.min(4, zoomRef.current * scale));
      setZoom(newZoom);
      zoomRef.current = newZoom;
      lastTouchRef.current.dist = newDist;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastTouchRef.current = null;
  }, []);

  const handleZoom = useCallback((delta: number) => {
    const newZoom = Math.max(0.2, Math.min(4, zoomRef.current + delta));
    setZoom(newZoom);
    zoomRef.current = newZoom;
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setSelectedNode(null);
    setHoveredNode(null);
  }, []);

  // --- Zoom to a specific node (smooth animation) ---
  const zoomToNode = useCallback((nodeId: string) => {
    const targetNode = nodesRef.current.find((n) => n.id === nodeId);
    if (!targetNode || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const cx = centerRef.current.x;
    const cy = centerRef.current.y;

    // Calculate the pan needed to center this node
    const targetZoom = 2.0; // zoom in to 200%
    const offsetX = -(targetNode.x - cx) * targetZoom;
    const offsetY = -(targetNode.y - cy) * targetZoom;

    // Animate smoothly
    const startPan = { ...panRef.current };
    const startZoom = zoomRef.current;
    const duration = 600; // ms
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - t, 3);

      const newZoom = startZoom + (targetZoom - startZoom) * ease;
      const newPanX = startPan.x + (offsetX - startPan.x) * ease;
      const newPanY = startPan.y + (offsetY - startPan.y) * ease;

      setZoom(newZoom);
      zoomRef.current = newZoom;
      setPan({ x: newPanX, y: newPanY });
      panRef.current = { x: newPanX, y: newPanY };

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        // Select the node after zoom completes
        setSelectedNode(targetNode);
      }
    };

    requestAnimationFrame(animate);
  }, []);

  // Keep ref in sync so handleCanvasClick can use it
  zoomToNodeRef.current = zoomToNode;

  // --- Trigger Meshi message delivery animation ---
  // Call this when a message is sent to animate Meshi grabbing an envelope
  // and walking it to the recipient's node. Only visible to sender.
  const triggerMeshiDelivery = useCallback((toNodeId: string) => {
    const ns = nodesRef.current;
    const selfNode = ns.find((n) => n.type === "self");
    const targetNode = ns.find((n) => n.id === toNodeId);
    if (!selfNode || !targetNode) return;

    const m = meshiRef.current;
    // First move Meshi to self node to "grab" the envelope
    m.x = selfNode.x + 30;
    m.y = selfNode.y - 30;
    m.hasEnvelope = true;
    m.state = "delivering";
    m.envelopeProgress = 0;
    m.deliveryFrom = { x: selfNode.x + 30, y: selfNode.y - 30 };
    m.deliveryTo = { x: targetNode.x, y: targetNode.y };

    // Track delivery for privacy (only sender sees this)
    setMeshiDeliveries((prev) => [
      ...prev,
      { id: Date.now().toString(), fromNodeId: selfNode.id, toNodeId, timestamp: Date.now() },
    ]);
  }, []);

  // --- Filter options ---

  const filterOptions: { id: FilterType; label: string; icon: React.ElementType; count: number }[] = [
    { id: "all", label: "Everything", icon: Globe, count: visibleNodes.length },
    { id: "user", label: "People", icon: Users, count: visibleNodes.filter((n) => n.type === "user").length },
    { id: "alter-ego", label: "Alter Egos", icon: Sparkles, count: visibleNodes.filter((n) => n.type === "alter-ego").length },
    { id: "community", label: "Communities", icon: MessageCircle, count: visibleNodes.filter((n) => n.type === "community").length },
    { id: "tag", label: "Interests", icon: Hash, count: visibleNodes.filter((n) => n.type === "tag").length },
    { id: "post", label: "Posts", icon: FileText, count: visibleNodes.filter((n) => n.type === "post").length },
    { id: "platform", label: "Platforms", icon: Link2, count: visibleNodes.filter((n) => n.type === "platform").length },
  ];

  // Available connected platforms for cross-posting
  const connectedPlatforms = nodes.filter((n) => n.type === "platform").map((n) => ({
    id: n.id,
    label: n.label,
    color: n.color,
  }));

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-[var(--bg-primary)]">
        <div className="text-center">
          <motion.div
            className="relative w-28 h-28 mx-auto mb-6"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Meshi with construction hat */}
            <div className="relative">
              <MeshiMascot size={80} mood="excited" color="blue" showGlow animate />
              {/* Construction hat */}
              <svg className="absolute -top-5 left-1/2 -translate-x-1/2" width="48" height="28" viewBox="0 0 48 28">
                <path d="M8 28 L12 12 L36 12 L40 28 Z" fill="#f59e0b" stroke="#d97706" strokeWidth="1" />
                <rect x="4" y="24" width="40" height="4" rx="2" fill="#d97706" />
                <rect x="18" y="8" width="12" height="6" rx="1" fill="#fbbf24" />
              </svg>
            </div>
            {/* Hammer animation */}
            <motion.div
              className="absolute -right-4 top-6"
              animate={{ rotate: [0, -30, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformOrigin: "bottom center" }}
            >
              <svg width="24" height="32" viewBox="0 0 24 32">
                <rect x="10" y="12" width="4" height="20" rx="1" fill="#92400e" />
                <rect x="2" y="4" width="20" height="10" rx="2" fill="#6b7280" />
                <rect x="2" y="4" width="20" height="3" rx="1" fill="#9ca3af" />
              </svg>
            </motion.div>
          </motion.div>
          <motion.p
            className="text-[var(--text-secondary)] font-medium mb-1"
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            Meshi is building your mesh...
          </motion.p>
          <p className="text-[var(--text-muted)] text-sm">Mapping your digital universe</p>
          {/* Animated dots */}
          <div className="flex justify-center gap-1.5 mt-3">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{ background: "var(--accent)" }}
                animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-[var(--bg-primary)]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <X className="h-8 w-8 text-red-400" />
          </div>
          <p className="text-[var(--text-secondary)] font-medium mb-2">{error}</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div data-meshi-zone="mesh-canvas" className="relative h-[calc(100vh-4rem)] overflow-hidden bg-[var(--bg-primary)]">
      {/* Keyboard shortcut handled in useEffect below */}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 p-2 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <MeshiLogo size={32} color="blue" mood="happy" />
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">The Mesh</h1>
              <p className="text-[11px] text-[var(--text-muted)]">Your digital universe</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick search / command */}
            <button
              onClick={() => setShowCommandPalette(true)}
              className="flex items-center gap-2 px-3 py-1.5 glass-panel rounded-xl text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all shadow-lg"
            >
              <Search className="h-3 w-3" />
              <span className="hidden md:inline">Search mesh...</span>
              <kbd className="hidden md:inline text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] font-mono">⌘K</kbd>
            </button>

            {/* Footprint Dashboard toggle */}
            <button
              onClick={() => setShowFootprint(!showFootprint)}
              className={"flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all shadow-lg " + (
                showFootprint
                  ? "brand-button text-white shadow-lg"
                  : "glass-panel text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              <Fingerprint className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Footprint</span>
            </button>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex gap-1 glass-panel rounded-xl p-1 shadow-xl mt-2 sm:mt-3 w-fit max-w-full overflow-x-auto scrollbar-hide">
          {filterOptions.filter((fItem) => fItem.count > 0 || fItem.id === "all").map((fItem) => {
            const IconComp = fItem.icon;
            return (
              <button
                key={fItem.id}
                onClick={() => setFilter(fItem.id)}
                className={"flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all " + (
                  filter === fItem.id
                    ? "brand-button text-white shadow-lg"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                )}
              >
                <IconComp className="h-3 w-3" />
                <span className="hidden lg:inline">{fItem.label}</span>
                {fItem.count > 0 && fItem.id !== "all" && (
                  <span className={"text-[9px] px-1 rounded-full " + (filter === fItem.id ? "bg-white/20" : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]")}>
                    {fItem.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-16 right-2 sm:right-4 z-10 flex flex-col gap-1">
        <button onClick={() => handleZoom(0.3)} className="p-2 glass-surface rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all" title="Zoom in"><ZoomIn className="h-4 w-4" /></button>
        <button onClick={() => handleZoom(-0.3)} className="p-2 glass-surface rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all" title="Zoom out"><ZoomOut className="h-4 w-4" /></button>
        <button onClick={resetView} className="p-2 glass-surface rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all" title="Reset view"><Maximize2 className="h-4 w-4" /></button>
        <div className="h-px bg-[var(--bg-tertiary)] my-0.5" />
        <button onClick={() => setShowLabels(!showLabels)} className={"p-2 glass-surface rounded-lg transition-all " + (showLabels ? "text-[var(--accent)]" : "text-[var(--text-muted)]")} title={showLabels ? "Hide labels" : "Show labels"}>{showLabels ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
        <button onClick={() => setShowStats(!showStats)} className={"p-2 glass-surface rounded-lg transition-all " + (showStats ? "text-[var(--accent)]" : "text-[var(--text-muted)]")} title={showStats ? "Hide stats" : "Show stats"}><Info className="h-4 w-4" /></button>
      </div>


      {/* === Meshi House === */}
      <div className="absolute bottom-32 left-2 sm:left-4 z-10">
        <div className="relative">
          <button
            onClick={() => {
              if (meshiHouseLocked) return;
              setShowMeshiHouseMenu(!showMeshiHouseMenu);
              // Send Meshi home
              const m = meshiRef.current;
              const selfNode = nodesRef.current.find((n) => n.type === "self");
              if (selfNode) {
                m.targetX = selfNode.x + 30;
                m.targetY = selfNode.y - 30;
                m.state = "returning";
              }
            }}
            className={"p-2.5 rounded-xl transition-all shadow-lg " + (
              meshiHouseLocked
                ? "bg-amber-500/20 border border-amber-500/30 text-amber-400"
                : "glass-surface text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            )}
            title={meshiHouseLocked ? "Meshi is locked at home" : "Send Meshi home"}
          >
            <Home className="h-4 w-4" />
          </button>
          <AnimatePresence>
            {showMeshiHouseMenu && (
              <motion.div
                initial={{ opacity: 0, y: 5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                className="absolute bottom-full left-0 mb-2 glass-dropdown rounded-xl p-2 shadow-xl min-w-[160px]"
              >
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider px-2 pb-1.5 mb-1 border-b border-[var(--border-primary)]">Meshi House</p>
                <button
                  onClick={() => {
                    setMeshiHouseLocked(!meshiHouseLocked);
                    setShowMeshiHouseMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <Lock className={"h-3 w-3 " + (meshiHouseLocked ? "text-amber-400" : "text-[var(--text-muted)]")} />
                  <span className="text-[var(--text-secondary)]">{meshiHouseLocked ? "Unlock Meshi" : "Lock Meshi at home"}</span>
                </button>
                <button
                  onClick={() => {
                    // Trigger exploration with discovery generation
                    setMeshiExploring(true);
                    setMeshiDiscoveries([]);
                    setShowMeshiHouseMenu(false);
                    // Generate discoveries from mesh data over time
                    const ns = nodesRef.current;
                    const discoveryTemplates = [
                      (n: MeshNode) => n.type === "user" && n.isMutual ? `${n.label} is a mutual connection` : null,
                      (n: MeshNode) => n.type === "post" && n.likeCount && n.likeCount > 0 ? `Found a post with ${n.likeCount} likes` : null,
                      (n: MeshNode) => n.type === "community" ? `Discovered community: ${n.label}` : null,
                      (n: MeshNode) => n.type === "tag" ? `Interesting topic: ${n.label}` : null,
                      (n: MeshNode) => n.type === "platform" ? `Connected to ${n.label}` : null,
                      (n: MeshNode) => n.type === "user" && n.sharedInterests && n.sharedInterests.length > 0 ? `${n.label} shares ${n.sharedInterests.length} interests with you` : null,
                    ];
                    let dIdx = 0;
                    const shuffled = [...ns].sort(() => Math.random() - 0.5);
                    const discoveryInterval = setInterval(() => {
                      if (dIdx >= shuffled.length || dIdx >= 5) { clearInterval(discoveryInterval); return; }
                      const node = shuffled[dIdx];
                      for (const tmpl of discoveryTemplates) {
                        const summary = tmpl(node);
                        if (summary) {
                          setMeshiDiscoveries(prev => [...prev, { nodeId: node.id, summary, timestamp: Date.now() }]);
                          break;
                        }
                      }
                      dIdx++;
                    }, 2500);
                    // Auto-stop after 15 seconds
                    setTimeout(() => { setMeshiExploring(false); clearInterval(discoveryInterval); }, 15000);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <Search className="h-3 w-3 text-[var(--text-muted)]" />
                  <span className="text-[var(--text-secondary)]">Explore mesh</span>
                </button>
                <button
                  onClick={() => {
                    setShowRpsGame(true);
                    setShowMeshiHouseMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <Gamepad2 className="h-3 w-3 text-[var(--text-muted)]" />
                  <span className="text-[var(--text-secondary)]">Play with Meshi</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Stats bar — positioned above action bar to prevent overlap */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-16 left-2 sm:left-4 z-10 flex gap-1.5 sm:gap-2 flex-wrap max-w-[calc(100vw-5rem)]"
          >
            {[
              { label: "people", count: nodes.filter((n) => n.type === "user").length, color: "text-[var(--accent)]" },
              { label: "communities", count: nodes.filter((n) => n.type === "community").length, color: "text-sky-400" },
              { label: "interests", count: nodes.filter((n) => n.type === "tag").length, color: "text-cyan-400" },
              { label: "posts", count: nodes.filter((n) => n.type === "post").length, color: "text-emerald-400" },
              { label: "platforms", count: nodes.filter((n) => n.type === "platform").length, color: "text-amber-400" },
            ].filter((s) => s.count > 0).map((s) => (
              <div key={s.label} className="glass-surface rounded-lg/60 px-2.5 py-1.5 text-[11px] text-[var(--text-tertiary)] shadow-lg">
                <span className={"font-semibold " + s.color}>{s.count}</span> {s.label}
              </div>
            ))}
            <div className="glass-surface rounded-lg/60 px-2.5 py-1.5 text-[11px] text-[var(--text-muted)]">
              {Math.round(zoom * 100)}% zoom
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* === Meshi Exploration Discoveries (Feature #4) === */}
      <AnimatePresence>
        {meshiExploring && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-20 left-4 z-10 glass-dropdown rounded-xl p-3 shadow-xl max-w-[200px]"
          >
            <div className="flex items-center gap-2 mb-2">
              <Search className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
              <span className="text-[11px] font-medium text-[var(--text-primary)]">Meshi is exploring...</span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
              Investigating posts and connections in your mesh. Discoveries will appear here.
            </p>
            {meshiDiscoveries.length > 0 && (
              <div className="mt-2 space-y-1">
                {meshiDiscoveries.slice(-3).map((d) => (
                  <div key={d.timestamp} className="text-[9px] text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] rounded px-2 py-1">
                    {d.summary}
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setMeshiExploring(false)}
              className="mt-2 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Stop exploring
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Rock Paper Scissors Game Overlay === */}
      <AnimatePresence>
        {showRpsGame && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowRpsGame(false); setRpsChoice(null); setRpsResult(null); } }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-sm mx-4 glass-dropdown rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400" />
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4 text-purple-400" />
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Play with Meshi</h3>
                  </div>
                  <button onClick={() => { setShowRpsGame(false); setRpsChoice(null); setRpsResult(null); }} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {!rpsResult ? (
                  <>
                    <p className="text-xs text-[var(--text-muted)] mb-4 text-center">Choose your move — Meshi is ready!</p>
                    <div className="flex justify-center gap-3 mb-4">
                      {(["rock", "paper", "scissors"] as const).map((choice) => {
                        const icons = { rock: "🪨", paper: "📄", scissors: "✂️" };
                        return (
                          <motion.button
                            key={choice}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              setRpsChoice(choice);
                              const options = ["rock", "paper", "scissors"] as const;
                              const meshiPick = options[Math.floor(Math.random() * 3)];
                              const wins: Record<string, string> = { rock: "scissors", paper: "rock", scissors: "paper" };
                              const result = choice === meshiPick ? "draw" : wins[choice] === meshiPick ? "win" : "lose";
                              setTimeout(() => {
                                setRpsResult({ playerChoice: choice, meshiChoice: meshiPick, result });
                              }, 600);
                            }}
                            className={"w-16 h-16 rounded-2xl flex items-center justify-center text-2xl transition-all border-2 " + (
                              rpsChoice === choice
                                ? "border-[var(--accent)] bg-[var(--accent)]/10 scale-110"
                                : "border-[var(--border-primary)] hover:border-[var(--text-muted)] bg-[var(--bg-tertiary)]"
                            )}
                          >
                            {icons[choice]}
                          </motion.button>
                        );
                      })}
                    </div>
                    {rpsChoice && !rpsResult && (
                      <div className="text-center">
                        <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 0.5, repeat: Infinity }}>
                          <MeshiMascot size={40} mood="thinking" animate={false} showGlow={false} />
                        </motion.div>
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">Meshi is choosing...</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-6 mb-4">
                      <div className="text-center">
                        <p className="text-2xl mb-1">{{ rock: "🪨", paper: "📄", scissors: "✂️" }[rpsResult.playerChoice]}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">You</p>
                      </div>
                      <p className="text-lg font-bold text-[var(--text-muted)]">vs</p>
                      <div className="text-center">
                        <p className="text-2xl mb-1">{{ rock: "🪨", paper: "📄", scissors: "✂️" }[rpsResult.meshiChoice]}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">Meshi</p>
                      </div>
                    </div>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}>
                      <p className={"text-lg font-bold mb-1 " + (
                        rpsResult.result === "win" ? "text-emerald-400" :
                        rpsResult.result === "lose" ? "text-red-400" : "text-amber-400"
                      )}>
                        {rpsResult.result === "win" ? "You win!" : rpsResult.result === "lose" ? "Meshi wins!" : "It's a draw!"}
                      </p>
                      <MeshiMascot
                        size={48}
                        mood={rpsResult.result === "win" ? "surprised" : rpsResult.result === "lose" ? "excited" : "happy"}
                        animate showGlow={false}
                      />
                    </motion.div>
                    <button
                      onClick={() => { setRpsChoice(null); setRpsResult(null); }}
                      className="mt-4 px-4 py-2 rounded-xl text-xs font-medium brand-button text-white transition-all active:scale-95"
                    >
                      Play again
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint — centered above bottom controls */}
      {nodes.length > 0 && !selectedNode && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[5] glass-surface rounded-lg px-3 py-1.5 text-[10px] text-[var(--text-muted)] pointer-events-none hidden md:block">
          Click to inspect &middot; Double-click to navigate &middot; Scroll to zoom &middot; R reset &middot; L labels &middot; 1-7 filters &middot; ⌘K search
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />


      {/* === Profile Preview Panel (Feature #7) === */}
      <AnimatePresence>
        {profilePreview && profilePreview.type === "user" && (
          <motion.div
            initial={{ opacity: 0, x: 20, y: -10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 20, y: -10 }}
            transition={{ type: "spring", damping: 25 }}
            className="absolute top-4 right-4 z-20 w-64 glass-dropdown rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="h-12 w-full" style={{ background: "linear-gradient(135deg, " + profilePreview.color + "40, " + profilePreview.color + "10)" }} />
            <div className="px-4 pb-4 -mt-5">
              <div className="flex items-end gap-3 mb-3">
                {profilePreview.avatarUrl ? (
                  <Avatar src={profilePreview.avatarUrl} alt={profilePreview.label} size="lg" />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold border-2 border-[var(--bg-primary)]" style={{ backgroundColor: profilePreview.color }}>
                    {profilePreview.label[0]}
                  </div>
                )}
                <div className="min-w-0 pb-0.5">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{profilePreview.label}</p>
                  {profilePreview.sublabel && <p className="text-[10px] text-[var(--text-muted)] truncate">{profilePreview.sublabel}</p>}
                </div>
              </div>
              
              {/* Status indicator */}
              {profilePreview.status && (
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[profilePreview.status] || STATUS_COLORS.offline }} />
                  <span className="text-[10px] text-[var(--text-muted)] capitalize">{profilePreview.status === "dnd" ? "Do Not Disturb" : profilePreview.status}</span>
                </div>
              )}

              {/* Stats row */}
              <div className="flex items-center gap-3 mb-3 text-[10px] text-[var(--text-muted)]">
                {profilePreview.followerCount !== undefined && <span><strong className="text-[var(--text-primary)]">{profilePreview.followerCount}</strong> followers</span>}
                {profilePreview.postCount !== undefined && <span><strong className="text-[var(--text-primary)]">{profilePreview.postCount}</strong> posts</span>}
              </div>

              {/* Shared interests */}
              {profilePreview.sharedInterests && profilePreview.sharedInterests.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {profilePreview.sharedInterests.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">#{tag}</span>
                  ))}
                </div>
              )}

              {/* Quick actions */}
              <div className="flex gap-2">
                {profilePreview.href && (
                  <Link href={profilePreview.href} className="flex-1">
                    <button className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium brand-button text-white transition-all active:scale-95">
                      View Profile <ChevronRight className="h-2.5 w-2.5" />
                    </button>
                  </Link>
                )}
                <button
                  onClick={() => setProfilePreview(null)}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected node detail panel with quick actions */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute top-20 right-2 sm:right-4 z-20 w-[calc(100vw-1rem)] sm:w-80 max-w-80 glass-dropdown rounded-2xl shadow-2xl overflow-hidden max-h-[60vh] overflow-y-auto"
          >
            <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, " + selectedNode.color + ", " + selectedNode.color + "60, transparent)" }} />
            <div className="p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {selectedNode.avatarUrl ? (
                    <Avatar src={selectedNode.avatarUrl} alt={selectedNode.label} size="md" />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg" style={{ backgroundColor: selectedNode.color }}>
                      {selectedNode.type === "community" ? <Users className="h-5 w-5" /> :
                       selectedNode.type === "tag" ? <Hash className="h-5 w-5" /> :
                       selectedNode.type === "post" ? <FileText className="h-5 w-5" /> :
                       selectedNode.type === "platform" ? <Link2 className="h-5 w-5" /> :
                       selectedNode.label[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{selectedNode.label}</p>
                    {selectedNode.sublabel && <p className="text-xs text-[var(--text-muted)] truncate">{selectedNode.sublabel}</p>}
                  </div>
                </div>
                <button onClick={() => setSelectedNode(null)} className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"><X className="h-4 w-4" /></button>
              </div>

              {/* Type badges */}
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="text-[10px] capitalize">{selectedNode.type === "self" ? "You" : selectedNode.type}</Badge>
                {selectedNode.isMutual && <Badge className="text-[10px]">Mutual</Badge>}
                {selectedNode.category && <Badge variant="secondary" className="text-[10px]">{selectedNode.category}</Badge>}
                {selectedNode.type === "post" && (
                  <Badge variant="secondary" className="text-[10px] flex items-center gap-0.5">
                    <Lock className="h-2.5 w-2.5" /> Your post
                  </Badge>
                )}
              </div>

              {/* Content preview */}
              {selectedNode.content && <p className="text-xs text-[var(--text-tertiary)] leading-relaxed mb-3 line-clamp-3">{selectedNode.content}</p>}

              {/* Stats */}
              {(selectedNode.followerCount !== undefined || selectedNode.postCount !== undefined || selectedNode.memberCount !== undefined || selectedNode.likeCount !== undefined) && (
                <div className="flex items-center gap-3 mb-3 py-2 border-y border-[var(--border-primary)]">
                  {selectedNode.followerCount !== undefined && <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]"><Users className="h-3 w-3" /><span className="text-[var(--text-primary)] font-medium">{selectedNode.followerCount}</span></div>}
                  {selectedNode.postCount !== undefined && <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]"><FileText className="h-3 w-3" /><span className="text-[var(--text-primary)] font-medium">{selectedNode.postCount}</span></div>}
                  {selectedNode.memberCount !== undefined && <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]"><Users className="h-3 w-3" /><span className="text-[var(--text-primary)] font-medium">{selectedNode.memberCount}</span></div>}
                  {selectedNode.likeCount !== undefined && <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]"><Heart className="h-3 w-3" /><span className="text-[var(--text-primary)] font-medium">{selectedNode.likeCount}</span></div>}
                  {selectedNode.commentCount !== undefined && <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]"><MessageCircle className="h-3 w-3" /><span className="text-[var(--text-primary)] font-medium">{selectedNode.commentCount}</span></div>}
                </div>
              )}

              {/* Shared interests */}
              {selectedNode.sharedInterests && selectedNode.sharedInterests.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Shared interests</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.sharedInterests.map((stag) => (
                      <span key={stag} className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">#{stag}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Connection count + Zoom to */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                  {edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).length} connections in mesh
                </p>
                <button
                  onClick={() => zoomToNode(selectedNode.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
                >
                  <ZoomIn className="h-3 w-3" /> Zoom to
                </button>
              </div>

              {/* ── PRIVACY CONTROL ── */}
              {selectedNode.type !== "self" && (
                <div className="flex items-center justify-between mb-3 py-2 border-b border-[var(--border-primary)]">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Node visibility</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => toggleNodeHidden(selectedNode.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all hover:bg-[var(--bg-tertiary)]"
                      style={{ color: hiddenNodes.has(selectedNode.id) ? "#ef4444" : "var(--text-secondary)" }}
                    >
                      <HideIcon className="h-3 w-3" />
                      {hiddenNodes.has(selectedNode.id) ? "Hidden" : "Hide node"}
                    </button>
                    <button
                      onClick={() => toggleBranchHidden(selectedNode.type)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all hover:bg-[var(--bg-tertiary)]"
                      style={{ color: hiddenBranches.has(selectedNode.type) ? "#ef4444" : "var(--text-muted)" }}
                    >
                      <EyeOff className="h-3 w-3" />
                      {hiddenBranches.has(selectedNode.type) ? "Branch hidden" : "Hide all " + selectedNode.type + "s"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── QUICK ACTIONS ── */}
              <div className="space-y-2">
                {/* User quick actions: Message, Follow/Unfollow, View Profile */}
                {(selectedNode.type === "user") && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push("/messages?to=" + selectedNode.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium                     brand-button text-white transition-all active:scale-95 shadow-lg"
                                        >
                                          <Send className="h-3 w-3" /> Message
                    </button>
                    <button
                      onClick={async () => {
                        setActionLoading("follow-" + selectedNode.id);
                        await toggleFollow(selectedNode.id.replace("follower-", ""));
                        setActionLoading(null);
                      }}
                      disabled={actionLoading === "follow-" + selectedNode.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium glass-surface text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95"
                    >
                      {actionLoading === "follow-" + selectedNode.id ? (
                        <div className="h-3 w-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)" }} />
                      ) : selectedNode.isMutual ? (
                        <><UserMinus className="h-3 w-3" /> Unfollow</>
                      ) : (
                        <><UserPlus className="h-3 w-3" /> Follow</>
                      )}
                    </button>
                  </div>
                )}

                {/* Post quick actions: Like, Comment, View, Delete */}
                {selectedNode.type === "post" && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleLike(selectedNode.id)}
                        className={"flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95 " + (
                          likedPosts.has(selectedNode.id)
                            ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                            : "glass-surface text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                        )}
                      >
                        <Heart className={"h-3 w-3" + (likedPosts.has(selectedNode.id) ? " fill-current" : "")} />
                        {likedPosts.has(selectedNode.id) ? "Liked" : "Like"}
                      </button>
                      <button
                        onClick={() => router.push("/feed")}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium glass-surface text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95"
                      >
                        <MessageSquare className="h-3 w-3" /> Comment
                      </button>
                    </div>
                    <div className="flex gap-2">
                      {selectedNode.href && (
                        <Link href={selectedNode.href} className="flex-1">
                          <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium brand-button text-white transition-all active:scale-95 shadow-lg">
                            <Eye className="h-3 w-3" /> View Post
                          </button>
                        </Link>
                      )}
                      <button
                        onClick={async () => {
                          const postId = selectedNode.id.replace("post-", "");
                          setActionLoading("delete-" + postId);
                          await deletePost(postId);
                          setSelectedNode(null);
                          setActionLoading(null);
                          window.location.reload();
                        }}
                        disabled={actionLoading?.startsWith("delete-")}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 glass-surface hover:bg-red-500/10 transition-all active:scale-95"
                      >
                        {actionLoading?.startsWith("delete-") ? (
                          <div className="h-3 w-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <><Trash2 className="h-3 w-3" /> Delete</>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Platform quick actions */}
                {selectedNode.type === "platform" && (
                  <div className="flex gap-2">
                    <Link href="/connected-accounts" className="flex-1">
                      <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium brand-button text-white transition-all active:scale-95 shadow-lg">
                        <Shield className="h-3 w-3" /> Manage
                      </button>
                    </Link>
                    <Link href="/settings" className="flex-1">
                      <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium glass-surface text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95">
                        <ExternalLink className="h-3 w-3" /> Settings
                      </button>
                    </Link>
                  </div>
                )}

                {/* Community quick actions */}
                {selectedNode.type === "community" && selectedNode.href && (
                  <Link href={selectedNode.href}>
                    <Button variant="gradient" size="sm" className="w-full">
                      Visit Community <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                )}

                {/* Tag quick actions */}
                {selectedNode.type === "tag" && selectedNode.href && (
                  <Link href={selectedNode.href}>
                    <Button variant="gradient" size="sm" className="w-full">
                      <Search className="h-3.5 w-3.5 mr-1" /> Search Tag
                    </Button>
                  </Link>
                )}

                {/* Self quick actions */}
                {selectedNode.type === "self" && (
                  <div className="flex gap-2">
                    <Link href="/feed?compose=true" className="flex-1">
                      <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium brand-button text-white transition-all active:scale-95 shadow-lg">
                        <PenSquare className="h-3 w-3" /> New Post
                      </button>
                    </Link>
                    <Link href={selectedNode.href || "/settings"} className="flex-1">
                      <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium glass-surface text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95">
                        <Eye className="h-3 w-3" /> Profile
                      </button>
                    </Link>
                  </div>
                )}

                {/* Generic view button for types without specific actions */}
                {selectedNode.href && !["user", "post", "platform", "community", "tag", "self"].includes(selectedNode.type) && (
                  <Link href={selectedNode.href}>
                    <Button variant="gradient" size="sm" className="w-full">
                      View <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FOOTPRINT DASHBOARD ── */}
      <AnimatePresence>
        {showFootprint && meshStats && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-16 left-4 right-4 md:left-auto md:right-4 md:bottom-4 md:w-96 z-20 glass-dropdown rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="h-1.5 w-full" style={{ background: "var(--brand-gradient)" }} />
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MeshiLogo size={28} color="blue" mood="happy" />
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Your Digital Footprint</h3>
                    <p className="text-[10px] text-[var(--text-muted)]">Everything in your mesh at a glance</p>
                  </div>
                </div>
                <button onClick={() => setShowFootprint(false)} className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "Following", value: meshStats.followingCount, color: "text-[var(--accent)]", icon: Users },
                  { label: "Followers", value: meshStats.followerCount, color: "text-indigo-400", icon: Users },
                  { label: "Mutuals", value: meshStats.mutualCount, color: "text-blue-400", icon: Heart },
                  { label: "Posts", value: meshStats.postCount, color: "text-emerald-400", icon: FileText },
                  { label: "Communities", value: meshStats.communityCount, color: "text-sky-400", icon: Users },
                  { label: "Platforms", value: meshStats.connectedPlatformCount, color: "text-amber-400", icon: Link2 },
                ].map((stat) => (
                  <div key={stat.label} className="glass-surface rounded-xl p-2.5 text-center">
                    <stat.icon className={"h-3.5 w-3.5 mx-auto mb-1 " + stat.color} />
                    <p className={"text-lg font-bold " + stat.color}>{stat.value}</p>
                    <p className="text-[9px] text-[var(--text-muted)]">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Privacy summary */}
              <div className="glass-surface rounded-xl p-3 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  <p className="text-xs font-semibold text-[var(--text-primary)]">Privacy Status</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[var(--text-muted)]">Profile visibility</span>
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> You control</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[var(--text-muted)]">Data shared with mesh.me</span>
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1"><Shield className="h-2.5 w-2.5" /> Minimal</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[var(--text-muted)]">Third-party access</span>
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> None</span>
                  </div>
                </div>
              </div>

              {/* Quick manage links */}
              <div className="flex gap-2">
                <Link href="/settings" className="flex-1">
                  <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium brand-button text-white transition-all active:scale-95 shadow-lg">
                    <Shield className="h-3 w-3" /> Security Hub
                  </button>
                </Link>
                <Link href="/connected-accounts" className="flex-1">
                  <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium glass-surface text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95">
                    <Link2 className="h-3 w-3" /> Accounts
                  </button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── COMMAND PALETTE ── */}
      <AnimatePresence>
        {showCommandPalette && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-start justify-center pt-24 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowCommandPalette(false); }}
          >
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 400 }}
              className="w-full max-w-md glass-dropdown rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-3 border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-[var(--text-muted)]" />
                  <input
                    autoFocus
                    type="text"
                    value={commandSearch}
                    onChange={(e) => setCommandSearch(e.target.value)}
                    placeholder="Search your mesh... people, posts, communities"
                    className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                    onKeyDown={(e) => { if (e.key === "Escape") setShowCommandPalette(false); }}
                  />
                  <kbd className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] font-mono">ESC</kbd>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                {/* Filter nodes by search */}
                {nodes
                  .filter((n) => n.type !== "self" && (
                    n.label.toLowerCase().includes(commandSearch.toLowerCase()) ||
                    (n.sublabel && n.sublabel.toLowerCase().includes(commandSearch.toLowerCase())) ||
                    (n.content && n.content.toLowerCase().includes(commandSearch.toLowerCase()))
                  ))
                  .slice(0, 10)
                  .map((node) => (
                    <button
                      key={node.id}
                      onClick={() => {
                        setSelectedNode(node);
                        setShowCommandPalette(false);
                        setCommandSearch("");
                        // Pan to node
                        const canvas = canvasRef.current;
                        if (canvas) {
                          const newPan = {
                            x: -(node.x - centerRef.current.x) * zoomRef.current,
                            y: -(node.y - centerRef.current.y) * zoomRef.current,
                          };
                          setPan(newPan);
                          panRef.current = newPan;
                        }
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-[var(--bg-tertiary)] transition-all group"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: node.color }}>
                        {node.avatarUrl ? (
                          <Avatar src={node.avatarUrl} alt={node.label} size="sm" />
                        ) : (
                          node.type === "community" ? <Users className="h-4 w-4" /> :
                          node.type === "tag" ? <Hash className="h-4 w-4" /> :
                          node.type === "post" ? <FileText className="h-4 w-4" /> :
                          node.type === "platform" ? <Link2 className="h-4 w-4" /> :
                          node.label[0]
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{node.label}</p>
                        {node.sublabel && <p className="text-[10px] text-[var(--text-muted)] truncate">{node.sublabel}</p>}
                      </div>
                      <Badge variant="secondary" className="text-[9px] capitalize flex-shrink-0">{node.type}</Badge>
                    </button>
                  ))}
                {commandSearch && nodes.filter((n) => n.type !== "self" && n.label.toLowerCase().includes(commandSearch.toLowerCase())).length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-xs text-[var(--text-muted)]">No results found in your mesh</p>
                  </div>
                )}
                {!commandSearch && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider px-3 pt-2 pb-1">Quick Actions</p>
                    {[
                      { label: "Create new post", icon: PenSquare, href: "/feed?compose=true" },
                      { label: "Explore mesh.me", icon: Globe, href: "/explore" },
                      { label: "Open MeChat", icon: MessageCircle, href: "/messages" },
                      { label: "Security Hub", icon: Shield, href: "/settings" },
                      { label: "Connected Accounts", icon: Link2, href: "/connected-accounts" },
                      { label: "View your footprint", icon: Fingerprint, action: () => { setShowFootprint(true); setShowCommandPalette(false); } },
                    ].map((action) => (
                      <button
                        key={action.label}
                        onClick={() => {
                          if (action.action) {
                            action.action();
                          } else if (action.href) {
                            router.push(action.href);
                            setShowCommandPalette(false);
                          }
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-[var(--bg-tertiary)] transition-all"
                      >
                        <action.icon className="h-4 w-4 text-[var(--text-muted)]" />
                        <span className="text-sm text-[var(--text-secondary)]">{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Meshi button (bottom right) */}
      <motion.button
        onClick={() => setShowMeshiChat(!showMeshiChat)}
        className="absolute bottom-3 sm:bottom-4 right-2 sm:right-4 z-10 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full shadow-xl transition-all hover:scale-110 active:scale-95"
        style={{ background: "var(--brand-gradient)" }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="Chat with Meshi"
      >
        <MeshiMascot size={28} mood="happy" animate={false} showGlow={false} />
      </motion.button>

      {/* Meshi Chat overlay */}
      <MeshiChat
        isOpen={showMeshiChat}
        onClose={() => setShowMeshiChat(false)}
        meshData={meshStats ? {
          followers: meshStats.followerCount,
          following: meshStats.followingCount,
          posts: meshStats.postCount,
          communities: meshStats.communityCount,
          platforms: meshStats.connectedPlatformCount,
        } : undefined}
      />

      {/* Quick action bar (bottom left) */}
      <div className="absolute bottom-3 sm:bottom-4 left-2 sm:left-4 z-10 flex gap-1.5 sm:gap-2">
        <button
          onClick={() => setShowPostComposer(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-semibold text-white transition-all active:scale-95 shadow-lg brand-button hover:shadow-xl hover:shadow-blue-500/25"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Create Post</span>
        </button>
        <button
          onClick={() => setShowNodePrivacy(!showNodePrivacy)}
          className={"flex items-center gap-1.5 px-3 py-2 glass-surface rounded-xl text-[11px] font-medium transition-all active:scale-95 shadow-lg " + (
            showNodePrivacy ? "text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          <Shield className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Privacy</span>
          {(hiddenNodes.size > 0 || hiddenBranches.size > 0) && (
            <span className="text-[9px] px-1 rounded-full bg-amber-500/20 text-amber-400">{hiddenNodes.size + hiddenBranches.size}</span>
          )}
        </button>
      </div>

      {/* ── PRIVACY PANEL ── */}
      <AnimatePresence>
        {showNodePrivacy && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute top-20 left-4 z-20 w-72 glass-dropdown rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-400" />
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Mesh Privacy</h3>
                </div>
                <button onClick={() => setShowNodePrivacy(false)} className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mb-3">Control what&apos;s visible on your mesh. Hidden items are only hidden for you and won&apos;t appear on your public mesh.</p>

              {/* Branch toggles */}
              <div className="space-y-1.5 mb-3">
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Hide entire branches</p>
                {["user", "community", "tag", "post", "platform"].map((type) => {
                  const typeLabels: Record<string, string> = { user: "People", community: "Communities", tag: "Interests", post: "Posts", platform: "Platforms" };
                  const typeColors: Record<string, string> = { user: "text-blue-400", community: "text-sky-400", tag: "text-cyan-400", post: "text-emerald-400", platform: "text-amber-400" };
                  return (
                    <button
                      key={type}
                      onClick={() => toggleBranchHidden(type)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs hover:bg-[var(--bg-tertiary)] transition-all"
                    >
                      <span className={"font-medium " + (typeColors[type] || "")}>{typeLabels[type] || type}</span>
                      <span className={"text-[10px] px-2 py-0.5 rounded-full " + (
                        hiddenBranches.has(type)
                          ? "bg-red-500/15 text-red-400"
                          : "bg-emerald-500/15 text-emerald-400"
                      )}>
                        {hiddenBranches.has(type) ? "Hidden" : "Visible"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Individual hidden nodes */}
              {hiddenNodes.size > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">{hiddenNodes.size} hidden node{hiddenNodes.size !== 1 ? "s" : ""}</p>
                  <button
                    onClick={() => { setHiddenNodes(new Set()); setHiddenBranches(new Set()); }}
                    className="text-[10px] text-[var(--accent)] hover:underline"
                  >
                    Show all nodes
                  </button>
                </div>
              )}

              <Link href="/settings">
                <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium brand-button text-white transition-all active:scale-95 shadow-lg">
                  <Shield className="h-3 w-3" /> Advanced Privacy Settings
                </button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── INLINE POST COMPOSER ── */}
      <AnimatePresence>
        {showPostComposer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowPostComposer(false); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-lg mx-4 glass-dropdown rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-400" />
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-[var(--text-primary)]">Create Post</h3>
                  <button onClick={() => setShowPostComposer(false)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="What's on your mind? Share it across your mesh..."
                  className="w-full h-32 p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-all"
                  autoFocus
                />

                {/* Cross-post to connected platforms */}
                {connectedPlatforms.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Share2 className="h-3 w-3" /> Also post to
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {connectedPlatforms.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setCrossPostPlatforms((prev) => {
                              const next = new Set(prev);
                              if (next.has(p.id)) next.delete(p.id);
                              else next.add(p.id);
                              return next;
                            });
                          }}
                          className={"flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border " + (
                            crossPostPlatforms.has(p.id)
                              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                              : "border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                          )}
                        >
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-4">
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {postContent.length}/500 characters
                    {crossPostPlatforms.size > 0 && (
                      <span className="ml-2 text-[var(--accent)]">+ {crossPostPlatforms.size} platform{crossPostPlatforms.size !== 1 ? "s" : ""}</span>
                    )}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowPostComposer(false); setPostContent(""); setCrossPostPlatforms(new Set()); }}
                      className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!postContent.trim()) return;
                        // Navigate to feed compose with content pre-filled
                        router.push("/feed?compose=true");
                        setShowPostComposer(false);
                        setPostContent("");
                        setCrossPostPlatforms(new Set());
                      }}
                      disabled={!postContent.trim()}
                      className="px-5 py-2 rounded-xl text-xs font-semibold text-white brand-button shadow-lg hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                      Publish
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {nodes.length <= 1 && !loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center pointer-events-auto">
            <div className="w-20 h-20 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-4">
              <Layers className="h-10 w-10 text-[var(--text-muted)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-secondary)] mb-2">Your mesh is growing</h3>
            <p className="text-sm text-[var(--text-muted)] mb-4 max-w-sm">
              Follow people, join communities, add interests, and create posts to see your digital universe expand.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/explore"><Button variant="gradient" size="sm">Explore</Button></Link>
              <Link href="/communities"><Button variant="secondary" size="sm">Join Communities</Button></Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
