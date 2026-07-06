"use client";

import { ArrowLeft, Loader2, Maximize2, Minus, PenLine, Plus, Scan, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MeshDesktopChrome } from "@/components/mesh/mesh-desktop-chrome";
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
import { PostComposer } from "@/components/feed/post-composer";
import { buildSceneModel, type BranchKey, type SceneModel, type SceneNode } from "./scene-model";
import { layoutScene, sceneBounds } from "./scene-layout";
import { drawScene, type Camera } from "./scene-render";
import { createPhysicsState, stepExpansion, stepScenePhysics, type PhysicsState } from "./scene-physics";

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
  const pillHitboxesRef = useRef<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());
  const profileHitboxesRef = useRef<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());
  const starsRef = useRef<{ x: number; y: number; r: number; tw: number }[]>([]);
  const sizeRef = useRef({ width: 0, height: 0 });
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    lastX: number;
    lastY: number;
    lastT: number;
    vx: number;
    vy: number;
    pinchDist: number;
  }>({ active: false, moved: false, lastX: 0, lastY: 0, lastT: 0, vx: 0, vy: 0, pinchDist: 0 });
  const flingRef = useRef({ vx: 0, vy: 0 });
  const zoomTargetRef = useRef<{ zoom: number; ax: number; ay: number } | null>(null);
  const panTargetRef = useRef<{ nodeId: string } | null>(null);
  const physicsRef = useRef<PhysicsState>(createPhysicsState());
  const lastFrameRef = useRef(0);

  const meshiCursorRef = useRef<HTMLDivElement>(null);
  const presenceTargetsRef = useRef<Map<string, { vx: number; vy: number }>>(new Map());
  const presenceElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const presencePosRef = useRef<Map<string, { vx: number; vy: number }>>(new Map());
  const hoverIdRef = useRef<string | null>(null);
  const cursorVpRef = useRef({ vx: 0.5, vy: 0.5 });
  const meshOwnerIdRef = useRef<string | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [isCoarsePointer, setIsCoarsePointer] = useState(true);
  const [meshUser, setMeshUser] = useState<{ displayName: string; avatarUrl: string | null } | null>(null);
  const [meshData, setMeshData] = useState<MeshApiResponse | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [hoverNode, setHoverNode] = useState<SceneNode | null>(null);
  const [viewedUser, setViewedUser] = useState<{ username: string; displayName: string | null } | null>(null);
  const [remotePresences, setRemotePresences] = useState<RemotePresence[]>([]);
  const [activeBranch, setActiveBranch] = useState<BranchKey | null>(null);
  const [selectedNode, setSelectedNode] = useState<SceneNode | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [discoverUsers, setDiscoverUsers] = useState<
    { id: string; username: string; displayName: string | null; avatarUrl: string | null }[]
  >([]);
  const showDesktopChrome = Boolean(meshData && !viewUserId);

  const activeBranchRef = useRef<BranchKey | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const focusIdRef = useRef<string | null>(null);
  const coarseRef = useRef(true);

  useEffect(() => {
    activeBranchRef.current = activeBranch;
  }, [activeBranch]);
  useEffect(() => {
    selectedIdRef.current = selectedNode?.id ?? null;
  }, [selectedNode]);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => {
      coarseRef.current = mq.matches;
      setIsCoarsePointer(mq.matches);
    };
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

  const loadScene = useCallback(
    async (opts?: { quiet?: boolean; signal?: AbortSignal }) => {
      const url = viewUserId ? `/api/mesh?user=${encodeURIComponent(viewUserId)}` : "/api/mesh";
      if (!opts?.quiet) {
        setStatus("loading");
        setMeshData(null);
      }
      try {
        const res = await fetch(url, { cache: "no-store", signal: opts?.signal });
        if (opts?.signal?.aborted) return;
        if (!res.ok) throw new Error(String(res.status));
        const payload: MeshApiResponse = await res.json();
        setMeshData(payload);
        const model = buildSceneModel(payload);
        layoutScene(model);
        const quiet = Boolean(opts?.quiet && modelRef.current);
        if (quiet) {
          // Carry over animated positions so a refresh doesn't re-form the sky.
          const prev = modelRef.current!;
          model.nodes.forEach((node) => {
            const old = prev.nodes.get(node.id);
            if (old) {
              node.dx = old.dx;
              node.dy = old.dy;
              node.vx = old.vx;
              node.vy = old.vy;
            } else {
              node.dx = node.x * 0.1;
              node.dy = node.y * 0.1;
            }
          });
        } else {
          physicsRef.current = createPhysicsState();
        }
        modelRef.current = model;
        loadImages(model);
        meshOwnerIdRef.current = payload.user.id;
        setViewedUser(
          viewUserId ? { username: payload.user.username, displayName: payload.user.displayName } : null,
        );
        if (!viewUserId) {
          setMeshUser({ displayName: payload.user.displayName || payload.user.username, avatarUrl: payload.user.avatarUrl });
        }
        if (!quiet) {
          setActiveBranch(null);
          setSelectedNode(null);
          fitToContent();
        }
        setStatus(model.branchOrder.length === 0 ? "empty" : "ready");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!opts?.quiet) setStatus("error");
        if (!opts?.quiet) setMeshData(null);
      }
    },
    [viewUserId, loadImages, fitToContent],
  );

  useEffect(() => {
    imagesRef.current = new Map();
    const controller = new AbortController();
    void loadScene({ signal: controller.signal });
    return () => controller.abort();
  }, [loadScene]);

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
      const dt = lastFrameRef.current ? time - lastFrameRef.current : 16;
      lastFrameRef.current = time;
      if (model && width && height) {
        // Physics: branch expansion easing + node springs.
        stepExpansion(
          physicsRef.current,
          model.branchOrder.map((id) => model.nodes.get(id)!.branch as BranchKey),
          activeBranchRef.current,
          dt,
        );
        stepScenePhysics(model, physicsRef.current, time, dt);

        // Inertial pan: carry the fling velocity after release, with decay.
        const fling = flingRef.current;
        if (!dragRef.current.active && (Math.abs(fling.vx) > 4 || Math.abs(fling.vy) > 4)) {
          const flingDt = Math.min(dt, 50);
          cameraRef.current.panX += (fling.vx * flingDt) / 1000;
          cameraRef.current.panY += (fling.vy * flingDt) / 1000;
          const decay = Math.exp(-flingDt / 320);
          fling.vx *= decay;
          fling.vy *= decay;
        }

        // Glide the camera toward a fly-to node, tracking its live position so
        // branch expansion, drift, and zoom changes are all accounted for.
        const pt = panTargetRef.current;
        if (pt) {
          const target = model.nodes.get(pt.nodeId);
          if (!target) {
            panTargetRef.current = null;
          } else {
            const cam = cameraRef.current;
            const tx = -target.dx * cam.zoom;
            const ty = -target.dy * cam.zoom;
            const k = Math.min(1, dt / 220);
            cam.panX += (tx - cam.panX) * k;
            cam.panY += (ty - cam.panY) * k;
            if (Math.hypot(tx - cam.panX, ty - cam.panY) < 1.5) panTargetRef.current = null;
          }
        }

        // Smooth zoom: ease toward the wheel / button target around its anchor.
        const zt = zoomTargetRef.current;
        if (zt) {
          const cam = cameraRef.current;
          const k = Math.min(1, dt / 90);
          const next = cam.zoom + (zt.zoom - cam.zoom) * k;
          const ratio = next / cam.zoom;
          cam.panX = zt.ax - (zt.ax - cam.panX) * ratio;
          cam.panY = zt.ay - (zt.ay - cam.panY) * ratio;
          cam.zoom = next;
          if (Math.abs(zt.zoom - cam.zoom) < 0.002) zoomTargetRef.current = null;
        }

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
          hoverId: hoverIdRef.current,
          images: imagesRef.current,
          backgroundStars: starsRef.current,
          hitboxes: hitboxesRef.current,
          pillHitboxes: pillHitboxesRef.current,
          profileHitboxes: profileHitboxesRef.current,
          avoidCenter: coarseRef.current,
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
  const flyToNode = useCallback((node: SceneNode) => {
    panTargetRef.current = { nodeId: node.id };
  }, []);

  const enterFriendMesh = useCallback(
    (node: SceneNode) => {
      if (node.userId) router.push(`/mesh?user=${encodeURIComponent(node.userId)}`);
    },
    [router],
  );

  const activateNode = useCallback(
    (node: SceneNode) => {
      if (node.kind === "self") {
        setActiveBranch(null);
        setSelectedNode(null);
        fitToContent();
        return;
      }
      if (node.kind === "person" && node.userId) {
        enterFriendMesh(node);
        return;
      }
      if (node.kind === "post" && node.href?.startsWith("/feed/")) {
        router.push(`/feed?flow=${encodeURIComponent(node.href.slice("/feed/".length))}`);
        return;
      }
      if (node.kind === "branch") {
        setActiveBranch((prev) => {
          const next = prev === node.branch ? null : node.branch;
          if (next) flyToNode(node);
          return next;
        });
        setSelectedNode(node);
        return;
      }
      setActiveBranch(node.branch);
      setSelectedNode(node);
      flyToNode(node);
    },
    [fitToContent, flyToNode, enterFriendMesh, router],
  );

  const hitTest = useCallback((sx: number, sy: number): SceneNode | null => {
    const model = modelRef.current;
    if (!model) return null;
    // Label pills (branch / self) are clickable too.
    for (const [id, pill] of pillHitboxesRef.current) {
      if (sx >= pill.x - 4 && sx <= pill.x + pill.w + 4 && sy >= pill.y - 4 && sy <= pill.y + pill.h + 4) {
        const node = model.nodes.get(id);
        if (node) return node;
      }
    }
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
    d.lastT = performance.now();
    d.vx = 0;
    d.vy = 0;
    flingRef.current = { vx: 0, vy: 0 };
    panTargetRef.current = null;
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
    const now = performance.now();
    const dtMove = Math.max(now - d.lastT, 1);
    // Blend an instantaneous velocity sample (px/s) for the release fling.
    d.vx = d.vx * 0.7 + ((dx * 1000) / dtMove) * 0.3;
    d.vy = d.vy * 0.7 + ((dy * 1000) / dtMove) * 0.3;
    d.lastT = now;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
  }, [hitTest]);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size < 2) d.pinchDist = 0;
      if (pointersRef.current.size === 0) {
        d.active = false;
        if (d.moved && performance.now() - d.lastT < 80) {
          flingRef.current = { vx: d.vx, vy: d.vy };
        }
      }

      if (!d.moved) {
        const rect = containerRef.current!.getBoundingClientRect();
        const profileRect = profileHitboxesRef.current.get(modelRef.current?.selfId || "");
        if (profileRect) {
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          if (sx >= profileRect.x && sx <= profileRect.x + profileRect.w && sy >= profileRect.y && sy <= profileRect.y + profileRect.h) {
            router.push("/profile");
            return;
          }
        }
        const node = hitTest(e.clientX - rect.left, e.clientY - rect.top);
        if (node) {
          activateNode(node);
          return;
        }
        // On touch, Meshi is the cursor: a tap selects whatever it is on,
        // unless the tap landed directly on another node (handled above).
        if (coarseRef.current && focusIdRef.current) {
          const focused = modelRef.current?.nodes.get(focusIdRef.current);
          if (focused) {
            activateNode(focused);
            return;
          }
        }
        setSelectedNode(null);
        setActiveBranch(null);
      }
    },
    [activateNode, hitTest, router],
  );

  const onWheel = useCallback((e: React.WheelEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left - rect.width / 2;
    const my = e.clientY - rect.top - rect.height / 2;
    const factor = Math.exp(-e.deltaY * 0.0014);
    const base = zoomTargetRef.current?.zoom ?? cameraRef.current.zoom;
    zoomTargetRef.current = {
      zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, base * factor)),
      ax: mx,
      ay: my,
    };
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const base = zoomTargetRef.current?.zoom ?? cameraRef.current.zoom;
    zoomTargetRef.current = {
      zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, base * factor)),
      ax: 0,
      ay: 0,
    };
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
        const visible = list.filter((p) => p.isOnline && p.viewingMesh === meshOwner);
        const visibleIds = new Set(visible.map((p) => p.userId));
        for (const p of visible) {
          presenceTargetsRef.current.set(p.userId, {
            vx: Math.min(0.97, Math.max(0.03, p.viewportPosition?.vx ?? 0.5)),
            vy: Math.min(0.95, Math.max(0.05, p.viewportPosition?.vy ?? 0.5)),
          });
        }
        presenceTargetsRef.current.forEach((_, id) => {
          if (!visibleIds.has(id)) {
            presenceTargetsRef.current.delete(id);
            presencePosRef.current.delete(id);
          }
        });
        setRemotePresences(visible);
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

  // Glide remote Meshis toward their latest reported position every frame so
  // they move like live cursors instead of jumping between poll updates.
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const step = (time: number) => {
      const dt = last ? Math.min(time - last, 50) : 16;
      last = time;
      const k = 1 - Math.exp(-dt / 260);
      presenceElsRef.current.forEach((el, userId) => {
        const target = presenceTargetsRef.current.get(userId);
        if (!target) return;
        const pos = presencePosRef.current.get(userId) ?? { ...target };
        pos.vx += (target.vx - pos.vx) * k;
        pos.vy += (target.vy - pos.vy) * k;
        presencePosRef.current.set(userId, pos);
        el.style.left = `${pos.vx * 100}%`;
        el.style.top = `${pos.vy * 100}%`;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Keyboard shortcuts: / search, +/- zoom, 0 fit, Escape closes overlays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.key === "Escape") {
        setShowSearch(false);
        setShowCompose(false);
        setSelectedNode(null);
        return;
      }
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        setShowSearch(true);
      } else if (e.key === "+" || e.key === "=") zoomBy(1.25);
      else if (e.key === "-") zoomBy(0.8);
      else if (e.key === "0" || e.key.toLowerCase() === "f") fitToContent();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomBy, fitToContent]);

  // Discoverability: the mesh search also reaches across all of mesh.me, so
  // you can find any public user and step straight into their mesh.
  useEffect(() => {
    if (!showSearch) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setDiscoverUsers([]);
      return;
    }
    const controller = new AbortController();
    setDiscoverUsers([]);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data || controller.signal.aborted) return;
        const users = Array.isArray(data.users) ? data.users : [];
        setDiscoverUsers(
          users
            .filter((u: { id: string }) => u.id !== meshOwnerIdRef.current)
            .slice(0, 5)
            .map((u: { id: string; username: string; displayName: string | null; avatarUrl: string | null }) => ({
              id: u.id,
              username: u.username,
              displayName: u.displayName,
              avatarUrl: u.avatarUrl,
            })),
        );
      } catch {
        // Discovery search is best-effort.
      }
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [showSearch, searchQuery]);

  const searchResults = (() => {
    if (!showSearch) return [];
    const q = searchQuery.trim().toLowerCase();
    const model = modelRef.current;
    if (!model) return [];
    const out: SceneNode[] = [];
    model.nodes.forEach((node) => {
      if (node.kind === "self" || node.kind === "branch") return;
      if (!q || node.label.toLowerCase().includes(q) || node.sublabel?.toLowerCase().includes(q)) out.push(node);
    });
    out.sort((a, b) => b.weight - a.weight);
    return out.slice(0, 8);
  })();

  const jumpToNode = useCallback(
    (node: SceneNode) => {
      setShowSearch(false);
      setSearchQuery("");
      setActiveBranch(node.branch);
      setSelectedNode(node);
      flyToNode(node);
    },
    [flyToNode],
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
          {focusId && (() => {
            const node = modelRef.current?.nodes.get(focusId);
            if (!node) return null;
            return (
              <div className="absolute left-1/2 top-full mt-1 w-max max-w-[13rem] -translate-x-1/2 rounded-lg border border-white/12 bg-black/75 px-2.5 py-1.5 text-center backdrop-blur">
                <p className="truncate text-[11px] font-semibold text-white">{node.label}</p>
                {node.sublabel && <p className="truncate text-[10px] text-white/60">{node.sublabel}</p>}
              </div>
            );
          })()}
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
            <div className="absolute left-1/2 top-full mt-1 w-max max-w-[16rem] -translate-x-1/2 rounded-lg border border-white/12 bg-black/75 px-2.5 py-1.5 text-center backdrop-blur">
              <p className="truncate text-[11px] font-semibold text-white">{hoverNode.label}</p>
              {hoverNode.sublabel && <p className="truncate text-[10px] text-white/60">{hoverNode.sublabel}</p>}
              {hoverNode.content && hoverNode.content !== hoverNode.label && (
                <p className="mt-1 line-clamp-2 text-left text-[10px] leading-snug text-white/75">{hoverNode.content}</p>
              )}
              {hoverNode.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hoverNode.imageUrl} alt="" className="mt-1 h-16 w-full rounded object-cover" />
              )}
              {hoverNode.meta && hoverNode.meta.length > 0 && (
                <div className="mt-1 flex flex-wrap justify-center gap-x-2.5 gap-y-0.5">
                  {hoverNode.meta.map((m) => (
                    <span key={m.label} className="text-[10px] text-white/60">
                      <span className="font-semibold text-white/85">{m.value}</span> {m.label.toLowerCase()}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-1 text-[9px] uppercase tracking-wide text-white/40">
                {hoverNode.kind === "person"
                  ? "Click to visit their mesh"
                  : hoverNode.kind === "post" && hoverNode.href?.startsWith("/feed/")
                    ? "Click to open in the Flow"
                    : "Click to open"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Other users' Meshis — visible only while they're viewing this same mesh */}
      {remotePresences.map((p) => (
        <div
          key={p.userId}
          ref={(el) => {
            if (el) presenceElsRef.current.set(p.userId, el);
            else presenceElsRef.current.delete(p.userId);
          }}
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={(() => {
            const pos =
              presencePosRef.current.get(p.userId) ??
              presenceTargetsRef.current.get(p.userId) ?? {
                vx: Math.min(0.97, Math.max(0.03, p.viewportPosition?.vx ?? 0.5)),
                vy: Math.min(0.95, Math.max(0.05, p.viewportPosition?.vy ?? 0.5)),
              };
            return { left: `${pos.vx * 100}%`, top: `${pos.vy * 100}%` };
          })()}
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
      <div
        className="absolute top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2"
        style={{ right: showDesktopChrome ? "min(23rem, calc(100vw - 4rem))" : "0.75rem" }}
      >
        {!viewedUser && meshUser && (
          <RailButton label="Post to your mesh" onClick={() => setShowCompose(true)}>
            <PenLine size={16} />
          </RailButton>
        )}
        <RailButton label="Search your mesh" onClick={() => setShowSearch(true)}>
          <Search size={16} />
        </RailButton>
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

      {showDesktopChrome && meshData ? (
        <MeshDesktopChrome
          platforms={meshData.platforms}
          recentComments={meshData.recentComments}
          onRecenter={fitToContent}
        />
      ) : null}

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

      {/* Search: jump to any star in your constellation */}
      {showSearch && (
        <div
          className="absolute inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-24 backdrop-blur-sm"
          onPointerDown={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) setShowSearch(false);
          }}
        >
          <div className="w-full max-w-md animate-[slideUp_.22s_ease-out] rounded-2xl border border-white/12 bg-[#0b1020] p-2 shadow-2xl">
            <div className="flex items-center gap-2 px-2">
              <Search size={15} className="shrink-0 text-white/45" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchResults[0]) jumpToNode(searchResults[0]);
                }}
                placeholder="Find a person, post, platform…"
                className="w-full bg-transparent py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none"
              />
              <button
                type="button"
                aria-label="Close search"
                onClick={() => setShowSearch(false)}
                className="rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>
            {searchResults.length > 0 && (
              <ul className="max-h-72 overflow-y-auto border-t border-white/8 pt-1">
                {searchResults.map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => jumpToNode(node)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/6"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: node.color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-white">{node.label}</span>
                        {node.sublabel && <span className="block truncate text-[11px] text-white/50">{node.sublabel}</span>}
                      </span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/35">{node.kind}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {discoverUsers.length > 0 && (
              <div className="border-t border-white/8 pt-1">
                <p className="px-3 pt-1.5 pb-0.5 text-[10px] uppercase tracking-wide text-white/35">Across mesh.me</p>
                <ul className="max-h-48 overflow-y-auto">
                  {discoverUsers.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSearch(false);
                          setSearchQuery("");
                          router.push(`/mesh?user=${encodeURIComponent(u.id)}`);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/6"
                      >
                        {u.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white/70">
                            {(u.displayName || u.username).slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-white">{u.displayName || u.username}</span>
                          <span className="block truncate text-[11px] text-white/50">@{u.username}</span>
                        </span>
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/35">Visit mesh</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {searchQuery.trim() && searchResults.length === 0 && discoverUsers.length === 0 && (
              <p className="border-t border-white/8 px-3 py-3 text-xs text-white/45">Nothing on the mesh matches that.</p>
            )}
          </div>
        </div>
      )}

      {/* Detail sheet */}
      {selectedNode && selectedNode.kind !== "self" && selectedNode.kind !== "branch" && (
        <NodeDetail node={selectedNode} onClose={() => setSelectedNode(null)} onEnterMesh={enterFriendMesh} />
      )}

      {/* Compose: post straight onto your constellation */}
      {showCompose && meshUser && (
        <div
          className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center"
          onPointerDown={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) setShowCompose(false);
          }}
        >
          <div className="w-full max-w-xl animate-[slideUp_.28s_ease-out] rounded-2xl border border-white/12 bg-[#0b1020] p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-sm font-semibold text-white">Post to your mesh</p>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowCompose(false)}
                className="rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <PostComposer
              user={meshUser}
              onPostCreated={() => {
                setShowCompose(false);
                setActiveBranch("posts");
                void loadScene({ quiet: true });
              }}
            />
          </div>
        </div>
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
