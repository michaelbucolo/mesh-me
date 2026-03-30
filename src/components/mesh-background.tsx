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
  // For center-attraction during typing
  attractionStrength: number;
  baseX: number;
  baseY: number;
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
  const fieldRef = useRef<string | null>(null);
  const burstRef = useRef(0);
  const meshiPosRef = useRef<{ x: number; y: number } | null>(null);

  const initNodes = useCallback(
    (width: number, height: number) => {
      const count = Math.floor((width * height) / (10000 / (density / 80)));
      const nodes: Node[] = [];
      for (let i = 0; i < Math.min(count, 200); i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        nodes.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          radius: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.5 + 0.2,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: Math.random() * 0.02 + 0.005,
          attractionStrength: Math.random() * 0.5 + 0.3,
          baseX: x,
          baseY: y,
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
      document.addEventListener("mousemove", handleMouse);
      document.addEventListener("mouseleave", handleMouseLeave);
    }

    // Listen for typing activity from MeshEntry
    const handleActivity = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.totalChars != null) {
        const prev = activityRef.current;
        activityRef.current = Math.min(detail.totalChars, 60);
        // Trigger burst on new character
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

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      timeRef.current += 1;

      ctx.clearRect(0, 0, w, h);

      const nodes = nodesRef.current;
      const mouse = mouseRef.current;
      const activity = activityRef.current;
      const isTyping = fieldRef.current !== null && activity > 0;
      const burst = burstRef.current;

      // Decay burst
      if (burstRef.current > 0) {
        burstRef.current *= 0.95;
        if (burstRef.current < 0.01) burstRef.current = 0;
      }

      // Target point: Meshi logo position if available, otherwise center
      const canvasRect = canvas.getBoundingClientRect();
      const meshi = meshiPosRef.current;
      const cx = meshi ? meshi.x - canvasRect.left : w / 2;
      const cy = meshi ? meshi.y - canvasRect.top : h / 2;

      // Connection distance grows as user types
      const connectionDist = 120 + activity * 3;
      const mouseDist = mouseInfluence + activity * 1.5;

      // How strongly nodes are attracted to center when typing
      const centerAttraction = isTyping ? Math.min(activity * 0.0004, 0.015) : 0;
      // Connection range to center grows with typing
      const centerConnectionRange = 200 + activity * 8;

      // Update positions
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;

        // Wrap around edges
        if (node.x < 0) node.x = w;
        if (node.x > w) node.x = 0;
        if (node.y < 0) node.y = h;
        if (node.y > h) node.y = 0;

        // Center attraction when typing (nodes connect to username like strings)
        if (centerAttraction > 0) {
          const dx = cx - node.x;
          const dy = cy - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 50) {
            const force = centerAttraction * node.attractionStrength;
            node.vx += dx / dist * force;
            node.vy += dy / dist * force;
          }
        }

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
        const maxSpeed = 1 + burst * 2;
        if (speed > maxSpeed) {
          node.vx = (node.vx / speed) * maxSpeed;
          node.vy = (node.vy / speed) * maxSpeed;
        }
      }

      // Draw node-to-node connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDist) {
            const baseAlpha = 0.15 + activity * 0.005;
            const alpha = (1 - dist / connectionDist) * baseAlpha;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = "rgba(59, 130, 246, " + alpha.toFixed(3) + ")";
            ctx.lineWidth = 0.5 + burst * 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw center connections (strings connecting to the username/input)
      if (isTyping) {
        for (const node of nodes) {
          const dx = cx - node.x;
          const dy = cy - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < centerConnectionRange) {
            const alpha = (1 - dist / centerConnectionRange) * (0.1 + activity * 0.006);
            // Draw a slightly curved line to center for organic feel
            const midX = (node.x + cx) / 2 + Math.sin(timeRef.current * 0.02 + node.pulsePhase) * 15;
            const midY = (node.y + cy) / 2 + Math.cos(timeRef.current * 0.02 + node.pulsePhase) * 15;

            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.quadraticCurveTo(midX, midY, cx, cy);
            ctx.strokeStyle = "rgba(96, 165, 250, " + alpha.toFixed(3) + ")";
            ctx.lineWidth = 0.6 + burst * 0.8;
            ctx.stroke();
          }
        }

        // Draw Meshi glow ring (pulsing circle around Meshi)
        if (meshi) {
          const ringRadius = 24 + activity * 0.5 + Math.sin(timeRef.current * 0.03) * 3;
          const ringAlpha = 0.12 + activity * 0.004 + burst * 0.15;
          ctx.beginPath();
          ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(96, 165, 250, " + ringAlpha.toFixed(3) + ")";
          ctx.lineWidth = 1.5 + burst * 1.5;
          ctx.stroke();
        }

        // Draw center glow (around Meshi / input area)
        const glowRadius = 60 + activity * 2 + burst * 30;
        const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
        glowGrad.addColorStop(0, "rgba(59, 130, 246, " + (0.08 + activity * 0.003 + burst * 0.1).toFixed(3) + ")");
        glowGrad.addColorStop(1, "rgba(59, 130, 246, 0)");
        ctx.beginPath();
        ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();
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
            ctx.strokeStyle = "rgba(59, 130, 246, " + alpha.toFixed(3) + ")";
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const pulse = Math.sin(timeRef.current * node.pulseSpeed + node.pulsePhase) * 0.3 + 0.7;
        const alpha = node.opacity * pulse;

        const glowSize = node.radius * (3 + activity * 0.06 + burst * 2);

        // Glow
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(59, 130, 246, " + (alpha * (0.1 + activity * 0.004 + burst * 0.08)).toFixed(3) + ")";
        ctx.fill();

        // Core
        const coreRadius = node.radius + activity * 0.025 + burst * 0.5;
        ctx.beginPath();
        ctx.arc(node.x, node.y, coreRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(147, 197, 253, " + alpha.toFixed(3) + ")";
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mesh-activity", handleActivity);
      document.removeEventListener("mousemove", handleMouse);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [interactive, density, mouseInfluence, initNodes]);

  return (
    <canvas
      ref={canvasRef}
      className={"absolute inset-0 w-full h-full " + className}
      style={{ pointerEvents: "none" }}
    />
  );
}
