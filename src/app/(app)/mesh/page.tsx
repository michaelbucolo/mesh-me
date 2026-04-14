"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ZoomIn, ZoomOut, Maximize2, Users, Hash, Globe, MessageCircle,
  X, FileText, Link2, Sparkles, RotateCcw, Eye, EyeOff, Info,
  Layers, Fingerprint, Search, Shield, Plus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MeshiMascot, MeshiMini, type MeshiColor, type MeshiHat, type MeshiMood } from "@/components/meshi/meshi-mascot";
import { MeshiMeetOverlay, MeshiVisitorBadge } from "@/components/meshi/meshi-interactions";
import { LiveMeshiPresence } from "@/components/meshi/meshi-presence";
import { MeshTutorial } from "@/components/mesh/mesh-tutorial";
import { ContentHub } from "@/components/mesh/content-hub";
import { MeshNodeDetail } from "@/components/mesh/mesh-node-detail";
import { MeshCommandPalette } from "@/components/mesh/mesh-command-palette";
import { MeshFootprint } from "@/components/mesh/mesh-footprint";
import { MeshPrivacyPanel } from "@/components/mesh/mesh-privacy-panel";
import { MeshPostComposer } from "@/components/mesh/mesh-post-composer";
import {
  type MeshNode, type MeshEdge, type FilterType,
  NODE_COLORS, NODE_GLOW, PLATFORM_COLORS, STATUS_COLORS, hexAlpha,
} from "@/components/mesh/mesh-types";
import { Avatar } from "@/components/ui/avatar";

// --- Component ---

