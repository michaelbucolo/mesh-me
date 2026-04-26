"use client";

import dynamic from "next/dynamic";

const DynamicFavicon = dynamic(() => import("@/components/dynamic-favicon").then((module) => module.DynamicFavicon), {
  ssr: false,
});
const MeshiFloat = dynamic(() => import("@/components/meshi/meshi-float").then((module) => module.MeshiFloat), {
  ssr: false,
});
const MeshiDeliveryWrapper = dynamic(
  () => import("@/components/meshi/meshi-delivery-wrapper").then((module) => module.MeshiDeliveryWrapper),
  { ssr: false },
);
const AchievementChecker = dynamic(
  () => import("@/components/achievements/achievement-toast").then((module) => module.AchievementChecker),
  { ssr: false },
);
const LiveSyncPulse = dynamic(() => import("@/components/live-sync-pulse").then((module) => module.LiveSyncPulse), {
  ssr: false,
});

export function AppClientLayer() {
  return (
    <>
      <DynamicFavicon />
      <MeshiFloat />
      <MeshiDeliveryWrapper />
      <AchievementChecker />
      <LiveSyncPulse />
    </>
  );
}
