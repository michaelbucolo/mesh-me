"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// ── The mesh weaving itself into being ────────────────────────────
//
// A self-forming constellation that mirrors the real (canvas) scene, so the
// loader dissolves seamlessly into the mesh it precedes: nodes stream in from
// the dark, strands snap between neighbours with a spark racing along each as
// it links, and once whole the web breathes while stray signals pulse across
// it. The exact scene palette (background gradient, nebula blobs, starfield,
// strand blues) is reused so there is no visual seam at hand-off.
//
// It draws nothing that depends on the user's data — it is pure motion — and
// the real scene simply unmounts it mid-weave when it is ready.

const UNIT = 0.46; // constellation radius as a fraction of min(w, h) / 2
const NODE_COUNT = 18;
const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // phyllotaxis angle → organic spread
const STAGGER = 1.7; // seconds over which nodes stream in
const NODE_GROW = 0.9; // seconds for one node to settle
const LINK_GROW = 0.5; // seconds for one strand to draw out

const STRANDS = ["#8aa1ff", "#93c5fd", "#a5b4fc"];
const NODE_COLORS = ["#8aa1ff", "#60a5fa", "#7dd3fc", "#a78bfa", "#c7d2fe"];
const NEBULA = [
  { hue: "#3b62c9", ax: 0.26, ay: 0.3, rad: 0.62, sp: 0.00007, a: 0.12 },
  { hue: "#7c3aed", ax: 0.76, ay: 0.32, rad: 0.54, sp: -0.00005, a: 0.1 },
  { hue: "#d6438f", ax: 0.6, ay: 0.8, rad: 0.62, sp: 0.00006, a: 0.07 },
];

