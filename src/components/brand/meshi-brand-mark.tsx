"use client";

import { MeshiMascot } from "@/components/meshi/meshi-mascot";

/**
 * The mesh.me logo mark IS Meshi — the platform's mascot and face. This is the
 * canonical brand Meshi (a consistent, gently-alive companion) used in the
 * sidebar, the auth entry, and anywhere the brand lockup is shown. A user's own
 * customized Meshi is rendered separately via the real MeshiMascot (UserMeshi).
 */
export function MeshiBrandMark({
  size = 34,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <MeshiMascot
      size={size}
      color="blue"
      mood="happy"
      animate
      className={className}
    />
  );
}
