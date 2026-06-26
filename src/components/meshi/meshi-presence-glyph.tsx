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
      <svg
        viewBox="0 0 64 64"
        width="100%"
        height="100%"
        fill="none"
        aria-hidden="true"
        className="meshi-presence-glyph-face"
      >
        <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="4" />
        <circle cx="25" cy="32" r="4.4" fill="currentColor" />
        <circle cx="39" cy="32" r="4.4" fill="currentColor" />
      </svg>
    </span>
  );
}
