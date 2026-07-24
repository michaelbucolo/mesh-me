// useMeshiDomSync — the scheduler's domSync phase: hearts in flight, and
// every Meshi ON the mesh gliding in world coordinates. Runs the same frame,
// AFTER physics and paint, so it reads THIS frame's hitmap and camera (the
// old second loop consumed the paint loop's leftovers with no ordering
// guarantee). Extracted AS-IS from the old mesh-scene.tsx.

"use client";

import { useEffect } from "react";
import { playSound } from "@/lib/sound";
import { cameraCenterWorld, projectPoint, unprojectPoint } from "../core/camera";
import { reactionGlyphSvg } from "../scene/reaction-glyphs";
import type { MeshRuntimeRef } from "../scene/runtime";

// A Meshi looks at things with its EYES, never by tilting. These helpers feed
// the --meshi-look-x/-y custom properties (each a unit vector -1..1) that
// MeshiMascot reads to shift its gaze. Runs on a per-frame hot path, so the
// nearest search ranks by squared distance and takes one sqrt for the winner.
type Pt = { x: number; y: number };

function nearestWithin(x: number, y: number, others: Pt[], range: number): Pt | null {
  let best: Pt | null = null;
  let bestSq = Infinity;
  for (const o of others) {
    const dx = o.x - x;
    const dy = o.y - y;
    const sq = dx * dx + dy * dy;
    if (sq < bestSq) {
      bestSq = sq;
      best = o;
    }
  }
  if (!best || bestSq > range * range || bestSq < 1) return null;
  return best;
}

// Unit direction from a Meshi at (x,y) toward a target — where its eyes point.
function lookUnit(x: number, y: number, target: Pt | null): Pt {
  if (!target) return { x: 0, y: 0 };
  const dx = target.x - x;
  const dy = target.y - y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return { x: 0, y: 0 };
  return { x: dx / d, y: dy / d };
}

