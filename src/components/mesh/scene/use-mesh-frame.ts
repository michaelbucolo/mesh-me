// useMeshFrame — the canvas, the paint engine (with its PR3 kill-switch),
// the quality governor, and the scheduler's sim + paint phases. Extracted
// verbatim from the old mesh-scene.tsx. The ONE rAF's ordering contract:
// sim (physics + camera motion) → paint (hitmap rebuild, canvas draw,
// governor) → domSync (registered by live/use-meshi-dom-sync).

"use client";

import { useEffect, useRef } from "react";
import { createMeshScheduler, type MeshScheduler } from "../core/scheduler";
import { createQualityGovernor, probeStartTier, type QualityGovernor } from "../core/motion";
import { createPaintEngine, resolveMeshEngine, type MeshEngineKind } from "../paint";
import { drawScene } from "./scene-render";
import { rebuildHitmap } from "../sim/hitmap";
import { driftScaleFor, stepScenePhysics } from "../sim/physics";
import type { MeshRuntimeRef } from "./runtime";

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

export function useMeshFrame(
  rtRef: MeshRuntimeRef,
  opts: {
    viewUserId?: string;
    viewMode: "mesh" | "global";
    isOwnMesh: boolean;
    fitToContent: () => void;
  },
): void {
  const { viewUserId, viewMode, isOwnMesh, fitToContent } = opts;

  // Adaptive rendering budget so the mesh stays smooth on older/slower devices
  // (LEGACY engine only — the next engine rides the two-way governor).
  // `frameCost` is a smoothed inter-frame time in ms; `slow` counts consecutive
  // slow frames; `frames` is a warm-up guard against startup jank.
  const perfRef = useRef({ tier: 0, frameCost: 16, slow: 0, frames: 0 });
  // PR3 kill-switch: which paint core this mount renders through, resolved
  // ONCE (localStorage `mesh_engine`, then ?mesh_engine=, then "next").
  const engineKindRef = useRef<MeshEngineKind | null>(null);
  if (engineKindRef.current === null) engineKindRef.current = resolveMeshEngine();
  // Two-way quality governor (next engine only): startup device probe picks
  // the tier — and pins its floor — then the frame-budget monitor demotes on
  // sustained slowness and promotes back on sustained headroom. The legacy
  // engine keeps its original one-way watchdog (perfRef) untouched.
  const governorRef = useRef<QualityGovernor | null>(null);
  // THE one rAF: every per-frame system (physics + camera, hitmap + paint,
  // Meshi/hearts DOM sync) rides this scheduler's fixed phases — nothing in
  // the mesh may run its own loop. The deepest perf tier's ~30fps cap is
  // handed to the scheduler so frame skipping happens once, for everything.
  const schedulerRef = useRef<MeshScheduler | null>(null);

  // --- Canvas sizing + the scene's sim/paint phases on the one scheduler ---
  useEffect(() => {
    const rt = rtRef.current;
    // Created once per mount, on the first effect run (never during render):
    // the scheduler + (next engine only) the two-way governor.
    if (schedulerRef.current === null) {
      schedulerRef.current = createMeshScheduler({
        frameCapMs: () =>
          engineKindRef.current === "next"
            ? governorRef.current?.params().frameCapMs ?? 0
            : perfRef.current.tier >= 2
              ? 31
              : 0,
      });
    }
    if (governorRef.current === null && engineKindRef.current === "next") {
      governorRef.current = createQualityGovernor({
        startTier: probeStartTier(),
        getStats: () => schedulerRef.current?.getStats() ?? null,
      });
    }
    // Hand the one scheduler to the runtime so live/use-meshi-dom-sync (whose
    // effect runs after this one) can register the domSync phase on it.
    rt.scheduler = schedulerRef.current;
    const canvas = rt.canvasEl;
    const container = rt.containerEl;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const perf = perfRef.current;
    const engineKind = engineKindRef.current ?? "next";
    if (engineKind === "legacy") {
      // Legacy watchdog's probe: genuinely weak devices (very few cores /
      // little memory) start already degraded. (The next engine's richer
      // probe lives in core/motion.ts and seeded the governor at mount.)
      const cores = navigator.hardwareConcurrency || 8;
      const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
      if (cores <= 2 || mem <= 2) perf.tier = 2;
    }
    // Device-pixel-ratio ceiling per tier: full detail, then progressively fewer
    // pixels to fill (the biggest lever for fill-rate-bound canvas rendering).
    const dprForTier = (tier: number) =>
      Math.min(window.devicePixelRatio || 1, tier >= 2 ? 1.3 : tier >= 1 ? 1.5 : 2);
    const dprNow = () =>
      engineKind === "next" && governorRef.current
        ? Math.min(window.devicePixelRatio || 1, governorRef.current.params().dprCap)
        : dprForTier(perf.tier);
    let dpr = dprNow();

    // PR3: the layered paint engine (kill-switch "next"). Its caches are
    // per-mount state — created here, disposed on cleanup, never shared.
    if (engineKind === "next" && rt.paintEngine === null) {
      rt.paintEngine = createPaintEngine({
        // Image LRU eviction drops the same ids from the id→image map that
        // hitmap + painters read, so paint and hit stay in lockstep.
        onImagesEvicted: (ids) => {
          for (const id of ids) rt.images.delete(id);
        },
      });
    }
    rt.paintEngine?.setDpr(dpr);
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[mesh] paint engine: ${engineKind}` +
          (engineKind === "next" && governorRef.current
            ? ` (probe tier T${governorRef.current.tier()})`
            : ""),
      );
    }

    const resize = () => {
      const rect = container.getBoundingClientRect();
      rt.size = { width: rect.width, height: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      rt.stars = generateStars(rect.width, rect.height);
      if (rt.model && rt.camera.panX === 0 && rt.camera.panY === 0) fitToContent();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Governor tier changes (either direction) re-derive the DPR ceiling and
    // re-rasterize at the new density; the scheduler reads the tier's frame
    // cap live, so a T2 30fps cap applies without re-wiring anything.
    const unsubscribeTier =
      governorRef.current?.onTierChange((tier) => {
        dpr = dprNow();
        rt.paintEngine?.setDpr(dpr);
        resize();
        if (process.env.NODE_ENV !== "production") {
          console.info(`[mesh] quality tier → T${tier}`);
        }
      }) ?? null;

    // The one scheduler owns the rAF, the frame cap (deepest tier ~30fps),
    // and the single clamped dt every phase shares — a tab-refocus gap can't
    // blow up the physics step or the perf watchdog's average.
    const scheduler = schedulerRef.current;

    // sim: physics + camera motion. World state settles before anything is
    // derived from it (hitmap) or drawn (paint).
    scheduler?.setPhase("sim", ({ dt }) => {
      const { width, height } = rt.size;
      const model = rt.model;
      if (!model || !width || !height) return;
      // Physics: node springs toward the closeness/time layout, drifting at
      // the owner's chosen motion style. Every Meshi in the room — yours
      // included — disturbs nearby strands as it passes, so the web reacts
      // to the people moving through it.
      const disturbances: { x: number; y: number }[] = [];
      if (rt.cursorWorldTarget.seen) disturbances.push({ x: rt.cursorWorldPos.x, y: rt.cursorWorldPos.y });
      if (isOwnMesh) disturbances.push({ x: rt.ownerWorldPos.x, y: rt.ownerWorldPos.y });
      rt.presence.worldPos.forEach((p) => disturbances.push({ x: p.x, y: p.y }));
      rt.presence.perchWorldPos.forEach((p) => disturbances.push({ x: p.x, y: p.y }));
      // Drift phase is driven by the shared wall clock (Date.now()), NOT the
      // per-client rAF `time`, so nodes/posts settle to the same orbit on every
      // screen — two viewers of one mesh agree on where each node sits.
      stepScenePhysics(model, rt.physics, Date.now(), dt, driftScaleFor(rt.proVisuals.motionStyle), disturbances);

      // Inertial pan: carry the fling velocity after release, with decay.
      const fling = rt.fling;
      if (!rt.drag.active && (Math.abs(fling.vx) > 4 || Math.abs(fling.vy) > 4)) {
        const flingDt = Math.min(dt, 50);
        rt.camera.panX += (fling.vx * flingDt) / 1000;
        rt.camera.panY += (fling.vy * flingDt) / 1000;
        const decay = Math.exp(-flingDt / 320);
        fling.vx *= decay;
        fling.vy *= decay;
      }

      // Glide the camera toward a fly-to node, tracking its live position so
      // branch expansion, drift, and zoom changes are all accounted for.
      const pt = rt.panTarget;
      if (pt) {
        const target = model.nodes.get(pt.nodeId);
        if (!target) {
          rt.panTarget = null;
        } else {
          const cam = rt.camera;
          const tx = -target.dx * cam.zoom;
          const ty = -target.dy * cam.zoom;
          const k = Math.min(1, dt / 220);
          cam.panX += (tx - cam.panX) * k;
          cam.panY += (ty - cam.panY) * k;
          if (Math.hypot(tx - cam.panX, ty - cam.panY) < 1.5) rt.panTarget = null;
        }
      }

      // Smooth zoom: ease toward the wheel / button target around its anchor.
      const zt = rt.zoomTarget;
      if (zt) {
        const cam = rt.camera;
        const k = Math.min(1, dt / 90);
        const next = cam.zoom + (zt.zoom - cam.zoom) * k;
        const ratio = next / cam.zoom;
        cam.panX = zt.ax - (zt.ax - cam.panX) * ratio;
        cam.panY = zt.ay - (zt.ay - cam.panY) * ratio;
        cam.zoom = next;
        if (Math.abs(zt.zoom - cam.zoom) < 0.002) rt.zoomTarget = null;
      }
    });

    // paint: hit targets are derived from the settled model + camera FIRST
    // (sim/hitmap — the painter has no say in what's tappable), then the
    // canvas draws, then the perf watchdog judges the frame.
    scheduler?.setPhase("paint", ({ time, dt }) => {
      const { width, height } = rt.size;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const model = rt.model;
      if (model && width && height) {
        rebuildHitmap(rt.hitmap, {
          model,
          camera: rt.camera,
          width,
          height,
          time,
          activeBranch: rt.activeBranch,
          selectedId: rt.selectedId,
          hoverId: rt.hoverId,
          images: rt.images,
          avoidCenter: rt.coarse,
        });

        // One options object serves whichever paint core the kill-switch
        // picked — the two are structurally identical by design.
        const frame = {
          ctx,
          model,
          width,
          height,
          camera: rt.camera,
          time,
          activeBranch: rt.activeBranch,
          selectedId: rt.selectedId,
          focusId: rt.focusId,
          hoverId: rt.hoverId,
          images: rt.images,
          backgroundStars: rt.stars,
          avoidCenter: rt.coarse,
          isOwnMesh,
          strands: rt.physics.strands,
          strandPulses: rt.strandPulses,
          visuals: rt.proVisuals,
          livePresence: rt.presence.info,
        };
        const paintEngine = engineKind === "next" ? rt.paintEngine : null;
        if (paintEngine && governorRef.current) {
          paintEngine.draw(frame, governorRef.current.tier());
        } else {
          drawScene(frame);
        }

        // Focus = item nearest screen center (the Meshi cursor's target).
        let nearest: string | null = null;
        let best = 52;
        const cx = width / 2;
        const cy = height / 2;
        rt.hitmap.circles.forEach((box, id) => {
          const node = model.nodes.get(id);
          if (!node || node.kind === "self" || node.kind === "branch") return;
          const d = Math.hypot(box.x - cx, box.y - cy);
          if (d < best) {
            best = d;
            nearest = id;
          }
        });
        if (nearest !== rt.focusId) {
          rt.focusId = nearest;
        }
      }
      // Quality control, per engine. NEXT: the two-way governor judges the
      // frame against the budget SLO (demotes on sustained slowness,
      // promotes back on sustained headroom; DPR/fx changes arrive via its
      // onTierChange hook above). LEGACY: the original one-way watchdog,
      // untouched.
      if (engineKind === "next") {
        governorRef.current?.onFrame(dt);
        return;
      }
      // Adaptive-quality watchdog. `dt` is the true inter-frame interval, so it
      // reflects the canvas draw, the presence/step loop, and browser paint
      // together — not just this callback's own span. If a device stays below
      // ~45fps (dt > 22ms) for a full second of CONSECUTIVE frames, escalate ONE
      // tier: reduce pixels first (tier 1), and only cap the frame rate (tier 2,
      // enforced by the scheduler's frame cap) if it's STILL slow afterwards. A
      // single fast frame resets the counter, so a borderline device is never
      // nudged down by noise. Skipped once frame-capped (tier 2 is the floor)
      // and during a brief startup warm-up.
      perf.frames++;
      if (perf.tier < 2 && perf.frames > 30) {
        perf.frameCost = perf.frameCost * 0.9 + dt * 0.1;
        if (perf.frameCost > 22) {
          if (++perf.slow > 60) {
            perf.tier += 1;
            // If trimming pixels wouldn't change anything (DPR already at/below
            // the tier-1 ceiling), skip straight to the frame cap rather than
            // idling a full window at a no-op stage.
            if (perf.tier === 1 && dprForTier(1) === dpr) perf.tier = 2;
            dpr = dprForTier(perf.tier);
            perf.slow = 0;
            perf.frameCost = 16; // judge the new tier fresh, ignoring the resize hitch
            resize();
          }
        } else {
          perf.slow = 0;
        }
      }
    });

    return () => {
      scheduler?.setPhase("sim", null);
      scheduler?.setPhase("paint", null);
      ro.disconnect();
      unsubscribeTier?.();
      // The paint engine's caches (sprites, images, background) are
      // per-mount state — dropped whole here, never retained or shared.
      rt.paintEngine?.dispose();
      rt.paintEngine = null;
    };
  }, [rtRef, fitToContent, viewUserId, viewMode, isOwnMesh]);
}
