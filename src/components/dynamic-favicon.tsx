"use client";

import { useEffect } from "react";

/**
 * DynamicFavicon — renders the user's customized Meshi as the browser favicon.
 * Uses an offscreen canvas to draw the Meshi SVG and converts it to a data URL.
 * Falls back to the static /meshi-favicon.svg if no customization is available.
 */

const COLOR_MAP: Record<string, { primary: string; bg: string }> = {
  blue: { primary: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  purple: { primary: "#8b5cf6", bg: "rgba(139,92,246,0.15)" },
  pink: { primary: "#ec4899", bg: "rgba(236,72,153,0.15)" },
  green: { primary: "#22c55e", bg: "rgba(34,197,94,0.15)" },
  orange: { primary: "#f97316", bg: "rgba(249,115,22,0.15)" },
  cyan: { primary: "#06b6d4", bg: "rgba(6,182,212,0.15)" },
  gold: { primary: "#eab308", bg: "rgba(234,179,8,0.15)" },
  rainbow: { primary: "#ec4899", bg: "rgba(139,92,246,0.15)" },
};

function drawMeshiFavicon(color: string, mood: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "/meshi-favicon.svg";

  const theme = COLOR_MAP[color] || COLOR_MAP.blue;
  const cx = 32;
  const cy = 32;
  const r = 28;

  // Background circle with slight fill
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = theme.bg;
  ctx.fill();

  // Border circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = theme.primary;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw eyes based on mood
  ctx.fillStyle = theme.primary;
  const eyeY = cy - 1;

  // Star and heart eyes are DRAWN, not typeset. fillText with system-ui pulls
  // whatever glyph the OS font supplies — a different star on every platform,
  // and on some, an emoji-font colour glyph that ignores theme.primary
  // entirely. Every other mood's eyes are canvas paths; these are now too.
  const starEye = (x: number, y: number, radius: number) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? radius : radius * 0.45;
      const px = x + rr * Math.cos(angle);
      const py = y + rr * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  };
  const heartEye = (x: number, y: number, s: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.1, y + s * 0.1, x - s * 0.7, y - s * 0.9, x, y - s * 0.25);
    ctx.bezierCurveTo(x + s * 0.7, y - s * 0.9, x + s * 1.1, y + s * 0.1, x, y + s * 0.9);
    ctx.closePath();
    ctx.fill();
  };

  switch (mood) {
    case "excited":
      starEye(cx - 8, eyeY, 6);
      starEye(cx + 8, eyeY, 6);
      break;
    case "love":
      heartEye(cx - 8, eyeY, 5.5);
      heartEye(cx + 8, eyeY, 5.5);
      break;
    case "sleepy":
      // Closed eyes (arcs)
      ctx.beginPath();
      ctx.arc(cx - 8, eyeY, 4, 0, Math.PI, false);
      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 8, eyeY, 4, 0, Math.PI, false);
      ctx.stroke();
      break;
    case "wink":
      // Left eye oval
      ctx.beginPath();
      ctx.ellipse(cx - 8, eyeY, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Right eye wink arc
      ctx.beginPath();
      ctx.arc(cx + 8, eyeY, 4, Math.PI * 0.1, Math.PI * 0.9, false);
      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      break;
    case "cool":
      // Square eyes
      ctx.fillRect(cx - 12, eyeY - 4, 8, 8);
      ctx.fillRect(cx + 4, eyeY - 4, 8, 8);
      break;
    case "thinking":
      // Asymmetric eyes
      ctx.beginPath();
      ctx.arc(cx - 8, eyeY, 4, Math.PI * 0.25, Math.PI * 1.25, false);
      ctx.fillStyle = theme.primary;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 8, eyeY, 4, Math.PI * 1.75, Math.PI * 0.75, false);
      ctx.fill();
      break;
    case "synergy1017":
      // Tall oval left + wink right
      ctx.beginPath();
      ctx.ellipse(cx - 7, eyeY, 3, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 3, eyeY + 2);
      ctx.quadraticCurveTo(cx + 8, eyeY - 4, cx + 13, eyeY + 2);
      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    default:
      // Happy - default wide oval eyes
      ctx.beginPath();
      ctx.ellipse(cx - 8, eyeY, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 8, eyeY, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
  }

  return canvas.toDataURL("image/png");
}

export function DynamicFavicon() {
  useEffect(() => {
    // Read Meshi customization from localStorage
    const updateFavicon = () => {
      try {
        const color = localStorage.getItem("meshiColor") || "blue";
        const face = localStorage.getItem("meshiFace") || "happy";
        const dataUrl = drawMeshiFavicon(color, face);

        // Update all favicon link elements
        let link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          document.head.appendChild(link);
        }
        link.type = "image/png";
        link.href = dataUrl;

        // Also update apple-touch-icon
        let appleLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
        if (!appleLink) {
          appleLink = document.createElement("link");
          appleLink.rel = "apple-touch-icon";
          document.head.appendChild(appleLink);
        }
        appleLink.href = dataUrl;
      } catch {
        // Fall back to static favicon
      }
    };

    // Update on mount
    updateFavicon();

    // Listen for Meshi customization changes
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "meshiColor" || e.key === "meshiFace") {
        updateFavicon();
      }
    };
    window.addEventListener("storage", handleStorage);

    // Also listen for custom events from same-tab updates
    const handleCustom = () => updateFavicon();
    window.addEventListener("meshiCustomized", handleCustom);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("meshiCustomized", handleCustom);
    };
  }, []);

  return null;
}
