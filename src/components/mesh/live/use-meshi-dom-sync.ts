// useMeshiDomSync — the scheduler's domSync phase, and THE projection edge
// for the Meshi layer: every sprite's logic runs in WORLD coordinates (the
// meshi-machine's one rule); this pass projects each Meshi to the screen
// exactly once per frame via core/camera and writes styles imperatively.
// Runs the same frame, AFTER physics and paint, so it reads THIS frame's
// hitmap and camera. The only screen-space state is cosmetic: the node-dodge
// offset, gaze vectors, and body-bank rotations.

"use client";

import { useEffect } from "react";
import { playSound } from "@/lib/sound";
import { playFunSound } from "../audio/sound-kit";
import { cameraCenterWorld, projectPoint } from "../core/camera";
import { reactionGlyphSvg } from "../scene/reaction-glyphs";
import type { MeshRuntimeRef } from "../scene/runtime";
import {
  deriveOwnerMode,
  glideStep,
  lookUnit,
  MAX_MESHI_SPEED_PX_S,
  stepLean,
  stepLook,
  stepSpriteToward,
} from "./meshi-machine";

type Pt = { x: number; y: number };

// Runs on a per-frame hot path, so the nearest search ranks by squared
// distance and takes one sqrt for the winner (inside lookUnit).
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
    // A Meshi looks at things with its EYES, never by tilting: ease the gaze
    // vector and write the custom properties MeshiMascot reads.
    const applyLook = (el: HTMLElement, look: Pt, from: Pt, target: Pt | null, dt: number) => {
      const want = target ? lookUnit(from.x, from.y, target) : { x: 0, y: 0 };
      if (!stepLook(look, want.x, want.y, dt)) return;
      el.style.setProperty("--meshi-look-x", look.x.toFixed(3));
      el.style.setProperty("--meshi-look-y", look.y.toFixed(3));
    };

    // Hearts in flight: each rises out of a Meshi, arcs across the world, and
    // pops on the post it was thrown at — nudging the count up as it lands
    // (real likes only; cosmetic fun-verb hearts land without counting).
    const stepHearts = (now: number) => {
      const host = rt.heartsEl;
      if (!host) return;
      rt.strandPulses.forEach((start, key) => {
        if (now - start > 1400) rt.strandPulses.delete(key);
      });
      // Strum stamps double as re-strum cooldowns — collect them once both
      // the shimmer (620ms) and the cooldown (550ms) are safely spent.
      rt.strandStrums.forEach((start, key) => {
        if (now - start > 900) rt.strandStrums.delete(key);
      });
      // Reaction trails: drop each once its lingering tail has faded.
      for (let i = rt.trails.length - 1; i >= 0; i -= 1) {
        if (now - rt.trails[i].born > rt.trails[i].dur * 1.2 + 60) rt.trails.splice(i, 1);
      }
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
          if (h.cosmetic) {
            // A fun-verb heart (flick / wheel / incoming fling): the landing
            // keeps its full flourish, but NO like was written, so the
            // displayed Likes tick and the strand pulse stay untouched —
            // play never mutates data. Its tick is a fun sound: opt-in only.
            playFunSound("land");
          } else {
            const meta = target.meta?.find((m) => m.label === "Likes");
            if (meta) {
              const n = parseInt(meta.value, 10);
              if (Number.isFinite(n)) meta.value = String(n + 1);
            }
            // The interaction rides the strand home to the maker.
            if (target.parentId) rt.strandPulses.set(`${target.parentId}>${target.id}`, now);
            playSound("land");
          }
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
      // changes. Applied via a CSS variable.
      const meshiScale = Math.max(0.5, Math.min(rt.camera.zoom, 2.2));
      meshiRLive = 12 * meshiScale;
      // The one glide: ease + hard speed cap (px/s on screen, converted to
      // world units), so a Meshi always floats to its updated spot — no
      // teleports, no darting. Per-frame step caps in each space:
      const maxScreenStep = (MAX_MESHI_SPEED_PX_S * dt) / 1000;
      const maxWorldStep = maxScreenStep / Math.max(rt.camera.zoom, 0.2);
      // Ambient easing for the owner Meshi ambling home.
      const k = 1 - Math.exp(-dt / 650);

      // ── Remote sprites: world glide + one projection each ──────────────
      // This frame's drawn positions, collected for the gaze passes below.
      const spritesScreen: { id: string; x: number; y: number }[] = [];
      rt.presenceEls.forEach((el, userId) => {
        const sprite = rt.presence.sprites.get(userId);
        if (!sprite) {
          el.style.opacity = "0";
          return;
        }
        el.style.setProperty("--meshi-scale", meshiScale.toFixed(3));
        // Where does this Meshi want to be, in world units?
        let tx: number;
        let ty: number;
        if (sprite.mode === "perch") {
          // Watching Meshis stand at the node they're reading — the perch
          // target derives from the node's LIVE position, eased in world
          // space so camera pans are instant and only real moves glide.
          const node = rt.model?.nodes.get(sprite.perchNodeId);
          const hb = rt.hitmap.circles.get(sprite.perchNodeId);
          if (!node || !hb) {
            el.style.opacity = "0";
            return;
          }
          tx = node.dx;
          ty = node.dy - (hb.r + 8 + 12 * meshiScale) / Math.max(rt.camera.zoom, 0.2);
        } else {
          tx = sprite.target.x;
          ty = sprite.target.y;
        }
        const pos = stepSpriteToward(sprite, tx, ty, dt, maxWorldStep);
        const s = project(pos.x, pos.y);
        // Node-dodging is a cosmetic SCREEN offset eased separately, so
        // camera pans stay instant while the sidestep itself is a glide.
        // Perched Meshis stand at their node — any leftover dodge eases away.
        const dodge = sprite.mode === "roam" ? avoidNodes(s.x, s.y) : s;
        glideStep(sprite.avoid, dodge.x - s.x, dodge.y - s.y, dt, maxScreenStep);
        const x = s.x + sprite.avoid.x;
        const y = s.y + sprite.avoid.y;
        el.style.opacity = "1";
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        spritesScreen.push({ id: userId, x, y });
      });

      // ── Your own cursor Meshi ──────────────────────────────────────────
      const cursorEl = rt.meshiCursorEl;
      // First frame after arriving at a mesh: seed the self Meshi at the
      // viewport centre and fade it in, so it's visible immediately instead
      // of parked invisibly at the top-left until the first pointer move.
      // One-shot (guarded on !seen) so the very next real move resumes
      // cursor-following. Placed BEFORE the coarse branch so the opacity
      // reveal runs for touch too.
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
      // What YOUR Meshi looks at: the node you're pointing at, then the one
      // you opened, then the nearest Meshi in the room.
      const selfLookTarget = (fromX: number, fromY: number): Pt | null => {
        const hoverHb = rt.hoverId ? rt.hitmap.circles.get(rt.hoverId) : null;
        const openHb = !hoverHb && rt.selectedId ? rt.hitmap.circles.get(rt.selectedId) : null;
        const hb = hoverHb ?? openHb;
        if (hb) return { x: hb.x, y: hb.y };
        const others: Pt[] = [...spritesScreen];
        if (!isOwnMesh && rt.presence.ownerScreen) others.push(rt.presence.ownerScreen);
        return nearestWithin(fromX, fromY, others, 380);
      };

      if (cursorEl) cursorEl.style.setProperty("--meshi-scale", meshiScale.toFixed(3));
      if (cursorEl && rt.cursorWorldTarget.seen) {
        // Meshi IS your cursor: while the mouse is on the canvas it mirrors
        // it tightly (a whisper of trailing keeps it alive, never vague).
        // Only remote viewers see the casual drift, via heartbeat interp.
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
        rt.presence.cursorRot = stepLean(rt.presence.cursorRot, vpf, dt);
        cursorEl.style.transform = `translate(${clear.x}px, ${clear.y}px) translate(-50%, -50%) rotate(${rt.presence.cursorRot.toFixed(2)}deg)`;
        applyLook(cursorEl, rt.presence.selfLook, clear, rt.reducedMotion ? null : selfLookTarget(clear.x, clear.y), dt);
      }

      // ── The mesh owner's Meshi ─────────────────────────────────────────
      // Behaviour states (live/meshi-machine): "cursor"/"centered" on your
      // own mesh, "tracking" the owner's live broadcast when visiting while
      // they're here, "resting" (asleep below their node, Zzz) when away.
      const ownerEl = rt.ownerMeshiEl;
      const container = rt.containerEl;
      if (ownerEl && container) {
        ownerEl.style.setProperty("--meshi-scale", meshiScale.toFixed(3));
        const ownerHere = !isOwnMesh ? rt.presence.ownerHereWorld : null;
        const mode = deriveOwnerMode({
          isOwnMesh,
          coarse: rt.coarse,
          cursorSeen: rt.cursorWorldTarget.seen,
          pointerLive: rt.pointerOnCanvas || time - rt.lastInputAt < 4000,
          ownerHere: !!ownerHere,
        });
        const selfId = rt.model?.selfId;
        // When the owner is away, their Meshi rests/sleeps at home — tucked
        // just BELOW their profile node, never on top of it. The drop is the
        // node's on-screen radius converted back to world units, so it
        // clears the node at any zoom and the Meshi eases there smoothly.
        let homeY = 0;
        if (!isOwnMesh && mode === "resting") {
          const selfHb = selfId ? rt.hitmap.circles.get(selfId) : null;
          const clearPx = (selfHb?.r ?? 40) + 26 * meshiScale;
          homeY = clearPx / Math.max(rt.camera.zoom, 0.05);
        }
        const selfDriven = mode === "cursor" || mode === "centered";
        const tx = selfDriven ? rt.cursorWorldTarget.x : ownerHere ? ownerHere.x : 0;
        const ty = selfDriven ? rt.cursorWorldTarget.y : ownerHere ? ownerHere.y : homeY;
        const ok = mode === "cursor" ? 1 - Math.exp(-dt / 90) : k;
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
        // Local body language for YOUR OWN Meshi: pop and lean into travel.
        // Visitors' views are untouched.
        if (isOwnMesh) {
          rt.presence.selfScreen = { x: cx, y: cy };
          const prevO = rt.presence.ownerPrev;
          const vpfO = prevO ? (cx - prevO.x) / Math.max(dt, 1) : 0;
          rt.presence.ownerPrev = { x: cx, y: cy };
          rt.presence.ownerRot = stepLean(rt.presence.ownerRot, vpfO, dt);
          ownerEl.style.transform = `translate(-50%, -50%) rotate(${rt.presence.ownerRot.toFixed(2)}deg)`;
          applyLook(ownerEl, rt.presence.selfLook, { x: cx, y: cy }, rt.reducedMotion ? null : selfLookTarget(cx, cy), dt);
        } else {
          // The host you're visiting watches whoever's in the room (eyes only).
          let target: Pt | null = null;
          if (!rt.reducedMotion && !rt.coarse) {
            const others: Pt[] = [...spritesScreen];
            if (rt.presence.selfScreen) others.push(rt.presence.selfScreen);
            target = nearestWithin(cx, cy, others, 420);
          }
          applyLook(ownerEl, rt.presence.ownerLook, { x: cx, y: cy }, target, dt);
        }
      }

      // ── Remote gaze: a room that notices itself ────────────────────────
      // Visiting Meshis look (eyes only) at the node they're reading, and
      // otherwise at the nearest Meshi. The scan is skipped on coarse/weak
      // devices; existing gaze just eases back to center.
      {
        const lookActive = !rt.reducedMotion && !rt.coarse;
        for (const sp of spritesScreen) {
          const el = rt.presenceEls.get(sp.id);
          const sprite = rt.presence.sprites.get(sp.id);
          if (!el || !sprite) continue;
          let target: Pt | null = null;
          if (lookActive) {
            if (sprite.mode === "perch") {
              const hb = rt.hitmap.circles.get(sprite.perchNodeId);
              if (hb) target = { x: hb.x, y: hb.y };
            }
            if (!target) {
              const others: Pt[] = [];
              for (const o of spritesScreen) {
                if (o.id !== sp.id) others.push(o);
              }
              if (rt.presence.selfScreen) others.push(rt.presence.selfScreen);
              if (rt.presence.ownerScreen) others.push(rt.presence.ownerScreen);
              target = nearestWithin(sp.x, sp.y, others, 420);
            }
          }
          applyLook(el, sprite.look, sp, target, dt);
        }
      }
    });
    return () => rt.scheduler?.setPhase("domSync", null);
  }, [rtRef, viewUserId, viewMode, isOwnMesh]);
}
