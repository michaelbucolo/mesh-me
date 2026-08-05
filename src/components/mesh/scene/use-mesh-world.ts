// useMeshWorld — fetching the mesh payload, building + laying out the scene
// model, the 25s quiet live-weave poll, Rewind's as-of world rebuilds, and
// the viewer-side seen state (branch mark-seen watermarks + per-session
// read marks) behind the wedge counts and the catch-up chip. Extracted
// verbatim from the old mesh-scene.tsx; all imperative state lives on the
// shared MeshRuntime, React state here is only what chrome renders.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { meshApiUrl, takeMeshPrefetch } from "./mesh-prefetch";
import { meshNodeMuteKey } from "@/lib/muted-sources";
import type { MeshApiResponse } from "../core/domain";
import type { ViewerCaps } from "../core/viewer";
import { MIN_ZOOM } from "../core/camera";
import { buildSceneModel, type BranchKey, type SceneModel } from "./scene-model";
import {
  applySeenState,
  loadBranchSeenMarks,
  saveBranchSeenMarks,
  totalUnseen,
  unseenByBranch,
  type BranchSeenMarks,
  type UnseenBranchCount,
} from "./seen-marks";
import { layoutScene, sceneBounds } from "../sim/layout";
import { createPhysicsState } from "../sim/physics";
import type { MeshRuntimeRef } from "./runtime";

// Your previous visit's timestamp — anything made after it is marked "New".
const LAST_VISIT_KEY = "meshLastVisit";

/**
 * Carry animated display state (positions, velocities, birth moments) from
 * the previous model into a rebuilt one so a refresh never re-forms the sky —
 * the ONE shared util behind both the quiet live-weave poll and Rewind's
 * scrubbing (they used to duplicate this loop). Nodes with no predecessor are
 * NEWBORN: they spawn at their maker's current position (or the fallback
 * origin) with a fresh birth moment, and the count of them is returned so the
 * quiet path can announce arrivals.
 */
function carryAnimState(
  prev: SceneModel | null,
  next: SceneModel,
  bornStamp: number,
  newbornOrigin: "layout" | "center",
): number {
  let newborn = 0;
  next.nodes.forEach((node) => {
    const old = prev?.nodes.get(node.id);
    if (old) {
      node.dx = old.dx;
      node.dy = old.dy;
      node.vx = old.vx;
      node.vy = old.vy;
      node.bornAt = old.bornAt;
    } else {
      // New content weaves itself in LIVE: it springs out of whatever made
      // it, playing the arrival celebration on the way.
      const parent = node.parentId ? next.nodes.get(node.parentId) : null;
      node.dx = parent ? parent.dx : newbornOrigin === "layout" ? node.x : 0;
      node.dy = parent ? parent.dy : newbornOrigin === "layout" ? node.y : 0;
      node.bornAt = bornStamp;
      newborn += 1;
    }
  });
  return newborn;
}

/** Mark the viewer's muted source hubs (platform/person) on a fresh model so
 * the detail sheet can show the muted state and offer Unmute. Content of
 * muted sources was already withheld server-side — this is display only. */
function applyMutedHubs(model: SceneModel, mutedKeys: string[] | undefined): void {
  if (!mutedKeys || mutedKeys.length === 0) return;
  const muted = new Set(mutedKeys);
  model.nodes.forEach((node) => {
    if (node.kind !== "platform" && node.kind !== "person") return;
    const key = meshNodeMuteKey(node.id);
    if (key && muted.has(key)) node.muted = true;
  });
}

/**
 * Choreograph the world forming: you ignite first, then your sources spring
 * out of you in a wave sweeping down from the top, then everything they made
 * blooms out of them — each node's birth moment staged for the renderer.
 */
