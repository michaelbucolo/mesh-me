"use client";

import { useRef, useEffect, useCallback } from "react";

interface MeshBackgroundProps {
  interactive?: boolean;
  density?: number;
  className?: string;
  mouseInfluence?: number;
  fixed?: boolean;
}

interface Star {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  twinklePhase: number;
  twinkleSpeed: number;
  driftPhase: number;
  depth: number;
  edgeWeight: number;
}

const MAX_STARS = 180;
const MAX_DEVICE_PIXEL_RATIO = 1.5;
const CONSTELLATION_DIST = 132;
const CONSTELLATION_DIST_SQ = CONSTELLATION_DIST * CONSTELLATION_DIST;
const MOUSE_GLOW_RADIUS = 190;
const MOUSE_GLOW_RADIUS_SQ = MOUSE_GLOW_RADIUS * MOUSE_GLOW_RADIUS;

function edgePosition(width: number, height: number) {
  const band = Math.max(34, Math.min(width, height) * 0.18);
  const edge = Math.floor(Math.random() * 4);
  if (edge === 0) return { x: Math.random() * width, y: Math.random() * band };
  if (edge === 1) return { x: width - Math.random() * band, y: Math.random() * height };
  if (edge === 2) return { x: Math.random() * width, y: height - Math.random() * band };
  return { x: Math.random() * band, y: Math.random() * height };
}

