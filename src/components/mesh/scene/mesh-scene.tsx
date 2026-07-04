"use client";

import { ArrowLeft, Loader2, Maximize2, Minus, Plus, Scan, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MeshiMascot,
  MeshiMini,
  type MeshiAccessory,
  type MeshiBadge,
  type MeshiColor,
  type MeshiEyeStyle,
  type MeshiHair,
  type MeshiHat,
  type MeshiMood,
  type MeshiOutfit,
} from "@/components/meshi/meshi-mascot";
import { useMeshiPreferences } from "@/hooks/use-meshi-preferences";
import type { MeshApiResponse } from "../mesh-data";
import { buildSceneModel, type BranchKey, type SceneModel, type SceneNode } from "./scene-model";
import { layoutScene, sceneBounds } from "./scene-layout";
import { drawScene, type Camera } from "./scene-render";

interface MeshSceneProps {
  viewUserId?: string;
}

const MIN_ZOOM = 0.22;
const MAX_ZOOM = 2.4;

type RemotePresence = {
  userId: string;
  username: string;
  displayName: string;
  meshiColor: string;
  meshiHat: string;
  meshiHair?: string;
  meshiAccessory?: string;
  meshiEyeStyle?: string;
  meshiBadge?: string;
  meshiOutfit?: string;
  meshiMood: string;
  viewportPosition: { vx: number; vy: number };
  viewingMesh: string;
  isOnline: boolean;
};

function generateStars(width: number, height: number) {
  const stars: { x: number; y: number; r: number; tw: number }[] = [];
  const count = Math.round((width * height) / 9000);
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < count; i++) {
    stars.push({ x: rand() * width, y: rand() * height, r: rand() * 1.1 + 0.2, tw: rand() * 6.28 });
  }
  return stars;
}