export function useMeshiDomSync(
  rtRef: MeshRuntimeRef,
  opts: { viewUserId?: string; viewMode: "mesh" | "global"; isOwnMesh: boolean },
): void {
  const { viewUserId, viewMode, isOwnMesh } = opts;

  useEffect(() => {
    const rt = rtRef.current;
    let meshiRLive = 13;
    // Deterministic per-frame push away from any node the Meshi would cover.
    // Recomputed from the world position each frame (never written back), so
    // it can't feedback-oscillate. Reads the model-derived hitmap.
    const avoidNodes = (sx: number, sy: number): { x: number; y: number } => {
      let x = sx;
      let y = sy;
      for (let pass = 0; pass < 2; pass += 1) {
        let pushed = false;
        rt.hitmap.circles.forEach((hb) => {
          const minD = hb.r + meshiRLive;
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
    // World→screen for the DOM layer — through core/camera like everyone else.
    const project = (wx: number, wy: number) =>
      projectPoint(
        rt.camera,
        rt.containerEl?.clientWidth ?? 0,
        rt.containerEl?.clientHeight ?? 0,
        wx,
        wy,
      );

    // Hearts in flight: each rises out of a Meshi, arcs across the world, and
    // pops on the post it was thrown at — nudging the count up as it lands.
    const stepHearts = (now: number) => {
      const host = rt.heartsEl;
      if (!host) return;
      rt.strandPulses.forEach((start, key) => {
        if (now - start > 1400) rt.strandPulses.delete(key);
      });
      rt.hearts = rt.hearts.filter((h) => {
        const t = (now - h.born) / h.dur;
        // Free-flight flourish: no target node, no count bump — rises out of a
        // point along its vector and fades. (node open / visitor / recenter)
        if (h.burst) {
          let bel = host.querySelector<HTMLElement>(`[data-heart-id="${h.id}"]`);
          if (t >= 1) { bel?.remove(); return false; }
          if (t < 0) return true; // staggered spawn not yet due
          if (!bel) {
            bel = document.createElement("div");
            bel.dataset.heartId = String(h.id);
            bel.dataset.meshHeart = "1";
            bel.innerHTML = reactionGlyphSvg(h.glyph ?? "spark");
            bel.style.cssText =
              "position:absolute;left:0;top:0;line-height:0;filter:drop-shadow(0 2px 7px rgba(129,140,248,0.55));will-change:transform,opacity;transform:translate(-50%,-50%);";
            host.appendChild(bel);
          }
          const ease = 1 - (1 - t) * (1 - t); // easeOutQuad
          const wx = h.fromX + Math.cos(h.burst.angle) * h.burst.dist * ease;
          const wy = h.fromY + Math.sin(h.burst.angle) * h.burst.dist * ease - 20 * ease;
          const s = project(wx, wy);
          const scale = 0.4 + 0.85 * Math.sin(t * Math.PI);
          bel.style.opacity = (1 - t * t).toFixed(3);
          bel.style.transform =
            `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%,-50%) scale(${scale.toFixed(3)}) rotate(${(t * 38).toFixed(1)}deg)`;
          return true;
        }
        const model = rt.model;
        const target = model?.nodes.get(h.targetId);
        let el = host.querySelector<HTMLElement>(`[data-heart-id="${h.id}"]`);
        if (!target) {
          el?.remove();
          return false;
        }
        if (t >= 1) {
          const meta = target.meta?.find((m) => m.label === "Likes");
          if (meta) {
            const n = parseInt(meta.value, 10);
            if (Number.isFinite(n)) meta.value = String(n + 1);
          }
          // The interaction rides the strand home to the maker.
          if (target.parentId) rt.strandPulses.set(`${target.parentId}>${target.id}`, now);
          playSound("land");
          if (el) {
            el.style.animation = "meshHeartLand .34s ease-out forwards";
            const gone = el;
            setTimeout(() => gone.remove(), 360);
          }
          return false;
        }
        if (!el) {
          el = document.createElement("div");
          el.dataset.heartId = String(h.id);
          el.dataset.meshHeart = "1";
          // Original hand-drawn heart (never an emoji) — a soft rose body with
          // a glossy highlight, so a thrown like reads as ours, not the OS font's.
          el.innerHTML = reactionGlyphSvg("heart");
          el.style.cssText =
            "position:absolute;left:0;top:0;line-height:0;filter:drop-shadow(0 2px 8px rgba(244,63,94,0.6));will-change:transform;transform:translate(-50%,-50%);";
          host.appendChild(el);
        }
        const cx0 = (h.fromX + target.dx) / 2;
        const cy0 = (h.fromY + target.dy) / 2 - 130;
        const mt = 1 - t;
        const wx = mt * mt * h.fromX + 2 * mt * t * cx0 + t * t * target.dx;
        const wy = mt * mt * h.fromY + 2 * mt * t * cy0 + t * t * target.dy;
        const s = project(wx, wy);
        const scale = 0.7 + 0.55 * Math.sin(t * Math.PI);
        el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%,-50%) scale(${scale.toFixed(3)}) rotate(${(Math.sin(t * 9) * 10).toFixed(1)}deg)`;
        return true;
      });
    };
    // The scheduler's frame cap and single dt clamp already govern this
    // phase — no second clock, no second frame cap.
    const scheduler = rt.scheduler;
    scheduler?.setPhase("domSync", ({ time, dt }) => {
      stepHearts(time);
      // Meshis are THINGS IN THE WORLD: they scale with the zoom exactly like
      // nodes do (same clamp), so their size relative to the mesh never
      // changes. Applied via a CSS variable so entrance/exit animations and
      // the model itself stay untouched.
      const meshiScale = Math.max(0.5, Math.min(rt.camera.zoom, 2.2));
      meshiRLive = 12 * meshiScale;
      // Ambient easing for your own idle Meshi ambling home…
      const k = 1 - Math.exp(-dt / 650);
      // Visitors GLIDE: a gentle ease plus a hard speed cap, so a Meshi
      // always floats to its updated spot — no teleports, and no darting
      // across the room that turns overstimulating with a crowd. Tuned for
      // the ~350ms movement broadcasts: tight enough to track live motion,
      // soft enough to stay smooth between frames.
      const kGlide = 1 - Math.exp(-dt / 300);
      // Screen-space speed cap (px/s), converted to world units per mode.
      const MAX_MESHI_SPEED = 680;
      const glide = (
        pos: { x: number; y: number },
        tx: number,
        ty: number,
        maxSpeed: number,
      ) => {
        let stepX = (tx - pos.x) * kGlide;
        let stepY = (ty - pos.y) * kGlide;
        const dist = Math.hypot(stepX, stepY);
        const maxStep = (maxSpeed * dt) / 1000;
        if (dist > maxStep && dist > 0) {
          stepX = (stepX / dist) * maxStep;
          stepY = (stepY / dist) * maxStep;
        }
        pos.x += stepX;
        pos.y += stepY;
      };
      const worldMaxSpeed = MAX_MESHI_SPEED / Math.max(rt.camera.zoom, 0.2);
      rt.presenceEls.forEach((el, userId) => {
        el.style.setProperty("--meshi-scale", meshiScale.toFixed(3));
        // Watching Meshis stand at the node they're reading. Eased in WORLD
        // space so camera pans are instant and only real moves glide.
        if (rt.presence.mode.get(userId) === "perch") {
          const nodeId = rt.presence.perchNode.get(userId);
          const node = nodeId ? rt.model?.nodes.get(nodeId) : null;
          const hb = nodeId ? rt.hitmap.circles.get(nodeId) : null;
          if (!node || !hb) {
            el.style.opacity = "0";
            return;
          }
          const tx = node.dx;
          const ty = node.dy - (hb.r + 8 + 12 * meshiScale) / Math.max(rt.camera.zoom, 0.2);
          const pos = rt.presence.perchWorldPos.get(userId) ?? { x: tx, y: ty };
          glide(pos, tx, ty, worldMaxSpeed);
          rt.presence.perchWorldPos.set(userId, pos);
          const s = project(pos.x, pos.y);
          rt.presence.perchPos.set(userId, { x: s.x, y: s.y });
          rt.presence.lastScreenPos.set(userId, { x: s.x, y: s.y });
          el.style.opacity = "1";
          el.style.left = `${s.x}px`;
          el.style.top = `${s.y}px`;
          return;
        }
        // Same-mesh visitors, anchored to the mesh itself when they've
        // broadcast a world position.
        const world = rt.presence.world.get(userId);
        if (world) {
          // First world fix hands off from wherever the Meshi was LAST DRAWN
          // (viewport-fallback included) — it travels there, never blinks.
          let pos = rt.presence.worldPos.get(userId);
          if (!pos) {
            const cEl2 = rt.containerEl;
            const cam2 = rt.camera;
            const lastDrawn = rt.presence.lastScreenPos.get(userId);
            pos =
              lastDrawn && cEl2
                ? unprojectPoint(cam2, cEl2.clientWidth, cEl2.clientHeight, lastDrawn.x, lastDrawn.y)
                : { ...world };
          }
          glide(pos, world.x, world.y, worldMaxSpeed);
          rt.presence.worldPos.set(userId, pos);
          const s = project(pos.x, pos.y);
          // Node-dodging eases too: only its OFFSET is smoothed, so camera
          // pans stay instant while the sidestep itself is a glide.
          const dodge = avoidNodes(s.x, s.y);
          const off = rt.presence.avoidOffset.get(userId) ?? { x: 0, y: 0 };
          glide(off, dodge.x - s.x, dodge.y - s.y, MAX_MESHI_SPEED);
          rt.presence.avoidOffset.set(userId, off);
          const clear = { x: s.x + off.x, y: s.y + off.y };
          rt.presence.lastScreenPos.set(userId, { x: clear.x, y: clear.y });
          el.style.opacity = "1";
          el.style.left = `${clear.x}px`;
          el.style.top = `${clear.y}px`;
          return;
        }
        const target = rt.presence.targets.get(userId);
        if (!target) return;
        el.style.opacity = "1";
        const pos = rt.presence.pos.get(userId) ?? { ...target };
        const cEl = rt.containerEl;
        const w = cEl?.clientWidth || 1200;
        // Viewport-fraction fallback: same glide, cap expressed in fractions.
        const fracPos = { x: pos.vx, y: pos.vy };
        glide(fracPos, target.vx, target.vy, MAX_MESHI_SPEED / w);
        pos.vx = fracPos.x;
        pos.vy = fracPos.y;
        rt.presence.pos.set(userId, pos);
        if (cEl) rt.presence.lastScreenPos.set(userId, { x: pos.vx * cEl.clientWidth, y: pos.vy * cEl.clientHeight });
        el.style.left = `${pos.vx * 100}%`;
        el.style.top = `${pos.vy * 100}%`;
      });

      // Your own Meshi ambles across the mesh toward the pointer, swerving
      // around nodes, and leans in (locally only) when you hover something.
      const cursorEl = rt.meshiCursorEl;
      // First frame after arriving at a mesh: seed the self Meshi at the
      // viewport centre and fade it in, so it's visible immediately instead of
      // parked invisibly at the top-left until the first pointer move. One-shot
      // (guarded on !seen) so the very next real move resumes cursor-following.
      // Placed BEFORE the coarse branch so the opacity reveal runs for touch
      // too (the coarse branch below re-affirms centre + seen harmlessly).
      if (cursorEl && !rt.cursorWorldTarget.seen) {
        const center = cameraCenterWorld(rt.camera);
        const t = rt.cursorWorldTarget;
        t.x = center.x;
        t.y = center.y;
        rt.cursorWorldPos.x = t.x;
        rt.cursorWorldPos.y = t.y;
        t.seen = true;
        cursorEl.style.opacity = "1";
      }
      if (rt.coarse) {
        const camCenter = cameraCenterWorld(rt.camera);
        const center = rt.cursorWorldTarget;
        center.x = camCenter.x;
        center.y = camCenter.y;
        center.seen = true;
        rt.cursorVp = { vx: 0.5, vy: 0.5 };
      }
      // ── Eye look-at: Meshis point their gaze (never their body) at what the
      // viewer is attending to. easeLook smooths the unit look-vector into the
      // --meshi-look-* custom properties MeshiMascot reads.
      const easeLook = (el: HTMLElement, key: string, from: Pt, target: Pt | null) => {
        const cur = rt.presence.look.get(key) ?? { x: 0, y: 0 };
        const want = target ? lookUnit(from.x, from.y, target) : { x: 0, y: 0 };
        if (want.x === 0 && want.y === 0 && Math.abs(cur.x) < 0.004 && Math.abs(cur.y) < 0.004) return;
        const kk = 1 - Math.exp(-dt / 130);
        const nx = cur.x + (want.x - cur.x) * kk;
        const ny = cur.y + (want.y - cur.y) * kk;
        rt.presence.look.set(key, { x: nx, y: ny });
        el.style.setProperty("--meshi-look-x", nx.toFixed(3));
        el.style.setProperty("--meshi-look-y", ny.toFixed(3));
      };
      // What YOUR Meshi looks at: the node you're pointing at, then the one you
      // opened, then the nearest Meshi in the room.
      const selfLookTarget = (fromX: number, fromY: number): Pt | null => {
        const hoverHb = rt.hoverId ? rt.hitmap.circles.get(rt.hoverId) : null;
        const openHb = !hoverHb && rt.selectedId ? rt.hitmap.circles.get(rt.selectedId) : null;
        const hb = hoverHb ?? openHb;
        if (hb) return { x: hb.x, y: hb.y };
        const others: Pt[] = [];
        rt.presence.lastScreenPos.forEach((q) => others.push(q));
        if (!isOwnMesh && rt.presence.ownerScreen) others.push(rt.presence.ownerScreen);
        return nearestWithin(fromX, fromY, others, 380);
      };

      if (cursorEl) cursorEl.style.setProperty("--meshi-scale", meshiScale.toFixed(3));
      if (cursorEl && rt.cursorWorldTarget.seen) {
        // Meshi IS your cursor: while the mouse is on the canvas it mirrors it
        // tightly (a whisper of trailing keeps it alive, never vague). Only
        // remote viewers see the casual drift, via heartbeat interpolation.
        const ck = 1 - Math.exp(-dt / 90);
        const p = rt.cursorWorldPos;
        const t = rt.cursorWorldTarget;
        p.x += (t.x - p.x) * ck;
        p.y += (t.y - p.y) * ck;
        const s = project(p.x, p.y);
        const clear = rt.coarse ? s : avoidNodes(s.x, s.y);
        // Lean into the direction of travel — pure body language, local-only.
        const prev = rt.presence.cursorPrev;
        const vpf = prev ? (clear.x - prev.x) / Math.max(dt, 1) : 0;
        rt.presence.cursorPrev = { x: clear.x, y: clear.y };
        rt.presence.selfScreen = { x: clear.x, y: clear.y };
        // Body only banks into the direction of travel; the gaze is the eyes.
        const travelLean = Math.max(-16, Math.min(16, vpf * 24));
        rt.presence.cursorRot += (travelLean - rt.presence.cursorRot) * (1 - Math.exp(-dt / 110));
        cursorEl.style.transform = `translate(${clear.x}px, ${clear.y}px) translate(-50%, -50%) rotate(${rt.presence.cursorRot.toFixed(2)}deg)`;
        easeLook(cursorEl, "__self__", clear, rt.reducedMotion ? null : selfLookTarget(clear.x, clear.y));
      }

      // The mesh owner's Meshi. On someone else's mesh it tracks the owner's
      // real broadcast position when they're here browsing, and eases home to
      // the heart (world origin) when they're away. On YOUR OWN mesh it follows
      // the cursor, while coarse pointers keep it centered as the world moves.
      const ownerEl = rt.ownerMeshiEl;
      const container = rt.containerEl;
      if (ownerEl && container) {
        ownerEl.style.setProperty("--meshi-scale", meshiScale.toFixed(3));
        const isMe = isOwnMesh;
        // On your own mesh your Meshi IS your cursor: it mirrors the mouse
        // while it's over the canvas, and only ambles home (casually) once
        // the mouse leaves or you go quiet.
        const pointerLive =
          rt.pointerOnCanvas || time - rt.lastInputAt < 4000;
        const active = isMe && rt.cursorWorldTarget.seen && pointerLive;
        const centered = rt.coarse && isMe;
        const selfDriven = active || centered;
        // When VISITING, follow the owner's real world position if they're here
        // browsing their own mesh; otherwise (away/offline) the Meshi eases home
        // to the heart. It glides between the two, so an owner arriving or
        // leaving the room slides in/out rather than snapping to center.
        const ownerHere = !isMe ? rt.presence.ownerHereWorld : null;
        const selfId = rt.model?.selfId;
        // When the owner is away, their Meshi rests/sleeps at home — but tucked
        // just BELOW their profile node, never on top of it. The drop is the
        // node's on-screen radius converted back to world units, so it clears the
        // node at any zoom and the Meshi eases there smoothly (no snap).
        const restingHome = !isMe && !ownerHere;
        let homeY = 0;
        if (restingHome) {
          const selfHb = selfId ? rt.hitmap.circles.get(selfId) : null;
          const clearPx = (selfHb?.r ?? 40) + 26 * meshiScale;
          homeY = clearPx / Math.max(rt.camera.zoom, 0.05);
        }
        const tx = selfDriven ? rt.cursorWorldTarget.x : ownerHere ? ownerHere.x : 0;
        const ty = selfDriven ? rt.cursorWorldTarget.y : ownerHere ? ownerHere.y : homeY;
        const ok = active && !rt.coarse ? 1 - Math.exp(-dt / 90) : k;
        const pos = rt.ownerWorldPos;
        pos.x += (tx - pos.x) * ok;
        pos.y += (ty - pos.y) * ok;
        const s = project(pos.x, pos.y);
        // Avoid nodes while wandering — but its own heart node is home, so
        // it's allowed to settle there. Touch users keep the owner Meshi
        // centered, so it must not be pushed aside by the focused node.
        let cx = s.x;
        let cy = rt.coarse ? s.y : s.y - 6;
        if (!rt.coarse && Math.hypot(pos.x, pos.y) > 30) {
          let px = s.x;
          let py = s.y;
          rt.hitmap.circles.forEach((hb, id) => {
            if (id === selfId) return;
            const minD = hb.r + 14 * meshiScale;
            const dx = px - hb.x;
            const dy = py - hb.y;
            const d = Math.hypot(dx, dy);
            if (d >= minD || d < 0.001) return;
            const f = (minD - d) / (d || 1);
            px += dx * f;
            py += dy * f;
          });
          cx = px;
          cy = rt.coarse ? py : py - 6;
        }
        ownerEl.style.left = `${cx}px`;
        ownerEl.style.top = `${cy}px`;
        rt.presence.ownerScreen = { x: cx, y: cy };
        // Local body language for YOUR OWN Meshi: grow toward hovered nodes,
        // pop on click, lean into travel. Visitors' views are untouched.
        if (isMe) {
          rt.presence.selfScreen = { x: cx, y: cy };
          const prevO = rt.presence.ownerPrev;
          const vpfO = prevO ? (cx - prevO.x) / Math.max(dt, 1) : 0;
          rt.presence.ownerPrev = { x: cx, y: cy };
          // Body banks into travel only; the eyes carry the gaze.
          const travelLeanO = Math.max(-16, Math.min(16, vpfO * 24));
          rt.presence.ownerRot += (travelLeanO - rt.presence.ownerRot) * (1 - Math.exp(-dt / 110));
          ownerEl.style.transform = `translate(-50%, -50%) rotate(${rt.presence.ownerRot.toFixed(2)}deg)`;
          easeLook(ownerEl, "__self__", { x: cx, y: cy }, rt.reducedMotion ? null : selfLookTarget(cx, cy));
        } else {
          // The host you're visiting watches whoever's in the room (eyes only).
          let target: Pt | null = null;
          if (!rt.reducedMotion && !rt.coarse) {
            const others: Pt[] = [];
            rt.presence.lastScreenPos.forEach((q) => others.push(q));
            if (rt.presence.selfScreen) others.push(rt.presence.selfScreen);
            target = nearestWithin(cx, cy, others, 420);
          }
          easeLook(ownerEl, "__owner__", { x: cx, y: cy }, target);
        }
      }
      // The visiting Meshis look (eyes only) at the node they're reading, and
      // otherwise at the nearest Meshi — a room that notices itself. The scan is
      // skipped on coarse/weak devices; existing gaze just eases back to center.
      {
        const lookActive = !rt.reducedMotion && !rt.coarse;
        rt.presenceEls.forEach((el, userId) => {
          const me = rt.presence.lastScreenPos.get(userId);
          if (!me) return;
          let target: Pt | null = null;
          if (lookActive) {
            const perchId = rt.presence.perchNode.get(userId);
            const hb = perchId ? rt.hitmap.circles.get(perchId) : null;
            if (hb) {
              target = { x: hb.x, y: hb.y };
            } else {
              const others: Pt[] = [];
              rt.presence.lastScreenPos.forEach((q, id) => {
                if (id !== userId) others.push(q);
              });
              if (rt.presence.selfScreen) others.push(rt.presence.selfScreen);
              if (rt.presence.ownerScreen) others.push(rt.presence.ownerScreen);
              target = nearestWithin(me.x, me.y, others, 420);
            }
          }
          easeLook(el, userId, me, target);
        });
      }
    });
    return () => rt.scheduler?.setPhase("domSync", null);
  }, [rtRef, viewUserId, viewMode, isOwnMesh]);
}
