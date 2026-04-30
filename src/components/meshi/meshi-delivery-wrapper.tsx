"use client";

import { MeshiDelivery } from "@/components/meshi/meshi-delivery";
import { useMeshiPreferences } from "@/hooks/use-meshi-preferences";

export function MeshiDeliveryWrapper() {
  const prefs = useMeshiPreferences();
  return (
    <MeshiDelivery
      myMeshiColor={prefs.color}
      myMeshiHat={prefs.hat}
      myMeshiHair={prefs.hair}
      myMeshiAccessory={prefs.accessory}
      myMeshiEyeStyle={prefs.eye}
      myMeshiBadge={prefs.badge}
      myMeshiOutfit={prefs.outfit}
    />
  );
}
