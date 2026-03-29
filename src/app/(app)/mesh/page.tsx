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
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toggleFollow, deletePost } from "@/lib/actions";

// --- Types ---

interface MeshNode {
  id: string;
  type: "self" | "user" | "community" | "tag" | "post" | "platform";
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
}

interface MeshEdge {
  source: string;
  target: string;
  strength: number;
  type: "follow" | "mutual" | "community" | "interest" | "post" | "platform";
}

// --- Constants ---

const NODE_COLORS: Record<string, string> = {
  self: "#3b82f6",
  user: "#60a5fa",
  mutual: "#818cf8",
  community: "#ec4899",
  tag: "#06b6d4",
  post: "#22c55e",
  platform: "#f59e0b",
};

const NODE_GLOW: Record<string, string> = {
  self: "rgba(59, 130, 246, 0.3)",
  user: "rgba(96, 165, 250, 0.2)",
  mutual: "rgba(129, 140, 248, 0.25)",
  community: "rgba(236, 72, 153, 0.2)",
  tag: "rgba(6, 182, 212, 0.2)",
  post: "rgba(34, 197, 94, 0.15)",
  platform: "rgba(245, 158, 11, 0.2)",
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

type FilterType = "all" | "user" | "community" | "tag" | "post" | "platform";

// --- Helpers ---

function hexAlpha(opacity: number): string {
  const clamped = Math.max(0, Math.min(1, opacity));
  return Math.round(clamped * 255).toString(16).padStart(2, "0");
}

// --- Component ---

export default function MeshPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
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
  const router = useRouter();

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

  // Keyboard shortcut: Cmd/Ctrl+K for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- Load mesh data ---

  useEffect(() => {
    async function loadMeshData() {
      try {
        const res = await fetch("/api/mesh");
        if (!res.ok) throw new Error("Failed to load mesh data");
        const data = await res.json();

        const cx = 600, cy = 400;
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
          followerCount: number; postCount: number;
        }, i: number) => {
          const angle = (i / Math.max(followingCount, 1)) * Math.PI * 2;
          const dist = 160 + Math.random() * 60;
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

        // Follower-only nodes
        const followingIds = new Set((data.following || []).map((f: { id: string }) => f.id));
        (data.followers || []).forEach((f: {
          id: string; username: string; displayName: string; avatarUrl: string | null;
          isMutual: boolean; followerCount: number; postCount: number;
        }, i: number) => {
          if (followingIds.has(f.id)) return;
          const angle = (i / Math.max(data.followers.length, 1)) * Math.PI * 2 + 0.5;
          const dist = 230 + Math.random() * 80;
          meshNodes.push({
            id: "follower-" + f.id, type: "user", label: f.displayName,
            sublabel: "@" + f.username,
            avatarUrl: f.avatarUrl, href: "/profile/" + f.username,
            x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
            vx: 0, vy: 0, radius: 12, color: NODE_COLORS.user,
            opacity: 0.7, pulsePhase: Math.random() * Math.PI * 2,
            connections: [data.user.id],
            followerCount: f.followerCount, postCount: f.postCount,
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
        const minDist = node.radius + other.radius + 50;
        if (dist < minDist * 2.5) {
          const force = (minDist * 2.5 - dist) * 0.003;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (node.type !== "self") { node.vx -= fx; node.vy -= fy; }
          if (other.type !== "self") { other.vx += fx; other.vy += fy; }
        }
      }

      if (node.type !== "self") {
        node.vx += (cx - node.x) * 0.00008;
        node.vy += (cy - node.y) * 0.00008;
        const ndx = node.x - cx;
        const ndy = node.y - cy;
        const ndist = Math.sqrt(ndx * ndx + ndy * ndy) || 1;
        node.vx += (-ndy / ndist) * 0.015;
        node.vy += (ndx / ndist) * 0.015;
      }

      node.vx *= 0.96;
      node.vy *= 0.96;

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
      const idealDist = source.radius + target.radius + 80 + (1 - edge.strength) * 120;
      const diff = dist - idealDist;
      if (Math.abs(diff) > 5) {
        const force = diff * 0.001 * edge.strength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (target.type !== "self") { target.vx -= fx; target.vy -= fy; }
        if (source.type !== "self") { source.vx += fx; source.vy += fy; }
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

      // Draw edges
      for (const edge of es) {
        const source = ns.find((n) => n.id === edge.source);
        const target = ns.find((n) => n.id === edge.target);
        if (!source || !target) continue;
        if (f !== "all" && target.type !== f && source.type !== f && source.type !== "self" && target.type !== "self") continue;

        const isHighlighted = (hovered && (hovered.id === source.id || hovered.id === target.id))
          || (selected && (selected.id === source.id || selected.id === target.id));

        const baseAlpha = isHighlighted ? 0.4 : 0.08 + edge.strength * 0.12;
        const pulseAlpha = Math.sin(time * 2 + edge.strength * 5) * 0.03;

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
        ctx.lineWidth = isHighlighted ? 2.5 : 0.8 + edge.strength * 1.2;
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

      // Draw nodes
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

        const glowRadius = nodeRadius * (2.5 + pulse * 0.8);
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);
        gradient.addColorStop(0, glowColor.replace(/[\d.]+\)$/, (0.3 * nodeOpacity) + ")"));
        gradient.addColorStop(0.5, glowColor.replace(/[\d.]+\)$/, (0.1 * nodeOpacity) + ")"));
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        if (node.type === "self") {
          const ringRadius = nodeRadius + 8 + pulse * 6;
          ctx.beginPath();
          ctx.arc(node.x, node.y, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(59, 130, 246, " + (0.15 + pulse * 0.1) + ")";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
        const fillGrad = ctx.createRadialGradient(
          node.x - nodeRadius * 0.3, node.y - nodeRadius * 0.3, 0,
          node.x, node.y, nodeRadius
        );
        fillGrad.addColorStop(0, node.color + hexAlpha(0.5 * nodeOpacity));
        fillGrad.addColorStop(1, node.color + hexAlpha(0.2 * nodeOpacity));
        ctx.fillStyle = fillGrad;
        ctx.fill();

        ctx.strokeStyle = node.color + hexAlpha((isHovered || isSelected ? 1 : 0.7) * nodeOpacity);
        ctx.lineWidth = isHovered || isSelected ? 2.5 : 1.5;
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 255, 255, " + (0.85 * nodeOpacity) + ")";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (node.type === "self") {
          ctx.font = "bold " + (nodeRadius * 0.7) + "px system-ui, -apple-system, sans-serif";
          ctx.fillText("me", node.x, node.y);
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
      }

      ctx.restore();
      animationRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationRef.current);
  }, [simulate]);

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
  }, []);

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

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragActiveRef.current) return;
    const coords = getWorldCoords(e.clientX, e.clientY);
    const node = findNodeAt(coords.x, coords.y);
    setSelectedNode(node);
  }, [getWorldCoords, findNodeAt]);

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

  // --- Filter options ---

  const filterOptions: { id: FilterType; label: string; icon: React.ElementType; count: number }[] = [
    { id: "all", label: "Everything", icon: Globe, count: nodes.length },
    { id: "user", label: "People", icon: Users, count: nodes.filter((n) => n.type === "user").length },
    { id: "community", label: "Communities", icon: MessageCircle, count: nodes.filter((n) => n.type === "community").length },
    { id: "tag", label: "Interests", icon: Hash, count: nodes.filter((n) => n.type === "tag").length },
    { id: "post", label: "Posts", icon: FileText, count: nodes.filter((n) => n.type === "post").length },
    { id: "platform", label: "Platforms", icon: Link2, count: nodes.filter((n) => n.type === "platform").length },
  ];

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-[var(--bg-primary)]">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-2 animate-ping" style={{ borderColor: "var(--accent-muted)" }} />
            <div className="absolute inset-2 rounded-full border-2 animate-ping" style={{ borderColor: "var(--accent-muted)", animationDelay: "0.2s" }} />
            <div className="absolute inset-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)" }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="h-6 w-6" style={{ color: "var(--accent)" }} />
            </div>
          </div>
          <p className="text-[var(--text-secondary)] font-medium mb-1">Building your mesh...</p>
          <p className="text-[var(--text-muted)] text-sm">Mapping your digital universe</p>
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
    <div className="relative h-[calc(100vh-4rem)] overflow-hidden bg-[var(--bg-primary)]">
      {/* Keyboard shortcut handled in useEffect below */}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="brand-logo h-8 w-8 rounded-lg flex items-center justify-center shadow-lg" style={{ background: "var(--brand-gradient)" }}>
              <Layers className="h-4 w-4 text-white" />
            </div>
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
        <div className="flex gap-1 glass-panel rounded-xl p-1 shadow-xl mt-3 w-fit">
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
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1">
        <button onClick={() => handleZoom(0.3)} className="p-2 glass-surface rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all" title="Zoom in"><ZoomIn className="h-4 w-4" /></button>
        <button onClick={() => handleZoom(-0.3)} className="p-2 glass-surface rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all" title="Zoom out"><ZoomOut className="h-4 w-4" /></button>
        <button onClick={resetView} className="p-2 glass-surface rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all" title="Reset view"><Maximize2 className="h-4 w-4" /></button>
        <div className="h-px bg-[var(--bg-tertiary)] my-0.5" />
        <button onClick={() => setShowLabels(!showLabels)} className={"p-2 glass-surface rounded-lg transition-all " + (showLabels ? "text-[var(--accent)]" : "text-[var(--text-muted)]")} title={showLabels ? "Hide labels" : "Show labels"}>{showLabels ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
        <button onClick={() => setShowStats(!showStats)} className={"p-2 glass-surface rounded-lg transition-all " + (showStats ? "text-[var(--accent)]" : "text-[var(--text-muted)]")} title={showStats ? "Hide stats" : "Show stats"}><Info className="h-4 w-4" /></button>
      </div>

      {/* Stats bar */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 left-4 z-10 flex gap-2 flex-wrap"
          >
            {[
              { label: "people", count: nodes.filter((n) => n.type === "user").length, color: "text-[var(--accent)]" },
              { label: "communities", count: nodes.filter((n) => n.type === "community").length, color: "text-pink-400" },
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

      {/* Hint */}
      {nodes.length > 0 && !selectedNode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 glass-surface rounded-lg px-3 py-1.5 text-[10px] text-[var(--text-muted)] pointer-events-none">
          Click a node to inspect &middot; Double-click to navigate &middot; Scroll to zoom &middot; Drag to pan
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

      {/* Selected node detail panel with quick actions */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute top-20 right-4 z-20 w-80 glass-dropdown rounded-2xl shadow-2xl overflow-hidden"
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

              {/* Connection count */}
              <div className="mb-3">
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                  {edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).length} connections in mesh
                </p>
              </div>

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

                {/* Post quick actions: View, Delete (own posts) */}
                {selectedNode.type === "post" && (
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
                  <div className="brand-logo h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "var(--brand-gradient)" }}>
                    <Fingerprint className="h-3.5 w-3.5 text-white" />
                  </div>
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
                  { label: "Mutuals", value: meshStats.mutualCount, color: "text-purple-400", icon: Heart },
                  { label: "Posts", value: meshStats.postCount, color: "text-emerald-400", icon: FileText },
                  { label: "Communities", value: meshStats.communityCount, color: "text-pink-400", icon: Users },
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

      {/* Quick action bar (bottom left) - always visible */}
      <div className="absolute bottom-4 left-4 z-10 flex gap-2">
        <Link href="/feed?compose=true">
          <button className="flex items-center gap-1.5 px-3 py-2 glass-surface rounded-xl text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95 shadow-lg">
            <PenSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Post</span>
          </button>
        </Link>
        <Link href="/messages">
          <button className="flex items-center gap-1.5 px-3 py-2 glass-surface rounded-xl text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95 shadow-lg">
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">MeChat</span>
          </button>
        </Link>
        <Link href="/explore">
          <button className="flex items-center gap-1.5 px-3 py-2 glass-surface rounded-xl text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95 shadow-lg">
            <Globe className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Explore</span>
          </button>
        </Link>
      </div>

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
