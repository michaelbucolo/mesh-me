"use client";

import { useRef, useEffect, useCallback } from "react";

interface MeshBackgroundProps {
  interactive?: boolean;
  density?: number;
  className?: string;
  mouseInfluence?: number;
}

interface Star {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  twinklePhase: number;
  twinkleSpeed: number;
}

export function MeshBackground({
  density = 80,
  className = "",
}: MeshBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef(0);
  const activityRef = useRef(0);
  const fieldRef = useRef<string | null>(null);
  const burstRef = useRef(0);
  const meshiPosRef = useRef<{ x: number; y: number } | null>(null);
  const convergeRef = useRef(0);

  const initStars = useCallback(
    (width: number, height: number) => {
      const count = Math.floor((width * height) / (10000 / (density / 80)));
      const stars: Star[] = [];
      for (let i = 0; i < Math.min(count, 200); i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.5 + 0.15,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: Math.random() * 0.015 + 0.004,
        });
      }
      starsRef.current = stars;
    },
    [density]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
      initStars(canvas.offsetWidth, canvas.offsetHeight);
    };

    resize();
    window.addEventListener("resize", resize);

    // Track mouse for glow effect (nodes stay in place, just glow brighter)
    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };
    document.addEventListener("mousemove", handleMouse);
    document.addEventListener("mouseleave", handleMouseLeave);

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

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      timeRef.current += 1;

      ctx.clearRect(0, 0, w, h);

      const stars = starsRef.current;
      const mouse = mouseRef.current;
      const activity = activityRef.current;
      const isTyping = fieldRef.current !== null && activity > 0;
      const burst = burstRef.current;
      const mouseGlowRadius = 180;

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
      const canvasRect = canvas.getBoundingClientRect();
      const meshi = meshiPosRef.current;
      const mx = meshi ? meshi.x - canvasRect.left : w / 2;
      const my = meshi ? meshi.y - canvasRect.top : h / 2;

      // Constellation line distance
      const constellationDist = 120;
      // String range to Meshi grows with typing
      const stringRange = 250 + activity * 6;

      // Compute display positions (static, or converging to Meshi on login)
      const positions: { x: number; y: number }[] = [];
      for (const star of stars) {
        if (converge > 0) {
          const ease = converge * converge * (3 - 2 * converge);
          positions.push({
            x: star.x + (mx - star.x) * ease,
            y: star.y + (my - star.y) * ease,
          });
        } else {
          positions.push({ x: star.x, y: star.y });
        }
      }

      // --- Draw constellation lines between nearby stars ---
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = positions[i].x - positions[j].x;
          const dy = positions[i].y - positions[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < constellationDist) {
            let alpha = (1 - dist / constellationDist) * 0.1;

            // Glow brighter near mouse
            if (mouse.x > 0) {
              const midX = (positions[i].x + positions[j].x) / 2;
              const midY = (positions[i].y + positions[j].y) / 2;
              const mouseDist = Math.sqrt((mouse.x - midX) ** 2 + (mouse.y - midY) ** 2);
              if (mouseDist < mouseGlowRadius) {
                alpha += (1 - mouseDist / mouseGlowRadius) * 0.15;
              }
            }

            // Fade during converge
            if (converge > 0.3) {
              alpha *= Math.max(0, 1 - (converge - 0.3) / 0.4);
            }

            ctx.beginPath();
            ctx.moveTo(positions[i].x, positions[i].y);
            ctx.lineTo(positions[j].x, positions[j].y);
            ctx.strokeStyle = "rgba(59, 130, 246, " + Math.min(alpha, 0.35).toFixed(3) + ")";
            ctx.lineWidth = 0.4;
            ctx.stroke();
          }
        }
      }

      // --- Draw strings from stars to Meshi when typing ---
      if (isTyping && converge === 0) {
        for (let i = 0; i < stars.length; i++) {
          const pos = positions[i];
          const dx = mx - pos.x;
          const dy = my - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < stringRange) {
            const proximity = 1 - dist / stringRange;
            let alpha = proximity * (0.06 + activity * 0.004) + burst * 0.04;

            // Glow brighter near mouse
            if (mouse.x > 0) {
              const mouseDist = Math.sqrt((mouse.x - pos.x) ** 2 + (mouse.y - pos.y) ** 2);
              if (mouseDist < mouseGlowRadius) {
                alpha += (1 - mouseDist / mouseGlowRadius) * 0.1;
              }
            }

            // Gentle curve for organic string feel
            const midX = (pos.x + mx) / 2 + Math.sin(timeRef.current * 0.012 + stars[i].twinklePhase) * 10;
            const midY = (pos.y + my) / 2 + Math.cos(timeRef.current * 0.012 + stars[i].twinklePhase) * 10;

            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.quadraticCurveTo(midX, midY, mx, my);
            ctx.strokeStyle = "rgba(96, 165, 250, " + Math.min(alpha, 0.35).toFixed(3) + ")";
            ctx.lineWidth = 0.5 + burst * 0.3;
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
        const twinkle = Math.sin(timeRef.current * star.twinkleSpeed + star.twinklePhase) * 0.35 + 0.65;
        let alpha = star.opacity * twinkle;

        // Glow brighter near mouse
        if (mouse.x > 0) {
          const mouseDist = Math.sqrt((mouse.x - pos.x) ** 2 + (mouse.y - pos.y) ** 2);
          if (mouseDist < mouseGlowRadius) {
            const boost = (1 - mouseDist / mouseGlowRadius) * 0.5;
            alpha = Math.min(alpha + boost, 1);
          }
        }

        // Fade at end of converge
        if (converge > 0.7) {
          alpha *= Math.max(0, 1 - (converge - 0.7) / 0.3);
        }

        // Glow halo
        const glowSize = star.radius * (2.5 + Math.sin(timeRef.current * 0.008 + star.twinklePhase * 2) * 0.4);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(59, 130, 246, " + (alpha * 0.07).toFixed(3) + ")";
        ctx.fill();

        // Core star dot
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(180, 210, 255, " + alpha.toFixed(3) + ")";
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mesh-activity", handleActivity);
      window.removeEventListener("mesh-converge", handleConverge);
      document.removeEventListener("mousemove", handleMouse);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [density, initStars]);

  return (
    <canvas
      ref={canvasRef}
      className={"absolute inset-0 w-full h-full " + className}
      style={{ pointerEvents: "none" }}
    />
  );
}
