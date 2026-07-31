// useMeshFrame — the canvas, the paint engine, the quality governor, and the
// scheduler's sim + paint phases. The ONE rAF's ordering contract:
// sim (physics + camera motion) → paint (hitmap rebuild, canvas draw,
// governor) → domSync (registered by live/use-meshi-dom-sync).

"use client";

import { useEffect, useRef } from "react";
import { createMeshScheduler, type MeshScheduler } from "../core/scheduler";
import { createQualityGovernor, probeStartTier, type QualityGovernor } from "../core/motion";
import { createPaintEngine } from "../paint";
import { rebuildHitmap } from "../sim/hitmap";
import { driftScaleFor, stepScenePhysics } from "../sim/physics";
import { stepStrum } from "../sim/strum";
import { stepToys } from "../sim/toys";
import type { MeshRuntimeRef } from "./runtime";

export function useMeshFrame(
  rtRef: MeshRuntimeRef,
  opts: {
    viewUserId?: string;
    viewMode: "mesh" | "global";
    isOwnMesh: boolean;
    fitToContent: () => void;
    /** A strand was strummed this frame — the surface owns the tone (opt-in
     * gated sound) and the one-time "Sound on?" affordance. */
    onStrum?: (note: number) => void;
  },
): void {
  const { viewUserId, viewMode, isOwnMesh, fitToContent, onStrum } = opts;

  // Two-way quality governor: a startup device probe picks the tier — and
  // pins its floor — then the frame-budget monitor demotes on sustained
  // slowness and promotes back on sustained headroom.
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
    // the scheduler and the two-way quality governor.
    if (schedulerRef.current === null) {
      schedulerRef.current = createMeshScheduler({
        frameCapMs: () => governorRef.current?.params().frameCapMs ?? 0,
      });
    }
    if (governorRef.current === null) {
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

    // Device-pixel-ratio ceiling comes from the governor's tier: full detail,
    // then progressively fewer pixels to fill (the biggest lever for
    // fill-rate-bound canvas rendering).
    const dprNow = () =>
      governorRef.current
        ? Math.min(window.devicePixelRatio || 1, governorRef.current.params().dprCap)
        : Math.min(window.devicePixelRatio || 1, 2);
    let dpr = dprNow();

    // The layered paint engine. Its caches are per-mount state — created
    // here, disposed on cleanup, never shared.
    if (rt.paintEngine === null) {
      rt.paintEngine = createPaintEngine({
        // Image LRU eviction drops the same ids from the id→image map that
        // hitmap + painters read, so paint and hit stay in lockstep.
        onImagesEvicted: (ids) => {
          for (const id of ids) rt.images.delete(id);
        },
      });
    }
    rt.paintEngine?.setDpr(dpr);
    if (process.env.NODE_ENV !== "production" && governorRef.current) {
      console.info(`[mesh] paint engine ready (probe tier T${governorRef.current.tier()})`);
    }

    const resize = () => {
      const rect = container.getBoundingClientRect();
      rt.size = { width: rect.width, height: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
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
    scheduler?.setPhase("sim", ({ time, dt }) => {
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
      rt.presence.sprites.forEach((s) => {
        if (s.world) disturbances.push({ x: s.world.x, y: s.world.y });
      });
      // Drift phase is driven by the shared wall clock (Date.now()), NOT the
      // per-client rAF `time`, so nodes/posts settle to the same orbit on every
      // screen — two viewers of one mesh agree on where each node sits.
      stepScenePhysics(model, rt.physics, Date.now(), dt, driftScaleFor(rt.proVisuals.motionStyle), disturbances);
      // Toys ride the same springs: a held pluck injects velocity toward the
      // pointer AFTER the layout springs settle — cosmetic offset only, and a
      // no-op (one null check) whenever nothing is being played with.
      stepToys(model, rt.toys, dt, rt.reducedMotion);
      // The STRUM: your presence point (cursor on fine pointers; the world
      // spot the touch Meshi rides during a pan/fling) sweeping across a
      // filament twangs it — strand-control-point kick + fx stamp + tone via
      // onStrum. Early-outs to one distance check while you're still, and
      // never touches laid-out positions (cosmetic-only, like every toy).
      if (rt.cursorWorldTarget.seen) {
        stepStrum(
          model,
          rt.physics,
          rt.strum,
          rt.strandStrums,
          rt.cursorWorldTarget.x,
          rt.cursorWorldTarget.y,
          time,
          rt.reducedMotion,
          onStrum,
        );
      }

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
          avoidCenter: rt.coarse,
          isOwnMesh,
          strands: rt.physics.strands,
          strandPulses: rt.strandPulses,
          // Reduced motion collapses the strum to its tone: the painter never
          // sees the shimmer stamps (they remain as re-strum cooldowns only).
          strandStrums: rt.reducedMotion ? undefined : rt.strandStrums,
          trails: rt.trails,
          visuals: rt.proVisuals,
          livePresence: rt.presence.info,
        };
        if (rt.paintEngine && governorRef.current) {
          rt.paintEngine.draw(frame, governorRef.current.tier());
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
      // Quality control: the two-way governor judges the frame against the
      // budget SLO — demoting on sustained slowness, promoting back on
      // sustained headroom. DPR/fx changes arrive via its onTierChange hook.
      governorRef.current?.onFrame(dt);
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
  }, [rtRef, fitToContent, viewUserId, viewMode, isOwnMesh, onStrum]);
}
