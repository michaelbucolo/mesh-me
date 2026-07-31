"use client";

import { useEffect, useRef, type RefObject } from "react";

export type EntryStage = "identity" | "password" | "signup" | "reset";
type EntryPhase = "idle" | "forming" | "success" | "failed";

/**
 * Shared, mutable state the constellation reads every animation frame. The
 * parent mutates this ref directly (on keystroke, stage change, etc.) so the
 * canvas animates smoothly without triggering a single React re-render.
 */
export type ConstellationState = {
  energy: number; // 0..1, bumped on keystroke, decays over time
  stage: EntryStage;
  phase: EntryPhase;
  sparks?: number; // monotonic keystroke counter; each bump flings a caret spark
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
  par: number; // parallax reach (px) — two depth layers offset opposite the pointer
  depth: number; // 0 far, 1 near
};

// A spark born at the caret that races outward to a perimeter node.
type Spark = { idx: number; t: number };

// The constellation is drawn from the APP'S OWN theme, resolved live at mount
// (user report: the entry's colors didn't match the rest of the site — this
// table used to be a private periwinkle/violet/cyan triple that existed
// nowhere else). Calm strands are the page's ink; energy warms them toward
// the one accent. The values below are only the SSR/no-DOM fallback.
const COLORS = {
  strand: [235, 235, 245], // calm: ink (resolved from --text-primary)
  strandHot: [10, 132, 255], // warming: the accent (resolved from --accent)
  strandAurora: [10, 132, 255], // hot: the same accent, brighter by alpha
  node: [174, 174, 178], // resolved from --text-secondary
  success: [10, 132, 255], // success is the accent doing its job
  core: [235, 235, 245], // star cores: ink, not hardcoded white
};

function resolveThemeColor(varName: string, fallback: number[]): number[] {
  if (typeof document === "undefined") return fallback;
  const probe = document.createElement("span");
  probe.style.color = `var(${varName})`;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const m = getComputedStyle(probe).color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  probe.remove();
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : fallback;
}

function resolveThemeColors(): void {
  COLORS.strand = resolveThemeColor("--text-primary", COLORS.strand);
  COLORS.core = COLORS.strand;
  COLORS.node = resolveThemeColor("--text-secondary", COLORS.node);
  const accent = resolveThemeColor("--accent", COLORS.strandHot);
  COLORS.strandHot = accent;
  COLORS.strandAurora = accent;
  COLORS.success = accent;
}

