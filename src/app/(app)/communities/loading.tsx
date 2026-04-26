import { MeshiFunLoadingScreen } from "@/components/meshi/meshi-loading";

export default function Loading() {
  return (
    <MeshiFunLoadingScreen
      title="Communities"
      subtitle="Meshi is preparing your community spaces."
      mode="default"
      progressLabel="Spaces loaded"
      steps={[
        "Fetching joined communities",
        "Loading trending spaces",
        "Syncing membership state",
        "Preparing discussion previews",
      ]}
    />
  );
}
