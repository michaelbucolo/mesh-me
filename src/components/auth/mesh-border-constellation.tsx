"use client";

import { useEffect, useRef, type RefObject } from "react";

export type EntryStage = "identity" | "password" | "signup" | "reset";
export type EntryPhase = "idle" | "forming" | "success" | "failed";

/**
 * Shared, mutable state the constellation reads every animation frame. The
 * parent mutates this ref directly (on keystroke, stage change, etc.) so the
 * canvas animates smoothly without triggering a single React re-render.
 */
export type ConstellationState = {
  energy: number; // 0..1, bumped on keystroke, decays over time
  stage: EntryStage;
  phase: EntryPhase;
};

type Node = {
  bx: number;
  by: number;
  amp: number;
  speed: number;
  phase: number;
  r: number;
  x: number;
  y: number;
};

const COLORS = {
  strand: [130, 150, 255],
  strandHot: [168, 120, 250],
  node: [200, 214, 255],
  success: [236, 130, 200],
};

function rgba(c: number[], a: number) {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

/**
 * A luminous mesh that lives on the perimeter of the screen and reacts to the
 * person signing in: strands breathe, brighten as they type, and reach inward
 * toward the field; on success the whole web pulls together into their mesh.
 * Canvas + rAF only — no per-frame React work.
 */
export function MeshBorderConstellation({
  state,
  anchorRef,
  reducedMotion,
}: {
  state: RefObject<ConstellationState>;
  anchorRef: RefObject<HTMLElement | null>;
  reducedMotion: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let edges: Array<[number, number, number]> = []; // [i, j, baseAlpha]
    let raf = 0;
    let running = true;

    // Distribute nodes with a strong bias toward the border band, leaving the
    // center (where the form sits) sparse and open.
    const build = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const area = width * height;
      const count = Math.max(46, Math.min(96, Math.round(area / 20000)));
      const cx = width / 2;
      const cy = height / 2;
      // Keep-clear ellipse around the centered card.
      const clearRx = Math.min(width * 0.34, 320);
      const clearRy = Math.min(height * 0.34, 300);

      nodes = [];
      let guard = 0;
      while (nodes.length < count && guard < count * 40) {
        guard += 1;
        // Bias toward edges: bx/by pushed outward via a power curve.
        const ex = Math.random();
        const ey = Math.random();
        const px = Math.pow(Math.abs(ex - 0.5) * 2, 0.6) * (ex < 0.5 ? -0.5 : 0.5) + 0.5;
        const py = Math.pow(Math.abs(ey - 0.5) * 2, 0.6) * (ey < 0.5 ? -0.5 : 0.5) + 0.5;
        const x = px * width;
        const y = py * height;
        // Reject anything inside the central keep-clear ellipse.
        const nx = (x - cx) / clearRx;
        const ny = (y - cy) / clearRy;
        if (nx * nx + ny * ny < 1) continue;
        nodes.push({
          bx: x,
          by: y,
          amp: reducedMotion ? 0 : 3 + Math.random() * 7,
          speed: 0.0003 + Math.random() * 0.0006,
          phase: Math.random() * Math.PI * 2,
          r: 0.8 + Math.random() * 1.8,
          x,
          y,
        });
      }

      // Precompute edges between near neighbours (drift is small, so the web
      // stays valid without recomputing each frame).
      edges = [];
      const threshold = Math.min(width, height) * 0.22;
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const dx = nodes[i].bx - nodes[j].bx;
          const dy = nodes[i].by - nodes[j].by;
          const d = Math.hypot(dx, dy);
          if (d < threshold) {
            edges.push([i, j, 1 - d / threshold]);
          }
        }
      }
    };

    build();
    const ro = new ResizeObserver(() => build());
    ro.observe(canvas);

    const draw = (time: number) => {
      if (!running) return;
      const s = state.current || { energy: 0, stage: "identity" as EntryStage, phase: "idle" as EntryPhase };
      // Ease displayed energy down each frame; the parent bumps it on keystroke.
      s.energy = Math.max(0, s.energy - 0.012);
      const energy = Math.min(1, s.energy);
      const success = s.phase === "success";
      // "forming" = the field is morphing into Meshi: the whole perimeter reels
      // its strands inward toward the anchor, but in the live blue/violet tone
      // rather than the pink success bloom.
      const forming = s.phase === "forming";
      const converge = success || forming;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      const cx = width / 2;
      const cy = height / 2;

      // Anchor (the field) the strands reach toward.
      let ax = cx;
      let ay = cy;
      const anchor = anchorRef.current;
      if (anchor) {
        const r = anchor.getBoundingClientRect();
        const cr = canvas.getBoundingClientRect();
        ax = r.left + r.width / 2 - cr.left;
        ay = r.top + r.height / 2 - cr.top;
      }

      // Update node positions (gentle drift).
      for (const n of nodes) {
        if (n.amp > 0) {
          n.x = n.bx + Math.sin(time * n.speed + n.phase) * n.amp;
          n.y = n.by + Math.cos(time * n.speed * 0.9 + n.phase) * n.amp;
        }
      }

      // Perimeter web.
      const webBase = 0.05 + energy * 0.10;
      const hot = success ? 1 : energy;
      for (const [i, j, w] of edges) {
        const a = webBase * (0.4 + w * 0.9);
        const col = success
          ? COLORS.success
          : hot > 0.4
            ? COLORS.strandHot
            : COLORS.strand;
        ctx.strokeStyle = rgba(col, a * (success ? 2.4 : 1));
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }

      // Reach strands: the nearest perimeter nodes send a live thread toward the
      // field, intensifying as the person types (energy) — or, on success,
      // converging to form the mesh.
      const reachStrength = converge ? 1 : energy;
      if (reachStrength > 0.02) {
        // Sort a shallow copy by distance to anchor, take the closest few.
        const near = nodes
          .map((n, idx) => ({ idx, d: Math.hypot(n.x - ax, n.y - ay) }))
          .sort((p, q) => p.d - q.d)
          .slice(0, converge ? nodes.length : 10);
        const dash = (time * 0.06) % 24;
        for (const { idx } of near) {
          const n = nodes[idx];
          const a = converge ? 0.5 : reachStrength * 0.55;
          ctx.strokeStyle = rgba(success ? COLORS.success : COLORS.strandHot, a);
          ctx.lineWidth = converge ? 1.4 : 1.1;
          ctx.setLineDash(converge ? [] : [3, 6]);
          ctx.lineDashOffset = -dash;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          // Curve slightly toward the anchor for an organic pull.
          const mx = (n.x + ax) / 2 + (n.y - ay) * 0.06;
          const my = (n.y + ay) / 2 + (ax - n.x) * 0.06;
          ctx.quadraticCurveTo(mx, my, ax, ay);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // Nodes.
      for (const n of nodes) {
        const glow = 0.35 + energy * 0.4 + (success ? 0.5 : 0);
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4);
        g.addColorStop(0, rgba(success ? COLORS.success : COLORS.node, glow));
        g.addColorStop(1, rgba(COLORS.node, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgba([255, 255, 255], 0.55 + energy * 0.35);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";

      if (reducedMotion && !success) return; // single static frame when calm
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [state, anchorRef, reducedMotion]);

  return <canvas ref={canvasRef} className="mesh-gate-canvas" aria-hidden="true" />;
}