function rgba(c: number[], a: number) {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

function mixColor(c1: number[], c2: number[], t: number) {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return [c1[0] + (c2[0] - c1[0]) * u, c1[1] + (c2[1] - c1[1]) * u, c1[2] + (c2[2] - c1[2]) * u];
}

// Hot strands interpolate blue → periwinkle → cyan as energy rises.
function strandColor(heat: number) {
  const u = heat < 0 ? 0 : heat > 1 ? 1 : heat;
  return u < 0.5
    ? mixColor(COLORS.strand, COLORS.strandHot, u / 0.5)
    : mixColor(COLORS.strandHot, COLORS.strandAurora, (u - 0.5) / 0.5);
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
    resolveThemeColors();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let edges: Array<[number, number, number]> = []; // [i, j, baseAlpha]
    let sparks: Spark[] = [];
    let lastSparkCount = 0;
    // Normalized pointer offset [-1..1]; nodes parallax a few px opposite it.
    let pointerX = 0;
    let pointerY = 0;
    let raf = 0;
    let running = true;

    const onPointer = (event: PointerEvent) => {
      const cr = canvas.getBoundingClientRect();
      if (cr.width <= 0 || cr.height <= 0) return;
      pointerX = ((event.clientX - cr.left) / cr.width - 0.5) * 2;
      pointerY = ((event.clientY - cr.top) / cr.height - 0.5) * 2;
    };
    // Skip pointer tracking under reduced motion so the static frame never redraws.
    if (!reducedMotion) window.addEventListener("pointermove", onPointer, { passive: true });

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
      sparks = [];
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
        // Two subtle depth layers: near nodes parallax more, far nodes less.
        const depth = Math.random() < 0.5 ? 1 : 0;
        nodes.push({
          bx: x,
          by: y,
          amp: reducedMotion ? 0 : 3 + Math.random() * 7,
          speed: 0.0003 + Math.random() * 0.0006,
          phase: Math.random() * Math.PI * 2,
          r: 0.8 + Math.random() * 1.8,
          x,
          y,
          par: reducedMotion ? 0 : depth === 1 ? 6 : 2.6,
          depth,
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

      // Update node positions (gentle drift + parallax opposite the pointer).
      for (const n of nodes) {
        let wx = 0;
        let wy = 0;
        if (n.amp > 0) {
          wx = Math.sin(time * n.speed + n.phase) * n.amp;
          wy = Math.cos(time * n.speed * 0.9 + n.phase) * n.amp;
        }
        n.x = n.bx + wx - pointerX * n.par;
        n.y = n.by + wy - pointerY * n.par;
      }

      // Each keystroke bumps `sparks`: fling one from the caret out to a nearby
      // perimeter node so the anchor visibly "throws" light along a reach-strand.
      const sparkCount = s.sparks ?? 0;
      if (sparkCount > lastSparkCount) {
        const toSpawn = Math.min(sparkCount - lastSparkCount, 3);
        for (let k = 0; k < toSpawn; k += 1) {
          const near = nodes
            .map((n, i) => ({ i, d: (n.x - ax) * (n.x - ax) + (n.y - ay) * (n.y - ay) }))
            .sort((p, q) => p.d - q.d)
            .slice(0, 6);
          if (near.length) sparks.push({ idx: near[Math.floor(Math.random() * near.length)].i, t: 0 });
        }
        lastSparkCount = sparkCount;
        if (sparks.length > 14) sparks = sparks.slice(sparks.length - 14);
      }

      // Perimeter web.
      const webBase = 0.05 + energy * 0.10;
      const hot = success ? 1 : energy;
      for (const [i, j, w] of edges) {
        const a = webBase * (0.4 + w * 0.9);
        const col = success ? COLORS.success : strandColor(hot);
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
        const reachCol = success ? COLORS.success : strandColor(converge ? 0.5 : energy);
        for (const { idx } of near) {
          const n = nodes[idx];
          const a = converge ? 0.5 : reachStrength * 0.55;
          ctx.strokeStyle = rgba(reachCol, a);
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

      // Caret sparks racing anchor → node along the reach curve.
      if (sparks.length > 0) {
        for (const sp of sparks) sp.t += 0.055;
        sparks = sparks.filter((sp) => sp.t < 1 && sp.idx < nodes.length);
        for (const sp of sparks) {
          const n = nodes[sp.idx];
          const t = sp.t;
          // Same quadratic path as the reach strand (P0 = anchor, P1 = node).
          const cpx = (n.x + ax) / 2 + (n.y - ay) * 0.06;
          const cpy = (n.y + ay) / 2 + (ax - n.x) * 0.06;
          const it = 1 - t;
          const sx = it * it * ax + 2 * it * t * cpx + t * t * n.x;
          const sy = it * it * ay + 2 * it * t * cpy + t * t * n.y;
          const fade = Math.sin(Math.PI * t); // rise then settle at the node
          const rad = (3.1 + fade * 2.1) * 2.2;
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
          g.addColorStop(0, rgba(COLORS.core, 0.9 * fade));
          g.addColorStop(0.4, rgba(COLORS.strandAurora, 0.8 * fade));
          g.addColorStop(1, rgba(COLORS.strandAurora, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(sx, sy, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Nodes.
      for (const n of nodes) {
        const glow = (0.35 + energy * 0.4 + (success ? 0.5 : 0)) * (n.depth === 1 ? 1.12 : 0.9);
        const core = success ? COLORS.success : mixColor(COLORS.node, COLORS.strandAurora, energy * 0.5);
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4);
        g.addColorStop(0, rgba(core, glow));
        g.addColorStop(1, rgba(COLORS.node, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgba(COLORS.core, 0.55 + energy * 0.35);
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
      if (!reducedMotion) window.removeEventListener("pointermove", onPointer);
    };
  }, [state, anchorRef, reducedMotion]);

  return <canvas ref={canvasRef} className="mesh-gate-canvas" aria-hidden="true" />;
}