function stageWorldFormation(model: SceneModel): void {
  const stamp = typeof performance !== "undefined" ? performance.now() : Date.now();
  const TAU = Math.PI * 2;
  model.nodes.forEach((n) => {
    if (n.id === model.selfId) return;
    const d = (((n.angle + Math.PI / 2) % TAU) + TAU) % TAU;
    const sweep = Math.min(d, TAU - d) / Math.PI; // 0 at the top arc, 1 at the bottom
    const wiggle = (n.id.charCodeAt(n.id.length - 1) % 7) * 22;
    n.bornAt = stamp + (n.depth <= 1 ? 280 + sweep * 420 : 820 + sweep * 540) + wiggle;
  });
}

type MeshStatus = "loading" | "ready" | "error" | "private";

export interface MeshWorld {
  status: MeshStatus;
  /** The current scene model, mirrored into React state on every rebuild so
   * chrome (list view, lens stream) renders from state, never from the ref. */
  model: SceneModel | null;
  meshData: MeshApiResponse | null;
  meshUser: { displayName: string; avatarUrl: string | null } | null;
  viewedUser: { username: string; displayName: string | null } | null;
  meshIsEmpty: boolean;
  newCount: number;
  /** Unseen content per branch wedge — feeds the wedge-count chips. */
  unseen: UnseenBranchCount[];
  weaveToast: { count: number; key: number } | null;
  oldestMoment: number | null;
  rewindAt: number | null;
  rewindValue: number;
  fitToContent: () => void;
  loadScene: (opts?: { quiet?: boolean; signal?: AbortSignal }) => Promise<void>;
  loadImages: (model: SceneModel) => void;
  onRewindInput: (value: number) => void;
  backToNow: () => void;
  /** Mark-seen pill: clear a whole branch's unseen state (viewer-side only —
   * a local watermark; nothing anyone else can see changes). */
  markBranchSeen: (branch: BranchKey) => void;
  /** Opening content in the lens clears its New mark for this session. */
  markNodeSeen: (nodeId: string) => void;
}

