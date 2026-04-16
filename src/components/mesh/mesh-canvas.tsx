"use client";

import { useRef, useCallback, useEffect } from "react";
import type { MeshEngine } from "./mesh-engine";
import type { MeshNode, FilterType } from "./mesh-types";
import { renderMesh } from "./mesh-renderer";
import { createMeshiState, tickMeshi, updateMeshiCursor, MESHI_COLORS, type MeshiState, type RemoteMeshi } from "./meshi-on-mesh";

interface MeshCanvasProps {
  engine: MeshEngine;
  filter: FilterType;
  showLabels: boolean;
  zoom: number;
  pan: { x: number; y: number };
  hoveredNode: MeshNode | null;
  selectedNode: MeshNode | null;
  imageCache: React.RefObject<Map<string, HTMLImageElement | null>>;
  loading: boolean;
  meshiColor?: string;
  meshiHat?: string;
  meshiUsername?: string;
  remoteMeshis?: RemoteMeshi[];
  syncPulseTime?: number | null;
  onMeshiPositionChange?: (x: number, y: number, mood: string) => void;
  onZoomChange: (zoom: number) => void;
  onPanChange: (pan: { x: number; y: number }) => void;
  onHoverChange: (node: MeshNode | null) => void;
  onClick: (node: MeshNode | null) => void;
  onDoubleClick: (node: MeshNode | null) => void;
}

