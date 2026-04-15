"use client";

import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, RotateCcw, Layers } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MeshiMascot, MeshiMini, type MeshiColor, type MeshiHat, type MeshiMood } from "@/components/meshi/meshi-mascot";
import { MeshiMeetOverlay, MeshiVisitorBadge } from "@/components/meshi/meshi-interactions";
import { LiveMeshiPresence } from "@/components/meshi/meshi-presence";
import { MeshEngine } from "@/components/mesh/mesh-engine";
import { MeshCanvas } from "@/components/mesh/mesh-canvas";
import { MeshFilterBar, MeshZoomControls, MeshStatsBar, MeshActionBar } from "@/components/mesh/mesh-controls";
import { buildMeshData, buildUserMeshData, preloadNodeImages, type MeshApiResponse } from "@/components/mesh/mesh-data";
import type { MeshNode, MeshEdge, FilterType } from "@/components/mesh/mesh-types";

// Lazy-load overlay panels — only rendered when user opens them
const ContentHub = lazy(() => import("@/components/mesh/content-hub").then(m => ({ default: m.ContentHub })));
const MeshNodeDetail = lazy(() => import("@/components/mesh/mesh-node-detail").then(m => ({ default: m.MeshNodeDetail })));
const MeshCommandPalette = lazy(() => import("@/components/mesh/mesh-command-palette").then(m => ({ default: m.MeshCommandPalette })));
const MeshFootprint = lazy(() => import("@/components/mesh/mesh-footprint").then(m => ({ default: m.MeshFootprint })));
const MeshPrivacyPanel = lazy(() => import("@/components/mesh/mesh-privacy-panel").then(m => ({ default: m.MeshPrivacyPanel })));
const MeshPostComposer = lazy(() => import("@/components/mesh/mesh-post-composer").then(m => ({ default: m.MeshPostComposer })));

