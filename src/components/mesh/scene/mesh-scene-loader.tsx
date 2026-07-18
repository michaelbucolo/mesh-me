"use client";

import dynamic from "next/dynamic";
import { MeshFormingLoader } from "./mesh-forming-loader";

const MeshScene = dynamic(() => import("./mesh-scene").then((module) => module.MeshScene), {
  ssr: false,
  loading: () => <MeshFormingLoader />,
});

export function MeshSceneLoader({ viewUserId }: { viewUserId?: string }) {
  return <MeshScene viewUserId={viewUserId} />;
}
