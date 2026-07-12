"use client";

import dynamic from "next/dynamic";

const MeshScene = dynamic(() => import("./mesh-scene").then((module) => module.MeshScene), {
  ssr: false,
  loading: () => (
    <div className="relative flex min-h-[calc(100dvh-8rem)] items-center justify-center overflow-hidden rounded-[28px] border border-[#17345d] bg-[#050b18]">
      <div className="absolute h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="relative flex flex-col items-center gap-3 text-center">
        <div className="h-12 w-12 animate-pulse rounded-full border border-blue-400/40 bg-blue-400/10 shadow-[0_0_45px_rgba(59,130,246,0.2)]" />
        <p className="text-sm font-medium text-slate-400">Forming your mesh…</p>
      </div>
    </div>
  ),
});

export function MeshSceneLoader({ viewUserId }: { viewUserId?: string }) {
  return <MeshScene viewUserId={viewUserId} />;
}
