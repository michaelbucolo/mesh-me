"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { MeshFormingLoader } from "./mesh-forming-loader";
import { meshApiUrl, prefetchMesh } from "./mesh-prefetch";

const MeshScene = dynamic(() => import("./mesh-scene").then((module) => module.MeshScene), {
  ssr: false,
  loading: () => <MeshFormingLoader />,
});

export function MeshSceneLoader({ viewUserId }: { viewUserId?: string }) {
  // Start the data request while the scene chunk is still downloading, so the
  // two run in parallel instead of chaining.
  useEffect(() => {
    prefetchMesh(meshApiUrl(viewUserId));
  }, [viewUserId]);

  return <MeshScene viewUserId={viewUserId} />;
}