export function MeshCanvas({
  engine, filter, showLabels, zoom, pan,
  hoveredNode, selectedNode, imageCache, loading,
  meshiColor, meshiHat, meshiUsername, remoteMeshis, syncPulseTime,
  onMeshiPositionChange,
  onZoomChange, onPanChange, onHoverChange, onClick, onDoubleClick,
}: MeshCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const dragActiveRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastTouchRef = useRef<{ x: number; y: number; dist?: number } | null>(null);

  // Formation animation state
  const formationStartRef = useRef<number | null>(null);
  const formationDuration = 2000; // 2 seconds for full formation

  // Meshi state
  const meshiStateRef = useRef<MeshiState | null>(null);
  const meshiInitializedRef = useRef(false);
  const remoteMeshisRef = useRef<RemoteMeshi[]>([]);
  const lastPositionReportRef = useRef(0);

  // Keep refs in sync for the render loop
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const filterRef = useRef(filter);
  const showLabelsRef = useRef(showLabels);
  const hoveredRef = useRef(hoveredNode);
  const selectedRef = useRef(selectedNode);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { filterRef.current = filter; }, [filter]);
  useEffect(() => { showLabelsRef.current = showLabels; }, [showLabels]);
  useEffect(() => { hoveredRef.current = hoveredNode; }, [hoveredNode]);
  useEffect(() => { selectedRef.current = selectedNode; }, [selectedNode]);
  useEffect(() => { remoteMeshisRef.current = remoteMeshis || []; }, [remoteMeshis]);

  // Keep syncPulseTime in a ref for the render loop
  const syncPulseTimeRef = useRef<number | null>(syncPulseTime ?? null);
  useEffect(() => { syncPulseTimeRef.current = syncPulseTime ?? null; }, [syncPulseTime]);

  // Patch Meshi appearance when user prefs change without destroying position/trail state
  useEffect(() => {
    if (meshiStateRef.current) {
      meshiStateRef.current.color = MESHI_COLORS[meshiColor || "blue"] || MESHI_COLORS.blue;
      meshiStateRef.current.hatColor = MESHI_COLORS[meshiColor || "blue"] || MESHI_COLORS.blue;
      meshiStateRef.current.hat = meshiHat || "none";
      meshiStateRef.current.username = meshiUsername || "You";
    }
  }, [meshiColor, meshiHat, meshiUsername]);

  // World coordinate conversion
  const getWorldCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const z = zoomRef.current;
    const p = panRef.current;
    const center = engine.getCenter();
    return {
      x: (mx - canvas.offsetWidth / 2 - p.x) / z + center.x,
      y: (my - canvas.offsetHeight / 2 - p.y) / z + center.y,
    };
  }, [engine]);

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      const cx = canvas.offsetWidth / 2;
      const cy = canvas.offsetHeight / 2;
      engine.setCenter(cx, cy);
      // Move pinned self node to new center and restart physics
      const selfNode = engine.nodes.find((n) => n.type === "self");
      if (selfNode) { selfNode.x = cx; selfNode.y = cy; }
      engine.wake();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [engine, loading]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || loading) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = performance.now();

    const render = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1); // Cap delta to avoid jumps
      lastTime = now;

      // Tick physics (pass dt for frame-rate independent simulation)
      engine.tick(dt);

      // Initialize Meshi at self node position once nodes are loaded
      if (!meshiInitializedRef.current && engine.nodes.length > 0) {
        const selfNode = engine.nodes.find((n) => n.type === "self");
        const cx = selfNode ? selfNode.x : engine.getCenter().x;
        const cy = selfNode ? selfNode.y : engine.getCenter().y;
        meshiStateRef.current = createMeshiState(
          cx, cy,
          meshiColor || "blue",
          meshiHat || "none",
          meshiUsername || "You",
        );
        meshiInitializedRef.current = true;
      }

      // Tick Meshi wandering behavior
      if (meshiStateRef.current) {
        // Make Meshi look at whatever node the user is focused on
        const focusNode = selectedRef.current || hoveredRef.current;
        if (focusNode) {
          meshiStateRef.current.lookAtX = focusNode.x;
          meshiStateRef.current.lookAtY = focusNode.y;
        } else {
          meshiStateRef.current.lookAtX = null;
          meshiStateRef.current.lookAtY = null;
        }

        tickMeshi(meshiStateRef.current, engine.nodes, dt, canvas.offsetWidth, canvas.offsetHeight);

        // Report position every 2 seconds for presence system
        if (onMeshiPositionChange && now - lastPositionReportRef.current > 2000) {
          lastPositionReportRef.current = now;
          onMeshiPositionChange(
            meshiStateRef.current.x,
            meshiStateRef.current.y,
            meshiStateRef.current.mood,
          );
        }
      }

      const cache = imageCache.current;

      // Compute formation progress (0→1 over formationDuration)
      if (formationStartRef.current === null) {
        formationStartRef.current = now;
      }
      const formationElapsed = now - formationStartRef.current;
      const formationProgress = Math.min(1, formationElapsed / formationDuration);

      renderMesh(ctx, engine.nodes, engine.edges, {
        zoom: zoomRef.current,
        pan: panRef.current,
        center: engine.getCenter(),
        filter: filterRef.current,
        showLabels: showLabelsRef.current,
        time: engine.time,
        formationProgress,
        syncPulseTime: syncPulseTimeRef.current,
      }, {
        hoveredNode: hoveredRef.current,
        selectedNode: selectedRef.current,
        meshiState: meshiStateRef.current,
        remoteMeshis: remoteMeshisRef.current,
      }, cache);

      animationRef.current = requestAnimationFrame(render);
    };

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width === 0 || canvas.height === 0) {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      engine.setCenter(canvas.offsetWidth / 2, canvas.offsetHeight / 2);
    }

    render();
    return () => cancelAnimationFrame(animationRef.current);
  }, [engine, loading, imageCache, meshiColor, meshiHat, meshiUsername, onMeshiPositionChange]);

  // --- Mouse handlers ---

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragActiveRef.current = false;
    dragStartRef.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y };
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      dragActiveRef.current = true;
      const newPan = { x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y };
      onPanChange(newPan);
      return;
    }
    const coords = getWorldCoords(e.clientX, e.clientY);
    const node = engine.findNodeAt(coords.x, coords.y, filterRef.current);
    onHoverChange(node);
    if (canvasRef.current) canvasRef.current.style.cursor = node ? "pointer" : "grab";

    // Update Meshi cursor position for following behavior
    if (meshiStateRef.current) {
      updateMeshiCursor(meshiStateRef.current, coords.x, coords.y);
    }
  }, [engine, getWorldCoords, onHoverChange, onPanChange]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
    setTimeout(() => { dragActiveRef.current = false; }, 50);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragActiveRef.current) return;
    const coords = getWorldCoords(e.clientX, e.clientY);
    const node = engine.findNodeAt(coords.x, coords.y, filterRef.current);
    onClick(node);
  }, [engine, getWorldCoords, onClick]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getWorldCoords(e.clientX, e.clientY);
    const node = engine.findNodeAt(coords.x, coords.y, filterRef.current);
    onDoubleClick(node);
  }, [engine, getWorldCoords, onDoubleClick]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newZoom = Math.max(0.2, Math.min(4, zoomRef.current + delta));
    onZoomChange(newZoom);
  }, [onZoomChange]);

  // --- Touch handlers ---

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
      onPanChange(newPan);
    } else if (e.touches.length === 2 && lastTouchRef.current && lastTouchRef.current.dist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.sqrt(dx * dx + dy * dy);
      const newZoom = Math.max(0.2, Math.min(4, zoomRef.current * (newDist / lastTouchRef.current.dist)));
      onZoomChange(newZoom);
      lastTouchRef.current.dist = newDist;
    }
  }, [onPanChange, onZoomChange]);

  const handleTouchEnd = useCallback(() => { lastTouchRef.current = null; }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ cursor: "grab" }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
}
