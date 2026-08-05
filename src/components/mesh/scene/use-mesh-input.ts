// useMeshInput — every gesture on the canvas: drag-pan with inertia, pinch
// zoom+pan, wheel zoom, tap/double-tap, long-press pluck, hover hit-testing,
// node activation, the travel dive into a friend's mesh, and the content
// stream the lens glides through. Extracted verbatim from the old
// mesh-scene.tsx; PR5 adds the pluck (press-and-hold a content node →
// cosmetic spring stretch + the DOM quick-action ring).

"use client";

import { useCallback, useEffect } from "react";
import type React from "react";
import { playSound } from "@/lib/sound";
import { isPrecisePointer, notePenDown, notePenUp, yieldsToPen } from "@/lib/pen";
import { clampZoom, unprojectPoint, MAX_ZOOM } from "../core/camera";
import type { MeshRuntime, MeshRuntimeRef } from "./runtime";
import { catchUpTourIds } from "./seen-marks";
import type { BranchKey, SceneModel, SceneNode } from "./scene-model";
import { spawnBurst } from "../live/hearts";
import { aimPluck, peekPluckFlick, releasePluck, startPluck } from "../sim/toys";
import { playFunSound } from "../audio/sound-kit";

export interface MeshInputDeps {
  fitToContent: () => void;
  push: (href: string) => void;
  setSelectedNode: React.Dispatch<React.SetStateAction<SceneNode | null>>;
  setActiveBranch: React.Dispatch<React.SetStateAction<BranchKey | null>>;
  setHoverNode: (node: SceneNode | null) => void;
  /** The travel veil is rising — label names whose mesh we're diving into. */
  onTravel: (label: string) => void;
  /** Start a catch-up tour through these node ids (oldest first). */
  onStartTour: (ids: string[]) => void;
  /** Catch-up fallback when nothing is new: open the list view. */
  openList: () => void;
  /** A long-press plucked this content node — open the quick-action ring at
   * this screen anchor (the DOM overlay's job; the canvas only stretches). */
  onPluck: (node: SceneNode, anchor: { x: number; y: number }) => void;
  /** A long-press held a PERSON node — open the emote wheel at this anchor.
   * Only wired when the viewer may broadcast presence (never in Global):
   * absent handler = the gesture is never armed, capability-by-construction. */
  onEmoteHold?: (node: SceneNode, anchor: { x: number; y: number }) => void;
  /** The plucked node was FLUNG on release — throw a heart at it. Only wired
   * when the viewer may broadcast presence (the heart is a bus verb). */
  onFlick?: (node: SceneNode) => void;
}

export interface MeshInput {
  flyToNode: (node: SceneNode) => void;
  enterFriendMesh: (node: SceneNode) => void;
  activateNode: (node: SceneNode) => void;
  jumpToNode: (node: SceneNode) => void;
  contentList: () => SceneNode[];
  startCatchUp: () => void;
  navigateContent: (dir: 1 | -1) => void;
  zoomBy: (factor: number) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onWheel: (e: React.WheelEvent) => void;
}

/** Every readable piece of content on the mesh, newest first — so the
 * content lens glides through your world the way memory works: from now,
 * backward. During a catch-up tour the stream is exactly the new items, in
 * the order they happened. Pure, so the shell derives the lens's stream from
 * the state model while event handlers derive it from the runtime. */
export function contentListOf(model: SceneModel | null, tourIds: string[] | null): SceneNode[] {
  if (!model) return [];
  if (tourIds && tourIds.length) {
    return tourIds
      .map((id) => model.nodes.get(id))
      .filter((n): n is SceneNode => Boolean(n));
  }
  const out: SceneNode[] = [];
  model.nodes.forEach((n) => {
    if (n.kind === "post" || n.kind === "activity") out.push(n);
  });
  out.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
  return out;
}

/** Press-and-hold this long (touch long-press / mouse hold) plucks a node. */
const PLUCK_HOLD_MS = 420;
/** Release speed (SCREEN px/s — world speed × zoom, so the gesture feels the
 * same at any zoom) above which letting go of a pluck reads as a FLICK. */
const FLICK_MIN_PX_S = 700;
/** A flick must come off a LIVE gesture — a stale velocity from a pause
 * before release never throws. */