export default function MeshPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
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
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set());
  const [hiddenBranches, setHiddenBranches] = useState<Set<string>>(new Set());
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [showNodePrivacy, setShowNodePrivacy] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [showMeshiMeet, setShowMeshiMeet] = useState(false);
  const [showContentHub, setShowContentHub] = useState(false);
  const [myMeshiColor, setMyMeshiColor] = useState<MeshiColor>("blue");
  const [myMeshiHat, setMyMeshiHat] = useState<MeshiHat>("none");
  const router = useRouter();

  // Profile preview on node click
  const [profilePreview, setProfilePreview] = useState<MeshNode | null>(null);

  // Multi-user mesh exploration
  const [viewingUserMesh, setViewingUserMesh] = useState<MeshNode | null>(null);
  const [myNodes, setMyNodes] = useState<MeshNode[]>([]);
  const [myEdges, setMyEdges] = useState<MeshEdge[]>([]);
  const [loadingUserMesh, setLoadingUserMesh] = useState(false);
  const [viewingUserMeshiPrefs, setViewingUserMeshiPrefs] = useState<{ color: MeshiColor; hat: MeshiHat } | null>(null);

  // Load hidden nodes and Meshi prefs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("meshHiddenNodes");
      if (saved) setHiddenNodes(new Set(JSON.parse(saved)));
      const savedBranches = localStorage.getItem("meshHiddenBranches");
      if (savedBranches) setHiddenBranches(new Set(JSON.parse(savedBranches)));
      const color = localStorage.getItem("meshiColor");
      if (color) setMyMeshiColor(color as MeshiColor);
      const hat = localStorage.getItem("meshiHat");
      if (hat) setMyMeshiHat(hat as MeshiHat);
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
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
        return;
      }
      if (e.key === "Escape") {
        if (selectedNodeRef.current) setSelectedNode(null);
        else if (showCommandPalette) setShowCommandPalette(false);
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "r" || e.key === "R") { resetView(); return; }
      if (e.key === "l" || e.key === "L") { setShowLabels((prev) => !prev); return; }
      if (e.key === "s" || e.key === "S") { setShowStats((prev) => !prev); return; }
      if (e.key === "f" || e.key === "F") { setShowFootprint((prev) => !prev); return; }
      if (e.key === "+" || e.key === "=") { handleZoom(0.3); return; }
      if (e.key === "-") { handleZoom(-0.3); return; }
      const filterKeys: Record<string, FilterType> = { "1": "all", "2": "user", "3": "alter-ego", "4": "community", "5": "tag", "6": "post", "7": "platform" };
      if (filterKeys[e.key]) { setFilter(filterKeys[e.key]); return; }
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

        // Following nodes
        const followingCount = data.following?.length || 0;
        (data.following || []).forEach((f: {
          id: string; username: string; displayName: string; avatarUrl: string | null;
          isMutual: boolean; sharedCommunities: string[]; sharedInterests: string[];
          followerCount: number; postCount: number; interactionCount?: number;
          status?: string;
        }, i: number) => {
          const angle = (i / Math.max(followingCount, 1)) * Math.PI * 2;
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
            isMutual, isFollowing: true, followerCount: f.followerCount, postCount: f.postCount,
            sharedInterests: f.sharedInterests,
            status: (f.status as MeshNode["status"]) || undefined,
          });
          meshEdges.push({
            source: data.user.id, target: f.id,
            strength: isMutual ? 1.0 : 0.7,
            type: isMutual ? "mutual" : "follow",
          });
          (f.sharedCommunities || []).forEach((cId: string) => {
            meshEdges.push({ source: f.id, target: "community-" + cId, strength: 0.4, type: "community" });
          });
        });

        // Follower-only nodes
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
            sublabel: "@" + f.username, avatarUrl: f.avatarUrl, href: "/profile/" + f.username,
            x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
            vx: 0, vy: 0, radius: 12, color: NODE_COLORS.user,
            opacity: 0.7, pulsePhase: Math.random() * Math.PI * 2,
            connections: [data.user.id],
            followerCount: f.followerCount, postCount: f.postCount,
            status: (f.status as MeshNode["status"]) || undefined,
          });
          meshEdges.push({ source: data.user.id, target: "follower-" + f.id, strength: 0.3, type: "follow" });
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
            sublabel: c.memberCount + " members", href: "/communities/" + c.slug,
            x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
            vx: 0, vy: 0, radius: 24, color: NODE_COLORS.community,
            opacity: 1, pulsePhase: Math.random() * Math.PI * 2,
            connections: [data.user.id], memberCount: c.memberCount,
            content: c.description || undefined, category: c.category || undefined,
          });
          meshEdges.push({ source: data.user.id, target: "community-" + c.id, strength: 0.6, type: "community" });
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
          meshEdges.push({ source: data.user.id, target: "tag-" + tag, strength: 0.25, type: "interest" });
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
            color: NODE_COLORS.post, opacity: 0.8, pulsePhase: Math.random() * Math.PI * 2,
            connections: [data.user.id], likeCount: p.likeCount, commentCount: p.commentCount, content: p.content,
          });
          meshEdges.push({ source: data.user.id, target: "post-" + p.id, strength: 0.15, type: "post" });
          if (p.communityId) meshEdges.push({ source: "post-" + p.id, target: "community-" + p.communityId, strength: 0.3, type: "community" });
          (p.tags || []).forEach((ptag: string) => {
            meshEdges.push({ source: "post-" + p.id, target: "tag-" + ptag, strength: 0.2, type: "interest" });
          });
        });

        // Alter ego nodes
        (data.alterEgos || []).forEach((ego: {
          id: string; username: string; displayName: string; bio: string | null; avatarUrl: string | null;
        }, i: number) => {
          const angle = (i / Math.max(data.alterEgos?.length || 1, 1)) * Math.PI * 2 - Math.PI / 2;
          const dist = 90 + i * 30;
          meshNodes.push({
            id: "alter-ego-" + ego.id, type: "alter-ego", label: ego.displayName,
            sublabel: "@" + ego.username, avatarUrl: ego.avatarUrl,
            x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
            vx: 0, vy: 0, radius: 22, color: NODE_COLORS["alter-ego"],
            opacity: 1, pulsePhase: Math.random() * Math.PI * 2,
            connections: [data.user.id], content: ego.bio || undefined,
          });
          meshEdges.push({ source: data.user.id, target: "alter-ego-" + ego.id, strength: 0.9, type: "alter-ego" });
        });

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
            connections: [data.user.id], platform: acc.platform,
          });
          meshEdges.push({ source: data.user.id, target: "platform-" + acc.platform, strength: 0.5, type: "platform" });
        });

        // Preload images
        for (const node of meshNodes) {
          const imgUrl = node.avatarUrl || node.imageUrl;
          if (imgUrl && !imageCache.current.has(node.id)) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => { imageCache.current.set(node.id, img); };
            img.onerror = () => { imageCache.current.set(node.id, null); };
            img.src = imgUrl;
            imageCache.current.set(node.id, null);
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
        node.vx += (cx - node.x) * 0.00008;
        node.vy += (cy - node.y) * 0.00008;
      }
      node.vx *= 0.92;
      node.vy *= 0.92;
      if (node.type !== "self") { node.x += node.vx; node.y += node.vy; }
    }

    for (const edge of es) {
      const source = ns.find((n) => n.id === edge.source);
      const target = ns.find((n) => n.id === edge.target);
      if (!source || !target) continue;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const interactions = edge.interactionCount || 0;
      const interactionProximity = 1 / (1 + interactions * 0.1);
      const baseIdealDist = source.radius + target.radius + 80 + (1 - edge.strength) * 120;
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
      ctx.translate(-centerRef.current.x, -centerRef.current.y);

      // Draw edges
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
          ctx.quadraticCurveTo(mx - edy * 0.15, my + edx * 0.15, target.x, target.y);
        } else {
          ctx.lineTo(target.x, target.y);
        }

        const edgeColor = edge.type === "mutual" ? "167, 139, 250"
          : edge.type === "community" ? "236, 72, 153"
          : edge.type === "interest" ? "6, 182, 212"
          : edge.type === "post" ? "16, 185, 129"
          : edge.type === "platform" ? "245, 158, 11"
          : "99, 102, 241";

        ctx.strokeStyle = `rgba(${edgeColor}, ${baseAlpha + pulseAlpha})`;
        const interactionBoost = edge.interactionCount ? Math.min(edge.interactionCount * 0.3, 2.5) : 0;
        ctx.lineWidth = isHighlighted ? 2 + interactionBoost : 0.5 + edge.strength * 0.5 + interactionBoost;
        ctx.stroke();

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

      // Draw nodes
      for (const node of ns) {
        if (f !== "all" && node.type !== f && node.type !== "self") continue;

        const isHovered = hovered?.id === node.id;
        const isSelected = selected?.id === node.id;
        const isConnectedToHovered = hovered && es.some((e) =>
          (e.source === hovered.id && e.target === node.id) || (e.target === hovered.id && e.source === node.id)
        );
        const isConnectedToSelected = selected && es.some((e) =>
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
        const cachedImg = imageCache.current.get(node.id);
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

          ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * nodeOpacity})`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          if (node.type === "self") {
            const initials = node.label.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "ME";
            ctx.font = `bold ${nodeRadius * 0.55}px system-ui, -apple-system, sans-serif`;
            ctx.fillText(initials, node.x, node.y);
          } else if (node.type === "community") {
            ctx.font = `${Math.max(9, nodeRadius * 0.5)}px system-ui, -apple-system, sans-serif`;
            ctx.fillText((node.label[0] || "C").toUpperCase(), node.x, node.y);
          } else if (node.type === "tag") {
            ctx.font = `${Math.max(9, nodeRadius * 0.5)}px system-ui, -apple-system, sans-serif`;
            ctx.fillText("#", node.x, node.y);
          } else if (node.type === "post") {
            ctx.font = `${Math.max(7, nodeRadius * 0.45)}px system-ui, -apple-system, sans-serif`;
            ctx.fillText("\u2726", node.x, node.y);
          } else if (node.type === "platform") {
            ctx.font = `bold ${nodeRadius * 0.5}px system-ui, -apple-system, sans-serif`;
            ctx.fillText(node.label[0], node.x, node.y);
          } else {
            ctx.font = `bold ${nodeRadius * 0.6}px system-ui, -apple-system, sans-serif`;
            ctx.fillText((node.label[0] || "?").toUpperCase(), node.x, node.y);
          }
        }

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
          if (node.sublabel && (isHovered || isSelected)) {
            ctx.fillStyle = `rgba(161, 161, 170, ${0.7 * nodeOpacity})`;
            ctx.font = `${Math.max(8, nodeRadius * 0.4)}px system-ui, -apple-system, sans-serif`;
            ctx.fillText(node.sublabel, node.x, node.y + nodeRadius + 20);
          }
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

      // Hover tooltip
      if (hovered && z >= 0.5) {
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
          if (parts.length > 0) ttLines.push(parts.join(" · "));
          if (hovered.sharedInterests && hovered.sharedInterests.length > 0)
            ttLines.push("Shared: " + hovered.sharedInterests.slice(0, 3).join(", "));
        } else if (hovered.type === "community") {
          if (hovered.memberCount !== undefined) ttLines.push(hovered.memberCount + " members");
        } else if (hovered.type === "post") {
          if (hovered.content) ttLines.push(hovered.content.slice(0, 50) + (hovered.content.length > 50 ? "..." : ""));
          const parts: string[] = [];
          if (hovered.likeCount !== undefined) parts.push(hovered.likeCount + " likes");
          if (hovered.commentCount !== undefined) parts.push(hovered.commentCount + " comments");
          if (parts.length > 0) ttLines.push(parts.join(" · "));
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

      ctx.restore();
      animationRef.current = requestAnimationFrame(render);
    };

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width === 0 || canvas.height === 0) {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      centerRef.current = { x: canvas.offsetWidth / 2, y: canvas.offsetHeight / 2 };
    }

    render();
    return () => cancelAnimationFrame(animationRef.current);
  }, [simulate, loading]);

  // Canvas resize
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
  }, [loading]);

  // --- Interaction handlers ---

  const getWorldCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const z = zoomRef.current;
    const p = panRef.current;
    return {
      x: (mx - canvas.offsetWidth / 2 - p.x) / z + centerRef.current.x,
      y: (my - canvas.offsetHeight / 2 - p.y) / z + centerRef.current.y,
    };
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

  const zoomToNodeRef = useRef<(nodeId: string) => void>(() => {});

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragActiveRef.current) return;
    const coords = getWorldCoords(e.clientX, e.clientY);
    const node = findNodeAt(coords.x, coords.y);
    if (node?.type === "self" && node.href) { router.push(node.href); return; }
    if (node?.type === "user") {
      setProfilePreview(node);
      zoomToNodeRef.current(node.id);
    }
    setSelectedNode(node);
  }, [getWorldCoords, findNodeAt, router]);

  // Enter another user's mesh on double-click
  const enterUserMesh = useCallback(async (node: MeshNode) => {
    if (!node.sublabel) return;
    const username = node.sublabel.replace("@", "");
    setLoadingUserMesh(true);
    try {
      if (!viewingUserMesh) {
        setMyNodes([...nodesRef.current]);
        setMyEdges([...edgesRef.current]);
      }
      const res = await fetch(`/api/users/${username}/mesh`);
      if (!res.ok) throw new Error("Failed to load user mesh");
      const data = await res.json();

      if (data.meshiPreference) {
        setViewingUserMeshiPrefs({
          color: (data.meshiPreference.colorTheme || "blue") as MeshiColor,
          hat: (data.meshiPreference.hatStyle || "none") as MeshiHat,
        });
      } else {
        setViewingUserMeshiPrefs({ color: "blue", hat: "none" });
      }

      const cx = centerRef.current.x || 600, cy = centerRef.current.y || 400;
      const userNodes: MeshNode[] = [];
      const userEdges: MeshEdge[] = [];

      userNodes.push({
        id: data.user?.id || node.id, type: "self", label: data.user?.displayName || node.label,
        sublabel: "@" + username, avatarUrl: data.user?.avatarUrl || node.avatarUrl,
        href: "/profile/" + username,
        x: cx, y: cy, vx: 0, vy: 0, radius: 35, color: node.color || NODE_COLORS.self,
        opacity: 1, pulsePhase: 0, connections: [],
      });

      const following = data.following || [];
      following.slice(0, 30).forEach((f: {
        id: string; username: string; displayName: string; avatarUrl: string | null;
        isMutual: boolean; followerCount: number; postCount: number;
      }, i: number) => {
        const angle = (i / Math.max(following.length, 1)) * Math.PI * 2;
        const dist = 140 + Math.random() * 50;
        const isMutual = f.isMutual;
        userNodes.push({
          id: f.id, type: "user", label: f.displayName,
          sublabel: "@" + f.username, avatarUrl: f.avatarUrl, href: "/profile/" + f.username,
          x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
          vx: 0, vy: 0, radius: isMutual ? 18 : 14,
          color: isMutual ? NODE_COLORS.mutual : NODE_COLORS.user,
          opacity: 1, pulsePhase: Math.random() * Math.PI * 2,
          connections: [data.user?.id || node.id],
          isMutual, followerCount: f.followerCount, postCount: f.postCount,
        });
        userEdges.push({
          source: data.user?.id || node.id, target: f.id,
          strength: isMutual ? 1.0 : 0.7, type: isMutual ? "mutual" : "follow",
        });
      });

      (data.communities || []).slice(0, 6).forEach((c: { id: string; name: string; memberCount: number }, i: number) => {
        const angle = (i / 6) * Math.PI * 2 + Math.PI / 3;
        const dist = 200 + Math.random() * 40;
        userNodes.push({
          id: "community-" + c.id, type: "community", label: c.name,
          x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
          vx: 0, vy: 0, radius: 14, color: NODE_COLORS.community,
          opacity: 0.9, pulsePhase: Math.random() * Math.PI * 2,
          connections: [data.user?.id || node.id], memberCount: c.memberCount,
        });
        userEdges.push({
          source: data.user?.id || node.id, target: "community-" + c.id,
          strength: 0.5, type: "community",
        });
      });

      setNodes(userNodes);
      setEdges(userEdges);
      nodesRef.current = userNodes;
      edgesRef.current = userEdges;
      setViewingUserMesh(node);
      setSelectedNode(null);
      setProfilePreview(null);
      setShowMeshiMeet(false);
      setZoom(1); zoomRef.current = 1;
      setPan({ x: 0, y: 0 }); panRef.current = { x: 0, y: 0 };
    } catch {
      if (node.href) router.push(node.href);
    } finally {
      setLoadingUserMesh(false);
    }
  }, [viewingUserMesh, router]);

  const returnToMyMesh = useCallback(() => {
    if (myNodes.length > 0) {
      setNodes(myNodes);
      setEdges(myEdges);
      nodesRef.current = myNodes;
      edgesRef.current = myEdges;
    }
    setViewingUserMesh(null);
    setViewingUserMeshiPrefs(null);
    setShowMeshiMeet(false);
    setSelectedNode(null);
    setProfilePreview(null);
    setZoom(1); zoomRef.current = 1;
    setPan({ x: 0, y: 0 }); panRef.current = { x: 0, y: 0 };
  }, [myNodes, myEdges]);

  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getWorldCoords(e.clientX, e.clientY);
    const node = findNodeAt(coords.x, coords.y);
    if (node?.type === "user" && node.sublabel) { enterUserMesh(node); return; }
    if (node?.href) window.location.href = node.href;
  }, [getWorldCoords, findNodeAt, enterUserMesh]);

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
    if (canvasRef.current) canvasRef.current.style.cursor = node ? "pointer" : "grab";
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
      lastTouchRef.current = { x: e.touches[0].clientX - panRef.current.x, y: e.touches[0].clientY - panRef.current.y };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchRef.current = { x: 0, y: 0, dist: Math.sqrt(dx * dx + dy * dy) };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 1 && lastTouchRef.current && lastTouchRef.current.dist === undefined) {
      const newPan = { x: e.touches[0].clientX - lastTouchRef.current.x, y: e.touches[0].clientY - lastTouchRef.current.y };
      setPan(newPan);
      panRef.current = newPan;
    } else if (e.touches.length === 2 && lastTouchRef.current && lastTouchRef.current.dist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.sqrt(dx * dx + dy * dy);
      const newZoom = Math.max(0.2, Math.min(4, zoomRef.current * (newDist / lastTouchRef.current.dist)));
      setZoom(newZoom);
      zoomRef.current = newZoom;
      lastTouchRef.current.dist = newDist;
    }
  }, []);

  const handleTouchEnd = useCallback(() => { lastTouchRef.current = null; }, []);

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

  const zoomToNode = useCallback((nodeId: string) => {
    const targetNode = nodesRef.current.find((n) => n.id === nodeId);
    if (!targetNode || !canvasRef.current) return;
    const cx = centerRef.current.x;
    const cy = centerRef.current.y;
    const targetZoom = 2.0;
    const offsetX = -(targetNode.x - cx) * targetZoom;
    const offsetY = -(targetNode.y - cy) * targetZoom;
    const startPan = { ...panRef.current };
    const startZoom = zoomRef.current;
    const duration = 600;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const newZoom = startZoom + (targetZoom - startZoom) * ease;
      const newPanX = startPan.x + (offsetX - startPan.x) * ease;
      const newPanY = startPan.y + (offsetY - startPan.y) * ease;
      setZoom(newZoom);
      zoomRef.current = newZoom;
      setPan({ x: newPanX, y: newPanY });
      panRef.current = { x: newPanX, y: newPanY };
      if (t < 1) requestAnimationFrame(animate);
      else setSelectedNode(targetNode);
    };
    requestAnimationFrame(animate);
  }, []);

  zoomToNodeRef.current = zoomToNode;

  // Filter options
  const filterOptions: { id: FilterType; label: string; icon: React.ElementType; count: number }[] = [
    { id: "all", label: "Everything", icon: Globe, count: visibleNodes.length },
    { id: "user", label: "People", icon: Users, count: visibleNodes.filter((n) => n.type === "user").length },
    { id: "alter-ego", label: "Alter Egos", icon: Sparkles, count: visibleNodes.filter((n) => n.type === "alter-ego").length },
    { id: "community", label: "Communities", icon: MessageCircle, count: visibleNodes.filter((n) => n.type === "community").length },
    { id: "tag", label: "Interests", icon: Hash, count: visibleNodes.filter((n) => n.type === "tag").length },
    { id: "post", label: "Posts", icon: FileText, count: visibleNodes.filter((n) => n.type === "post").length },
    { id: "platform", label: "Platforms", icon: Link2, count: visibleNodes.filter((n) => n.type === "platform").length },
  ];

  const connectedPlatforms = nodes.filter((n) => n.type === "platform").map((n) => ({
    id: n.id, label: n.label, color: n.color,
  }));

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-[var(--bg-primary)]">
        <div className="text-center">
          <motion.div
            className="relative mx-auto mb-8"
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <MeshiMascot size={80} mood="searching" color={myMeshiColor} hat={myMeshiHat} showGlow animate />
          </motion.div>
          <motion.p
            className="text-[var(--text-primary)] font-semibold text-lg mb-1"
            animate={{ opacity: [1, 0.7, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Building your mesh
          </motion.p>
          <p className="text-[var(--text-muted)] text-sm">Mapping your digital universe</p>
          <div className="mt-6 mx-auto w-48 h-1 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-indigo-500"
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: "40%" }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-[var(--bg-primary)]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <X className="h-8 w-8 text-red-400" />
          </div>
          <p className="text-[var(--text-primary)] font-semibold mb-1">Something went wrong</p>
          <p className="text-[var(--text-muted)] text-sm mb-4">{error}</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4 mr-2" /> Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div data-meshi-zone="mesh-canvas" className="relative h-[calc(100vh-4rem)] overflow-hidden bg-[var(--bg-primary)]">
      <MeshTutorial />

      {/* Top bar — filter pills + action buttons */}
      <div className="absolute top-0 left-0 right-0 z-10 p-2 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1 rounded-2xl p-1 bg-black/30 backdrop-blur-xl border border-white/[0.06] overflow-x-auto scrollbar-hide">
            {filterOptions.filter((fItem) => fItem.count > 0 || fItem.id === "all").map((fItem) => {
              const IconComp = fItem.icon;
              const isActive = filter === fItem.id;
              return (
                <button
                  key={fItem.id}
                  onClick={() => setFilter(fItem.id)}
                  className={"flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all duration-200 whitespace-nowrap " + (
                    isActive
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-white/50 hover:text-white/80 hover:bg-white/[0.06]"
                  )}
                  title={fItem.label}
                >
                  <IconComp className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{fItem.label}</span>
                  {isActive && fItem.count > 0 && fItem.id !== "all" && (
                    <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full">{fItem.count}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCommandPalette(true)} className="p-2.5 rounded-xl bg-black/30 backdrop-blur-xl border border-white/[0.06] text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200" title="Search mesh (Cmd+K)">
              <Search className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowFootprint(!showFootprint)}
              className={"p-2.5 rounded-xl backdrop-blur-xl border transition-all duration-200 " + (
                showFootprint
                  ? "bg-indigo-500/30 border-indigo-400/30 text-indigo-300"
                  : "bg-black/30 border-white/[0.06] text-white/60 hover:text-white hover:bg-white/10"
              )}
              title="Digital Footprint"
            >
              <Fingerprint className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute top-1/2 -translate-y-1/2 right-2 sm:right-3 z-10 flex flex-col gap-1 bg-black/30 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-1.5">
        <button onClick={() => handleZoom(0.3)} className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all duration-200" title="Zoom in"><ZoomIn className="h-4 w-4" /></button>
        <button onClick={() => handleZoom(-0.3)} className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all duration-200" title="Zoom out"><ZoomOut className="h-4 w-4" /></button>
        <button onClick={resetView} className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all duration-200" title="Reset view"><Maximize2 className="h-4 w-4" /></button>
        <div className="h-px bg-white/[0.08] mx-1" />
        <button onClick={() => setShowLabels(!showLabels)} className={"p-2 rounded-xl transition-all duration-200 " + (showLabels ? "text-indigo-400 bg-indigo-500/15" : "text-white/40 hover:text-white/70")} title={showLabels ? "Hide labels" : "Show labels"}>{showLabels ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
        <button onClick={() => setShowStats(!showStats)} className={"p-2 rounded-xl transition-all duration-200 " + (showStats ? "text-indigo-400 bg-indigo-500/15" : "text-white/40 hover:text-white/70")} title={showStats ? "Hide stats" : "Show stats"}><Info className="h-4 w-4" /></button>
      </div>

      {/* Stats bar */}
      <AnimatePresence>
        {showStats && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-16 sm:bottom-[4.5rem] left-2 sm:left-4 z-10 flex gap-1.5 flex-wrap max-w-[calc(100vw-6rem)]"
          >
            {[
              { label: "people", count: nodes.filter((n) => n.type === "user").length, color: "text-indigo-400" },
              { label: "communities", count: nodes.filter((n) => n.type === "community").length, color: "text-pink-400" },
              { label: "interests", count: nodes.filter((n) => n.type === "tag").length, color: "text-cyan-400" },
              { label: "posts", count: nodes.filter((n) => n.type === "post").length, color: "text-emerald-400" },
              { label: "platforms", count: nodes.filter((n) => n.type === "platform").length, color: "text-amber-400" },
            ].filter((s) => s.count > 0).map((s) => (
              <div key={s.label} className="bg-black/30 backdrop-blur-xl border border-white/[0.06] rounded-xl px-2.5 py-1.5 text-[11px] text-white/50">
                <span className={"font-bold " + s.color}>{s.count}</span> {s.label}
              </div>
            ))}
            <div className="bg-black/30 backdrop-blur-xl border border-white/[0.06] rounded-xl px-2.5 py-1.5 text-[11px] text-white/40">
              {Math.round(zoom * 100)}%
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back to my mesh button */}
      <AnimatePresence>
        {viewingUserMesh && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-16 left-1/2 -translate-x-1/2 z-20">
            <button onClick={returnToMyMesh} className="flex items-center gap-2 px-4 py-2 glass-dropdown rounded-xl text-xs font-medium text-[var(--text-primary)] shadow-xl hover:bg-[var(--bg-tertiary)] transition-all active:scale-95">
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Back to my mesh</span>
              <span className="text-[var(--text-muted)]">&middot;</span>
              {viewingUserMeshiPrefs && <MeshiMini size={18} color={viewingUserMeshiPrefs.color} hat={viewingUserMeshiPrefs.hat} mood="happy" />}
              <span className="text-[var(--text-muted)]">Viewing {viewingUserMesh.label}&apos;s mesh</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading overlay when entering another user's mesh */}
      <AnimatePresence>
        {loadingUserMesh && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="glass-dropdown rounded-2xl p-6 shadow-2xl text-center">
              <motion.div animate={{ x: [0, 50, -30, 40, -20, 0], y: [0, -20, 10, -30, 15, 0], rotate: [0, 10, -10, 5, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }} className="mx-auto mb-3">
                <MeshiMascot size={56} mood="excited" color={myMeshiColor} hat={myMeshiHat} showGlow animate />
              </motion.div>
              <p className="text-sm text-[var(--text-primary)] font-medium">Meshi is exploring...</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Entering their mesh</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Meshi visitor badge */}
      <AnimatePresence>
        {viewingUserMesh && !loadingUserMesh && (
          <MeshiVisitorBadge viewingUsername={viewingUserMesh.label} onInteract={() => setShowMeshiMeet(true)} />
        )}
      </AnimatePresence>

      {/* Live Meshi presence */}
      <LiveMeshiPresence
        viewingMesh={viewingUserMesh ? viewingUserMesh.id : null}
        myMeshiColor={myMeshiColor}
        myMeshiHat={myMeshiHat}
        onInteract={(presence) => {
          if (!viewingUserMesh) return;
          setViewingUserMeshiPrefs({ color: presence.meshiColor as MeshiColor, hat: presence.meshiHat as MeshiHat });
          setShowMeshiMeet(true);
        }}
      />

      {/* Meshi-to-Meshi interaction overlay */}
      <AnimatePresence>
        {showMeshiMeet && viewingUserMesh && viewingUserMeshiPrefs && (
          <MeshiMeetOverlay
            myMeshi={{ color: myMeshiColor, hat: myMeshiHat, mood: "excited" as MeshiMood, username: "You" }}
            theirMeshi={{ color: viewingUserMeshiPrefs.color, hat: viewingUserMeshiPrefs.hat, mood: "happy" as MeshiMood, username: viewingUserMesh.label }}
            onClose={() => setShowMeshiMeet(false)}
          />
        )}
      </AnimatePresence>

      {/* Hint */}
      {nodes.length > 0 && !selectedNode && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[5] bg-black/25 backdrop-blur-xl border border-white/[0.04] rounded-full px-4 py-1.5 text-[10px] text-white/35 pointer-events-none hidden md:block">
          {viewingUserMesh
            ? "Double-click to explore deeper \u00b7 Click back to return"
            : "Click to inspect \u00b7 Double-click to enter mesh \u00b7 Scroll to zoom \u00b7 \u2318K search"
          }
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

      {/* Profile Preview Panel */}
      <AnimatePresence>
        {profilePreview && profilePreview.type === "user" && (
          <motion.div
            initial={{ opacity: 0, x: 20, y: -10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 20, y: -10 }}
            transition={{ type: "spring", damping: 25 }}
            className="absolute top-4 right-4 z-20 w-64 glass-dropdown rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="h-12 w-full" style={{ background: `linear-gradient(135deg, ${profilePreview.color}40, ${profilePreview.color}10)` }} />
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
              {profilePreview.status && (
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[profilePreview.status] || STATUS_COLORS.offline }} />
                  <span className="text-[10px] text-[var(--text-muted)] capitalize">{profilePreview.status === "dnd" ? "Do Not Disturb" : profilePreview.status}</span>
                </div>
              )}
              <div className="flex items-center gap-3 mb-3 text-[10px] text-[var(--text-muted)]">
                {profilePreview.followerCount !== undefined && <span><strong className="text-[var(--text-primary)]">{profilePreview.followerCount}</strong> followers</span>}
                {profilePreview.postCount !== undefined && <span><strong className="text-[var(--text-primary)]">{profilePreview.postCount}</strong> posts</span>}
              </div>
              {profilePreview.sharedInterests && profilePreview.sharedInterests.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {profilePreview.sharedInterests.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">#{tag}</span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                {profilePreview.href && (
                  <Link href={profilePreview.href} className="flex-1">
                    <button className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium brand-button text-white transition-all active:scale-95">
                      View Profile <span className="ml-0.5">→</span>
                    </button>
                  </Link>
                )}
                <button onClick={() => setProfilePreview(null)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected node detail panel (extracted component) */}
      <AnimatePresence>
        {selectedNode && (
          <MeshNodeDetail
            node={selectedNode}
            edges={edges}
            hiddenNodes={hiddenNodes}
            hiddenBranches={hiddenBranches}
            likedPosts={likedPosts}
            actionLoading={actionLoading}
            onClose={() => setSelectedNode(null)}
            onToggleNodeHidden={toggleNodeHidden}
            onToggleBranchHidden={toggleBranchHidden}
            onToggleLike={toggleLike}
            onSetActionLoading={setActionLoading}
            onZoomToNode={zoomToNode}
          />
        )}
      </AnimatePresence>

      {/* Footprint dashboard (extracted component) */}
      <AnimatePresence>
        {showFootprint && meshStats && (
          <MeshFootprint
            meshStats={meshStats}
            meshiColor={myMeshiColor}
            meshiHat={myMeshiHat}
            onClose={() => setShowFootprint(false)}
          />
        )}
      </AnimatePresence>

      {/* Command palette (extracted component) */}
      <AnimatePresence>
        {showCommandPalette && (
          <MeshCommandPalette
            nodes={nodes}
            searchQuery={commandSearch}
            onSearchChange={setCommandSearch}
            onClose={() => setShowCommandPalette(false)}
            onSelectNode={setSelectedNode}
            onShowFootprint={() => setShowFootprint(true)}
            centerRef={centerRef}
            zoomRef={zoomRef}
            panRef={panRef}
            onPanChange={(newPan) => { setPan(newPan); panRef.current = newPan; }}
          />
        )}
      </AnimatePresence>

      {/* Quick action bar (bottom left) */}
      <div className="absolute bottom-3 sm:bottom-4 left-2 sm:left-4 z-10 flex gap-2">
        <button onClick={() => setShowPostComposer(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-semibold text-white transition-all duration-200 active:scale-95 shadow-lg bg-indigo-500 hover:bg-indigo-400 hover:shadow-indigo-500/30">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Create Post</span>
        </button>
        <button
          onClick={() => setShowContentHub(true)}
          className={"flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-medium transition-all duration-200 active:scale-95 backdrop-blur-xl border " + (
            showContentHub ? "bg-cyan-500/20 border-cyan-400/30 text-cyan-300" : "bg-black/30 border-white/[0.06] text-white/60 hover:text-white hover:bg-white/10"
          )}
        >
          <Layers className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Content Hub</span>
        </button>
        <button
          onClick={() => setShowNodePrivacy(!showNodePrivacy)}
          className={"flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-medium transition-all duration-200 active:scale-95 backdrop-blur-xl border " + (
            showNodePrivacy ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300" : "bg-black/30 border-white/[0.06] text-white/60 hover:text-white hover:bg-white/10"
          )}
        >
          <Shield className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Privacy</span>
          {(hiddenNodes.size > 0 || hiddenBranches.size > 0) && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/25 text-amber-300 font-bold">{hiddenNodes.size + hiddenBranches.size}</span>
          )}
        </button>
      </div>

      {/* Content Hub */}
      <ContentHub isOpen={showContentHub} onClose={() => setShowContentHub(false)} onDeleteSuccess={() => window.location.reload()} />

      {/* Privacy panel (extracted component) */}
      <AnimatePresence>
        {showNodePrivacy && (
          <MeshPrivacyPanel
            hiddenNodes={hiddenNodes}
            hiddenBranches={hiddenBranches}
            onToggleBranchHidden={toggleBranchHidden}
            onShowAll={() => { setHiddenNodes(new Set()); setHiddenBranches(new Set()); }}
            onClose={() => setShowNodePrivacy(false)}
          />
        )}
      </AnimatePresence>

      {/* Post composer (extracted component) */}
      <AnimatePresence>
        {showPostComposer && (
          <MeshPostComposer
            connectedPlatforms={connectedPlatforms}
            onClose={() => setShowPostComposer(false)}
          />
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
