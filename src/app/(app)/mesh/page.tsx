"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, Compass, RotateCcw, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeshiMascot, type MeshiColor, type MeshiHat } from "@/components/meshi/meshi-mascot";
import { MeshEngine } from "@/components/mesh/mesh-engine";
import { MeshCanvas } from "@/components/mesh/mesh-canvas";
import { buildMeshData, buildUserMeshData, preloadNodeImages, type MeshApiResponse } from "@/components/mesh/mesh-data";
import type { MeshNode, MeshEdge } from "@/components/mesh/mesh-types";
import type { RemoteMeshi } from "@/components/mesh/meshi-on-mesh";

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

export default function MeshPage() {
  const router = useRouter();
  const imageCache = useRef<Map<string, HTMLImageElement | null>>(new Map());
  const userMeshCacheRef = useRef<Map<string, CachedUserMeshResponse>>(new Map());
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [engine] = useState(() => new MeshEngine());
  const [selectedNode, setSelectedNode] = useState<MeshNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<MeshNode | null>(null);
  const [zoom, setZoom] = useState(0.68);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingUserMesh, setLoadingUserMesh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meshNotice, setMeshNotice] = useState<string | null>(null);

  const [myMeshiColor, setMyMeshiColor] = useState<MeshiColor>("blue");
  const [myMeshiHat, setMyMeshiHat] = useState<MeshiHat>("none");
  const [myUsername, setMyUsername] = useState("You");

  const [viewingUserMesh, setViewingUserMesh] = useState<MeshNode | null>(null);
  const [myNodes, setMyNodes] = useState<MeshNode[]>([]);
  const [myEdges, setMyEdges] = useState<MeshEdge[]>([]);
  const [meshData, setMeshData] = useState<MeshApiResponse | null>(null);

  const [remoteMeshis] = useState<RemoteMeshi[]>([]);
  const [travelLog, setTravelLog] = useState<Array<{ mesh: string; at: number }>>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/mesh", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load mesh data");
        const data: MeshApiResponse = await res.json();
        setMeshData(data);

        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        engine.setCenter(cx, cy);

        const { nodes, edges } = buildMeshData(data, cx, cy);
        engine.setData(nodes, edges);
        preloadNodeImages(nodes, imageCache.current);

        setMyNodes(nodes);
        setMyEdges(edges);
        setMyUsername(data.user.displayName || data.user.username || "You");
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
    setZoom(0.68);
    setPan({ x: 0, y: 0 });
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
        data = await res.json() as CachedUserMeshResponse;
        userMeshCacheRef.current.set(username, data);
      }

      const { nodes: userNodes, edges: userEdges } = buildUserMeshData(data, center.x, center.y);
      engine.setData(userNodes, userEdges);
      preloadNodeImages(userNodes, imageCache.current);

      setViewingUserMesh(node);
      if (data.privacyLevel === "private") {
        setMeshNotice("This user keeps their mesh private.");
      } else if (data.privacyLevel === "friends-only") {
        setMeshNotice("This mesh is visible to mutual follows only.");
      } else {
        setMeshNotice(null);
      }
      setTravelLog((prev) => [{ mesh: node.label, at: Date.now() }, ...prev].slice(0, 5));
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
    setTravelLog((prev) => [{ mesh: "Your mesh", at: Date.now() }, ...prev].slice(0, 5));
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

  const focusNode = selectedNode || hoveredNode;
  const userCount = useMemo(() => engine.nodes.filter((node) => node.type === "user").length, [engine.nodes]);

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
        onZoomChange={setZoom}
        onPanChange={setPan}
        onHoverChange={setHoveredNode}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
      />

      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-xs text-white backdrop-blur-md">
        <MeshiMascot size={20} mood={focusNode ? "thinking" : "happy"} color={myMeshiColor} hat={myMeshiHat} animate />
        <span>{viewingUserMesh ? `${viewingUserMesh.label}'s mesh` : "Your mesh"}</span>
      </div>

      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        <button onClick={resetView} className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-xs text-white backdrop-blur-md hover:bg-black/60 transition">
          <RotateCcw className="inline h-3.5 w-3.5 mr-1" />Reset
        </button>
        {viewingUserMesh && (
          <button onClick={returnToMyMesh} className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-xs text-white backdrop-blur-md hover:bg-black/60 transition">
            <ArrowLeftRight className="inline h-3.5 w-3.5 mr-1" />Return
          </button>
        )}
      </div>

      <AnimatePresence>
        {(focusNode || meshNotice) && (
          <motion.div
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            className="absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-white/15 bg-black/55 p-4 text-white backdrop-blur-xl"
          >
            {meshNotice && <p className="text-xs text-amber-200 mb-2">{meshNotice}</p>}
            {focusNode ? (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">{focusNode.label}</p>
                  <p className="text-xs text-white/65">{focusNode.sublabel || focusNode.type}</p>
                  {focusNode.description && <p className="mt-1 text-xs text-white/75">{focusNode.description}</p>}
                </div>
                {focusNode.href && (
                  <Button size="sm" variant="secondary" onClick={() => router.push(focusNode.href!)}>
                    Open
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/75">Move through nodes naturally: tap a user to travel, pinch to zoom, drag to drift.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute left-3 bottom-3 z-10 flex items-center gap-2 text-[11px] text-white/70">
        <span className="rounded-full border border-white/15 bg-black/35 px-2.5 py-1 backdrop-blur">{userCount} people</span>
        <span className="rounded-full border border-white/15 bg-black/35 px-2.5 py-1 backdrop-blur">{engine.nodes.length} nodes</span>
        <span className="rounded-full border border-white/15 bg-black/35 px-2.5 py-1 backdrop-blur">{zoom.toFixed(2)}x</span>
      </div>

      <div className="absolute right-3 bottom-3 z-10 flex flex-col gap-2 max-w-[18rem]">
        {travelLog.slice(0, 2).map((entry) => (
          <div key={`${entry.mesh}-${entry.at}`} className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[11px] text-white/70 backdrop-blur">
            Jumped to <span className="text-white">{entry.mesh}</span>
          </div>
        ))}
      </div>

      {engine.nodes.length <= 1 && !loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none px-4">
          <div className="pointer-events-auto max-w-md rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-5 text-center text-white">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
              <UserRound className="h-8 w-8 text-white/70" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Your mesh is just getting started</h3>
            <p className="text-sm text-white/70 mb-4">
              Follow people and connect platforms so your world can grow into a living map.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/explore"><Button variant="gradient" size="sm">Explore</Button></Link>
              <Link href="/connected-accounts"><Button variant="secondary" size="sm">Connect platforms</Button></Link>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-14 left-3 z-10 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[11px] text-white/65 backdrop-blur">
        <Compass className="inline h-3.5 w-3.5 mr-1" /> Drag to pan · Scroll to zoom · Tap to focus
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

      <div className="sr-only">Connected accounts: {meshData?.connectedAccounts?.length ?? 0}</div>
    </div>
  );
}
