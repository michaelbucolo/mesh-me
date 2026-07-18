"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface MeshiPresenceGlyphProps {
  size?: number;
  className?: string;
  active?: boolean;
  label?: string;
}

export function MeshiPresenceGlyph({
  size = 32,
  className,
  active = false,
  label = "Meshi",
}: MeshiPresenceGlyphProps) {
  return (
    <span
      className={cn("meshi-presence-glyph", active && "meshi-presence-glyph-active", className)}
      style={{ "--meshi-glyph-size": `${size}px` } as CSSProperties}
      aria-label={label}
      role="img"
    >
      {/* Canonical Meshi face at small scale — mirrors meshi-mascot.tsx
          proportions (face-space scaled 1.25x into this 64-unit viewBox):
          rounded-square body (rx 40%), tall ellipse eyes (ry ~1.5x rx) with
          up-left glints, and the mascot smile "M -4.6 7 Q 0 11 4.6 7". */}
      <svg
        viewBox="0 0 64 64"
        width="100%"
        height="100%"
        fill="none"
        aria-hidden="true"
        className="meshi-presence-glyph-face"
      >
        <rect x="12" y="12" width="40" height="40" rx="16" stroke="currentColor" strokeWidth="4" />
        <ellipse cx="25.8" cy="32" rx="3" ry="4.6" fill="currentColor" />
        <ellipse cx="38.2" cy="32" rx="3" ry="4.6" fill="currentColor" />
        <circle cx="24.8" cy="30.4" r="1" fill="white" />
        <circle cx="37.2" cy="30.4" r="1" fill="white" />
        <path
          d="M 26.3 40.8 Q 32 45.8 37.7 40.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
