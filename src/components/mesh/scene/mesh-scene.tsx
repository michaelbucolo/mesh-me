"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Heart, HelpCircle, LocateFixed, MessageCircle, Minus, PenLine, Plus, Search, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toggleReaction } from "@/lib/actions";
import { MeshiLoader } from "@/components/meshi/meshi-loader";
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
import { getVideoEmbedUrl } from "@/lib/video-embed";
import { buildSceneModel, type BranchKey, type SceneModel, type SceneNode } from "./scene-model";
import { layoutScene, sceneBounds } from "./scene-layout";
import { drawScene, type Camera } from "./scene-render";
import { createPhysicsState, stepExpansion, stepScenePhysics, type PhysicsState } from "./scene-physics";

interface MeshSceneProps {
  viewUserId?: string;
}

const MIN_ZOOM = 0.22;
const MAX_ZOOM = 2.4;
const TIPS_SEEN_KEY = "mesh-tips-seen";

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
  position?: { x: number; y: number };
  viewingMesh: string;
  surface?: string;
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
  // Meshi lives ON the mesh: its target and eased position are WORLD
  // coordinates, so it pans and travels with the web rather than floating on
  // a screen layer. It ambles casually toward wherever the pointer points.
  const cursorWorldTargetRef = useRef<{ x: number; y: number; seen: boolean }>({ x: 0, y: 0, seen: false });
  const cursorWorldPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Local-only hover growth — only YOU see your Meshi lean in toward a node.
  const cursorScaleRef = useRef(1);
  // Reactive body language: Meshi leans into its direction of travel, and a
  // click/tap gives a happy little pop. Screen-space, per-frame, local-only.
  const cursorRotRef = useRef(0);
  const cursorPrevRef = useRef<{ x: number; y: number } | null>(null);
  const ownerScaleRef = useRef(1);
  const ownerRotRef = useRef(0);
  const ownerPrevRef = useRef<{ x: number; y: number } | null>(null);
  // Whether the mouse is currently over the canvas — while it is, your Meshi
  // mirrors it tightly (it IS your cursor); when it leaves, Meshi ambles home.
  const pointerOnCanvasRef = useRef(false);
  // Last pointer/touch input time — the owner Meshi wanders toward recent
  // input and ambles home to the heart once you've been idle a few seconds.
  const lastInputAtRef = useRef(0);
  const ownerWorldPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const presenceTargetsRef = useRef<Map<string, { vx: number; vy: number }>>(new Map());
  const presenceElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const presencePosRef = useRef<Map<string, { vx: number; vy: number }>>(new Map());
  // "room" = viewing this same mesh (drifts like a live cursor);
  // "perch" = a connection online elsewhere, perched on their own node.
  const presenceModeRef = useRef<Map<string, "room" | "perch">>(new Map());
  const perchPosRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  // Latest broadcast WORLD position per same-mesh visitor, and their eased
  // world position — anchored to the mesh itself, not the screen.
  const presenceWorldRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const presenceWorldPosRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const hoverIdRef = useRef<string | null>(null);
  // Mirrors showCompose for the heartbeat, which runs outside React renders.
  const composingRef = useRef(false);
  const cursorVpRef = useRef({ vx: 0.5, vy: 0.5 });
  const meshOwnerIdRef = useRef<string | null>(null);
  const ownerMeshiElRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error" | "private">("loading");
  const [meshIsEmpty, setMeshIsEmpty] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(true);
  const [meshUser, setMeshUser] = useState<{ displayName: string; avatarUrl: string | null } | null>(null);
  const [meshData, setMeshData] = useState<MeshApiResponse | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  useEffect(() => {
    composingRef.current = showCompose;
  }, [showCompose]);
  const [hoverNode, setHoverNode] = useState<SceneNode | null>(null);
  const [viewedUser, setViewedUser] = useState<{ username: string; displayName: string | null } | null>(null);
  const [remotePresences, setRemotePresences] = useState<RemotePresence[]>([]);
  const [activeBranch, setActiveBranch] = useState<BranchKey | null>(null);
  const [selectedNode, setSelectedNode] = useState<SceneNode | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [discoverUsers, setDiscoverUsers] = useState<
    { id: string; username: string; displayName: string | null; avatarUrl: string | null }[]
  >([]);
  const showDesktopChrome = Boolean(meshData && !viewUserId);
  // On your OWN mesh, the owner Meshi pinned at the heart already is you — so
  // don't ALSO render the pointer-following cursor Meshi, or there are two of
  // you. The cursor Meshi is for exploring: show it only when visiting someone
  // else's mesh, or as a fallback when there's no owner Meshi to stand in.
  const showCursorMeshi = prefs.enabled && (Boolean(viewUserId) || !meshData?.meshiPreference);

  const lastTapRef = useRef<{ x: number; y: number; t: number } | null>(null);
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

  // First visit: walk newcomers through how to explore the mesh.
  useEffect(() => {
    try {
      if (!localStorage.getItem(TIPS_SEEN_KEY)) setShowTips(true);
    } catch {
      // Storage may be unavailable; skip the intro.
    }
  }, []);

  const dismissTips = useCallback(() => {
    setShowTips(false);
    try {
      localStorage.setItem(TIPS_SEEN_KEY, "1");
    } catch {
      // Storage may be unavailable.
    }
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
    const isNarrowViewport = width < 640;
    const zoom = isNarrowViewport
      ? Math.max(MIN_ZOOM, 0.72)
      : Math.max(MIN_ZOOM, Math.min(1, Math.min(width / contentW, height / contentH)));
    const midX = isNarrowViewport ? 0 : (b.minX + b.maxX) / 2;
    const midY = isNarrowViewport ? 0 : (b.minY + b.maxY) / 2;
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
        if (payload.privateMesh) {
          // Locked mesh: keep the owner's identity for the locked state UI.
          setMeshData(payload);
          setViewedUser({ username: payload.user.username, displayName: payload.user.displayName });
          setStatus("private");
          return;
        }
        setMeshData(payload);
        const model = buildSceneModel(payload);
        layoutScene(model);
        const quiet = Boolean(opts?.quiet && modelRef.current);
        if (quiet) {
          // Carry over animated positions so a refresh doesn't re-form the sky.
          const prev = modelRef.current!;
          const bornStamp = (typeof performance !== "undefined" ? performance.now() : Date.now());
          model.nodes.forEach((node) => {
            const old = prev.nodes.get(node.id);
            if (old) {
              node.dx = old.dx;
              node.dy = old.dy;
              node.vx = old.vx;
              node.vy = old.vy;
            } else {
              // New content: land at its place and play the arrival animation,
              // then its strands draw out to everything it connects to.
              node.dx = node.x;
              node.dy = node.y;
              node.bornAt = bornStamp;
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
        // An empty mesh is still the mesh: render the canvas (you + your
        // Meshi) and let compose/search work — just surface a gentle hint.
        setMeshIsEmpty(model.branchOrder.length === 0);
        setStatus("ready");
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
          isOwnMesh: !viewUserId,
          strands: physicsRef.current.strands,
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
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [fitToContent, viewUserId]);

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
    [fitToContent, flyToNode, enterFriendMesh],
  );

  // Every readable piece of content on the mesh, in reading order — so the
  // content lens can glide from one to the next like a stream you scroll.
  const contentList = useCallback((): SceneNode[] => {
    const model = modelRef.current;
    if (!model) return [];
    const out: SceneNode[] = [];
    model.nodes.forEach((n) => {
      if (n.kind === "post" || n.kind === "activity") out.push(n);
    });
    return out;
  }, []);

  const navigateContent = useCallback(
    (dir: 1 | -1) => {
      const list = contentList();
      if (list.length === 0) return;
      const cur = selectedIdRef.current;
      const i = list.findIndex((n) => n.id === cur);
      const next = list[((i === -1 ? 0 : i) + dir + list.length) % list.length];
      setSelectedNode(next);
      setActiveBranch(next.branch);
      flyToNode(next);
    },
    [contentList, flyToNode],
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
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      // On touch the stable viewport anchor is the screen centre — but a TAP
      // is a deliberate point, so it still steers your Meshi on the mesh.
      if (coarseRef.current) {
        cursorVpRef.current = { vx: 0.5, vy: 0.5 };
      } else {
        cursorVpRef.current = { vx: sx / rect.width, vy: sy / rect.height };
      }
      const cam = cameraRef.current;
      const t = cursorWorldTargetRef.current;
      t.x = (sx - rect.width / 2 - cam.panX) / cam.zoom;
      t.y = (sy - rect.height / 2 - cam.panY) / cam.zoom;
      if (!t.seen) {
        cursorWorldPosRef.current.x = t.x;
        cursorWorldPosRef.current.y = t.y;
        t.seen = true;
      }
      lastInputAtRef.current = performance.now();
      if (e.pointerType === "mouse") pointerOnCanvasRef.current = true;
      // A press is a moment of intent — Meshi pops with you, everywhere.
      cursorScaleRef.current = Math.min(cursorScaleRef.current + 0.3, 1.6);
      ownerScaleRef.current = Math.min(ownerScaleRef.current + 0.3, 1.6);
      if (meshiCursorRef.current) meshiCursorRef.current.style.opacity = "1";
    }
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
    const rect = containerRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (rect.width > 0 && rect.height > 0) {
      if (coarseRef.current) {
        cursorVpRef.current = { vx: 0.5, vy: 0.5 };
      } else {
        cursorVpRef.current = { vx: sx / rect.width, vy: sy / rect.height };
        // Pointer position in WORLD coordinates — where Meshi wanders toward,
        // and what we broadcast so everyone anchors you to the same spot on
        // the actual mesh.
        const cam = cameraRef.current;
        const t = cursorWorldTargetRef.current;
        const wx = (sx - rect.width / 2 - cam.panX) / cam.zoom;
        const wy = (sy - rect.height / 2 - cam.panY) / cam.zoom;
        if (!t.seen) {
          cursorWorldPosRef.current.x = wx;
          cursorWorldPosRef.current.y = wy;
          t.seen = true;
        }
        t.x = wx;
        t.y = wy;
        lastInputAtRef.current = performance.now();
        pointerOnCanvasRef.current = true;
      }
    }
    const cursor = meshiCursorRef.current;
    if (cursor) cursor.style.opacity = "1";
    if (e.pointerType === "mouse") {
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
        // Double-tap / double-click on empty space zooms in on that spot.
        const now = performance.now();
        const prevTap = lastTapRef.current;
        lastTapRef.current = { x: e.clientX, y: e.clientY, t: now };
        if (
          prevTap &&
          now - prevTap.t < 320 &&
          Math.hypot(e.clientX - prevTap.x, e.clientY - prevTap.y) < 32 &&
          !hitTest(e.clientX - rect.left, e.clientY - rect.top)
        ) {
          lastTapRef.current = null;
          const base = zoomTargetRef.current?.zoom ?? cameraRef.current.zoom;
          zoomTargetRef.current = {
            zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, base * 1.55)),
            ax: e.clientX - rect.left - rect.width / 2,
            ay: e.clientY - rect.top - rect.height / 2,
          };
          return;
        }
        const profileRect = profileHitboxesRef.current.get(modelRef.current?.selfId || "");
        if (profileRect) {
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          if (sx >= profileRect.x && sx <= profileRect.x + profileRect.w && sy >= profileRect.y && sy <= profileRect.y + profileRect.h) {
            const selfNode = modelRef.current?.nodes.get(modelRef.current?.selfId ?? "");
            router.push(selfNode?.href || "/profile");
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
            // Broadcast what you're DOING, not just your default face — this
            // is how others see you being alive on the internet.
            meshiMood: composingRef.current ? "thinking" : hoverIdRef.current ? "excited" : prefs.face,
            viewportPosition: coarseRef.current ? { vx: 0.5, vy: 0.5 } : vp,
            position: {
              x: coarseRef.current ? -cameraRef.current.panX / cameraRef.current.zoom : cursorWorldTargetRef.current.x,
              y: coarseRef.current ? -cameraRef.current.panY / cameraRef.current.zoom : cursorWorldTargetRef.current.y,
            },
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
        // Everyone online: people viewing THIS mesh drift as live cursors;
        // connections online elsewhere perch on their own node in the web.
        const visible = list.filter((p) => p.isOnline);
        const visibleIds = new Set(visible.map((p) => p.userId));
        for (const p of visible) {
          // Only presence FROM the mesh surface drives a live cursor — the
          // app-wide heartbeat (MeChat, Flow, anywhere) keeps people online
          // but shouldn't paint a phantom cursor in the room.
          if (p.userId === meshOwner && p.surface !== "mesh") {
            // Owner active elsewhere on mesh.me: their awake Meshi covers it.
            presenceModeRef.current.delete(p.userId);
            presenceTargetsRef.current.delete(p.userId);
            presenceWorldRef.current.delete(p.userId);
            continue;
          }
          if (p.viewingMesh === meshOwner && p.surface === "mesh") {
            presenceModeRef.current.set(p.userId, "room");
            // World coordinates anchor their Meshi to the actual mesh, so it
            // stays put on the web while you pan. Viewport fractions remain a
            // fallback for stale clients that haven't sent a position yet.
            if (p.position && (p.position.x !== 0 || p.position.y !== 0)) {
              presenceWorldRef.current.set(p.userId, { x: p.position.x, y: p.position.y });
              presenceTargetsRef.current.delete(p.userId);
            } else {
              presenceWorldRef.current.delete(p.userId);
              presenceTargetsRef.current.set(p.userId, {
                vx: Math.min(0.97, Math.max(0.03, p.viewportPosition?.vx ?? 0.5)),
                vy: Math.min(0.95, Math.max(0.05, p.viewportPosition?.vy ?? 0.5)),
              });
            }
          } else {
            presenceModeRef.current.set(p.userId, "perch");
            presenceTargetsRef.current.delete(p.userId);
            presenceWorldRef.current.delete(p.userId);
          }
        }
        presenceTargetsRef.current.forEach((_, id) => {
          if (!visibleIds.has(id)) {
            presenceTargetsRef.current.delete(id);
            presencePosRef.current.delete(id);
          }
        });
        presenceModeRef.current.forEach((_, id) => {
          if (!visibleIds.has(id)) {
            presenceModeRef.current.delete(id);
            perchPosRef.current.delete(id);
            presenceWorldRef.current.delete(id);
            presenceWorldPosRef.current.delete(id);
          }
        });
        setRemotePresences(visible);
      } catch {
        // Presence is best-effort.
      }
    };

    const hb = setInterval(heartbeat, 5000);
    const pl = setInterval(poll, 5000);
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

  // Glide every Meshi ON the mesh each frame: positions live in world
  // coordinates so they pan/zoom with the web, and a screen-space pass keeps
  // them from ever sitting on top of a node.
  useEffect(() => {
    const MESHI_R = 24;
    // Deterministic per-frame push away from any node the Meshi would cover.
    // Recomputed from the world position each frame (never written back), so
    // it can't feedback-oscillate.
    const avoidNodes = (sx: number, sy: number): { x: number; y: number } => {
      let x = sx;
      let y = sy;
      for (let pass = 0; pass < 2; pass += 1) {
        let pushed = false;
        hitboxesRef.current.forEach((hb) => {
          const minD = hb.r + MESHI_R;
          const dx = x - hb.x;
          const dy = y - hb.y;
          const d = Math.hypot(dx, dy);
          if (d >= minD || d < 0.001) return;
          const f = (minD - d) / (d || 1);
          x += dx * f;
          y += dy * f;
          pushed = true;
        });
        if (!pushed) break;
      }
      return { x, y };
    };
    const project = (wx: number, wy: number) => {
      const container = containerRef.current;
      const cam = cameraRef.current;
      const w = container?.clientWidth ?? 0;
      const h = container?.clientHeight ?? 0;
      return { x: w / 2 + cam.panX + wx * cam.zoom, y: h / 2 + cam.panY + wy * cam.zoom };
    };

    let raf = 0;
    let last = 0;
    const step = (time: number) => {
      const dt = last ? Math.min(time - last, 50) : 16;
      last = time;
      // Casual, unhurried easing — Meshis drift toward where their user is
      // looking rather than mirroring a mouse at full speed.
      const k = 1 - Math.exp(-dt / 650);
      presenceElsRef.current.forEach((el, userId) => {
        // Connections online elsewhere perch above their own node in the web,
        // tracking it as the mesh pans and drifts.
        if (presenceModeRef.current.get(userId) === "perch") {
          const hb = hitboxesRef.current.get(`person:${userId}`);
          if (!hb) {
            el.style.opacity = "0";
            return;
          }
          const tx = hb.x;
          const ty = hb.y - hb.r - 24;
          const pos = perchPosRef.current.get(userId) ?? { x: tx, y: ty };
          pos.x += (tx - pos.x) * k;
          pos.y += (ty - pos.y) * k;
          perchPosRef.current.set(userId, pos);
          el.style.opacity = "1";
          el.style.left = `${pos.x}px`;
          el.style.top = `${pos.y}px`;
          return;
        }
        // Same-mesh visitors, anchored to the mesh itself when they've
        // broadcast a world position.
        const world = presenceWorldRef.current.get(userId);
        if (world) {
          const pos = presenceWorldPosRef.current.get(userId) ?? { ...world };
          pos.x += (world.x - pos.x) * k;
          pos.y += (world.y - pos.y) * k;
          presenceWorldPosRef.current.set(userId, pos);
          const s = project(pos.x, pos.y);
          const clear = avoidNodes(s.x, s.y);
          el.style.opacity = "1";
          el.style.left = `${clear.x}px`;
          el.style.top = `${clear.y}px`;
          return;
        }
        const target = presenceTargetsRef.current.get(userId);
        if (!target) return;
        el.style.opacity = "1";
        const pos = presencePosRef.current.get(userId) ?? { ...target };
        pos.vx += (target.vx - pos.vx) * k;
        pos.vy += (target.vy - pos.vy) * k;
        presencePosRef.current.set(userId, pos);
        el.style.left = `${pos.vx * 100}%`;
        el.style.top = `${pos.vy * 100}%`;
      });

      // Your own Meshi ambles across the mesh toward the pointer, swerving
      // around nodes, and leans in (locally only) when you hover something.
      const cursorEl = meshiCursorRef.current;
      if (coarseRef.current) {
        const cam = cameraRef.current;
        const center = cursorWorldTargetRef.current;
        center.x = -cam.panX / cam.zoom;
        center.y = -cam.panY / cam.zoom;
        center.seen = true;
        cursorVpRef.current = { vx: 0.5, vy: 0.5 };
      }
      if (cursorEl && cursorWorldTargetRef.current.seen) {
        // Meshi IS your cursor: while the mouse is on the canvas it mirrors it
        // tightly (a whisper of trailing keeps it alive, never vague). Only
        // remote viewers see the casual drift, via heartbeat interpolation.
        const ck = 1 - Math.exp(-dt / 90);
        const p = cursorWorldPosRef.current;
        const t = cursorWorldTargetRef.current;
        p.x += (t.x - p.x) * ck;
        p.y += (t.y - p.y) * ck;
        const s = project(p.x, p.y);
        const clear = coarseRef.current ? s : avoidNodes(s.x, s.y);
        const targetScale = hoverIdRef.current ? 1.28 : 1;
        cursorScaleRef.current += (targetScale - cursorScaleRef.current) * (1 - Math.exp(-dt / 140));
        // Lean into the direction of travel — pure body language, local-only.
        const prev = cursorPrevRef.current;
        const vpf = prev ? (clear.x - prev.x) / Math.max(dt, 1) : 0;
        cursorPrevRef.current = { x: clear.x, y: clear.y };
        const leanTarget = Math.max(-16, Math.min(16, vpf * 24));
        cursorRotRef.current += (leanTarget - cursorRotRef.current) * (1 - Math.exp(-dt / 110));
        cursorEl.style.transform = `translate(${clear.x}px, ${clear.y}px) translate(-50%, -50%) rotate(${cursorRotRef.current.toFixed(2)}deg) scale(${cursorScaleRef.current.toFixed(3)})`;
      }

      // The mesh owner's Meshi. On someone else's mesh it rests at the heart
      // (world origin). On YOUR OWN mesh it follows the cursor, while coarse
      // pointers keep it centered as the world moves underneath.
      const ownerEl = ownerMeshiElRef.current;
      const container = containerRef.current;
      if (ownerEl && container) {
        const isMe = !viewUserId;
        // On your own mesh your Meshi IS your cursor: it mirrors the mouse
        // while it's over the canvas, and only ambles home (casually) once
        // the mouse leaves or you go quiet.
        const pointerLive =
          pointerOnCanvasRef.current || time - lastInputAtRef.current < 4000;
        const active = isMe && cursorWorldTargetRef.current.seen && pointerLive;
        const centered = coarseRef.current && isMe;
        const tx = centered ? cursorWorldTargetRef.current.x : active ? cursorWorldTargetRef.current.x : 0;
        const ty = centered ? cursorWorldTargetRef.current.y : active ? cursorWorldTargetRef.current.y : 0;
        const ok = active && !coarseRef.current ? 1 - Math.exp(-dt / 90) : k;
        const pos = ownerWorldPosRef.current;
        pos.x += (tx - pos.x) * ok;
        pos.y += (ty - pos.y) * ok;
        const s = project(pos.x, pos.y);
        // Avoid nodes while wandering — but its own heart node is home, so
        // it's allowed to settle there. Touch users keep the owner Meshi
        // centered, so it must not be pushed aside by the focused node.
        const selfId = modelRef.current?.selfId;
        let cx = s.x;
        let cy = coarseRef.current ? s.y : s.y - 6;
        if (!coarseRef.current && Math.hypot(pos.x, pos.y) > 30) {
          let px = s.x;
          let py = s.y;
          hitboxesRef.current.forEach((hb, id) => {
            if (id === selfId) return;
            const minD = hb.r + 24;
            const dx = px - hb.x;
            const dy = py - hb.y;
            const d = Math.hypot(dx, dy);
            if (d >= minD || d < 0.001) return;
            const f = (minD - d) / (d || 1);
            px += dx * f;
            py += dy * f;
          });
          cx = px;
          cy = coarseRef.current ? py : py - 6;
        }
        ownerEl.style.left = `${cx}px`;
        ownerEl.style.top = `${cy}px`;
        // Local body language for YOUR OWN Meshi: grow toward hovered nodes,
        // pop on click, lean into travel. Visitors' views are untouched.
        if (isMe) {
          const growTarget = hoverIdRef.current ? 1.28 : 1;
          ownerScaleRef.current += (growTarget - ownerScaleRef.current) * (1 - Math.exp(-dt / 140));
          const prevO = ownerPrevRef.current;
          const vpfO = prevO ? (cx - prevO.x) / Math.max(dt, 1) : 0;
          ownerPrevRef.current = { x: cx, y: cy };
          const leanTargetO = Math.max(-16, Math.min(16, vpfO * 24));
          ownerRotRef.current += (leanTargetO - ownerRotRef.current) * (1 - Math.exp(-dt / 110));
          ownerEl.style.transform = `translate(-50%, -50%) rotate(${ownerRotRef.current.toFixed(2)}deg) scale(${ownerScaleRef.current.toFixed(3)})`;
        }
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [viewUserId]);

  // Keyboard shortcuts: / search, +/- zoom, 0 fit, Escape closes overlays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.key === "Escape") {
        setShowSearch(false);
        setShowCompose(false);
        setSelectedNode(null);
        setShowTips(false);
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
      data-testid="mesh-scene"
      className={`relative h-full min-h-0 w-full min-w-0 flex-1 touch-none overflow-hidden bg-[#04050c] select-none ${!isCoarsePointer ? "cursor-none" : ""}`}
      onWheel={onWheel}
    >
      <canvas
        ref={canvasRef}
        data-testid="mesh-canvas"
        role="img"
        aria-label="Your mesh constellation"
        className="block h-full w-full"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={(e) => {
          // A lifted finger fires pointerleave too — only a mouse leaving the
          // canvas should hide Meshi; on touch it stays where you left it.
          if (e.pointerType !== "mouse") return;
          pointerOnCanvasRef.current = false;
          hoverIdRef.current = null;
          setHoverNode(null);
          if (meshiCursorRef.current) meshiCursorRef.current.style.opacity = "0";
        }}
      />

      {/* Meshi — you, wandering the mesh. On desktop it ambles after your
          pointer; on touch it stays centered while the world moves beneath it.
          Shown when visiting another mesh (on your own mesh the owner Meshi
          at the heart is you, and it does the wandering instead). */}
      {showCursorMeshi && (
        <div
          ref={meshiCursorRef}
          className="pointer-events-none absolute left-0 top-0 z-20 opacity-0 transition-opacity duration-150"
        >
          <MeshiMascot
            size={44}
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
            <div
              className="absolute left-1/2 top-full mt-1.5 w-max max-w-[16.5rem] -translate-x-1/2 animate-[fadeIn_.14s_ease] overflow-hidden rounded-xl border border-white/12 bg-[#0a0f1f]/90 text-center shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl"
              style={{ boxShadow: `0 12px 40px rgba(0,0,0,0.55), inset 0 2px 0 ${hoverNode.color || "var(--mesh-blue)"}` }}
            >
              <div className="px-3 py-2">
                <p className="truncate text-[11.5px] font-semibold text-white">{hoverNode.label}</p>
                {hoverNode.sublabel && <p className="truncate text-[10px] text-white/55">{hoverNode.sublabel}</p>}
                {hoverNode.content && hoverNode.content !== hoverNode.label && (
                  <p className="mt-1 line-clamp-2 text-left text-[10px] leading-snug text-white/75">{hoverNode.content}</p>
                )}
                {(() => {
                  // Video posts play right in the hover card — a peek at the
                  // actual content, not just its thumbnail.
                  const embed = getVideoEmbedUrl(hoverNode.href, { autoplay: true, muted: true });
                  if (embed) {
                    return (
                      <iframe
                        src={embed}
                        title="Preview"
                        allow="autoplay; encrypted-media"
                        className="mt-1.5 aspect-video w-56 rounded-lg border-0"
                      />
                    );
                  }
                  return hoverNode.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={hoverNode.imageUrl} alt="" className="mt-1.5 h-20 w-full rounded-lg object-cover" />
                  ) : null;
                })()}
                {hoverNode.meta && hoverNode.meta.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap justify-center gap-x-2.5 gap-y-0.5">
                    {hoverNode.meta.map((m) => (
                      <span key={m.label} className="text-[10px] text-white/55">
                        <span className="font-semibold text-white/90">{m.value}</span> {m.label.toLowerCase()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p className="border-t border-white/8 bg-white/[0.04] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
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

      {/* The mesh owner's Meshi at the heart of their mesh. Awake and adrift
          when they're online; curled up asleep with a soft "Zzz" when they're
          offline, so a visited mesh always shows whether its owner is around. */}
      {meshData?.meshiPreference && (() => {
        const m = meshData.meshiPreference;
        // The URL may address this mesh by username; presence always speaks in
        // ids, so compare against the resolved owner id from the payload.
        const ownerId = meshData?.user.id ?? viewUserId;
        const ownerOnline = !viewUserId || remotePresences.some((p) => p.userId === ownerId);
        return (
          <div
            ref={ownerMeshiElRef}
            className="pointer-events-none absolute left-1/2 top-1/2 z-[6] -translate-x-1/2 -translate-y-1/2"
            aria-hidden="true"
          >
            <div className={ownerOnline ? "mesh-owner-meshi is-online" : "mesh-owner-meshi is-asleep"}>
              {!ownerOnline && <span className="mesh-owner-zzz">z</span>}
              <MeshiMascot
                size={44}
                color={(m.colorTheme || "blue") as MeshiColor}
                hat={(m.hatStyle || "none") as MeshiHat}
                hair={(m.hairStyle || "none") as MeshiHair}
                accessory={(m.accessoryStyle || "none") as MeshiAccessory}
                eyeStyle={(m.eyeStyle || "regular") as MeshiEyeStyle}
                badge={(m.badgeStyle || "none") as MeshiBadge}
                outfit={(m.outfitStyle || "none") as MeshiOutfit}
                mood={
                  !ownerOnline
                    ? "sleepy"
                    : !viewUserId && showCompose
                      ? "thinking"
                      : !viewUserId && hoverNode
                        ? "excited"
                        : ((m.faceStyle || "happy") as MeshiMood)
                }
                animate={ownerOnline}
                showGlow={ownerOnline}
              />
            </div>
          </div>
        );
      })()}

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
            // Perched connections are positioned per-frame from their node;
            // start invisible so they never flash in at the viewport centre.
            if (presenceModeRef.current.get(p.userId) === "perch") {
              const pos = perchPosRef.current.get(p.userId);
              return pos
                ? { left: `${pos.x}px`, top: `${pos.y}px` }
                : { left: "50%", top: "50%", opacity: 0 };
            }
            const pos =
              presencePosRef.current.get(p.userId) ??
              presenceTargetsRef.current.get(p.userId) ?? {
                vx: Math.min(0.97, Math.max(0.03, p.viewportPosition?.vx ?? 0.5)),
                vy: Math.min(0.95, Math.max(0.05, p.viewportPosition?.vy ?? 0.5)),
              };
            // Keep other visitors in the open canvas, never tucked behind the
            // right-hand desktop chrome panel where they read as clipped clutter.
            const maxVx = showDesktopChrome ? 0.68 : 0.95;
            return { left: `${Math.min(pos.vx, maxVx) * 100}%`, top: `${pos.vy * 100}%` };
          })()}
        >
          <MeshiMini
            size={44}
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
        data-testid="mesh-action-bar"
        role="toolbar"
        aria-label="Mesh actions"
        className={`absolute right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2 ${
          showDesktopChrome ? "lg:right-[min(23rem,calc(100vw_-_4rem))]" : ""
        }`}
      >
        {!viewedUser && meshUser && (
          <RailButton label="Create on your mesh" onClick={() => setShowCompose(true)}>
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
        <RailButton label="Recenter" onClick={fitToContent}>
          <LocateFixed size={16} />
        </RailButton>
        <RailButton label="How to explore" onClick={() => setShowTips(true)}>
          <HelpCircle size={16} />
        </RailButton>
      </div>

      {showDesktopChrome && meshData ? (
        <MeshDesktopChrome
          platforms={meshData.platforms}
          recentComments={meshData.recentComments}
        />
      ) : null}

      {/* Loading / states */}
      {status === "loading" && (
        <div className="absolute inset-0 z-40 bg-[#04050c]">
          <MeshiLoader
            title={viewUserId ? "Opening their mesh" : "Weaving your mesh"}
            subtitle="Meshi is arranging your world into view."
            mode="mesh-building"
          />
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
      {status === "private" && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[#04050c] px-6 text-center">
          {meshData?.user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={meshData.user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-white/15" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-xl font-bold text-white">
              {(meshData?.user.displayName || meshData?.user.username || "?").slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <p className="text-base font-semibold text-white">
              {meshData?.user.displayName || `@${meshData?.user.username}`}&apos;s mesh is private
            </p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-white/55">
              Follow each other and their world opens up to you.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/profile/${meshData?.user.username}`}
              className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black transition hover:bg-white/90"
            >
              View profile
            </Link>
            <Link
              href="/mesh"
              className="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              Back to my mesh
            </Link>
          </div>
        </div>
      )}
      {status === "ready" && meshIsEmpty && !showCompose && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-30 flex justify-center px-6">
          <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-2.5 rounded-2xl border border-white/12 bg-black/55 px-5 py-4 text-center backdrop-blur">
            <p className="text-sm text-white/80">
              {viewedUser
                ? `This mesh is just ${viewedUser.displayName || "@" + viewedUser.username} for now.`
                : "Your mesh is just you for now."}
            </p>
            {!viewedUser && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCompose(true)}
                  className="rounded-full bg-[var(--mesh-blue)] px-4 py-1.5 text-xs font-medium text-white"
                >
                  Create your first post
                </button>
                <Link
                  href="/connected-accounts"
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/85"
                >
                  Connect accounts
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* How to explore — shown on first visit, reopenable from the rail */}
      {showTips && status === "ready" && (
        <div
          className="absolute inset-0 z-50 flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center"
          onPointerDown={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) dismissTips();
          }}
        >
          <div
            className="w-full max-w-sm animate-[slideUp_.24s_ease-out] rounded-2xl border border-white/12 bg-[#0b1020] p-5 shadow-2xl"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Welcome to your mesh</p>
                <p className="text-[11px] text-white/50">Your whole world, woven into one web.</p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={dismissTips}
                className="rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <ul className="space-y-2.5 text-xs leading-relaxed text-white/75">
              <li className="flex gap-2.5">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--mesh-blue)]" />
                <span>{isCoarsePointer ? "Drag to pan and pinch to zoom around your web." : "Drag to pan and scroll to zoom around your web."}</span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--mesh-blue)]" />
                <span>{isCoarsePointer ? "Tap any node to open it — posts, people, platforms." : "Click any node to open it — posts, people, platforms."}</span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--mesh-blue)]" />
                <span>{isCoarsePointer ? "Double-tap empty space to zoom in on that spot." : "Double-click empty space to zoom in on that spot."}</span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--mesh-blue)]" />
                <span>Friends glow on the web — open one to step into their mesh.</span>
              </li>
              {!isCoarsePointer && (
                <li className="flex gap-2.5">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--mesh-blue)]" />
                  <span>
                    Press <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white">/</kbd> to search,{" "}
                    <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white">0</kbd> to recenter, and{" "}
                    <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white">+</kbd>/
                    <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white">-</kbd> to zoom.
                  </span>
                </li>
              )}
            </ul>
            <button
              type="button"
              onClick={dismissTips}
              className="mt-4 w-full rounded-full bg-[var(--mesh-blue)] py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              Start exploring
            </button>
          </div>
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

      {/* Content lens — consume posts & activity right on the mesh */}
      {selectedNode && (selectedNode.kind === "post" || selectedNode.kind === "activity") && (
        <ContentLens
          key={selectedNode.id}
          node={selectedNode}
          list={contentList()}
          onClose={() => setSelectedNode(null)}
          onNavigate={navigateContent}
        />
      )}

      {/* Detail sheet — people, platforms, communities, interests */}
      {selectedNode &&
        selectedNode.kind !== "self" &&
        selectedNode.kind !== "branch" &&
        selectedNode.kind !== "post" &&
        selectedNode.kind !== "activity" && (
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
            <div className="mb-2 flex items-start justify-between px-1">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-[var(--mesh-blue)]" />
                <div>
                  <p className="text-sm font-semibold text-white">Create on your mesh</p>
                  <p className="text-[11px] text-white/45">Watch it weave itself into your web.</p>
                </div>
              </div>
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
              startExpanded
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
      className="group relative flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-black/45 text-white/85 backdrop-blur transition-colors hover:bg-black/65 hover:text-white"
    >
      {children}
      <span className="pointer-events-none absolute right-full mr-2 hidden w-max rounded-lg border border-white/12 bg-black/80 px-2 py-1 text-[11px] font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 sm:block">
        {label}
      </span>
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

// The native Post id behind a content node, if it's one of our own posts a
// signed-in user can react to (external platform posts return null).
function nativePostId(node: SceneNode): string | null {
  if (node.id.startsWith("post:")) return node.id.slice("post:".length);
  if (node.id.startsWith("friend-post:")) {
    const parts = node.id.split(":");
    return parts[parts.length - 1] || null;
  }
  return null;
}

function metaCount(node: SceneNode, label: string): number {
  const v = node.meta?.find((m) => m.label === label)?.value;
  const n = v ? parseInt(v, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

/**
 * The Content Lens — an immersive reader that opens over the mesh when you tap
 * a post or activity. You read the full content and its media, react to it, and
 * glide to the next piece of content on your mesh without ever leaving the web.
 * This is what turns the mesh from a map into a medium you actually consume.
 */
function ContentLens({
  node,
  list,
  onClose,
  onNavigate,
}: {
  node: SceneNode;
  list: SceneNode[];
  onClose: () => void;
  onNavigate: (dir: 1 | -1) => void;
}) {
  const index = list.findIndex((n) => n.id === node.id);
  const total = list.length;
  const postId = nativePostId(node);
  const isExternal = Boolean(node.href && node.href.startsWith("http"));

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(metaCount(node, "Likes"));
  const [likePending, startLike] = useTransition();

  // Keyboard: arrows browse, Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onNavigate(1);
      else if (e.key === "ArrowLeft") onNavigate(-1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNavigate, onClose]);

  const handleLike = () => {
    if (!postId) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    startLike(async () => {
      const res = await toggleReaction(postId);
      if (res && "error" in res) {
        setLiked(!next);
        setLikeCount((c) => c + (next ? -1 : 1));
      }
    });
  };

  const commentCount = metaCount(node, "Comments");

  return (
    <div
      className="absolute inset-0 z-50 flex items-end justify-center bg-black/65 p-3 backdrop-blur-md sm:items-center"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex w-full max-w-lg animate-[slideUp_.3s_cubic-bezier(0.22,1,0.36,1)] flex-col overflow-hidden rounded-3xl border border-white/12 bg-[#0b1020]/95 shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Media */}
        {node.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={node.imageUrl}
            alt=""
            className="max-h-[46vh] w-full object-cover"
          />
        )}

        <div className="flex flex-col gap-3 p-5">
          {/* Source */}
          <div className="flex items-center gap-3">
            {node.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={node.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : (
              <span
                className="h-9 w-9 shrink-0 rounded-full"
                style={{ background: `radial-gradient(circle at 34% 30%, #ffffff55, ${node.color})` }}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{node.label}</p>
              {node.sublabel && <p className="truncate text-xs text-white/50">{node.sublabel}</p>}
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/6 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white/45">
              <Sparkles size={11} />
              {node.kind === "activity" ? "Activity" : "Post"}
            </span>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          {node.content ? (
            <p className="max-h-[28vh] overflow-y-auto whitespace-pre-wrap text-[15px] leading-relaxed text-white/85">
              {node.content}
            </p>
          ) : (
            <p className="text-sm text-white/45">{node.label}</p>
          )}

          {/* Engagement */}
          <div className="flex items-center gap-2 border-t border-white/8 pt-3">
            <button
              type="button"
              onClick={handleLike}
              disabled={!postId || likePending}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                liked ? "bg-rose-500/15 text-rose-300" : "bg-white/6 text-white/75 hover:bg-white/10"
              } ${!postId ? "cursor-default opacity-70" : ""}`}
            >
              <Heart size={14} fill={liked ? "currentColor" : "none"} />
              {likeCount}
            </button>

            {node.href && !isExternal ? (
              <Link
                href={node.href}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/6 px-3 py-1.5 text-xs font-semibold text-white/75 transition-colors hover:bg-white/10"
              >
                <MessageCircle size={14} />
                {commentCount > 0 ? commentCount : "Comment"}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/6 px-3 py-1.5 text-xs font-semibold text-white/55">
                <MessageCircle size={14} />
                {commentCount}
              </span>
            )}

            {isExternal && node.href && (
              <Link
                href={node.href}
                target="_blank"
                className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/6 px-3 py-1.5 text-xs font-semibold text-white/75 transition-colors hover:bg-white/10"
              >
                <ExternalLink size={13} />
                Open on {node.sublabel || "source"}
              </Link>
            )}
          </div>
        </div>

        {/* Stream controls — browse content across the mesh */}
        {total > 1 && (
          <div className="flex items-center justify-between border-t border-white/8 bg-black/30 px-4 py-2.5">
            <button
              type="button"
              onClick={() => onNavigate(-1)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft size={15} />
              Prev
            </button>
            <span className="text-[11px] font-medium tracking-wide text-white/40">
              {index >= 0 ? index + 1 : 1} / {total} on your mesh
            </span>
            <button
              type="button"
              onClick={() => onNavigate(1)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              Next
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