function seededRng(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

function withAlpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

interface Node {
  ax: number; // resting position, normalized about centre (unit = min(w,h)/2)
  ay: number;
  sx: number; // streamed-in-from position
  sy: number;
  r: number; // base radius (px at unit scale 1)
  color: string;
  appearAt: number;
  floatPhase: number;
  floatAmp: number;
}

interface Link {
  a: number;
  b: number;
  formAt: number;
  color: string;
}

function buildConstellation() {
  const rand = seededRng(20260718);
  const nodes: Node[] = [];

  // Central "you" anchor.
  nodes.push({
    ax: 0,
    ay: 0,
    sx: (rand() - 0.5) * 0.1,
    sy: (rand() - 0.5) * 0.1,
    r: 5.4,
    color: "#dbe4ff",
    appearAt: 0,
    floatPhase: rand() * 6.28,
    floatAmp: 0.006,
  });

  // Phyllotaxis spread — even yet organic, densest at the core.
  for (let i = 1; i < NODE_COUNT; i++) {
    const frac = i / NODE_COUNT;
    const rad = Math.sqrt(frac) * UNIT;
    const ang = i * GOLDEN + (rand() - 0.5) * 0.5;
    const ax = Math.cos(ang) * rad;
    const ay = Math.sin(ang) * rad;
    // Streams in from further out along the same ray, with a little scatter.
    const outward = 1.7 + rand() * 0.8;
    nodes.push({
      ax,
      ay,
      sx: ax * outward + (rand() - 0.5) * 0.3,
      sy: ay * outward + (rand() - 0.5) * 0.3,
      r: 3.6 - frac * 1.7 + rand() * 0.5,
      color: NODE_COLORS[Math.floor(rand() * NODE_COLORS.length)],
      appearAt: 0.15 + Math.pow(frac, 0.85) * STAGGER + rand() * 0.12,
      floatPhase: rand() * 6.28,
      floatAmp: 0.008 + rand() * 0.01,
    });
  }

  // Link each node to its 1–2 nearest neighbours (deduped) → an organic web.
  const links: Link[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    const dists = nodes
      .map((n, j) => ({ j, d: Math.hypot(n.ax - nodes[i].ax, n.ay - nodes[i].ay) }))
      .filter((x) => x.j !== i)
      .sort((a, b) => a.d - b.d);
    const wanted = i === 0 ? 4 : 2; // the core fans out to several
    for (let k = 0; k < wanted && k < dists.length; k++) {
      const j = dists[k].j;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({
        a: i,
        b: j,
        formAt: Math.max(nodes[i].appearAt, nodes[j].appearAt) + 0.12,
        color: STRANDS[links.length % STRANDS.length],
      });
    }
  }

  const formationEnd = Math.max(...links.map((l) => l.formAt + LINK_GROW), STAGGER + NODE_GROW);
  return { nodes, links, formationEnd };
}

interface MeshFormingLoaderProps {
  /** Caption under the weave. Pass an empty string to hide it. */
  label?: string;
  /** Backdrop mode: transparent, no caption, no rounded shell — sits behind other content. */
  backdrop?: boolean;
  className?: string;
}

export function MeshFormingLoader({
  label = "Forming your mesh…",
  backdrop = false,
  className,
}: MeshFormingLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { nodes, links, formationEnd } = buildConstellation();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let stars: { x: number; y: number; r: number; tw: number }[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rand = seededRng(1337);
      const count = Math.min(150, Math.round((width * height) / 11000));
      stars = Array.from({ length: count }, () => ({
        x: rand() * width,
        y: rand() * height,
        r: rand() * 1.1 + 0.2,
        tw: rand() * 6.28,
      }));
    };
    resize();

    // Signals that periodically race across the settled web.
    const pulses: { link: number; t: number }[] = [];
    let nextPulse = formationEnd + 0.6;

    const nodePos = (n: Node, unit: number, cx: number, cy: number, local: number, time: number) => {
      const e = easeOutCubic(local);
      let nx = n.sx + (n.ax - n.sx) * e;
      let ny = n.sy + (n.ay - n.sy) * e;
      if (!reduce && local >= 1) {
        // Gentle breathing drift once settled.
        nx += Math.sin(time * 0.9 + n.floatPhase) * n.floatAmp;
        ny += Math.cos(time * 0.75 + n.floatPhase) * n.floatAmp;
      }
      return { x: cx + nx * unit, y: cy + ny * unit, e };
    };

    const draw = (time: number) => {
      const t = reduce ? formationEnd + 2 : time;
      const cx = width / 2;
      const cy = height / 2;
      const unit = Math.min(width, height) / 2;

      // ── Background: the scene's own gradient (or transparent for backdrop) ──
      ctx.clearRect(0, 0, width, height);
      if (!backdrop) {
        const bg = ctx.createRadialGradient(cx, cy * 0.82, unit * 0.1, cx, cy, Math.max(width, height) * 0.75);
        bg.addColorStop(0, "#0c1226");
        bg.addColorStop(0.55, "#070a16");
        bg.addColorStop(1, "#030409");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);
      }

      // Nebula blobs, drifting.
      ctx.globalCompositeOperation = "lighter";
      for (const b of NEBULA) {
        const bx = (b.ax + Math.sin(t * b.sp * 1000) * 0.02) * width;
        const by = (b.ay + Math.cos(t * b.sp * 1000) * 0.02) * height;
        const br = b.rad * Math.max(width, height);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, withAlpha(b.hue, b.a));
        g.addColorStop(1, withAlpha(b.hue, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.globalCompositeOperation = "source-over";

      // Starfield twinkle.
      for (const s of stars) {
        const tw = reduce ? 0.6 : 0.5 + 0.5 * Math.sin(t * 1.6 + s.tw);
        ctx.fillStyle = withAlpha("#aab4e8", 0.22 * tw);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 6.283);
        ctx.fill();
      }

      // ── Strands ──
      ctx.lineCap = "round";
      for (const l of links) {
        const grow = clamp01((t - l.formAt) / LINK_GROW);
        if (grow <= 0) continue;
        const na = nodes[l.a];
        const nb = nodes[l.b];
        const la = clamp01((t - na.appearAt) / NODE_GROW);
        const lb = clamp01((t - nb.appearAt) / NODE_GROW);
        const pa = nodePos(na, unit, cx, cy, la, t);
        const pb = nodePos(nb, unit, cx, cy, lb, t);
        const hx = pa.x + (pb.x - pa.x) * grow;
        const hy = pa.y + (pb.y - pa.y) * grow;
        const shimmer = reduce ? 1 : 0.8 + 0.2 * Math.sin(t * 1.3 + l.formAt * 4);
        ctx.strokeStyle = withAlpha(l.color, (0.1 + 0.28 * grow) * shimmer);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        // Bright spark at the drawing tip.
        if (grow < 1 && !reduce) {
          ctx.fillStyle = withAlpha("#ffffff", 0.9 * (1 - grow) + 0.2);
          ctx.beginPath();
          ctx.arc(hx, hy, 1.5, 0, 6.283);
          ctx.fill();
        }
      }

      // ── Signal pulses along formed strands ──
      if (!reduce) {
        if (t >= nextPulse) {
          pulses.push({ link: Math.floor(seededRng(Math.floor(t * 1000))() * links.length), t });
          nextPulse = t + 0.9 + seededRng(Math.floor(t * 331))() * 1.4;
        }
        for (let i = pulses.length - 1; i >= 0; i--) {
          const p = pulses[i];
          const prog = (t - p.t) / 0.7;
          if (prog >= 1) {
            pulses.splice(i, 1);
            continue;
          }
          const l = links[p.link];
          if (!l) continue;
          const na = nodes[l.a];
          const nb = nodes[l.b];
          const pa = nodePos(na, unit, cx, cy, 1, t);
          const pb = nodePos(nb, unit, cx, cy, 1, t);
          const x = pa.x + (pb.x - pa.x) * prog;
          const y = pa.y + (pb.y - pa.y) * prog;
          const glow = ctx.createRadialGradient(x, y, 0, x, y, 6);
          glow.addColorStop(0, withAlpha("#e0ecff", 0.9 * (1 - prog)));
          glow.addColorStop(1, withAlpha("#e0ecff", 0));
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, 6.283);
          ctx.fill();
        }
      }

      // ── Nodes ──
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const local = clamp01((t - n.appearAt) / NODE_GROW);
        if (local <= 0) continue;
        const p = nodePos(n, unit, cx, cy, local, t);
        const isCore = i === 0;
        const pulse = reduce ? 1 : isCore ? 0.85 + 0.15 * Math.sin(t * 1.8) : 1;
        const r = n.r * (0.5 + 0.5 * p.e) * pulse;

        // Soft glow halo.
        const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4.5);
        halo.addColorStop(0, withAlpha(n.color, 0.5 * p.e));
        halo.addColorStop(1, withAlpha(n.color, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 4.5, 0, 6.283);
        ctx.fill();

        // Core dot.
        ctx.fillStyle = withAlpha(n.color, 0.55 + 0.45 * p.e);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, 6.283);
        ctx.fill();
        // White heart.
        ctx.fillStyle = withAlpha("#ffffff", (isCore ? 0.95 : 0.7) * p.e);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.42, 0, 6.283);
        ctx.fill();

        // Settle ring.
        if (p.e > 0.85) {
          ctx.strokeStyle = withAlpha(n.color, 0.35 * (p.e - 0.85) * 6.6);
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 3, 0, 6.283);
          ctx.stroke();
        }
      }

      // Vignette to seat the web in the dark.
      if (!backdrop) {
        const vig = ctx.createRadialGradient(cx, cy, unit * 0.5, cx, cy, Math.max(width, height) * 0.72);
        vig.addColorStop(0, "rgba(3,4,9,0)");
        vig.addColorStop(1, "rgba(3,4,9,0.55)");
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, width, height);
      }
    };

    let raf = 0;
    let startedAt = 0;
    const loop = (now: number) => {
      if (!startedAt) startedAt = now;
      draw((now - startedAt) / 1000);
      raf = requestAnimationFrame(loop);
    };

    // Observe size after draw() exists; resize() wipes the backing store, so in
    // reduced-motion mode (no RAF) we must repaint the static frame each resize.
    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) draw(formationEnd + 2);
    });
    ro.observe(canvas);

    if (reduce) {
      draw(formationEnd + 2);
    } else {
      raf = requestAnimationFrame(loop);
    }

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else if (!reduce && !raf) {
        startedAt = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [backdrop]);

  if (backdrop) {
    return (
      <canvas
        ref={canvasRef}
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative flex min-h-[calc(100dvh-8rem)] w-full items-end justify-center overflow-hidden rounded-[28px] border border-[#17345d] bg-[#050b18]",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      {label ? (
        <div className="relative z-10 mb-[15vh] flex flex-col items-center gap-2 px-6 text-center">
          <p className="mesh-forming-caption text-sm font-medium ">{label}</p>
          <span className="flex gap-1" aria-hidden>
            <span className="mesh-forming-dot h-1.5 w-1.5 rounded-full bg-[#8aa1ff]" />
            <span className="mesh-forming-dot h-1.5 w-1.5 rounded-full bg-[#8aa1ff]" style={{ animationDelay: "0.18s" }} />
            <span className="mesh-forming-dot h-1.5 w-1.5 rounded-full bg-[#8aa1ff]" style={{ animationDelay: "0.36s" }} />
          </span>
        </div>
      ) : (
        <span className="sr-only">Forming your mesh</span>
      )}
    </div>
  );
}