export function MeshBackground({
  interactive = true,
  density = 80,
  className = "",
  mouseInfluence = 1,
  fixed = false,
}: MeshBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const reducedMotionRef = useRef(false);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef(0);
  const activityRef = useRef(0);
  const fieldRef = useRef<string | null>(null);
  const burstRef = useRef(0);
  const meshiPosRef = useRef<{ x: number; y: number } | null>(null);
  const convergeRef = useRef(0);
  const canvasRectRef = useRef<DOMRect | null>(null);
  const positionsRef = useRef<{ x: number; y: number }[]>([]);
  const timeMsRef = useRef(0);
  const frameSkipRef = useRef(0);
  const frameCountRef = useRef(0);
  const lastFpsSampleTsRef = useRef(0);

  const initStars = useCallback(
    (width: number, height: number) => {
      const safeDensity = Math.max(12, density);
      const count = Math.floor((width * height) / (10000 / (safeDensity / 80)));
      const stars: Star[] = [];
      for (let i = 0; i < Math.min(count, MAX_STARS); i++) {
        const edgeWeight = Math.random() < 0.58 ? Math.random() * 0.45 + 0.55 : Math.random() * 0.22;
        const position = edgeWeight > 0.5 ? edgePosition(width, height) : { x: Math.random() * width, y: Math.random() * height };
        stars.push({
          x: position.x,
          y: position.y,
          radius: Math.random() * 1.2 + 0.45 + edgeWeight * 0.25,
          opacity: Math.random() * 0.42 + 0.18 + edgeWeight * 0.08,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: Math.random() * 0.012 + 0.003,
          driftPhase: Math.random() * Math.PI * 2,
          depth: Math.random() * 0.75 + 0.25,
          edgeWeight,
        });
      }
      starsRef.current = stars;
      positionsRef.current = new Array(stars.length).fill(null).map(() => ({ x: 0, y: 0 }));
    },
    [density]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvasRectRef.current = canvas.getBoundingClientRect();
      initStars(canvas.offsetWidth, canvas.offsetHeight);
    };

    resize();
    window.addEventListener("resize", resize);
    // Scrolling only changes where the canvas sits in the viewport — refresh the
    // cached rect used for pointer mapping, but never re-run the full resize
    // (which reseeds every star via Math.random and teleports the constellation).
    const onScroll = () => {
      canvasRectRef.current = canvas.getBoundingClientRect();
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateReducedMotion = () => {
      reducedMotionRef.current = reducedMotionQuery.matches;
    };
    updateReducedMotion();
    reducedMotionQuery.addEventListener("change", updateReducedMotion);

    // Track mouse for glow effect (nodes stay in place, just glow brighter)
    const handleMouse = (e: MouseEvent) => {
      const rect = canvasRectRef.current ?? canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };
    if (interactive) {
      document.addEventListener("mousemove", handleMouse);
      document.addEventListener("mouseleave", handleMouseLeave);
    }

    // Listen for typing activity from MeshEntry
    const handleActivity = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.totalChars != null) {
        const prev = activityRef.current;
        activityRef.current = Math.min(detail.totalChars, 60);
        if (detail.totalChars > prev) {
          burstRef.current = 1.0;
        }
      }
      if (detail?.field != null) {
        fieldRef.current = detail.field;
      }
      if (detail?.meshiPos != null) {
        meshiPosRef.current = detail.meshiPos;
      }
    };
    window.addEventListener("mesh-activity", handleActivity);

    // Listen for login success — all stars converge on Meshi
    const handleConverge = () => {
      convergeRef.current = 0.001;
    };
    window.addEventListener("mesh-converge", handleConverge);

    const draw = (now: number) => {
      if (document.hidden) {
        animFrameRef.current = 0;
        return;
      }

      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (!w || !h) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const lastTime = timeRef.current || now;
      const delta = Math.max(8, Math.min(40, now - lastTime));
      timeRef.current = now;
      timeMsRef.current += delta;
      frameCountRef.current += 1;

      if (lastFpsSampleTsRef.current === 0) {
        lastFpsSampleTsRef.current = now;
      } else if (now - lastFpsSampleTsRef.current >= 1000) {
        const fps = (frameCountRef.current * 1000) / (now - lastFpsSampleTsRef.current);
        frameSkipRef.current = fps < 105 ? 1 : 0;
        frameCountRef.current = 0;
        lastFpsSampleTsRef.current = now;
      }

      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const reducedMotion = reducedMotionRef.current;
      const pointerStrength = interactive ? Math.max(0, Math.min(mouseInfluence, 1.4)) : 0;

      const stars = starsRef.current;
      const mouse = mouseRef.current;
      const activity = activityRef.current;
      const isTyping = fieldRef.current !== null && activity > 0;
      const burst = burstRef.current;
      const breath = reducedMotion ? 0.65 : Math.sin(timeMsRef.current * 0.00022) * 0.18 + 0.72;

      const fieldGlow = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.max(w, h) * 0.76);
      fieldGlow.addColorStop(0, "rgba(147, 197, 253, " + (0.018 * breath).toFixed(3) + ")");
      fieldGlow.addColorStop(0.46, "rgba(14, 165, 233, " + (0.012 * breath).toFixed(3) + ")");
      fieldGlow.addColorStop(1, "rgba(2, 6, 23, 0)");
      ctx.fillStyle = fieldGlow;
      ctx.fillRect(0, 0, w, h);

      const edgeVeil = ctx.createLinearGradient(0, 0, w, h);
      edgeVeil.addColorStop(0, "rgba(191, 219, 254, 0.018)");
      edgeVeil.addColorStop(0.5, "rgba(96, 165, 250, 0)");
      edgeVeil.addColorStop(1, "rgba(125, 211, 252, 0.016)");
      ctx.fillStyle = edgeVeil;
      ctx.fillRect(0, 0, w, h);
      // Decay burst
      if (burstRef.current > 0) {
        burstRef.current *= 0.95;
        if (burstRef.current < 0.01) burstRef.current = 0;
      }

      // Converge animation progress
      let converge = convergeRef.current;
      if (converge > 0 && converge < 1) {
        converge = Math.min(converge + 0.008, 1);
        convergeRef.current = converge;
      }

      // Meshi target position
      const canvasRect = canvasRectRef.current ?? canvas.getBoundingClientRect();
      const meshi = meshiPosRef.current;
      const mx = meshi ? meshi.x - canvasRect.left : w / 2;
      const my = meshi ? meshi.y - canvasRect.top : h / 2;
      // String range to Meshi grows with typing
      const stringRange = 250 + activity * 6;
      const stringRangeSq = stringRange * stringRange;

      // Compute display positions (static, or converging to Meshi on login)
      const positions = positionsRef.current;
      for (let idx = 0; idx < stars.length; idx++) {
        const star = stars[idx];
        if (converge > 0) {
          const ease = converge * converge * (3 - 2 * converge);
          positions[idx].x = star.x + (mx - star.x) * ease;
          positions[idx].y = star.y + (my - star.y) * ease;
        } else {
          const drift = reducedMotion ? 0 : Math.sin(timeMsRef.current * 0.00016 + star.driftPhase) * star.depth * 1.8;
          positions[idx].x = star.x + drift;
          positions[idx].y = star.y + Math.cos(timeMsRef.current * 0.00014 + star.driftPhase) * star.depth * 1.2;
        }
      }

      // --- Draw constellation lines between nearby stars using a grid ---
      const cellSize = CONSTELLATION_DIST;
      const grid = new Map<string, number[]>();
      for (let i = 0; i < positions.length; i++) {
        const gx = (positions[i].x / cellSize) | 0;
        const gy = (positions[i].y / cellSize) | 0;
        const key = `${gx},${gy}`;
        const bucket = grid.get(key);
        if (bucket) {
          bucket.push(i);
        } else {
          grid.set(key, [i]);
        }
      }

      for (const [key, bucket] of grid.entries()) {
        const [gx, gy] = key.split(",").map(Number);
        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            const neighborKey = `${gx + ox},${gy + oy}`;
            const other = grid.get(neighborKey);
            if (!other) continue;
            for (let bi = 0; bi < bucket.length; bi++) {
              const i = bucket[bi];
              for (let bj = 0; bj < other.length; bj++) {
                const j = other[bj];
                if (j <= i) continue;
                const dx = positions[i].x - positions[j].x;
                const dy = positions[i].y - positions[j].y;
                const distSq = dx * dx + dy * dy;
                if (distSq > CONSTELLATION_DIST_SQ) continue;
                const dist = Math.sqrt(distSq);
                const edgeBlend = Math.max(stars[i].edgeWeight, stars[j].edgeWeight);
                let alpha = (1 - dist / CONSTELLATION_DIST) * (0.07 + edgeBlend * 0.055);

                // Glow brighter near mouse
                if (mouse.x > 0) {
                  const midX = (positions[i].x + positions[j].x) / 2;
                  const midY = (positions[i].y + positions[j].y) / 2;
                  const mouseDx = mouse.x - midX;
                  const mouseDy = mouse.y - midY;
                  const mouseDistSq = mouseDx * mouseDx + mouseDy * mouseDy;
                  if (mouseDistSq < MOUSE_GLOW_RADIUS_SQ) {
                    const mouseDist = Math.sqrt(mouseDistSq);
                    alpha += (1 - mouseDist / MOUSE_GLOW_RADIUS) * 0.16 * pointerStrength;
                  }
                }

                // Fade during converge
                if (converge > 0.3) {
                  alpha *= Math.max(0, 1 - (converge - 0.3) / 0.4);
                }
                if (alpha < 0.012) continue;

                const lineGradient = ctx.createLinearGradient(positions[i].x, positions[i].y, positions[j].x, positions[j].y);
                lineGradient.addColorStop(0, "rgba(219, 234, 254, " + Math.min(alpha * 0.9, 0.22).toFixed(3) + ")");
                lineGradient.addColorStop(0.5, "rgba(96, 165, 250, " + Math.min(alpha * 1.35, 0.34).toFixed(3) + ")");
                lineGradient.addColorStop(1, "rgba(186, 230, 253, " + Math.min(alpha, 0.24).toFixed(3) + ")");

                ctx.beginPath();
                ctx.moveTo(positions[i].x, positions[i].y);
                ctx.lineTo(positions[j].x, positions[j].y);
                ctx.strokeStyle = lineGradient;
                ctx.lineWidth = 0.32 + edgeBlend * 0.22;
                ctx.stroke();

                if (!reducedMotion && alpha > 0.045 && (i + j) % 19 === 0) {
                  const trace = (Math.sin(timeMsRef.current * 0.00062 + i * 0.7 + j * 0.33) + 1) / 2;
                  const traceX = positions[i].x + (positions[j].x - positions[i].x) * trace;
                  const traceY = positions[i].y + (positions[j].y - positions[i].y) * trace;
                  ctx.beginPath();
                  ctx.arc(traceX, traceY, 0.75 + edgeBlend * 0.35, 0, Math.PI * 2);
                  ctx.fillStyle = "rgba(240, 249, 255, " + Math.min(alpha * 1.8, 0.38).toFixed(3) + ")";
                  ctx.fill();
                }
              }
            }
          }
        }
      }

      // --- Draw strings from stars to Meshi when typing ---
      if (isTyping && converge === 0) {
        for (let i = 0; i < stars.length; i++) {
          const pos = positions[i];
          const dx = mx - pos.x;
          const dy = my - pos.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < stringRangeSq) {
            const dist = Math.sqrt(distSq);
            const proximity = 1 - dist / stringRange;
            let alpha = proximity * (0.06 + activity * 0.004) + burst * 0.04;

            // Glow brighter near mouse
            if (mouse.x > 0) {
              const mouseDx = mouse.x - pos.x;
              const mouseDy = mouse.y - pos.y;
                const mouseDistSq = mouseDx * mouseDx + mouseDy * mouseDy;
                if (mouseDistSq < MOUSE_GLOW_RADIUS_SQ) {
                  const mouseDist = Math.sqrt(mouseDistSq);
                  alpha += (1 - mouseDist / MOUSE_GLOW_RADIUS) * 0.1 * pointerStrength;
                }
              }

            // Gentle curve for organic string feel
            const midX = (pos.x + mx) / 2 + Math.sin(timeMsRef.current * 0.00072 + stars[i].twinklePhase) * 10;
            const midY = (pos.y + my) / 2 + Math.cos(timeMsRef.current * 0.00072 + stars[i].twinklePhase) * 10;

            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.quadraticCurveTo(midX, midY, mx, my);
            const stringGradient = ctx.createLinearGradient(pos.x, pos.y, mx, my);
            stringGradient.addColorStop(0, "rgba(191, 219, 254, " + Math.min(alpha, 0.26).toFixed(3) + ")");
            stringGradient.addColorStop(0.66, "rgba(96, 165, 250, " + Math.min(alpha * 1.45, 0.42).toFixed(3) + ")");
            stringGradient.addColorStop(1, "rgba(255, 255, 255, " + Math.min(alpha * 1.2, 0.34).toFixed(3) + ")");
            ctx.strokeStyle = stringGradient;
            ctx.lineWidth = 0.42 + burst * 0.35;
            ctx.stroke();
          }
        }

        // Subtle glow around Meshi
        const glowRadius = 40 + activity * 1.2 + burst * 12;
        const glowGrad = ctx.createRadialGradient(mx, my, 0, mx, my, glowRadius);
        glowGrad.addColorStop(0, "rgba(59, 130, 246, " + (0.05 + activity * 0.002 + burst * 0.06).toFixed(3) + ")");
        glowGrad.addColorStop(1, "rgba(59, 130, 246, 0)");
        ctx.beginPath();
        ctx.arc(mx, my, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();
      }

      // --- Converge: draw strings from all stars to Meshi ---
      if (converge > 0 && converge < 0.8) {
        const stringAlpha = Math.min(converge * 2, 0.25) * (1 - converge / 0.8);
        for (let i = 0; i < stars.length; i++) {
          const pos = positions[i];
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y);
          ctx.lineTo(mx, my);
          ctx.strokeStyle = "rgba(96, 165, 250, " + stringAlpha.toFixed(3) + ")";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      // --- Converge flash at completion ---
      if (converge > 0.85 && converge < 1) {
        const t = (converge - 0.85) / 0.15;
        const flashAlpha = t * 0.4;
        const flashRadius = 80 + t * 200;
        const flashGrad = ctx.createRadialGradient(mx, my, 0, mx, my, flashRadius);
        flashGrad.addColorStop(0, "rgba(147, 197, 253, " + flashAlpha.toFixed(3) + ")");
        flashGrad.addColorStop(0.5, "rgba(59, 130, 246, " + (flashAlpha * 0.5).toFixed(3) + ")");
        flashGrad.addColorStop(1, "rgba(59, 130, 246, 0)");
        ctx.beginPath();
        ctx.arc(mx, my, flashRadius, 0, Math.PI * 2);
        ctx.fillStyle = flashGrad;
        ctx.fill();
      }

      // --- Draw stars (twinkling in place, constellation-like) ---
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        const pos = positions[i];

        // Twinkle shimmer
        const twinkle = Math.sin(timeMsRef.current * star.twinkleSpeed * 0.06 + star.twinklePhase) * 0.35 + 0.65;
        let alpha = star.opacity * twinkle;

        // Glow brighter near mouse
        if (mouse.x > 0) {
          const mouseDx = mouse.x - pos.x;
          const mouseDy = mouse.y - pos.y;
          const mouseDistSq = mouseDx * mouseDx + mouseDy * mouseDy;
          if (mouseDistSq < MOUSE_GLOW_RADIUS_SQ) {
            const mouseDist = Math.sqrt(mouseDistSq);
            const boost = (1 - mouseDist / MOUSE_GLOW_RADIUS) * 0.5 * pointerStrength;
            alpha = Math.min(alpha + boost, 1);
          }
        }

        // Fade at end of converge
        if (converge > 0.7) {
          alpha *= Math.max(0, 1 - (converge - 0.7) / 0.3);
        }

        // Glow halo
        const glowSize = star.radius * (2.7 + Math.sin(timeMsRef.current * 0.00048 + star.twinklePhase * 2) * 0.4 + star.edgeWeight * 0.9);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(96, 165, 250, " + (alpha * (0.07 + star.edgeWeight * 0.035)).toFixed(3) + ")";
        ctx.fill();

        // Core star dot
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(180, 210, 255, " + alpha.toFixed(3) + ")";
        ctx.fill();
      }

      if (frameSkipRef.current === 1) {
        frameSkipRef.current = 2;
      } else if (frameSkipRef.current === 2) {
        frameSkipRef.current = 1;
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }
      animFrameRef.current = requestAnimationFrame(draw);
    };

    const handleVisibility = () => {
      if (!document.hidden && !animFrameRef.current) {
        animFrameRef.current = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mesh-activity", handleActivity);
      window.removeEventListener("mesh-converge", handleConverge);
      reducedMotionQuery.removeEventListener("change", updateReducedMotion);
      document.removeEventListener("mousemove", handleMouse);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("visibilitychange", handleVisibility);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [density, initStars, interactive, mouseInfluence]);

  return (
    <canvas
      ref={canvasRef}
      className={"mesh-field-canvas absolute inset-0 h-full w-full " + className}
      style={{ pointerEvents: "none", position: fixed ? "fixed" : undefined }}
    />
  );
}
