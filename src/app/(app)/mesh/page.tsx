"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useTransition, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Compass,
  Eye,
  Globe,
  Layers,
  Link2,
  MessageCircle,
  Network,
  PenSquare,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeshiMascot, type MeshiColor, type MeshiHat } from "@/components/meshi/meshi-mascot";
import { LiveMeshiPresence } from "@/components/meshi/meshi-presence";
import { MeshEngine } from "@/components/mesh/mesh-engine";
import { MeshCanvas } from "@/components/mesh/mesh-canvas";
import { buildMeshData, buildUserMeshData, preloadNodeImages, type MeshApiResponse } from "@/components/mesh/mesh-data";
import type { MeshNode, MeshEdge } from "@/components/mesh/mesh-types";
import type { RemoteMeshi } from "@/components/mesh/meshi-on-mesh";
import { createPost, deletePost } from "@/lib/actions";

type CachedUserMeshResponse = {
  user: { id: string; username: string; displayName: string; avatarUrl: string | null };
  following?: unknown[];
  communities?: unknown[];
  interests?: string[];
  platforms?: Array<{ id: string; platform: string; platformUsername?: string | null; publicPosts?: unknown[] }>;
  stats?: { followers?: number; following?: number; posts?: number; communities?: number; platforms?: number };
  privacyLevel?: string;
  meshiPreference?: { colorTheme?: string; hatStyle?: string } | null;
};

type MeshMode = "overview" | "posts" | "interactions" | "connections" | "travel" | "presence" | "sync";

const MODE_TABS: Array<{
  key: MeshMode;
  label: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
}> = [
  { key: "overview", label: "Overview", icon: Eye, description: "Your internet-wide command center" },
  { key: "posts", label: "Posts", icon: PenSquare, description: "Compose, queue, and remove content" },
  { key: "interactions", label: "Interactions", icon: MessageCircle, description: "Track likes, comments, reposts" },
  { key: "connections", label: "Connections", icon: Network, description: "People, communities, and platform graph" },
  { key: "travel", label: "Travel", icon: Compass, description: "Jump across meshes and return instantly" },
  { key: "presence", label: "Presence", icon: Users, description: "Live meshi and active users" },
  { key: "sync", label: "Sync", icon: RefreshCw, description: "Cross-platform two-way sync status" },
];

const QUICK_ACTIONS = [
  { href: "/feed", label: "Open feed", icon: Globe },
  { href: "/explore", label: "Discover people", icon: Compass },
  { href: "/connected-accounts", label: "Connect platforms", icon: Network },
  { href: "/messages", label: "Open MeChat", icon: MessageCircle },
] as const;