export default function MeshPage() {
  const router = useRouter();
  const imageCache = useRef<Map<string, HTMLImageElement | null>>(new Map());
  const zoomToNodeRef = useRef<(nodeId: string) => void>(() => {});

  // --- Core state ---
  const [engine] = useState(() => new MeshEngine());
  const [selectedNode, setSelectedNode] = useState<MeshNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<MeshNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [showStats, setShowStats] = useState(true);

  // --- Overlay state ---
  const [showFootprint, setShowFootprint] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [showNodePrivacy, setShowNodePrivacy] = useState(false);
  const [showContentHub, setShowContentHub] = useState(false);
  const [showMeshiMeet, setShowMeshiMeet] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // --- Privacy state ---
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set());
  const [hiddenBranches, setHiddenBranches] = useState<Set<string>>(new Set());
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  // --- Mesh data ---
  const [meshStats, setMeshStats] = useState<MeshApiResponse["stats"] | null>(null);
  const [myMeshiColor, setMyMeshiColor] = useState<MeshiColor>("blue");
  const [myMeshiHat, setMyMeshiHat] = useState<MeshiHat>("none");

  // --- Meshi on mesh state ---
  const [meshiPosition, setMeshiPosition] = useState<{ x: number; y: number }>({ x: 400, y: 300 });
  const [meshiMood, setMeshiMood] = useState("exploring");
  const [remoteMeshis, setRemoteMeshis] = useState<import("@/components/mesh/meshi-on-mesh").RemoteMeshi[]>([]);
  const [myUsername, setMyUsername] = useState("You");

  // --- Multi-user mesh exploration ---
  const [viewingUserMesh, setViewingUserMesh] = useState<MeshNode | null>(null);
  const [myNodes, setMyNodes] = useState<MeshNode[]>([]);
  const [myEdges, setMyEdges] = useState<MeshEdge[]>([]);
  const [loadingUserMesh, setLoadingUserMesh] = useState(false);
  const [viewingUserMeshiPrefs, setViewingUserMeshiPrefs] = useState<{ color: MeshiColor; hat: MeshiHat } | null>(null);

  // --- Refs for canvas component ---
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // --- Load hidden nodes + Meshi prefs from localStorage ---
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

  // --- Toggle helpers ---
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

  // --- Visible nodes (filtered by privacy settings) ---
  const visibleNodes = useMemo(() => {
    return engine.nodes.filter((n) => {
      if (n.type === "self" || n.type === "alter-ego") return true;
      if (hiddenNodes.has(n.id)) return false;
      if (hiddenBranches.has(n.type)) return false;
      return true;
    });
  }, [engine.nodes, hiddenNodes, hiddenBranches]);

  // --- Fetch mesh data ---
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/mesh");
        if (!res.ok) throw new Error("Failed to load mesh data");
        const data: MeshApiResponse = await res.json();

        // Set center from window dimensions
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        engine.setCenter(cx, cy);

        const { nodes, edges } = buildMeshData(data, cx, cy);
        engine.setData(nodes, edges);
        preloadNodeImages(nodes, imageCache.current);

        // Store for returning from user-mesh exploration
        setMyNodes(nodes);
        setMyEdges(edges);

        // Set stats and Meshi prefs
        setMeshStats(data.stats);
        setMyUsername(data.user.displayName || data.user.username);
        if (data.meshiPreference) {
          const c = data.meshiPreference.colorTheme as MeshiColor;
          const h = data.meshiPreference.hatStyle as MeshiHat;
          if (c) setMyMeshiColor(c);
          if (h) setMyMeshiHat(h);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load mesh");
      } finally {
        setLoading(false);
      }
    })();
  }, [engine]);

  // --- View helpers ---
  const handleZoom = useCallback((delta: number) => {
    setZoom((z) => {
      const next = Math.max(0.2, Math.min(4, z + delta));
      zoomRef.current = next;
      return next;
    });
  }, []);

  const resetView = useCallback(() => {
    setZoom(1); zoomRef.current = 1;
    setPan({ x: 0, y: 0 }); panRef.current = { x: 0, y: 0 };
    setSelectedNode(null);
    setHoveredNode(null);
  }, []);

  // --- Keyboard shortcuts (after handleZoom/resetView are defined) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case "r": case "R": resetView(); break;
        case "l": case "L": setShowLabels((v) => !v); break;
        case "s": case "S": setShowStats((v) => !v); break;
        case "f": case "F": setShowFootprint((v) => !v); break;
        case "=": case "+": handleZoom(0.3); break;
        case "-": handleZoom(-0.3); break;
        case "1": setFilter("all"); break;
        case "2": setFilter("user"); break;
        case "3": setFilter("alter-ego"); break;
        case "4": setFilter("community"); break;
        case "5": setFilter("tag"); break;
        case "6": setFilter("post"); break;
        case "7": setFilter("platform"); break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleZoom, resetView]);

  const zoomToNode = useCallback((nodeId: string) => {
    const targetNode = engine.getNode(nodeId);
    if (!targetNode) return;
    const center = engine.getCenter();
    const targetZoom = 2.0;
    const offsetX = -(targetNode.x - center.x) * targetZoom;
    const offsetY = -(targetNode.y - center.y) * targetZoom;
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
      setZoom(newZoom); zoomRef.current = newZoom;
      setPan({ x: newPanX, y: newPanY }); panRef.current = { x: newPanX, y: newPanY };
      if (t < 1) requestAnimationFrame(animate);
      else setSelectedNode(targetNode);
    };
    requestAnimationFrame(animate);
  }, [engine]);

  zoomToNodeRef.current = zoomToNode;

  // --- Multi-user mesh exploration ---
  const enterUserMesh = useCallback(async (node: MeshNode) => {
    const username = node.sublabel?.replace("@", "");
    if (!username) return;

    try {
      setLoadingUserMesh(true);
      // Save current mesh only on first exploration
      if (!viewingUserMesh) {
        setMyNodes([...engine.nodes]);
        setMyEdges([...engine.edges]);
      }
      const res = await fetch(`/api/users/${username}/mesh`);
      if (!res.ok) { if (node.href) router.push(node.href); return; }
      const data = await res.json();

      const center = engine.getCenter();
      const { nodes: userNodes, edges: userEdges } = buildUserMeshData(data, center.x, center.y);

      engine.setData(userNodes, userEdges);
      preloadNodeImages(userNodes, imageCache.current);

      if (data.meshiPreference) {
        setViewingUserMeshiPrefs({
          color: (data.meshiPreference.colorTheme || "blue") as MeshiColor,
          hat: (data.meshiPreference.hatStyle || "none") as MeshiHat,
        });
      } else {
        setViewingUserMeshiPrefs({ color: "blue", hat: "none" });
      }

      setViewingUserMesh(node);
      setSelectedNode(null);
      setShowMeshiMeet(false);
      resetView();
    } catch {
      if (node.href) router.push(node.href);
    } finally {
      setLoadingUserMesh(false);
    }
  }, [viewingUserMesh, router, engine, resetView]);

  const returnToMyMesh = useCallback(() => {
    if (myNodes.length > 0) {
      engine.setData(myNodes, myEdges);
    }
    setViewingUserMesh(null);
    setViewingUserMeshiPrefs(null);
    setShowMeshiMeet(false);
    setSelectedNode(null);
    resetView();
  }, [myNodes, myEdges, engine, resetView]);

  // --- Canvas interaction handlers ---
  const handleMeshiPositionChange = useCallback((x: number, y: number, mood: string) => {
    setMeshiPosition({ x, y });
    setMeshiMood(mood);
  }, []);

  const handleRemoteMeshisChange = useCallback((meshis: import("@/components/mesh/meshi-on-mesh").RemoteMeshi[]) => {
    setRemoteMeshis(meshis);
  }, []);

  const handleCanvasClick = useCallback((node: MeshNode | null) => {
    if (node) {
      setSelectedNode(node);
    } else {
      setSelectedNode(null);
    }
  }, []);

  const handleCanvasDoubleClick = useCallback((node: MeshNode | null) => {
    if (!node) return;
    if (node.type === "user" && node.sublabel) {
      enterUserMesh(node);
    } else if (node.href) {
      window.location.href = node.href;
    }
  }, [enterUserMesh]);

  // --- Connected platforms for post composer ---
  const connectedPlatforms = useMemo(() => {
    return engine.nodes.filter((n) => n.type === "platform").map((n) => ({
      id: n.id, label: n.label, color: n.color,
    }));
  }, [engine.nodes]);

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
      {/* Filter bar + search/footprint buttons */}
      <MeshFilterBar
        filter={filter}
        nodes={visibleNodes}
        onFilterChange={setFilter}
        onSearchOpen={() => setShowCommandPalette(true)}
        showFootprint={showFootprint}
        onToggleFootprint={() => setShowFootprint((v) => !v)}
      />

      {/* Zoom controls (right side) */}
      <MeshZoomControls
        showLabels={showLabels}
        showStats={showStats}
        onZoom={handleZoom}
        onReset={resetView}
        onToggleLabels={() => setShowLabels((v) => !v)}
        onToggleStats={() => setShowStats((v) => !v)}
      />

      {/* Stats bar (bottom left, above action bar) */}
      <MeshStatsBar nodes={visibleNodes} zoom={zoom} visible={showStats} />

      {/* Canvas */}
      <MeshCanvas
        engine={engine}
        filter={filter}
        showLabels={showLabels}
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
        onMeshiPositionChange={handleMeshiPositionChange}
        onZoomChange={(z) => { setZoom(z); zoomRef.current = z; }}
        onPanChange={(p) => { setPan(p); panRef.current = p; }}
        onHoverChange={setHoveredNode}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
      />

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
        myMeshiPosition={meshiPosition}
        myMeshiMood={meshiMood}
        onRemoteMeshisChange={handleRemoteMeshisChange}
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

      {/* Hint bar */}
      {engine.nodes.length > 0 && !selectedNode && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[5] bg-black/25 backdrop-blur-xl border border-white/[0.04] rounded-full px-4 py-1.5 text-[10px] text-white/35 pointer-events-none hidden md:block">
          {viewingUserMesh
            ? "Double-click to explore deeper \u00b7 Click back to return"
            : "Click to inspect \u00b7 Double-click to enter mesh \u00b7 Scroll to zoom \u00b7 \u2318K search"
          }
        </div>
      )}

      {/* Selected node detail panel */}
      <AnimatePresence>
        {selectedNode && (
          <Suspense fallback={null}>
          <MeshNodeDetail
            node={selectedNode}
            edges={engine.edges}
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
          </Suspense>
        )}
      </AnimatePresence>

      {/* Footprint dashboard */}
      <AnimatePresence>
        {showFootprint && meshStats && (
          <Suspense fallback={null}>
          <MeshFootprint
            meshStats={meshStats}
            meshiColor={myMeshiColor}
            meshiHat={myMeshiHat}
            onClose={() => setShowFootprint(false)}
          />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Command palette */}
      <AnimatePresence>
        {showCommandPalette && (
          <Suspense fallback={null}>
          <MeshCommandPalette
            nodes={engine.nodes}
            searchQuery={commandSearch}
            onSearchChange={setCommandSearch}
            onClose={() => setShowCommandPalette(false)}
            onSelectNode={setSelectedNode}
            onShowFootprint={() => setShowFootprint(true)}
            centerRef={{ get current() { return engine.getCenter(); } }}
            zoomRef={zoomRef}
            panRef={panRef}
            onPanChange={(newPan) => { setPan(newPan); panRef.current = newPan; }}
          />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Action bar (bottom left) */}
      <MeshActionBar
        showContentHub={showContentHub}
        showNodePrivacy={showNodePrivacy}
        hiddenCount={hiddenNodes.size + hiddenBranches.size}
        onCreatePost={() => setShowPostComposer(true)}
        onToggleContentHub={() => setShowContentHub(true)}
        onTogglePrivacy={() => setShowNodePrivacy((v) => !v)}
      />

      {/* Content Hub */}
      <Suspense fallback={null}>
        <ContentHub isOpen={showContentHub} onClose={() => setShowContentHub(false)} onDeleteSuccess={() => window.location.reload()} />
      </Suspense>

      {/* Privacy panel */}
      <AnimatePresence>
        {showNodePrivacy && (
          <Suspense fallback={null}>
          <MeshPrivacyPanel
            hiddenNodes={hiddenNodes}
            hiddenBranches={hiddenBranches}
            onToggleBranchHidden={toggleBranchHidden}
            onShowAll={() => { setHiddenNodes(new Set()); setHiddenBranches(new Set()); }}
            onClose={() => setShowNodePrivacy(false)}
          />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Post composer */}
      <AnimatePresence>
        {showPostComposer && (
          <Suspense fallback={null}>
          <MeshPostComposer
            connectedPlatforms={connectedPlatforms}
            onClose={() => setShowPostComposer(false)}
          />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {engine.nodes.length <= 1 && !loading && (
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
