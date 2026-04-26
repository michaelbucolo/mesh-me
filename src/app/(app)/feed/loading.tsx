import { MeshiFunLoadingScreen } from "@/components/meshi/meshi-loading";

export default function Loading() {
  return (
    <MeshiFunLoadingScreen
      title="Feed"
      subtitle="Meshi is preparing your latest feed updates."
      mode="default"
      progressLabel="Posts loaded"
      steps={[
        "Fetching latest posts",
        "Scoring relevance",
        "Loading media previews",
        "Hydrating interaction state",
      ]}
    />
  );
}
