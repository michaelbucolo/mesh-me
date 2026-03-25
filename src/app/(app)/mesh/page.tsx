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
} from "lucide-react";
import Link from "next/link";

interface MeshNode {
  id: string;
  type: "user" | "community" | "tag" | "post" | "self";
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
  connections: string[];
}

interface MeshEdge {
  source: string;
  target: string;
  strength: number;
}

const NODE_COLORS: Record<string, string> = {
  self: "#6366f1",
  user: "#8b5cf6",
  community: "#ec4899",
  tag: "#06b6d4",
  post: "#22c55e",
};

export default function MeshPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [nodes, setNodes] = useState<MeshNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<MeshNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const nodesRef = useRef<MeshNode[]>([]);
  const edgesRef = useRef<MeshEdge[]>([]);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    async function loadMeshData() {
      try {
        const res = await fetch("/api/mesh");
        if (res.ok) {
          const data = await res.json();
          const cx = 600, cy = 400;
          const meshNodes: MeshNode[] = [];
          const meshEdges: MeshEdge[] = [];

          meshNodes.push({
            id: data.user.id, type: "self", label: data.user.displayName,
            sublabel: `@${data.user.username}`, avatarUrl: data.user.avatarUrl,
            href: `/profile/${data.user.username}`,
            x: cx, y: cy, vx: 0, vy: 0, radius: 30, color: NODE_COLORS.self, connections: [],
          });

          data.following?.forEach((f: { id: string; username: string; displayName: string; avatarUrl: string | null }, i: number) => {
            const angle = (i / (data.following.length || 1)) * Math.PI * 2;
            const dist = 150 + Math.random() * 80;
            meshNodes.push({
              id: f.id, type: "user", label: f.displayName, sublabel: `@${f.username}`,
              avatarUrl: f.avatarUrl, href: `/profile/${f.username}`,
              x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
              vx: 0, vy: 0, radius: 18, color: NODE_COLORS.user, connections: [data.user.id],
            });
            meshEdges.push({ source: data.user.id, target: f.id, strength: 0.8 });
          });

          const followingIds = new Set(data.following?.map((f: { id: string }) => f.id) || []);
          data.followers?.forEach((f: { id: string; username: string; displayName: string; avatarUrl: string | null }, i: number) => {
            if (followingIds.has(f.id)) return;
            const angle = (i / (data.followers.length || 1)) * Math.PI * 2 + 0.5;
            const dist = 200 + Math.random() * 100;
            meshNodes.push({
              id: `follower-${f.id}`, type: "user", label: f.displayName, sublabel: `@${f.username}`,
              avatarUrl: f.avatarUrl, href: `/profile/${f.username}`,
              x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
              vx: 0, vy: 0, radius: 14, color: NODE_COLORS.user, connections: [data.user.id],
            });
            meshEdges.push({ source: data.user.id, target: `follower-${f.id}`, strength: 0.4 });
          });

          data.communities?.forEach((c: { id: string; name: string; slug: string; memberCount: number }, i: number) => {
            const angle = (i / (data.communities.length || 1)) * Math.PI * 2 + 1;
            const dist = 250 + Math.random() * 60;
            meshNodes.push({
              id: `community-${c.id}`, type: "community", label: c.name,
              sublabel: `${c.memberCount} members`, href: `/communities/${c.slug}`,
              x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
              vx: 0, vy: 0, radius: 22, color: NODE_COLORS.community, connections: [data.user.id],
            });
            meshEdges.push({ source: data.user.id, target: `community-${c.id}`, strength: 0.6 });
          });

          data.interests?.forEach((tag: string, i: number) => {
            const angle = (i / (data.interests.length || 1)) * Math.PI * 2 + 2;
            const dist = 300 + Math.random() * 80;
            meshNodes.push({
              id: `tag-${tag}`, type: "tag", label: `#${tag}`,
              href: `/search?q=${encodeURIComponent(tag)}`,
              x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
              vx: 0, vy: 0, radius: 12, color: NODE_COLORS.tag, connections: [data.user.id],
            });
            meshEdges.push({ source: data.user.id, target: `tag-${tag}`, strength: 0.3 });
          });

          setNodes(meshNodes);
          nodesRef.current = meshNodes;
          edgesRef.current = meshEdges;
        }
      } catch {
        // empty mesh
      } finally {
        setLoading(false);
      }
    }
    loadMeshData();
  }, []);

  const simulate = useCallback(() => {
    const ns = nodesRef.current;
    const es = edgesRef.current;
    if (ns.length === 0) return;
    const cx = 600, cy = 400;

    for (let i = 0; i < ns.length; i++) {
      const node = ns[i];
      for (let j = i + 1; j < ns.length; j++) {
        const other = ns[j];
        const dx = other.x - node.x;
        const dy = other.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = node.radius + other.radius + 40;
        if (dist < minDist * 3) {
          const force = (minDist * 3 - dist) * 0.002;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          node.vx -= fx; node.vy -= fy;
          other.vx += fx; other.vy += fy;
        }
      }
      if (node.type !== "self") {
        node.vx += (cx - node.x) * 0.0001;
        node.vy += (cy - node.y) * 0.0001;
      }
      node.vx *= 0.95; node.vy *= 0.95;
      if (node.type !== "self") { node.x += node.vx; node.y += node.vy; }
    }

    for (const edge of es) {
      const source = ns.find((n) => n.id === edge.source);
      const target = ns.find((n) => n.id === edge.target);
      if (!source || !target) continue;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const idealDist = source.radius + target.radius + 100 + (1 - edge.strength) * 100;
      if (dist > idealDist) {
        const force = (dist - idealDist) * 0.001 * edge.strength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (target.type !== "self") { target.vx -= fx; target.vy -= fy; }
        if (source.type !== "self") { source.vx += fx; source.vy += fy; }
      }
    }
    nodesRef.current = [...ns];
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      simulate();
      const w = canvas.width, h = canvas.height;
      const z = zoomRef.current;
      const p = panRef.current;
      const ns = nodesRef.current;
      const es = edgesRef.current;

      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2 + p.x, h / 2 + p.y);
      ctx.scale(z, z);
      ctx.translate(-600, -400);

      for (const edge of es) {
        const source = ns.find((n) => n.id === edge.source);
        const target = ns.find((n) => n.id === edge.target);
        if (!source || !target) continue;
        if (filter !== "all" && target.type !== filter && source.type !== filter) continue;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = `rgba(99, 102, 241, ${0.1 + edge.strength * 0.15})`;
        ctx.lineWidth = 1 + edge.strength;
        ctx.stroke();
      }

      for (const node of ns) {
        if (filter !== "all" && node.type !== filter && node.type !== "self") continue;
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 2);
        gradient.addColorStop(0, node.color + "30");
        gradient.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color + "40";
        ctx.fill();
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#e4e4e7";
        ctx.font = `${Math.max(10, node.radius * 0.6)}px system-ui`;
        ctx.textAlign = "center";
        ctx.fillText(node.label, node.x, node.y + node.radius + 14);
      }

      ctx.restore();
      animationRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationRef.current);
  }, [filter, simulate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const z = zoomRef.current;
    const p = panRef.current;
    const worldX = (mx - canvas.width / 2 - p.x) / z + 600;
    const worldY = (my - canvas.height / 2 - p.y) / z + 400;

    for (const node of nodesRef.current) {
      const dx = worldX - node.x;
      const dy = worldY - node.y;
      if (dx * dx + dy * dy < node.radius * node.radius * 4) {
        setSelectedNode(node);
        return;
      }
    }
    setSelectedNode(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newPan = { x: e.clientX - dragStart.x, y: e.clientY - dragStart.y };
    setPan(newPan);
    panRef.current = newPan;
  };
  const handleMouseUp = () => setIsDragging(false);
  const handleZoom = (delta: number) => {
    const newZoom = Math.max(0.3, Math.min(3, zoom + delta));
    setZoom(newZoom);
    zoomRef.current = newZoom;
  };

  const filters = [
    { id: "all", label: "Everything", icon: Globe },
    { id: "user", label: "People", icon: Users },
    { id: "community", label: "Communities", icon: MessageCircle },
    { id: "tag", label: "Interests", icon: Hash },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Building your mesh...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-4rem)] overflow-hidden bg-zinc-950">
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">The Mesh</h1>
          <p className="text-xs text-zinc-500">Your digital universe &mdash; explore your connections</p>
        </div>
        <div className="flex gap-1 bg-zinc-900/80 backdrop-blur-xl rounded-xl p-1 border border-zinc-800">
          {filters.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f.id ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}>
              <f.icon className="h-3.5 w-3.5" />{f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1">
        <button onClick={() => handleZoom(0.2)} className="p-2 bg-zinc-900/80 backdrop-blur-xl rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"><ZoomIn className="h-4 w-4" /></button>
        <button onClick={() => handleZoom(-0.2)} className="p-2 bg-zinc-900/80 backdrop-blur-xl rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"><ZoomOut className="h-4 w-4" /></button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); zoomRef.current = 1; panRef.current = { x: 0, y: 0 }; }} className="p-2 bg-zinc-900/80 backdrop-blur-xl rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"><Maximize2 className="h-4 w-4" /></button>
      </div>

      <div className="absolute bottom-4 left-4 z-10 flex gap-2">
        <div className="bg-zinc-900/80 backdrop-blur-xl rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400">{nodes.filter((n) => n.type === "user").length} people</div>
        <div className="bg-zinc-900/80 backdrop-blur-xl rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400">{nodes.filter((n) => n.type === "community").length} communities</div>
        <div className="bg-zinc-900/80 backdrop-blur-xl rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400">{nodes.filter((n) => n.type === "tag").length} interests</div>
      </div>

      <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing"
        onClick={handleCanvasClick} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} />

      <AnimatePresence>
        {selectedNode && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="absolute top-16 right-4 z-20 w-72 bg-zinc-900/90 backdrop-blur-xl rounded-2xl border border-zinc-800 p-4 shadow-2xl">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                {selectedNode.avatarUrl ? (
                  <Avatar src={selectedNode.avatarUrl} alt={selectedNode.label} size="md" />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: selectedNode.color }}>
                    {selectedNode.type === "community" ? <Users className="h-5 w-5" /> : selectedNode.type === "tag" ? <Hash className="h-5 w-5" /> : selectedNode.label[0]}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{selectedNode.label}</p>
                  {selectedNode.sublabel && <p className="text-xs text-zinc-500">{selectedNode.sublabel}</p>}
                </div>
              </div>
              <button onClick={() => setSelectedNode(null)} className="text-zinc-500 hover:text-zinc-300"><X className="h-4 w-4" /></button>
            </div>
            <Badge variant="secondary" className="mb-3 text-xs capitalize">{selectedNode.type === "self" ? "You" : selectedNode.type}</Badge>
            {selectedNode.href && (
              <Link href={selectedNode.href}>
                <Button variant="secondary" size="sm" className="w-full mt-2">
                  View {selectedNode.type === "user" || selectedNode.type === "self" ? "Profile" : selectedNode.type === "community" ? "Community" : "Posts"}
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
