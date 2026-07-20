"use client";

import { useMeshiPreferences } from "@/hooks/use-meshi-preferences";
import { MeshiMascot, type MeshiMood } from "@/components/meshi/meshi-mascot";

/**
 * The signed-in user's real, canonical Meshi at any size — the same
 * high-fidelity mascot (their colour + full cosmetics), used everywhere a small
 * Meshi marker is needed so there is never a separate "simplified" drawing of
 * Meshi. Seeded from the per-device Meshi preferences (SSR-safe defaults until
 * hydration).
 */
export function UserMeshi({
  size = 32,
  mood,
  animate = true,
  className,
}: {
  size?: number;
  mood?: MeshiMood;
  animate?: boolean;
  className?: string;
}) {
  const prefs = useMeshiPreferences();
  return (
    <MeshiMascot
      size={size}
      mood={mood ?? prefs.face}
      color={prefs.color}
      hat={prefs.hat}
      hair={prefs.hair}
      accessory={prefs.accessory}
      eyeStyle={prefs.eye}
      badge={prefs.badge}
      outfit={prefs.outfit}
      animate={animate}
      className={className}
    />
  );
}