const FLICK_MAX_AGE_MS = 140;

function cancelPluckHold(rt: MeshRuntime): void {
  if (rt.pluckHold) {
    clearTimeout(rt.pluckHold.timer);
    rt.pluckHold = null;
  }
}

export function useMeshInput(rtRef: MeshRuntimeRef, deps: MeshInputDeps): MeshInput {
  const {
    fitToContent,
    push,
    setSelectedNode,
    setActiveBranch,
    setHoverNode,
    onTravel,
    onStartTour,
    openList,
    onPluck,
    onEmoteHold,
    onFlick,
  } = deps;

  // A pending hold timer must not outlive the scene.
  useEffect(() => {
    const rt = rtRef.current;
    return () => cancelPluckHold(rt);
  }, [rtRef]);

  const flyToNode = useCallback(
    (node: SceneNode) => {
      rtRef.current.panTarget = { nodeId: node.id };
    },
    [rtRef],
  );

  // Entering a friend's mesh is a TRIP, not a page change: the camera dives
  // into their node while a veil rises, then their world forms in.
  const enterFriendMesh = useCallback(
    (node: SceneNode) => {
      const rt = rtRef.current;
      if (!node.userId || rt.traveling) return;
      rt.traveling = true;
      playSound("whoosh");
      onTravel(node.label);
      setSelectedNode(null);
      rt.panTarget = { nodeId: node.id };
      rt.zoomTarget = {
        zoom: Math.min(MAX_ZOOM, Math.max(rt.camera.zoom * 2.6, 1.6)),
        ax: 0,
        ay: 0,
      };
      const dest = `/mesh?user=${encodeURIComponent(node.userId)}`;
      setTimeout(() => push(dest), 720);
    },
    [rtRef, onTravel, setSelectedNode, push],
  );

  const activateNode = useCallback(
    (node: SceneNode) => {
      const rt = rtRef.current;
      if (node.kind === "self") {
        setActiveBranch(null);
        setSelectedNode(null);
        // A quiet indigo twinkle blooms out of you as the world reframes.
        spawnBurst(rt, node.dx, node.dy, "spark", 6);
        fitToContent();
        return;
      }
      if (node.kind === "person" && node.userId) {
        // Don't teleport straight into their mesh — open their card so you can
        // choose: enter their mesh, follow, share, or view their profile.
        setActiveBranch(node.branch);
        setSelectedNode(node);
        playSound("pop");
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
      playSound("pop");
      // Opening a piece of content pops a little star burst off the node — and
      // the room sees your star too, so reactions aren't only heart-throws.
      if (node.kind === "post" || node.kind === "activity") {
        spawnBurst(rt, node.dx, node.dy, "star", 5);
        rt.pendingAction = { kind: "star", targetId: "", at: Date.now() };
        rt.heartbeatNow?.();
      }
      flyToNode(node);
    },
    [rtRef, fitToContent, flyToNode, setActiveBranch, setSelectedNode],
  );

  const jumpToNode = useCallback(
    (node: SceneNode) => {
      setActiveBranch(node.branch);
      setSelectedNode(node);
      flyToNode(node);
    },
    [flyToNode, setActiveBranch, setSelectedNode],
  );

  const contentList = useCallback((): SceneNode[] => {
    const rt = rtRef.current;
    return contentListOf(rt.model, rt.tourIds);
  }, [rtRef]);

  // Catch-up tour: fly through what arrived since your last visit — every
  // unseen item, OLDEST first (the order life happened) — each stop opening
  // in the lens where it lives. The ordering is pinned by the seen-bridge
  // contract test via the pure catchUpTourIds.
  const startCatchUp = useCallback(() => {
    const rt = rtRef.current;
    const model = rt.model;
    if (!model) return;
    const ids = catchUpTourIds(model);
    if (ids.length === 0) {
      openList();
      return;
    }
    // Sync the runtime immediately so the lens's very first render already
    // sees the tour stream, not the full mesh stream.
    rt.tourIds = ids;
    onStartTour(ids);
    const first = model.nodes.get(ids[0])!;
    setActiveBranch(first.branch);
    setSelectedNode(first);
    rt.panTarget = { nodeId: first.id };
  }, [rtRef, openList, onStartTour, setActiveBranch, setSelectedNode]);

  const navigateContent = useCallback(
    (dir: 1 | -1) => {
      const list = contentList();
      if (list.length === 0) return;
      const cur = rtRef.current.selectedId;
      const i = list.findIndex((n) => n.id === cur);
      const next = list[((i === -1 ? 0 : i) + dir + list.length) % list.length];
      setSelectedNode(next);
      setActiveBranch(next.branch);
      flyToNode(next);
    },
    [rtRef, contentList, flyToNode, setActiveBranch, setSelectedNode],
  );

  // `slop` grows every hit target by a few px — passed on touch so a fingertip
  // (much larger and less precise than a cursor) reliably lands on a node.
  const hitTest = useCallback(
    (sx: number, sy: number, slop = 0): SceneNode | null => {
      const rt = rtRef.current;
      const model = rt.model;
      if (!model) return null;
      // Label pills (branch / self) are clickable too.
      for (const [id, pill] of rt.hitmap.pills) {
        if (sx >= pill.x - 4 - slop && sx <= pill.x + pill.w + 4 + slop && sy >= pill.y - 4 - slop && sy <= pill.y + pill.h + 4 + slop) {
          const node = model.nodes.get(id);
          if (node) return node;
        }
      }
      let found: SceneNode | null = null;
      let bestD = Infinity;
      rt.hitmap.circles.forEach((box, id) => {
        const d = Math.hypot(box.x - sx, box.y - sy);
        // Among every target the finger is within reach of, pick the one whose
        // CENTRE is nearest the tap — so a fingertip lands on the node it's
        // actually over, not on a tiny far neighbour that merely overlaps it.
        if (d <= box.r + slop && d < bestD) {
          const node = model.nodes.get(id);
          if (node) {
            found = node;
            bestD = d;
          }
        }
      });
      return found;
    },
    [rtRef],
  );

  /**
   * Is THIS event too imprecise to trust exactly?
   *
   * `rt.coarse` answers "is the device's PRIMARY pointer coarse", set once from
   * matchMedia("(pointer: coarse)"). On a tablet that is touch, and it stayed
   * true for every Apple Pencil and S Pen event in the session — so a 1mm tip
   * got the 22px hit slop, the 12px drag threshold and a cursor pinned to the
   * screen centre, all of which exist for a fingertip. Precision is a fact about
   * the EVENT, so it is asked per event and `rt.coarse` only narrows the default.
   */
  const imprecise = useCallback(
    (e: React.PointerEvent) => rtRef.current.coarse && !isPrecisePointer(e.pointerType),
    [rtRef],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const rt = rtRef.current;
      notePenDown(e.nativeEvent);
      // A palm landing mid-stroke used to arrive as pointer two and turn a
      // Pencil line into a pinch-zoom; a palm landing first claimed the gesture
      // outright. The OS rejects palms eventually and says so with
      // pointercancel (handled below) — this covers the moment before it does.
      if (yieldsToPen(e.nativeEvent)) return;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      rt.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const rect = rt.containerEl?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        // On touch the stable viewport anchor is the screen centre — but a TAP
        // is a deliberate point, so it still steers your Meshi on the mesh.
        if (imprecise(e)) {
          rt.cursorVp = { vx: 0.5, vy: 0.5 };
        } else {
          rt.cursorVp = { vx: sx / rect.width, vy: sy / rect.height };
        }
        const t = rt.cursorWorldTarget;
        const w = unprojectPoint(rt.camera, rect.width, rect.height, sx, sy);
        t.x = w.x;
        t.y = w.y;
        if (!t.seen) {
          rt.cursorWorldPos.x = t.x;
          rt.cursorWorldPos.y = t.y;
          t.seen = true;
        }
        rt.lastInputAt = performance.now();
        if (isPrecisePointer(e.pointerType)) rt.pointerOnCanvas = true;
        if (rt.meshiCursorEl) rt.meshiCursorEl.style.opacity = "1";
      }
      const d = rt.drag;
      d.active = true;
      d.moved = false;
      d.startX = e.clientX;
      d.startY = e.clientY;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      d.lastT = performance.now();
      d.vx = 0;
      d.vy = 0;
      rt.fling = { vx: 0, vy: 0 };
      rt.panTarget = null;
      // Arm the PLUCK: a single pointer resting on a content node for
      // PLUCK_HOLD_MS (without moving, without a second finger) plucks it —
      // spring stretch on the canvas + the quick-action ring in the DOM.
      // A PERSON node long-press is the same gesture opening the EMOTE WHEEL
      // instead — and only ever arms when the emote handler is wired (the
      // surface withholds it without broadcast capability, so Global never
      // grows the gesture at all).
      cancelPluckHold(rt);
      if (rt.pointers.size === 1 && !rt.toys.pluck && rect && rect.width > 0 && rect.height > 0) {
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const held = hitTest(sx, sy, imprecise(e) ? 22 : 0);
        const holdable =
          held &&
          (held.kind === "post" ||
            held.kind === "activity" ||
            (held.kind === "person" && !!onEmoteHold));
        if (held && holdable) {
          const nodeId = held.id;
          const pointerId = e.pointerId;
          rt.pluckHold = {
            nodeId,
            pointerId,
            timer: setTimeout(() => {
              rt.pluckHold = null;
              // Still a genuine hold? (finger down, hasn't dragged or pinched)
              if (!rt.drag.active || rt.drag.moved || rt.pointers.size !== 1) return;
              const model = rt.model;
              const node = model?.nodes.get(nodeId);
              const anchor = rt.hitmap.circles.get(nodeId);
              const container = rt.containerEl;
              if (!model || !node || !anchor || !container) return;
              const r = container.getBoundingClientRect();
              const p = rt.pointers.get(pointerId);
              if (!r.width || !r.height || !p) return;
              const w = unprojectPoint(rt.camera, r.width, r.height, p.x - r.left, p.y - r.top);
              startPluck(rt.toys, nodeId, w.x, w.y, performance.now());
              rt.pluckPointerId = pointerId;
              // The eventual lift is the pluck's release — never a tap, never
              // a double-tap half.
              rt.lastTap = null;
              if (node.kind === "person" && onEmoteHold) {
                // Opening the emote wheel is a fun-layer moment: its pop rides
                // the explicit sound opt-in, and the eventual lift dismisses
                // the wheel — it must never double as a flick broadcast.
                rt.pluckEmote = true;
                playFunSound("pop");
                onEmoteHold(node, { x: anchor.x, y: anchor.y });
              } else {
                rt.pluckEmote = false;
                playSound("pop");
                onPluck(node, { x: anchor.x, y: anchor.y });
              }
            }, PLUCK_HOLD_MS),
          };
        }
      }
      if (rt.pointers.size === 2) {
        cancelPluckHold(rt);
        const pts = [...rt.pointers.values()];
        d.pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        d.pinchMidX = (pts[0].x + pts[1].x) / 2;
        d.pinchMidY = (pts[0].y + pts[1].y) / 2;
        // A second finger makes this a gesture, never a tap — so neither finger's
        // lift falls into the tap/deselect path (which would clear your selection).
        d.moved = true;
      }
    },
    [rtRef, hitTest, imprecise, onPluck, onEmoteHold],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const rt = rtRef.current;
      // A pointer captured on the canvas can still fire a move after the scene
      // unmounts (route change mid-drag); bail instead of throwing on the
      // non-null assertion.
      const container = rt.containerEl;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      // A plucked node follows the finger — its pointer steers the spring
      // stretch (world-space aim), never the camera or the hover state.
      if (rt.pluckPointerId === e.pointerId) {
        rt.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (rect.width > 0 && rect.height > 0) {
          const w = unprojectPoint(rt.camera, rect.width, rect.height, sx, sy);
          aimPluck(rt.toys, w.x, w.y, performance.now());
        }
        return;
      }
      if (rect.width > 0 && rect.height > 0) {
        if (imprecise(e)) {
          rt.cursorVp = { vx: 0.5, vy: 0.5 };
        } else {
          rt.cursorVp = { vx: sx / rect.width, vy: sy / rect.height };
          // Pointer position in WORLD coordinates — where Meshi wanders toward,
          // and what we broadcast so everyone anchors you to the same spot on
          // the actual mesh.
          const t = rt.cursorWorldTarget;
          const { x: wx, y: wy } = unprojectPoint(rt.camera, rect.width, rect.height, sx, sy);
          if (!t.seen) {
            rt.cursorWorldPos.x = wx;
            rt.cursorWorldPos.y = wy;
            t.seen = true;
          }
          t.x = wx;
          t.y = wy;
          rt.lastInputAt = performance.now();
          rt.pointerOnCanvas = true;
          // Movement broadcasts ~3×/second while you glide — the room should
          // see you move, not teleport.
          if (performance.now() - rt.lastMoveHb > 350) {
            rt.lastMoveHb = performance.now();
            rt.heartbeatNow?.();
          }
        }
      }
      const cursor = rt.meshiCursorEl;
      if (cursor) cursor.style.opacity = "1";
      if (!imprecise(e) && rt.cursorDotEl) {
        rt.cursorDotEl.style.opacity = "1";
        rt.cursorDotEl.style.transform = "translate(" + sx + "px, " + sy + "px) translate(-50%, -50%)";
      }
      if (isPrecisePointer(e.pointerType)) {
        if (!rt.drag.active) {
          const node = hitTest(sx, sy);
          const id = node?.id ?? null;
          if (id !== rt.hoverId) {
            rt.hoverId = id;
            setHoverNode(node);
          }
        }
      }
      const d = rt.drag;
      if (!d.active) return;
      rt.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (rt.pointers.size === 2) {
        const pts = [...rt.pointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const rawMidX = (pts[0].x + pts[1].x) / 2;
        const rawMidY = (pts[0].y + pts[1].y) / 2;
        if (d.pinchDist > 0) {
          const cam = rt.camera;
          const next = clampZoom(cam.zoom * (dist / d.pinchDist));
          const rect2 = container.getBoundingClientRect();
          const midX = rawMidX - rect2.left - rect2.width / 2;
          const midY = rawMidY - rect2.top - rect2.height / 2;
          const k = next / cam.zoom;
          // Zoom, anchored at the finger midpoint so it grows where you pinch…
          cam.panX = midX - (midX - cam.panX) * k;
          cam.panY = midY - (midY - cam.panY) * k;
          cam.zoom = next;
          // …AND pan by however far that midpoint slid, so dragging both fingers
          // together moves the mesh — the gesture people expect but didn't have.
          if (d.pinchMidX !== 0 || d.pinchMidY !== 0) {
            cam.panX += rawMidX - d.pinchMidX;
            cam.panY += rawMidY - d.pinchMidY;
          }
        }
        d.pinchDist = dist;
        d.pinchMidX = rawMidX;
        d.pinchMidY = rawMidY;
        d.moved = true;
        return;
      }

      const dx = e.clientX - d.lastX;
      const dy = e.clientY - d.lastY;
      // Tap-vs-drag is measured cumulatively from the press point, not per-move,
      // so a slow deliberate drag still counts while finger jitter during a tap
      // does not. Touch gets a much larger tolerance than a precise mouse — this
      // is the main reason taps "didn't select" before (a few px of wobble was
      // read as a drag).
      const moveThresh = imprecise(e) ? 12 : 3;
      const wasMoved = d.moved;
      if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > moveThresh) d.moved = true;
      // A confirmed drag is a pan, not a hold — disarm any pending pluck.
      if (d.moved && rt.pluckHold) cancelPluckHold(rt);
      // Don't pan until the gesture is a confirmed drag, so a tap never nudges the
      // scene under your finger. On the frame it first becomes a drag, catch up
      // the full displacement from the press point so panning starts without a jump.
      if (d.moved) {
        if (wasMoved) {
          rt.camera.panX += dx;
          rt.camera.panY += dy;
        } else {
          rt.camera.panX += e.clientX - d.startX;
          rt.camera.panY += e.clientY - d.startY;
        }
      }
      const now = performance.now();
      const dtMove = Math.max(now - d.lastT, 1);
      // Blend an instantaneous velocity sample (px/s) for the release fling.
      d.vx = d.vx * 0.7 + ((dx * 1000) / dtMove) * 0.3;
      d.vy = d.vy * 0.7 + ((dy * 1000) / dtMove) * 0.3;
      d.lastT = now;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
    },
    [rtRef, hitTest, imprecise, setHoverNode],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const rt = rtRef.current;
      notePenUp(e.nativeEvent);
      const d = rt.drag;
      // Lifting a plucked node releases the spring (snap-back wobble). The
      // DOM ring resolves its own release-on-action; this lift is never a
      // tap, a fling, or a deselect. A FAST lift is a FLICK: the node snaps
      // back exactly as springily, and a heart flies at it (when the flick
      // emitter is wired at all — broadcast capability only).
      if (rt.pluckPointerId === e.pointerId) {
        rt.pluckPointerId = null;
        // A wheel-opening pluck's lift dismisses the wheel — never a flick.
        const flick = onFlick && !rt.pluckEmote ? peekPluckFlick(rt.toys, performance.now()) : null;
        rt.pluckEmote = false;
        releasePluck(rt.toys, rt.model, rt.reducedMotion);
        rt.pointers.delete(e.pointerId);
        d.active = false;
        d.moved = false;
        d.pinchDist = 0;
        d.pinchMidX = 0;
        d.pinchMidY = 0;
        if (
          flick &&
          flick.ageMs < FLICK_MAX_AGE_MS &&
          flick.speed * rt.camera.zoom > FLICK_MIN_PX_S
        ) {
          const node = rt.model?.nodes.get(flick.nodeId);
          if (node) onFlick?.(node);
        }
        return;
      }
      // A lift before the hold fired is an ordinary tap — disarm the pluck.
      cancelPluckHold(rt);
      rt.pointers.delete(e.pointerId);
      if (rt.pointers.size < 2) d.pinchDist = 0;
      if (rt.pointers.size === 2) {
        // Dropped from 3+ fingers back to 2: re-seed the pinch anchor from the
        // two that remain, so the next pinch move doesn't jump on stale
        // distance/midpoint left over from before the extra finger lifted.
        const pts = [...rt.pointers.values()];
        d.pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        d.pinchMidX = (pts[0].x + pts[1].x) / 2;
        d.pinchMidY = (pts[0].y + pts[1].y) / 2;
      }
      if (rt.pointers.size === 1) {
        // Lifting one finger of a pinch: re-anchor the drag on the finger that
        // stays down, so its next move measures from where it IS — otherwise the
        // mesh jumps by the stale gap between the two fingers on the handoff.
        const [p] = [...rt.pointers.values()];
        d.lastX = p.x;
        d.lastY = p.y;
        d.vx = 0;
        d.vy = 0;
        d.pinchMidX = 0;
        d.pinchMidY = 0;
      }
      if (rt.pointers.size === 0) {
        d.active = false;
        d.pinchMidX = 0;
        d.pinchMidY = 0;
        if (d.moved && performance.now() - d.lastT < 80) {
          rt.fling = { vx: d.vx, vy: d.vy };
        }
      }

      // Only the FINAL finger lifting with no drag is a tap. Guarding on the
      // pointer count means a lift that's part of a still-in-progress multi-touch
      // gesture can never select or clear the selection.
      if (!d.moved && rt.pointers.size === 0) {
        const container = rt.containerEl;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        // A fingertip is far larger and less precise than a cursor, so on touch
        // every tap hit-test is forgiving by ~22px — a tap that lands near a
        // node still selects it (and the nearest-centre tiebreak in hitTest picks
        // the right one in a cluster). A mouse click stays pixel-precise (slop 0).
        const tapSlop = imprecise(e) ? 22 : 0;
        // Double-tap / double-click on empty space zooms in on that spot.
        const now = performance.now();
        const prevTap = rt.lastTap;
        rt.lastTap = { x: e.clientX, y: e.clientY, t: now };
        if (
          prevTap &&
          now - prevTap.t < 320 &&
          Math.hypot(e.clientX - prevTap.x, e.clientY - prevTap.y) < 32 &&
          !hitTest(e.clientX - rect.left, e.clientY - rect.top, tapSlop)
        ) {
          rt.lastTap = null;
          const base = rt.zoomTarget?.zoom ?? rt.camera.zoom;
          rt.zoomTarget = {
            zoom: clampZoom(base * 1.55),
            ax: e.clientX - rect.left - rect.width / 2,
            ay: e.clientY - rect.top - rect.height / 2,
          };
          return;
        }
        const profileRect = rt.hitmap.profile.get(rt.model?.selfId || "");
        if (profileRect) {
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          if (sx >= profileRect.x && sx <= profileRect.x + profileRect.w && sy >= profileRect.y && sy <= profileRect.y + profileRect.h) {
            const selfNode = rt.model?.nodes.get(rt.model?.selfId ?? "");
            push(selfNode?.href || "/profile");
            return;
          }
        }
        const node = hitTest(e.clientX - rect.left, e.clientY - rect.top, tapSlop);
        if (node) {
          activateNode(node);
          return;
        }
        // Tapping empty space clears the selection — the TOPMOST thing the
        // canvas owns. (Full-screen overlays sit above the canvas and catch
        // their own backdrop taps, so this is layered dismissal's floor: an
        // intentional tap on nothing simply deselects, as you'd expect.)
        setSelectedNode(null);
        setActiveBranch(null);
      }
    },
    [rtRef, activateNode, hitTest, imprecise, push, setActiveBranch, setSelectedNode, onFlick],
  );

  // A browser-initiated cancel (system gesture, pointer stolen) should ABORT the
  // gesture, never select — just drop the pointer and re-anchor any survivor,
  // so a cancelled tap can't grab a node and a cancelled pinch can't jump.
  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      const rt = rtRef.current;
      notePenUp(e.nativeEvent);
      const d = rt.drag;
      // An aborted gesture also aborts any pluck — release the spring quietly.
      cancelPluckHold(rt);
      if (rt.pluckPointerId === e.pointerId) {
        rt.pluckPointerId = null;
        rt.pluckEmote = false;
        releasePluck(rt.toys, rt.model, rt.reducedMotion);
      }
      rt.pointers.delete(e.pointerId);
      if (rt.pointers.size < 2) d.pinchDist = 0;
      if (rt.pointers.size === 2) {
        const pts = [...rt.pointers.values()];
        d.pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        d.pinchMidX = (pts[0].x + pts[1].x) / 2;
        d.pinchMidY = (pts[0].y + pts[1].y) / 2;
      }
      if (rt.pointers.size === 1) {
        const [p] = [...rt.pointers.values()];
        d.lastX = p.x;
        d.lastY = p.y;
        d.vx = 0;
        d.vy = 0;
        d.pinchMidX = 0;
        d.pinchMidY = 0;
      }
      if (rt.pointers.size === 0) {
        d.active = false;
        d.moved = false;
        d.pinchMidX = 0;
        d.pinchMidY = 0;
      }
    },
    [rtRef],
  );

  const onPointerLeave = useCallback(
    (e: React.PointerEvent) => {
      const rt = rtRef.current;
      // A lifted finger fires pointerleave too — only a PRECISE pointer
      // leaving the canvas should hide Meshi; on touch it stays where you left
      // it. A pen lifting away must clear hover, or the reticle sticks to
      // whatever it was last over.
      if (!isPrecisePointer(e.pointerType)) return;
      rt.pointerOnCanvas = false;
      rt.hoverId = null;
      setHoverNode(null);
      if (rt.meshiCursorEl) rt.meshiCursorEl.style.opacity = "0";
      if (rt.cursorDotEl) rt.cursorDotEl.style.opacity = "0";
    },
    [rtRef, setHoverNode],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const rt = rtRef.current;
      const container = rt.containerEl;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left - rect.width / 2;
      const my = e.clientY - rect.top - rect.height / 2;
      const factor = Math.exp(-e.deltaY * 0.0014);
      const base = rt.zoomTarget?.zoom ?? rt.camera.zoom;
      rt.zoomTarget = {
        zoom: clampZoom(base * factor),
        ax: mx,
        ay: my,
      };
    },
    [rtRef],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const rt = rtRef.current;
      const base = rt.zoomTarget?.zoom ?? rt.camera.zoom;
      rt.zoomTarget = {
        zoom: clampZoom(base * factor),
        ax: 0,
        ay: 0,
      };
    },
    [rtRef],
  );

  return {
    flyToNode,
    enterFriendMesh,
    activateNode,
    jumpToNode,
    contentList,
    startCatchUp,
    navigateContent,
    zoomBy,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    onWheel,
  };
}