export default function MeshPage() {
  const router = useRouter();
  const imageCache = useRef<Map<string, HTMLImageElement | null>>(new Map());
  const userMeshCacheRef = useRef<Map<string, CachedUserMeshResponse>>(new Map());

  const [engine] = useState(() => new MeshEngine());
  const [selectedNode, setSelectedNode] = useState<MeshNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<MeshNode | null>(null);
  const [zoom, setZoom] = useState(0.65);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingUserMesh, setLoadingUserMesh] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [myMeshiColor, setMyMeshiColor] = useState<MeshiColor>("blue");
  const [myMeshiHat, setMyMeshiHat] = useState<MeshiHat>("none");
  const [myUsername, setMyUsername] = useState("You");
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myMeshiPosition, setMyMeshiPosition] = useState({ x: 0, y: 0 });
  const [myMeshiMood, setMyMeshiMood] = useState("happy");
  const [remoteMeshis, setRemoteMeshis] = useState<RemoteMeshi[]>([]);
  const [presenceEnabled, setPresenceEnabled] = useState(true);
  const [travelLog, setTravelLog] = useState<Array<{ mesh: string; at: number }>>([]);
  const [presenceSummary, setPresenceSummary] = useState({
    totalOnline: 0,
    sameMeshOnline: 0,
    connectedOnline: 0,
  });
  const [meshNotice, setMeshNotice] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<MeshMode>("overview");
  const [composerText, setComposerText] = useState("");
  const [deleteQueue, setDeleteQueue] = useState<Array<{ id: string; label: string; scope: string }>>([]);
  const [syncPulseTime, setSyncPulseTime] = useState<number | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewportInfo, setViewportInfo] = useState({
    zoom: 0.65,
    panX: 0,
    panY: 0,
    centerX: 400,
    centerY: 300,
    canvasWidth: 800,
    canvasHeight: 600,
  });

  const [viewingUserMesh, setViewingUserMesh] = useState<MeshNode | null>(null);
  const [myNodes, setMyNodes] = useState<MeshNode[]>([]);
  const [myEdges, setMyEdges] = useState<MeshEdge[]>([]);
  const [isPending, startTransition] = useTransition();

  const zoomRef = useRef(0.65);
  const panRef = useRef({ x: 0, y: 0 });
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const loadMyMesh = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/mesh", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load mesh data");
      const data: MeshApiResponse = await res.json();

      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      engine.setCenter(cx, cy);

      const { nodes, edges } = buildMeshData(data, cx, cy);
      engine.setData(nodes, edges);
      preloadNodeImages(nodes, imageCache.current);

      setMyNodes(nodes);
      setMyEdges(edges);
      setMyUsername(data.user.displayName || data.user.username || "You");
      setMyUserId(data.user.id);

      if (data.meshiPreference?.colorTheme) setMyMeshiColor(data.meshiPreference.colorTheme as MeshiColor);
      if (data.meshiPreference?.hatStyle) setMyMeshiHat(data.meshiPreference.hatStyle as MeshiHat);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load mesh");
    } finally {
      setLoading(false);
    }
  }, [engine]);

  useEffect(() => {
    void loadMyMesh();
  }, [loadMyMesh]);

  const resetView = useCallback(() => {
    setZoom(0.65);
    zoomRef.current = 0.65;
    setPan({ x: 0, y: 0 });
    panRef.current = { x: 0, y: 0 };
    setSelectedNode(null);
    setHoveredNode(null);
  }, []);

  const enterUserMesh = useCallback(async (node: MeshNode) => {
    const username = node.sublabel?.replace("@", "");
    if (!username) return;

    try {
      setLoadingUserMesh(true);
      if (!viewingUserMesh) {
        setMyNodes([...engine.nodes]);
        setMyEdges([...engine.edges]);
      }

      const center = engine.getCenter();
      let data = userMeshCacheRef.current.get(username);
      if (!data) {
        const res = await fetch(`/api/users/${encodeURIComponent(username)}/mesh`, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load user mesh");
        data = (await res.json()) as CachedUserMeshResponse;
        userMeshCacheRef.current.set(username, data);
      }

      const { nodes: userNodes, edges: userEdges } = buildUserMeshData(data, center.x, center.y);
      engine.setData(userNodes, userEdges);
      preloadNodeImages(userNodes, imageCache.current);

      setViewingUserMesh(node);
      if (data.privacyLevel === "private") {
        setMeshNotice("Private mesh mode: only high-level map and platform signals are available.");
      } else if (data.privacyLevel === "friends-only") {
        setMeshNotice("Friends-only mesh: connect mutually to unlock full post and interaction routes.");
      } else {
        setMeshNotice(null);
      }
      setTravelLog((prev) => [{ mesh: node.label, at: Date.now() }, ...prev].slice(0, 10));
      setActiveMode("travel");
      setSelectedNode(null);
      resetView();
    } catch {
      if (node.href) router.push(node.href);
    } finally {
      setLoadingUserMesh(false);
    }
  }, [engine, resetView, router, viewingUserMesh]);

  const returnToMyMesh = useCallback(() => {
    if (myNodes.length > 0) engine.setData(myNodes, myEdges);
    setViewingUserMesh(null);
    setMeshNotice(null);
    setTravelLog((prev) => [{ mesh: "Your mesh", at: Date.now() }, ...prev].slice(0, 10));
    setSelectedNode(null);
    resetView();
  }, [engine, myEdges, myNodes, resetView]);

  const handleCanvasClick = useCallback((node: MeshNode | null) => {
    if (!node) {
      setSelectedNode(null);
      return;
    }

    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      if (node.type === "user" && node.sublabel) {
        void enterUserMesh(node);
      } else if (node.href) {
        router.push(node.href);
      } else {
        setSelectedNode(node);
      }
    }, 220);
  }, [enterUserMesh, router]);

  const handleCanvasDoubleClick = useCallback((node: MeshNode | null) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    if (node?.href) router.push(node.href);
  }, [router]);

  const meshStats = useMemo(() => {
    const totalNodes = engine.nodes.length;
    const people = engine.nodes.filter((node) => node.type === "user").length;
    const communities = engine.nodes.filter((node) => node.type === "community").length;
    const platforms = engine.nodes.filter((node) => node.type === "platform").length;
    const posts = engine.nodes.filter((node) => node.type === "post").length;
    const interactionSignals = engine.nodes.reduce((sum, node) => {
      return sum + (node.likeCount || 0) + (node.commentCount || 0) * 2 + (node.repostCount || 0) * 3;
    }, 0);

    return { totalNodes, people, communities, platforms, posts, interactionSignals };
  }, [engine.nodes]);

  const syncCoverage = useMemo(() => {
    const platformNodes = engine.nodes.filter((node) => node.type === "platform").length;
    const visiblePostNodes = engine.nodes.filter((node) => node.type === "post").length;
    const estimatedSync = Math.min(100, Math.round(platformNodes * 18 + visiblePostNodes * 2.5));
    return { platformNodes, visiblePostNodes, estimatedSync };
  }, [engine.nodes]);

  const selectedSummary = useMemo(() => {
    if (!selectedNode) return "Select a node to inspect controls for posting, deleting, and jumping across connected meshes.";
    const details: string[] = [selectedNode.label];
    if (selectedNode.platform) details.push(`Platform: ${selectedNode.platform}`);
    if (selectedNode.followerCount) details.push(`${selectedNode.followerCount.toLocaleString()} followers`);
    if (selectedNode.likeCount || selectedNode.commentCount || selectedNode.repostCount) {
      details.push(`${selectedNode.likeCount || 0} likes · ${selectedNode.commentCount || 0} comments · ${selectedNode.repostCount || 0} reposts`);
    }
    return details.join(" • ");
  }, [selectedNode]);

  const meshGuideText = viewingUserMesh
    ? `Traveling in ${viewingUserMesh.label}'s mesh. Every visible post, interaction, and connection here can map back to your own command center.`
    : hoveredNode
      ? `Hovering ${hoveredNode.label}. Single click to inspect; double click to travel to destination-enabled nodes.`
      : "The Mesh is your full internet presence map. Organize posts, interactions, connections, and sync all platforms from one surface.";

  const queueDeleteForSelected = useCallback(() => {
    if (!selectedNode) return;
    const isLikelyPlatformPost = selectedNode.id.startsWith("pp-");
    if (isLikelyPlatformPost) {
      setActionError("That post is external platform content. Open source platform to remove it.");
      return;
    }
    setDeleteQueue((prev) => {
      const exists = prev.some((item) => item.id === selectedNode.id);
      if (exists) return prev;
      return [{ id: selectedNode.id, label: selectedNode.label, scope: selectedNode.type }, ...prev].slice(0, 8);
    });
    setActiveMode("posts");
  }, [selectedNode]);

  const pulseSync = useCallback(() => {
    setSyncPulseTime(Date.now());
    setActiveMode("sync");
  }, []);

  const handlePublish = useCallback(() => {
    if (!composerText.trim()) return;
    setActionFeedback(null);
    setActionError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("content", composerText.trim());
      const result = await createPost(formData);
      if (result?.success) {
        setComposerText("");
        setActionFeedback("Posted to Mesh. Sync workers can now fan this out to connected platforms.");
        await loadMyMesh();
        pulseSync();
      } else {
        setActionError(result?.error || "Could not publish from Mesh.");
      }
    });
  }, [composerText, loadMyMesh, pulseSync, startTransition]);

  const handleDeleteQueued = useCallback((queuedId: string) => {
    setActionFeedback(null);
    setActionError(null);
    startTransition(async () => {
      const result = await deletePost(queuedId);
      if (result?.success) {
        setDeleteQueue((prev) => prev.filter((item) => item.id !== queuedId));
        setActionFeedback("Post deleted from Mesh.");
        await loadMyMesh();
        pulseSync();
      } else {
        setActionError(result?.error || "This item cannot be deleted from Mesh.");
      }
    });
  }, [loadMyMesh, pulseSync, startTransition]);

  if (loading) {
    return (
      <div className="relative h-[calc(100dvh-4rem)] overflow-hidden rounded-2xl md:rounded-3xl bg-[var(--bg-primary)] flex items-center justify-center">
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
          <MeshiMascot size={64} mood="searching" color={myMeshiColor} hat={myMeshiHat} showGlow animate />
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100dvh-4rem)] bg-[var(--bg-primary)] rounded-2xl md:rounded-3xl">
        <div className="text-center max-w-sm px-4">
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
    <div className="relative h-[calc(100dvh-4rem)] overflow-hidden rounded-2xl md:rounded-3xl bg-[var(--bg-primary)]">
      <MeshCanvas
        engine={engine}
        filter="all"
        showLabels={true}
        zoom={zoom}
        pan={pan}
        hoveredNode={hoveredNode}
        selectedNode={selectedNode}
        imageCache={imageCache}
        loading={loading}
        meshiColor={myMeshiColor}
        meshiHat={myMeshiHat}
        meshiUsername={myUsername}
        remoteMeshis={remoteMeshis}
        syncPulseTime={syncPulseTime}
        onMeshiPositionChange={(x, y, mood) => {
          setMyMeshiPosition({ x, y });
          setMyMeshiMood(mood);
        }}
        onViewportInfoChange={setViewportInfo}
        onZoomChange={(z) => {
          setZoom(z);
          zoomRef.current = z;
        }}
        onPanChange={(p) => {
          setPan(p);
          panRef.current = p;
        }}
        onHoverChange={setHoveredNode}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
      />

      <LiveMeshiPresence
        viewingMesh={viewingUserMesh?.id || myUserId}
        myMeshiColor={myMeshiColor}
        myMeshiHat={myMeshiHat}
        myMeshiPosition={myMeshiPosition}
        myMeshiMood={myMeshiMood}
        viewportInfo={viewportInfo}
        enabled={presenceEnabled}
        userNodes={engine.nodes
          .filter((n) => n.type === "user")
          .map((n) => ({
            userId: n.id,
            username: n.sublabel?.replace("@", "") || n.label,
            displayName: n.label,
            x: n.x,
            y: n.y,
          }))}
        onRemoteMeshisChange={setRemoteMeshis}
        onSummaryChange={setPresenceSummary}
        onInteract={(presence) => {
          const existingNode = engine.nodes.find((n) => n.type === "user" && n.id === presence.userId);
          if (existingNode?.sublabel) {
            void enterUserMesh(existingNode);
            return;
          }
          router.push(`/profile/${presence.username}`);
        }}
      />

      <div className="absolute inset-x-2 top-2 z-20 md:inset-x-4 md:top-4">
        <div className="rounded-2xl border border-white/10 bg-black/45 backdrop-blur-xl text-white shadow-2xl">
          <div className="p-3 md:p-4 flex flex-wrap items-start gap-3 md:gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-3">
                <MeshiMascot size={34} mood={selectedNode ? "thinking" : "happy"} color={myMeshiColor} hat={myMeshiHat} animate />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 mb-1">The Mesh control plane</p>
                  <p className="text-xs md:text-sm text-white/90 leading-relaxed">{meshGuideText}</p>
                  {meshNotice && <p className="mt-1.5 text-xs text-amber-200/90">{meshNotice}</p>}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setPresenceEnabled((value) => !value)}
                className={
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition " +
                  (presenceEnabled ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-white/70")
                }
              >
                <Zap className="h-3.5 w-3.5" />
                {presenceEnabled ? "Presence on" : "Presence off"}
              </button>
              <button onClick={resetView} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white/85 hover:bg-white/15 transition">
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
              <button onClick={pulseSync} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/25 px-2.5 py-1.5 text-xs font-medium text-indigo-100 hover:bg-indigo-500/35 transition">
                <RefreshCw className="h-3.5 w-3.5" />
                Sync now
              </button>
              {viewingUserMesh && (
                <button onClick={returnToMyMesh} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white/85 hover:bg-white/15 transition">
                  <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                  Back to my mesh
                </button>
              )}
            </div>
          </div>

          <div className="px-3 pb-3 md:px-4 md:pb-4">
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
              <MetricCard label="People" value={meshStats.people} compact />
              <MetricCard label="Communities" value={meshStats.communities} compact />
              <MetricCard label="Platforms" value={meshStats.platforms} compact />
              <MetricCard label="Posts" value={meshStats.posts} compact />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute left-2 right-2 bottom-2 z-20 md:left-4 md:bottom-4 md:right-auto md:w-[30rem]">
        <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl text-white shadow-2xl p-3 md:p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {MODE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveMode(tab.key)}
                className={
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition " +
                  (activeMode === tab.key ? "bg-white/20 text-white" : "bg-white/10 text-white/75 hover:text-white")
                }
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/35 p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 mb-1">{MODE_TABS.find((tab) => tab.key === activeMode)?.label}</p>
            <p className="text-xs text-white/80 mb-3">{MODE_TABS.find((tab) => tab.key === activeMode)?.description}</p>

            {activeMode === "overview" && (
              <div className="space-y-2 text-xs text-white/85">
                <p>{selectedSummary}</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_ACTIONS.map((action) => (
                    <Link key={action.href} href={action.href} className="rounded-lg bg-white/10 hover:bg-white/15 transition px-2.5 py-2 inline-flex items-center gap-2 text-xs font-medium">
                      <action.icon className="h-3.5 w-3.5" />
                      <span>{action.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {activeMode === "posts" && (
              <div className="space-y-2 text-xs text-white/85">
                <label className="text-white/70">Compose once, publish across connected meshes.</label>
                <textarea
                  value={composerText}
                  onChange={(event) => setComposerText(event.target.value)}
                  placeholder="Write a post for your entire internet presence..."
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-2.5 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  rows={3}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    disabled={isPending || !composerText.trim()}
                    onClick={handlePublish}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/25 px-2.5 py-1.5 text-xs font-medium text-indigo-100 hover:bg-indigo-500/35 transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Publish from Mesh
                  </button>
                  <button onClick={queueDeleteForSelected} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/20 px-2.5 py-1.5 text-xs font-medium text-red-100 hover:bg-red-500/30 transition">
                    <Trash2 className="h-3.5 w-3.5" />
                    Queue delete from selection
                  </button>
                </div>
                <div className="space-y-1.5 max-h-24 overflow-auto pr-1">
                  {deleteQueue.length === 0 ? (
                    <p className="text-white/50">No deletion queue yet. Select a post/platform/user node and queue an action.</p>
                  ) : (
                    deleteQueue.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-md bg-white/10 px-2 py-1 gap-2">
                        <span className="truncate pr-1">{item.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase tracking-wide text-white/60">{item.scope}</span>
                          <button
                            disabled={isPending}
                            onClick={() => handleDeleteQueued(item.id)}
                            className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-100 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {actionFeedback && <p className="text-[11px] text-emerald-300">{actionFeedback}</p>}
                {actionError && <p className="text-[11px] text-red-300">{actionError}</p>}
              </div>
            )}

            {activeMode === "interactions" && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <MetricCard label="Signals" value={meshStats.interactionSignals} compact />
                <MetricCard label="Comments" value={engine.nodes.reduce((sum, n) => sum + (n.commentCount || 0), 0)} compact />
                <MetricCard label="Reposts" value={engine.nodes.reduce((sum, n) => sum + (n.repostCount || 0), 0)} compact />
              </div>
            )}

            {activeMode === "connections" && (
              <div className="space-y-2 text-xs text-white/85">
                <p>{meshStats.people} people and {meshStats.communities} communities are mapped into {meshStats.totalNodes} total nodes.</p>
                <button onClick={() => router.push("/connected-accounts")} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/15 transition">
                  <Link2 className="h-3.5 w-3.5" />
                  Manage linked platforms
                </button>
              </div>
            )}

            {activeMode === "travel" && (
              <div className="space-y-1.5 max-h-36 overflow-auto pr-1 text-xs">
                {travelLog.length === 0 ? (
                  <p className="text-white/50">No mesh hops yet. Enter another person&apos;s mesh to build your travel timeline.</p>
                ) : (
                  travelLog.map((item, index) => (
                    <div key={`${item.mesh}-${item.at}-${index}`} className="flex items-center justify-between rounded-md bg-white/10 px-2 py-1.5">
                      <span className="truncate pr-3 text-white/90">{item.mesh}</span>
                      <span className="text-white/50">{new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeMode === "presence" && (
              <div className="grid grid-cols-3 gap-2">
                <MetricCard label="Online" value={presenceSummary.totalOnline} compact />
                <MetricCard label="This mesh" value={presenceSummary.sameMeshOnline} compact />
                <MetricCard label="Connected" value={presenceSummary.connectedOnline} compact />
              </div>
            )}

            {activeMode === "sync" && (
              <div className="space-y-2 text-xs text-white/85">
                <p>Estimated sync coverage: <span className="font-semibold text-white">{syncCoverage.estimatedSync}%</span> across {syncCoverage.platformNodes} platforms.</p>
                <p>{syncCoverage.visiblePostNodes} post nodes are currently visible on this mesh surface.</p>
                <Link href="/connected-accounts" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/25 px-2.5 py-1.5 text-xs font-medium text-indigo-100 hover:bg-indigo-500/35 transition">
                  <Globe className="h-3.5 w-3.5" />
                  Open sync manager
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {loadingUserMesh && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
              <MeshiMascot size={48} mood="excited" color={myMeshiColor} hat={myMeshiHat} showGlow animate />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {engine.nodes.length <= 1 && !loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none px-4">
          <div className="pointer-events-auto max-w-md rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-5 text-center text-white">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
              <Layers className="h-8 w-8 text-white/70" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Your mesh is just getting started</h3>
            <p className="text-sm text-white/70 mb-4">
              Connect platforms, follow people, and map communities to turn this into a full internet presence cockpit.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/explore"><Button variant="gradient" size="sm">Explore</Button></Link>
              <Link href="/connected-accounts"><Button variant="secondary" size="sm">Connect platforms</Button></Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  compact = false,
}: {
  label: string;
  value: number;
  icon?: ComponentType<{ className?: string }>;
  compact?: boolean;
}) {
  return (
    <div className={"rounded-lg bg-white/10 " + (compact ? "px-2 py-1.5" : "px-2.5 py-2")}>
      <div className="flex items-center gap-1.5 text-white/60 mb-0.5">
        {Icon && <Icon className="h-3 w-3" />}
        <p className="text-[10px] uppercase tracking-wide">{label}</p>
      </div>
      <p className={compact ? "text-sm font-semibold" : "text-base font-semibold"}>{value}</p>
    </div>
  );
}
