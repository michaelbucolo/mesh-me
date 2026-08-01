"use client";

import { useMeshiPreferences } from "@/hooks/use-meshi-preferences";
import { MeshiMascot, type MeshiMood } from "@/components/meshi/meshi-mascot";

/**
 * The signed-in user's real, canonical Meshi at any size — the same
 * high-fidelity mascot (their colour + full cosmetics), used everywhere a small
 * Meshi marker is needed so there is never a separate "simplified" drawing of
 * Meshi. Seeded from the per-device Meshi preferences (SSR-safe defaults until
 * hydration).
 *
 * A PORTRAIT BY DEFAULT, NOT A CHARACTER. Measured on /feed, five Meshi bodies
 * were on screen at once — the brand lockup, three identity badges and the
 * companion — and the ones that MOVED read as five live Meshis rather than one
 * Meshi and four pictures of him. Motion is what makes a drawing a character, so
 * only one thing in the product may have it: the companion in `meshi-float`
 * (and the one the mesh canvas draws, which is the same entity). Everything
 * reached through here is an avatar and holds still unless it explicitly opts in.
 */
export function UserMeshi({
  size = 32,
  mood,
  animate = false,
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
      mood={mood ?? "happy"}
      face={prefs.face}
      color={prefs.color}
      hat={prefs.hat}
      hair={prefs.hair}
      accessory={prefs.accessory}
      eyeStyle={prefs.eye}
      badge={prefs.badge}
      animate={animate}
      className={className}
    />
  );
}