export function MeshScene({ viewUserId }: MeshSceneProps) {
  const router = useRouter();
  const prefs = useMeshiPreferences();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera>({ panX: 0, panY: 0, zoom: 0.6 });
  const modelRef = useRef<SceneModel | null>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const hitboxesRef = useRef<Map<string, { x: number; y: number; r: number }>>(new Map());
  const starsRef = useRef<{ x: number; y: number; r: number; tw: number }[]>([]);
  const sizeRef = useRef({ width: 0, height: 0 });
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragRef = useRef<{ active: boolean; moved: boolean; lastX: number; lastY: number; pinchDist: number }>({
    active: false,
    moved: false,
    lastX: 0,
    lastY: 0,
    pinchDist: 0,
  });

  const meshiCursorRef = useRef<HTMLDivElement>(null);
  const hoverIdRef = useRef<string | null>(null);
  const cursorVpRef = useRef({ vx: 0.5, vy: 0.5 });
  const meshOwnerIdRef = useRef<string | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [isCoarsePointer, setIsCoarsePointer] = useState(true);
  const [hoverNode, setHoverNode] = useState<SceneNode | null>(null);
  const [viewedUser, setViewedUser] = useState<{ username: string; displayName: string | null } | null>(null);
  const [remotePresences, setRemotePresences] = useState<RemotePresence[]>([]);
  const [activeBranch, setActiveBranch] = useState<BranchKey | null>(null);
  const [selectedNode, setSelectedNode] = useState<SceneNode | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const activeBranchRef = useRef<BranchKey | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const focusIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeBranchRef.current = activeBranch;
  }, [activeBranch]);
  useEffect(() => {
    selectedIdRef.current = selectedNode?.id ?? null;
  }, [selectedNode]);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsCoarsePointer(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // --- Fetch + build model ---
  const loadImages = useCallback((model: SceneModel) => {
    model.nodes.forEach((node) => {
      const src = node.avatarUrl || node.imageUrl;
      if (!src || imagesRef.current.has(node.id)) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => imagesRef.current.set(node.id, img);
      img.src = src;
    });
  }, []);

  const fitToContent = useCallback(() => {
    const model = modelRef.current;
    const { width, height } = sizeRef.current;
    if (!model || !width || !height) return;
    const b = sceneBounds(model);
    const contentW = Math.max(b.maxX - b.minX, 400) + 220;
    const contentH = Math.max(b.maxY - b.minY, 400) + 220;
    const zoom = Math.max(MIN_ZOOM, Math.min(1, Math.min(width / contentW, height / contentH)));
    const midX = (b.minX + b.maxX) / 2;
    const midY = (b.minY + b.maxY) / 2;
    cameraRef.current = { zoom, panX: -midX * zoom, panY: -midY * zoom };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const url = viewUserId ? `/api/mesh?user=${encodeURIComponent(viewUserId)}` : "/api/mesh";
    const load = async () => {
      setStatus("loading");
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const payload: MeshApiResponse = await res.json();
        if (cancelled) return;
        const model = buildSceneModel(payload);
        layoutScene(model);
        modelRef.current = model;
        imagesRef.current = new Map();
        loadImages(model);
        meshOwnerIdRef.current = payload.user.id;
        setViewedUser(
          viewUserId ? { username: payload.user.username, displayName: payload.user.displayName } : null,
        );
        setActiveBranch(null);
        setSelectedNode(null);
        fitToContent();
        setStatus(model.branchOrder.length === 0 ? "empty" : "ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [viewUserId, loadImages, fitToContent]);

  // --- Canvas sizing + render loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      sizeRef.current = { width: rect.width, height: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      starsRef.current = generateStars(rect.width, rect.height);
      if (modelRef.current && cameraRef.current.panX === 0 && cameraRef.current.panY === 0) fitToContent();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const render = (time: number) => {
      const { width, height } = sizeRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const model = modelRef.current;
      if (model && width && height) {
        drawScene({
          ctx,
          model,
          width,
          height,
          camera: cameraRef.current,
          time,
          activeBranch: activeBranchRef.current,
          selectedId: selectedIdRef.current,
          focusId: focusIdRef.current,
          images: imagesRef.current,
          backgroundStars: starsRef.current,
          hitboxes: hitboxesRef.current,
        });

        // Focus = item nearest screen center (the Meshi cursor's target).
        let nearest: string | null = null;
        let best = 52;
        const cx = width / 2;
        const cy = height / 2;
        hitboxesRef.current.forEach((box, id) => {
          const node = model.nodes.get(id);
          if (!node || node.kind === "self" || node.kind === "branch") return;
          const d = Math.hypot(box.x - cx, box.y - cy);
          if (d < best) {
            best = d;
            nearest = id;
          }
        });
        if (nearest !== focusIdRef.current) {
          focusIdRef.current = nearest;
          setFocusId(nearest);
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [fitToContent]);

  // --- Interaction ---
  const activateNode = useCallback(
    (node: SceneNode) => {
      if (node.kind === "self") {
        setActiveBranch(null);
        setSelectedNode(null);
        fitToContent();
        return;
      }
      if (node.kind === "branch") {
        setActiveBranch((prev) => (prev === node.branch ? null : node.branch));
        setSelectedNode(node);
        return;
      }
      setActiveBranch(node.branch);
      setSelectedNode(node);
    },
    [fitToContent],
  );

  const hitTest = useCallback((sx: number, sy: number): SceneNode | null => {
    const model = modelRef.current;
    if (!model) return null;
    let found: SceneNode | null = null;
    let bestR = Infinity;
    hitboxesRef.current.forEach((box, id) => {
      const d = Math.hypot(box.x - sx, box.y - sy);
      if (d <= box.r && box.r < bestR) {
        const node = model.nodes.get(id);
        if (node) {
          found = node;
          bestR = box.r;
        }
      }
    });
    return found;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = dragRef.current;
    d.active = true;
    d.moved = false;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      d.pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "mouse") {
      const rect = containerRef.current!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cursor = meshiCursorRef.current;
      if (cursor) {
        cursor.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`;
        cursor.style.opacity = "1";
      }
      if (rect.width > 0 && rect.height > 0) {
        cursorVpRef.current = { vx: sx / rect.width, vy: sy / rect.height };
      }
      if (!dragRef.current.active) {
        const node = hitTest(sx, sy);
        const id = node?.id ?? null;
        if (id !== hoverIdRef.current) {
          hoverIdRef.current = id;
          setHoverNode(node);
        }
      }
    }
    const d = dragRef.current;
    if (!d.active) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (d.pinchDist > 0) {
        const cam = cameraRef.current;
        const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * (dist / d.pinchDist)));
        const rect = containerRef.current!.getBoundingClientRect();
        const midX = (pts[0].x + pts[1].x) / 2 - rect.left - rect.width / 2;
        const midY = (pts[0].y + pts[1].y) / 2 - rect.top - rect.height / 2;
        const k = next / cam.zoom;
        cam.panX = midX - (midX - cam.panX) * k;
        cam.panY = midY - (midY - cam.panY) * k;
        cam.zoom = next;
      }
      d.pinchDist = dist;
      d.moved = true;
      return;
    }

    const dx = e.clientX - d.lastX;
    const dy = e.clientY - d.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    cameraRef.current.panX += dx;
    cameraRef.current.panY += dy;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
  }, [hitTest]);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size < 2) d.pinchDist = 0;
      if (pointersRef.current.size === 0) d.active = false;

      if (!d.moved) {
        const rect = containerRef.current!.getBoundingClientRect();
        const node = hitTest(e.clientX - rect.left, e.clientY - rect.top);
        if (node) activateNode(node);
        else {
          setSelectedNode(null);
          setActiveBranch(null);
        }
      }
    },
    [activateNode, hitTest],
  );

  const onWheel = useCallback((e: React.WheelEvent) => {
    const cam = cameraRef.current;
    const rect = containerRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left - rect.width / 2;
    const my = e.clientY - rect.top - rect.height / 2;
    const factor = Math.exp(-e.deltaY * 0.0014);
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * factor));
    const k = next / cam.zoom;
    cam.panX = mx - (mx - cam.panX) * k;
    cam.panY = my - (my - cam.panY) * k;
    cam.zoom = next;
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const cam = cameraRef.current;
    cam.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * factor));
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }, []);

  // --- Live presence: broadcast where I am and show Meshis of users viewing this same mesh ---
  useEffect(() => {
    let stopped = false;

    const heartbeat = async () => {
      const meshOwner = meshOwnerIdRef.current;
      if (!meshOwner || document.visibilityState !== "visible") return;
      const vp = cursorVpRef.current;
      try {
        await fetch("/api/mesh/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meshiColor: prefs.color,
            meshiHat: prefs.hat,
            meshiHair: prefs.hair,
            meshiAccessory: prefs.accessory,
            meshiEyeStyle: prefs.eye,
            meshiBadge: prefs.badge,
            meshiOutfit: prefs.outfit,
            meshiMood: prefs.face,
            viewportPosition: vp,
            viewingMesh: meshOwner,
            surface: "mesh",
          }),
        });
      } catch {
        // Presence is best-effort.
      }
    };

    const poll = async () => {
      const meshOwner = meshOwnerIdRef.current;
      if (!meshOwner || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/mesh/presence?meshOwner=${encodeURIComponent(meshOwner)}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (stopped || !data) return;
        const list: RemotePresence[] = Array.isArray(data.presences) ? data.presences : [];
        // Only Meshis of users actively viewing this exact mesh right now.
        setRemotePresences(list.filter((p) => p.isOnline && p.viewingMesh === meshOwner));
      } catch {
        // Presence is best-effort.
      }
    };

    const hb = setInterval(heartbeat, 4000);
    const pl = setInterval(poll, 3000);
    const kick = setTimeout(() => {
      void heartbeat();
      void poll();
    }, 400);

    return () => {
      stopped = true;
      clearInterval(hb);
      clearInterval(pl);
      clearTimeout(kick);
    };
  }, [viewUserId, prefs.color, prefs.hat, prefs.hair, prefs.accessory, prefs.eye, prefs.badge, prefs.outfit, prefs.face]);

  useEffect(() => {
    return () => {
      fetch("/api/mesh/presence", { method: "DELETE" }).catch(() => {});
    };
  }, []);

  const enterFriendMesh = useCallback(
    (node: SceneNode) => {
      if (node.userId) router.push(`/mesh?user=${encodeURIComponent(node.userId)}`);
    },
    [router],
  );

  return (
    <div
      ref={containerRef}
      className={`relative h-full min-h-0 w-full min-w-0 flex-1 touch-none overflow-hidden bg-[#04050c] select-none ${!isCoarsePointer ? "cursor-none" : ""}`}
      onWheel={onWheel}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          hoverIdRef.current = null;
          setHoverNode(null);
          if (meshiCursorRef.current) meshiCursorRef.current.style.opacity = "0";
        }}
      />

      {/* Meshi — you, the cursor exploring the mesh. Center-pinned on touch, follows the pointer on desktop. */}
      {prefs.enabled && isCoarsePointer && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <MeshiMascot
            size={62}
            color={prefs.color}
            hat={prefs.hat}
            mood={focusId ? "excited" : prefs.face}
            hair={prefs.hair}
            accessory={prefs.accessory}
            eyeStyle={prefs.eye}
            badge={prefs.badge}
            outfit={prefs.outfit}
            prop="compass"
          />
        </div>
      )}
      {prefs.enabled && !isCoarsePointer && (
        <div
          ref={meshiCursorRef}
          className="pointer-events-none absolute left-0 top-0 z-20 opacity-0 transition-opacity duration-150"
        >
          <MeshiMascot
            size={52}
            color={prefs.color}
            hat={prefs.hat}
            mood={hoverNode ? "excited" : prefs.face}
            hair={prefs.hair}
            accessory={prefs.accessory}
            eyeStyle={prefs.eye}
            badge={prefs.badge}
            outfit={prefs.outfit}
            prop="compass"
          />
          {hoverNode && hoverNode.kind !== "self" && (
            <div className="absolute left-1/2 top-full mt-1 w-max max-w-[14rem] -translate-x-1/2 rounded-lg border border-white/12 bg-black/75 px-2.5 py-1.5 text-center backdrop-blur">
              <p className="truncate text-[11px] font-semibold text-white">{hoverNode.label}</p>
              {hoverNode.sublabel && <p className="truncate text-[10px] text-white/60">{hoverNode.sublabel}</p>}
            </div>
          )}
        </div>
      )}

      {/* Other users' Meshis — visible only while they're viewing this same mesh */}
      {remotePresences.map((p) => (
        <div
          key={p.userId}
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out"
          style={{
            left: `${Math.min(0.97, Math.max(0.03, p.viewportPosition?.vx ?? 0.5)) * 100}%`,
            top: `${Math.min(0.95, Math.max(0.05, p.viewportPosition?.vy ?? 0.5)) * 100}%`,
          }}
        >
          <MeshiMini
            size={34}
            color={p.meshiColor as MeshiColor}
            hat={p.meshiHat as MeshiHat}
            hair={(p.meshiHair || "none") as MeshiHair}
            accessory={(p.meshiAccessory || "none") as MeshiAccessory}
            eyeStyle={(p.meshiEyeStyle || "regular") as MeshiEyeStyle}
            badge={(p.meshiBadge || "none") as MeshiBadge}
            outfit={(p.meshiOutfit || "none") as MeshiOutfit}
            mood={(p.meshiMood as MeshiMood) || "happy"}
          />
          <p className="mt-0.5 max-w-[6rem] truncate text-center text-[10px] font-medium text-white/75">
            @{p.username}
          </p>
        </div>
      ))}

      {/* Top-left: back / context */}
      <div className="absolute left-3 top-20 z-30 flex items-center gap-2">
        {viewedUser ? (
          <button
            type="button"
            onClick={() => router.push("/mesh")}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/60"
          >
            <ArrowLeft size={14} />
            Back to your mesh
          </button>
        ) : null}
        {viewedUser && (
          <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/80 backdrop-blur">
            {viewedUser.displayName || "@" + viewedUser.username}&apos;s mesh
          </span>
        )}
      </div>

      {/* Right rail controls */}
      <div className="absolute right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2">
        <RailButton label="Zoom in" onClick={() => zoomBy(1.25)}>
          <Plus size={16} />
        </RailButton>
        <RailButton label="Zoom out" onClick={() => zoomBy(0.8)}>
          <Minus size={16} />
        </RailButton>
        <RailButton label="Fit" onClick={fitToContent}>
          <Scan size={16} />
        </RailButton>
        <RailButton label="Fullscreen" onClick={toggleFullscreen}>
          <Maximize2 size={16} />
        </RailButton>
      </div>

      {/* Loading / states */}
      {status === "loading" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#04050c]">
          <Loader2 className="animate-spin text-white/60" size={28} />
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-[#04050c] text-center">
          <p className="text-sm text-white/70">Your mesh couldn&apos;t be reached.</p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs text-white"
          >
            Try again
          </button>
        </div>
      )}
      {status === "empty" && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-[#04050c] px-8 text-center">
          <p className="text-sm text-white/70">Your mesh is just you for now.</p>
          <Link
            href="/connected-accounts"
            className="rounded-full bg-[var(--mesh-blue)] px-4 py-1.5 text-xs font-medium text-white"
          >
            Connect your accounts
          </Link>
        </div>
      )}

      {/* Detail sheet */}
      {selectedNode && selectedNode.kind !== "self" && selectedNode.kind !== "branch" && (
        <NodeDetail node={selectedNode} onClose={() => setSelectedNode(null)} onEnterMesh={enterFriendMesh} />
      )}
    </div>
  );
}

function RailButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-black/45 text-white/85 backdrop-blur transition-colors hover:bg-black/65 hover:text-white"
    >
      {children}
    </button>
  );
}

function NodeDetail({
  node,
  onClose,
  onEnterMesh,
}: {
  node: SceneNode;
  onClose: () => void;
  onEnterMesh: (node: SceneNode) => void;
}) {
  return (
    <div
      className="absolute inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-2xl border border-white/12 bg-[#0b1020]/95 p-4 shadow-2xl backdrop-blur sm:inset-x-auto sm:right-3 sm:bottom-3 sm:w-80"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-start gap-3">
        {node.avatarUrl || node.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={(node.avatarUrl || node.imageUrl) as string}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span
            className="h-12 w-12 shrink-0 rounded-xl"
            style={{ background: `radial-gradient(circle at 35% 30%, #ffffff55, ${node.color})` }}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{node.label}</p>
          {node.sublabel && <p className="truncate text-xs text-white/55">{node.sublabel}</p>}
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      {node.content && <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-white/70">{node.content}</p>}

      {node.meta && node.meta.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {node.meta.map((m) => (
            <span key={m.label} className="rounded-lg bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
              <span className="font-semibold text-white">{m.value}</span> {m.label}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {node.kind === "person" && node.userId && (
          <button
            type="button"
            onClick={() => onEnterMesh(node)}
            className="flex-1 rounded-full bg-[var(--mesh-blue)] py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            Enter their mesh
          </button>
        )}
        {node.href && (
          <Link
            href={node.href}
            target={node.href.startsWith("http") ? "_blank" : undefined}
            className="flex-1 rounded-full border border-white/15 bg-white/5 py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-white/10"
          >
            {node.kind === "post" ? "Open post" : node.kind === "platform" ? "Manage account" : "Open"}
          </Link>
        )}
      </div>
    </div>
  );
}