export function useMeshWorld(
  rtRef: MeshRuntimeRef,
  viewer: ViewerCaps,
  opts: {
    viewUserId?: string;
    viewMode: "mesh" | "global";
    /** A fresh (non-quiet) world replaced the old one — clear selection state. */
    onWorldReplaced: () => void;
    /** Rewind removed the currently selected node — clear selection state. */
    onSelectionInvalid: () => void;
  },
): MeshWorld {
  const { viewUserId, viewMode, onWorldReplaced, onSelectionInvalid } = opts;
  const isGlobal = viewer.isGlobal;
  const isOwnMesh = viewer.isOwner;

  const [status, setStatus] = useState<MeshStatus>("loading");
  const [model, setModel] = useState<SceneModel | null>(null);
  const [meshIsEmpty, setMeshIsEmpty] = useState(false);
  const [meshUser, setMeshUser] = useState<{ displayName: string; avatarUrl: string | null } | null>(null);
  const [meshData, setMeshData] = useState<MeshApiResponse | null>(null);
  const [viewedUser, setViewedUser] = useState<{ username: string; displayName: string | null } | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [unseen, setUnseen] = useState<UnseenBranchCount[]>([]);
  // Viewer-side seen refinements: per-branch mark-seen watermarks (persisted
  // locally) and the ids read this session — reapplied on every rebuild so
  // the 25s quiet poll can't resurrect a cleared New mark.
  const branchSeenRef = useRef<BranchSeenMarks | null>(null);
  const sessionSeenRef = useRef<Set<string>>(new Set());
  const branchSeenMarks = useCallback((): BranchSeenMarks => {
    if (branchSeenRef.current === null) branchSeenRef.current = loadBranchSeenMarks();
    return branchSeenRef.current;
  }, []);
  const refreshSeenCounts = useCallback(
    (model: SceneModel) => {
      setNewCount(totalUnseen(model));
      setUnseen(unseenByBranch(model));
    },
    [],
  );
  // Live weave toast: shown when polling brings something new into the world.
  const [weaveToast, setWeaveToast] = useState<{ count: number; key: number } | null>(null);
  useEffect(() => {
    if (!weaveToast) return;
    const t = setTimeout(() => setWeaveToast(null), 4200);
    return () => clearTimeout(t);
  }, [weaveToast]);
  // Rewind: rewindAt is the moment being viewed (null = now); rewindValue is
  // the slider position (0..1000).
  const [rewindAt, setRewindAt] = useState<number | null>(null);
  const [rewindValue, setRewindValue] = useState(1000);
  useEffect(() => {
    rtRef.current.rewindAt = rewindAt;
  }, [rtRef, rewindAt]);

  const loadImages = useCallback(
    (model: SceneModel) => {
      const rt = rtRef.current;
      model.nodes.forEach((node) => {
        const src = node.avatarUrl || node.imageUrl;
        if (!src) return;
        // Next engine: URL-keyed LRU with a real memory ceiling (and a changed
        // URL for the same node actually reloads). The id→image map stays the
        // single source painters AND hitmap read, so a card's drawn height and
        // its tap target always agree.
        const engine = rt.paintEngine;
        if (engine) {
          const ready = engine.images.request(src, node.id, (img) => {
            rt.images.set(node.id, img);
          });
          if (ready) rt.images.set(node.id, ready);
          return;
        }
        if (rt.images.has(node.id)) return;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => rt.images.set(node.id, img);
        img.src = src;
      });
    },
    [rtRef],
  );

  const fitToContent = useCallback(() => {
    const rt = rtRef.current;
    const model = rt.model;
    const { width, height } = rt.size;
    if (!model || !width || !height) return;
    const b = sceneBounds(model);
    const contentW = Math.max(b.maxX - b.minX, 400) + 220;
    const contentH = Math.max(b.maxY - b.minY, 400) + 220;
    const isNarrowViewport = width < 640;
    const zoom = isNarrowViewport
      ? Math.max(MIN_ZOOM, 0.72)
      : Math.max(MIN_ZOOM, Math.min(1, Math.min(width / contentW, (height - 130) / contentH)));
    const midX = isNarrowViewport ? 0 : (b.minX + b.maxX) / 2;
    const midY = isNarrowViewport ? 0 : (b.minY + b.maxY) / 2;
    // Nudge the world down so the top arc never hides under the top bar.
    rt.camera = { zoom, panX: -midX * zoom, panY: -midY * zoom + 30 };
  }, [rtRef]);

  const loadScene = useCallback(
    async (loadOpts?: { quiet?: boolean; signal?: AbortSignal }) => {
      const rt = rtRef.current;
      const url = meshApiUrl(viewUserId, viewMode);
      if (!loadOpts?.quiet) {
        setStatus("loading");
        setMeshData(null);
      }
      try {
        // First load rides the request the loader shell started while this
        // chunk was still downloading; refreshes fetch normally.
        const prefetched = loadOpts?.quiet ? undefined : takeMeshPrefetch(url);
        const res = prefetched
          ? await prefetched
          : await fetch(url, { cache: "no-store", signal: loadOpts?.signal });
        if (loadOpts?.signal?.aborted) return;
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
        {
          const cosmetics = payload.meshCosmetics || [];
          const pick = (type: string) =>
            cosmetics.find((c) => c.type === type && c.isActive !== false)?.value ?? null;
          rt.proVisuals = {
            connectionColor: pick("connectionColor"),
            nodeStyle: pick("nodeStyle"),
            motionStyle: pick("motionStyle"),
            atmosphere: pick("atmosphere"),
          };
        }
        if (rt.lastVisit === undefined) {
          try {
            const raw = localStorage.getItem(LAST_VISIT_KEY);
            rt.lastVisit = raw ? Number(raw) || null : null;
          } catch {
            rt.lastVisit = null;
          }
        }
        const model = buildSceneModel(payload, {
          lastVisitAt: isOwnMesh ? rt.lastVisit ?? null : null,
        });
        layoutScene(model);
        if (isOwnMesh) {
          // Viewer-side seen refinements: branch mark-seen watermarks + this
          // session's read items survive every rebuild.
          applySeenState(model, branchSeenMarks(), sessionSeenRef.current);
          try {
            localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
          } catch {
            // Storage may be unavailable — New marks just won't persist.
          }
        }
        applyMutedHubs(model, payload.viewerMutedSources);
        const quiet = Boolean(loadOpts?.quiet && rt.model);
        if (quiet) {
          // Carry over animated positions so a refresh doesn't re-form the sky
          // (shared carryAnimState — same util Rewind scrubbing rides).
          const bornStamp = typeof performance !== "undefined" ? performance.now() : Date.now();
          const newborn = carryAnimState(rt.model, model, bornStamp, "layout");
          if (newborn > 0) setWeaveToast({ count: newborn, key: Date.now() });
        } else {
          rt.physics = createPhysicsState();
          stageWorldFormation(model);
        }
        rt.model = model;
        setModel(model);
        loadImages(model);
        // Never seed the presence room id with the synthetic "global" hub — the
        // heartbeat keys off this field's truthiness, so leaving it null in
        // Global is defense-in-depth on top of the presence effect being disabled.
        rt.meshOwnerId = isGlobal ? null : payload.user.id;
        setViewedUser(
          viewUserId ? { username: payload.user.username, displayName: payload.user.displayName } : null,
        );
        if (isOwnMesh) {
          setMeshUser({ displayName: payload.user.displayName || payload.user.username, avatarUrl: payload.user.avatarUrl });
        }
        if (!quiet) {
          onWorldReplaced();
          fitToContent();
          // Re-seed the self/cursor Meshi at the freshly-fitted camera centre so
          // it's visible the instant you arrive at (or travel to) a mesh — the
          // step loop's one-shot seed re-runs next frame and fades it in.
          rt.cursorWorldTarget.seen = false;
          // Arrive INTO the world: the camera starts pushed in and eases out
          // while the mesh forms around you.
          rt.zoomTarget = { zoom: rt.camera.zoom, ax: 0, ay: 0 };
          rt.camera = { ...rt.camera, zoom: rt.camera.zoom * 1.5 };
        }
        // An empty mesh is still the mesh: render the canvas (you + your
        // Meshi) and let compose/search work — just surface a gentle hint.
        setMeshIsEmpty(model.nodes.size <= 1);
        refreshSeenCounts(model);
        setStatus("ready");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!loadOpts?.quiet) setStatus("error");
        if (!loadOpts?.quiet) setMeshData(null);
      }
    },
    [rtRef, viewUserId, viewMode, isGlobal, isOwnMesh, loadImages, fitToContent, onWorldReplaced, branchSeenMarks, refreshSeenCounts],
  );

  useEffect(() => {
    rtRef.current.images = new Map();
    const controller = new AbortController();
    void loadScene({ signal: controller.signal });
    return () => controller.abort();
  }, [rtRef, loadScene]);

  // The mesh is ALIVE: poll quietly so new content weaves itself in while
  // you watch. Paused while the tab is hidden and while rewinding — the past
  // doesn't change.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (rtRef.current.rewindAt != null) return;
      void loadScene({ quiet: true });
    }, 25000);
    return () => clearInterval(id);
  }, [rtRef, loadScene]);

  // --- Rewind: rebuild the world as it existed at a past moment ---
  // The oldest dated thing in this world bounds how far back you can travel.
  const oldestMoment = (() => {
    if (!meshData) return null;
    let oldest = Infinity;
    const see = (v: unknown) => {
      if (!v) return;
      const ms = new Date(v as string).getTime();
      if (Number.isFinite(ms)) oldest = Math.min(oldest, ms);
    };
    /* eslint-disable @typescript-eslint/no-explicit-any */
    (meshData.posts || []).forEach((p: any) => see(p.createdAt));
    (meshData.following || []).forEach((f: any) => see(f.joinedAt));
    (meshData.followers || []).forEach((f: any) => see(f.joinedAt));
    (meshData.connectedAccounts || []).forEach((a: any) => {
      see(a.createdAt);
      (a.topPosts || []).forEach((pp: any) => see(pp.publishedAt));
    });
    (meshData.friendMeshes || []).forEach((fm) => (fm.posts || []).forEach((p: any) => see(p.createdAt)));
    /* eslint-enable @typescript-eslint/no-explicit-any */
    return Number.isFinite(oldest) ? oldest : null;
  })();

  const applyAsOf = useCallback(
    (asOf: number | null) => {
      if (!meshData) return;
      const rt = rtRef.current;
      const model = buildSceneModel(meshData, {
        // New marks only make sense in the present.
        lastVisitAt: asOf != null || !isOwnMesh ? null : rt.lastVisit ?? null,
        asOf,
      });
      layoutScene(model);
      if (isOwnMesh && asOf == null) {
        applySeenState(model, branchSeenMarks(), sessionSeenRef.current);
      }
      applyMutedHubs(model, meshData.viewerMutedSources);
      // Scrubbing forward: things come into existence out of whoever made
      // them, with the arrival burst — your life re-assembling. (Shared
      // carryAnimState — same util the quiet live-weave refresh rides.)
      const stamp = typeof performance !== "undefined" ? performance.now() : Date.now();
      carryAnimState(rt.model, model, stamp, "center");
      rt.model = model;
      setModel(model);
      loadImages(model);
      refreshSeenCounts(model);
      // Whatever was selected may not exist at this moment in time.
      if (rt.selectedId && !model.nodes.get(rt.selectedId)) {
        onSelectionInvalid();
      }
    },
    [rtRef, meshData, isOwnMesh, loadImages, onSelectionInvalid, branchSeenMarks, refreshSeenCounts],
  );

  const rewindDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRewindInput = useCallback(
    (value: number) => {
      setRewindValue(value);
      if (rewindDebounceRef.current) clearTimeout(rewindDebounceRef.current);
      rewindDebounceRef.current = setTimeout(() => {
        if (!oldestMoment) return;
        if (value >= 1000) {
          setRewindAt(null);
          applyAsOf(null);
          return;
        }
        const span = Date.now() - oldestMoment;
        // Quadratic mapping gives fine control over the recent past while the
        // far end still reaches the very beginning.
        const asOf = Math.round(Date.now() - Math.pow(1 - value / 1000, 2) * span);
        setRewindAt(asOf);
        applyAsOf(asOf);
      }, 40);
    },
    [oldestMoment, applyAsOf],
  );

  const backToNow = useCallback(() => {
    if (rewindDebounceRef.current) clearTimeout(rewindDebounceRef.current);
    setRewindValue(1000);
    setRewindAt(null);
    applyAsOf(null);
  }, [applyAsOf]);

  // --- Viewer-side seen management (wedge mark-seen pill + lens reads) ---
  // Both mutate only presentation flags on this viewer's model + a local
  // watermark. Nothing here writes anywhere another user could observe.
  const markBranchSeen = useCallback(
    (branch: BranchKey) => {
      const marks = branchSeenMarks();
      marks[branch] = Date.now();
      saveBranchSeenMarks(marks);
      const model = rtRef.current.model;
      if (!model) return;
      model.nodes.forEach((node) => {
        if (node.branch === branch && node.isNew) {
          node.isNew = false;
          sessionSeenRef.current.add(node.id);
        }
      });
      refreshSeenCounts(model);
    },
    [rtRef, branchSeenMarks, refreshSeenCounts],
  );

  const markNodeSeen = useCallback(
    (nodeId: string) => {
      const model = rtRef.current.model;
      const node = model?.nodes.get(nodeId);
      if (!model || !node?.isNew) return;
      node.isNew = false;
      sessionSeenRef.current.add(nodeId);
      refreshSeenCounts(model);
    },
    [rtRef, refreshSeenCounts],
  );

  return {
    status,
    model,
    meshData,
    meshUser,
    viewedUser,
    meshIsEmpty,
    newCount,
    unseen,
    weaveToast,
    oldestMoment,
    rewindAt,
    rewindValue,
    fitToContent,
    loadScene,
    loadImages,
    onRewindInput,
    backToNow,
    markBranchSeen,
    markNodeSeen,
  };
}
