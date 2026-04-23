"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Compass,
  Globe,
  Layers,
  ListFilter,
  MessageCircle,
  Network,
  RotateCcw,
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

type CachedUserMeshResponse = {
  user: { id: string; username: string; displayName: string; avatarUrl: string | null };
  following?: unknown[];
  communities?: unknown[];
  meshiPreference?: { colorTheme?: string; hatStyle?: string } | null;
};

const QUICK_ACTIONS = [
  { href: "/explore", label: "Discover people", icon: Compass },
  { href: "/content-hub", label: "Browse content", icon: Globe },
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
  const [activePanel, setActivePanel] = useState<"actions" | "travel" | "presence" | null>(null);
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

  const zoomRef = useRef(0.65);
  const panRef = useRef({ x: 0, y: 0 });
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/mesh");
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
    })();
  }, [engine]);

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
        const res = await fetch(`/api/users/${username}/mesh`, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load user mesh");
        data = await res.json() as CachedUserMeshResponse;
        userMeshCacheRef.current.set(username, data);
      }

      const { nodes: userNodes, edges: userEdges } = buildUserMeshData(data, center.x, center.y);
      engine.setData(userNodes, userEdges);
      preloadNodeImages(userNodes, imageCache.current);

      setViewingUserMesh(node);
      setTravelLog((prev) => [{ mesh: node.label, at: Date.now() }, ...prev].slice(0, 8));
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
    setTravelLog((prev) => [{ mesh: "Your mesh", at: Date.now() }, ...prev].slice(0, 8));
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

    return { totalNodes, people, communities, platforms };
  }, [engine.nodes]);

  const meshGuideText = viewingUserMesh
    ? `You are viewing ${viewingUserMesh.label}'s mesh. Click "Back to my mesh" anytime to resume your own view.`
    : selectedNode
      ? `Focused on ${selectedNode.label}. Double-click for fast navigation if the node has a destination.`
      : hoveredNode
        ? `Hovering ${hoveredNode.label}. Click once to inspect, double-click to jump when available.`
        : "Start by clicking a node. You can explore people, communities, platforms, and content from one map.";

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
        syncPulseTime={null}
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
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 mb-1">Mesh brief</p>
                  <p className="text-xs md:text-sm text-white/90 leading-relaxed">{meshGuideText}</p>
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
              {viewingUserMesh && (
                <button onClick={returnToMyMesh} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white/85 hover:bg-white/15 transition">
                  <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                  Back to my mesh
                </button>
              )}
              <div className="hidden md:grid grid-cols-2 gap-1.5 text-xs w-36">
                <MetricCard label="People" value={meshStats.people} compact />
                <MetricCard label="Communities" value={meshStats.communities} compact />
                <MetricCard label="Platforms" value={meshStats.platforms} compact />
                <MetricCard label="Nodes" value={meshStats.totalNodes} compact />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute left-2 bottom-2 z-20 md:left-4 md:bottom-4 flex gap-2">
        <PanelButton
          icon={Compass}
          label="Actions"
          active={activePanel === "actions"}
          onClick={() => setActivePanel((curr) => (curr === "actions" ? null : "actions"))}
        />
        <PanelButton
          icon={ListFilter}
          label="Travel"
          active={activePanel === "travel"}
          onClick={() => setActivePanel((curr) => (curr === "travel" ? null : "travel"))}
        />
        <PanelButton
          icon={Users}
          label="Presence"
          active={activePanel === "presence"}
          onClick={() => setActivePanel((curr) => (curr === "presence" ? null : "presence"))}
        />
      </div>

      <AnimatePresence>
        {activePanel && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute left-2 right-2 bottom-14 z-20 md:left-4 md:right-auto md:w-[22rem]"
          >
            <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl text-white shadow-2xl p-3 md:p-4">
              {activePanel === "actions" && (
                <>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 mb-2">Quick actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_ACTIONS.map((action) => (
                      <Link key={action.href} href={action.href} className="rounded-lg bg-white/10 hover:bg-white/15 transition px-2.5 py-2 inline-flex items-center gap-2 text-xs font-medium">
                        <action.icon className="h-3.5 w-3.5" />
                        <span>{action.label}</span>
                      </Link>
                    ))}
                  </div>
                </>
              )}

              {activePanel === "travel" && (
                <>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 mb-2">Recent travel</p>
                  <div className="space-y-1.5 max-h-44 overflow-auto pr-1">
                    {travelLog.length === 0 ? (
                      <p className="text-xs text-white/60">No mesh hops yet. Enter someone&apos;s mesh to build a trail.</p>
                    ) : (
                      travelLog.map((item, index) => (
                        <div key={`${item.mesh}-${item.at}-${index}`} className="flex items-center justify-between text-xs">
                          <span className="truncate pr-3 text-white/90">{item.mesh}</span>
                          <span className="text-white/50">{new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {activePanel === "presence" && (
                <>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 mb-2">Live presence</p>
                  <div className="grid grid-cols-3 gap-2">
                    <MetricCard label="Online" value={presenceSummary.totalOnline} compact />
                    <MetricCard label="This mesh" value={presenceSummary.sameMeshOnline} compact />
                    <MetricCard label="Connected" value={presenceSummary.connectedOnline} compact />
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
              Follow people, connect platforms, and join communities to create a richer and more navigable map.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/explore"><Button variant="gradient" size="sm">Explore</Button></Link>
              <Link href="/communities"><Button variant="secondary" size="sm">Join communities</Button></Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PanelButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition backdrop-blur-xl border " +
        (active
          ? "border-white/30 bg-white/20 text-white"
          : "border-white/10 bg-black/45 text-white/80 hover:bg-black/60")
      }
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
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
