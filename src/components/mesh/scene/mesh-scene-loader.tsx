"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { MeshFormingLoader } from "./mesh-forming-loader";
import { meshApiUrl, prefetchMesh } from "./mesh-prefetch";

const MeshScene = dynamic(() => import("./mesh-surface").then((module) => module.MeshScene), {
  ssr: false,
  loading: () => <MeshFormingLoader />,
});

export function MeshSceneLoader({
  viewUserId,
  viewMode = "mesh",
  viewerIsPro = false,
}: {
  viewUserId?: string;
  viewMode?: "mesh" | "global";
  /** Decided on the server (mesh/page.tsx). Cosmetic only — it gates the
   * MeshPro hairline on the viewer's own Meshi and nothing else, so a forged
   * value buys a rim and no capability. */
  viewerIsPro?: boolean;
}) {
  // Start the data request while the scene chunk is still downloading, so the
  // two run in parallel instead of chaining.
  useEffect(() => {
    prefetchMesh(meshApiUrl(viewUserId, viewMode));
  }, [viewUserId, viewMode]);

  return <MeshScene viewUserId={viewUserId} viewMode={viewMode} viewerIsPro={viewerIsPro} />;
}
