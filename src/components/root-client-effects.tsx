"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const DynamicFavicon = dynamic(() => import("@/components/dynamic-favicon").then((mod) => mod.DynamicFavicon), {
  ssr: false,
});
const SpatialInit = dynamic(() => import("@/components/spatial-init").then((mod) => mod.SpatialInit), {
  ssr: false,
});
const PwaRegister = dynamic(() => import("@/components/pwa-register").then((mod) => mod.PwaRegister), {
  ssr: false,
});
const MeshiFloat = dynamic(() => import("@/components/meshi/meshi-float").then((mod) => mod.MeshiFloat), {
  ssr: false,
});
const MeshiDelivery = dynamic(() => import("@/components/meshi/meshi-delivery").then((mod) => mod.MeshiDelivery), {
  ssr: false,
});
const BugReportWidget = dynamic(() => import("@/components/support/bug-report-widget").then((mod) => mod.BugReportWidget), {
  ssr: false,
});

function useAfterFirstPaint(delayMs = 0) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let timeoutId: number | null = null;
    let rafId: number | null = null;

    rafId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => setReady(true), delayMs);
    });

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [delayMs]);

  return ready;
}

export function RootClientEffects() {
  const lightEffectsReady = useAfterFirstPaint(120);
  const companionReady = useAfterFirstPaint(650);

  return (
    <>
      {lightEffectsReady ? <DynamicFavicon /> : null}
      {lightEffectsReady ? <SpatialInit /> : null}
      {lightEffectsReady ? <PwaRegister /> : null}
      {companionReady ? <MeshiFloat /> : null}
      {companionReady ? <MeshiDelivery /> : null}
      {companionReady ? <BugReportWidget /> : null}
    </>
  );
}
