"use client";

import { useRef, useEffect, useCallback } from "react";

interface MeshBackgroundProps {
  interactive?: boolean;
  density?: number;
  className?: string;
  mouseInfluence?: number;
}

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  pulsePhase: number;
  pulseSpeed: number;
}

export function MeshBackground({
  interactive = true,
  density = 80,
  className = "",
  mouseInfluence = 150,
}: MeshBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef(0);
  const activityRef = useRef(0);

  const initNodes = useCallback(
    (width: number, height: number) => {
      const count = Math.floor((width * height) / (10000 / (density / 80)));
      const nodes: Node[] = [];
      for (let i = 0; i < Math.min(count, 200); i++) {
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          radius: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.5 + 0.2,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: Math.random() * 0.02 + 0.005,
        });
      }
      nodesRef.current = nodes;
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
      initNodes(canvas.offsetWidth, canvas.offsetHeight);
    };

    resize();
    window.addEventListener("resize", resize);

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    if (interactive) {
      canvas.addEventListener("mousemove", handleMouse);
      canvas.addEventListener("mouseleave", handleMouseLeave);
    }

    // Listen for typing activity from MeshEntry
    const handleActivity = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.totalChars != null) {
        activityRef.current = Math.min(detail.totalChars, 40);
      }
    };
    window.addEventListener("mesh-activity", handleActivity);

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      timeRef.current += 1;

      ctx.clearRect(0, 0, w, h);

      const nodes = nodesRef.current;
      const mouse = mouseRef.current;
      // Connection distance grows as user types (mesh evolves)
      const activity = activityRef.current;
      const connectionDist = 120 + activity * 2;
      const mouseDist = mouseInfluence + activity * 1.5;

      // Update positions
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;

        // Wrap around edges
        if (node.x < 0) node.x = w;
        if (node.x > w) node.x = 0;
        if (node.y < 0) node.y = h;
        if (node.y > h) node.y = 0;

        // Mouse attraction
        if (interactive && mouse.x > 0) {
          const dx = mouse.x - node.x;
          const dy = mouse.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouseDist && dist > 10) {
            const force = (mouseDist - dist) / mouseDist * 0.008;
            node.vx += dx * force;
            node.vy += dy * force;
          }
        }

        // Damping
        node.vx *= 0.99;
        node.vy *= 0.99;

        // Speed limit
        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (speed > 1) {
          node.vx = (node.vx / speed) * 1;
          node.vy = (node.vy / speed) * 1;
        }
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDist) {
            const baseAlpha = 0.15 + activity * 0.004;
            const alpha = (1 - dist / connectionDist) * baseAlpha;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw mouse connections
      if (interactive && mouse.x > 0) {
        for (const node of nodes) {
          const dx = mouse.x - node.x;
          const dy = mouse.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouseDist) {
            const alpha = (1 - dist / mouseDist) * 0.3;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const pulse = Math.sin(timeRef.current * node.pulseSpeed + node.pulsePhase) * 0.3 + 0.7;
        const alpha = node.opacity * pulse;

        const glowSize = node.radius * (3 + activity * 0.05);

        // Glow
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59, 130, 246, ${alpha * (0.1 + activity * 0.003)})`;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + activity * 0.02, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(147, 197, 253, ${alpha})`;
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mesh-activity", handleActivity);
      canvas.removeEventListener("mousemove", handleMouse);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [interactive, density, mouseInfluence, initNodes]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full ${className}`}
      style={{ pointerEvents: interactive ? "auto" : "none" }}
    />
  );
}
