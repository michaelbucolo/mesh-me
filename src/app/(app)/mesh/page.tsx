"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, RotateCcw, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeshiMascot, type MeshiColor, type MeshiHat } from "@/components/meshi/meshi-mascot";
import { MeshEngine } from "@/components/mesh/mesh-engine";
import { MeshCanvas } from "@/components/mesh/mesh-canvas";
import { buildMeshData, buildUserMeshData, preloadNodeImages, type MeshApiResponse } from "@/components/mesh/mesh-data";
import type { MeshNode, MeshEdge } from "@/components/mesh/mesh-types";

type CachedUserMeshResponse = {
  user: { id: string; username: string; displayName: string; avatarUrl: string | null };
  following?: unknown[];
  communities?: unknown[];
  meshiPreference?: { colorTheme?: string; hatStyle?: string } | null;
};

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

  const [viewingUserMesh, setViewingUserMesh] = useState<MeshNode | null>(null);
  const [myNodes, setMyNodes] = useState<MeshNode[]>([]);
  const [myEdges, setMyEdges] = useState<MeshEdge[]>([]);

  const zoomRef = useRef(0.65);
  const panRef = useRef({ x: 0, y: 0 });

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

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
      setSelectedNode(null);
      resetView();
    } catch {
      if (node.href) router.push(node.href);
    } finally {
      setLoadingUserMesh(false);
    }
  }, [engine, router, resetView, viewingUserMesh]);

  const returnToMyMesh = useCallback(() => {
    if (myNodes.length > 0) engine.setData(myNodes, myEdges);
    setViewingUserMesh(null);
    setSelectedNode(null);
    resetView();
  }, [engine, myEdges, myNodes, resetView]);

  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  if (loading) {
    return (
      <div className="relative h-[calc(100dvh-4rem)] overflow-hidden bg-[var(--bg-primary)] rounded-2xl md:rounded-3xl flex items-center justify-center">
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
          <MeshiMascot size={64} mood="searching" color={myMeshiColor} hat={myMeshiHat} showGlow animate />
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100dvh-4rem)] bg-[var(--bg-primary)]">
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
    <div className="relative h-[calc(100dvh-4rem)] overflow-hidden bg-[var(--bg-primary)] rounded-2xl md:rounded-3xl">
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
        remoteMeshis={[]}
        syncPulseTime={null}
        onZoomChange={(z) => { setZoom(z); zoomRef.current = z; }}
        onPanChange={(p) => { setPan(p); panRef.current = p; }}
        onHoverChange={setHoveredNode}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
      />

      <AnimatePresence>
        {viewingUserMesh && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
            <button onClick={returnToMyMesh} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/55 text-white text-xs font-medium backdrop-blur-md">
              <RotateCcw className="h-3.5 w-3.5" />
              Back to my mesh
            </button>
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
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center pointer-events-auto px-4">
            <div className="w-20 h-20 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-4">
              <Layers className="h-10 w-10 text-[var(--text-muted)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-secondary)] mb-2">Your mesh is growing</h3>
            <p className="text-sm text-[var(--text-muted)] mb-4 max-w-sm">
              Follow people, join communities, add interests, and create posts to expand your mesh.
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
