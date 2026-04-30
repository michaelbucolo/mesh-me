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
      <span aria-hidden="true">me</span>
    </span>
  );
}
