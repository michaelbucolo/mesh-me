import { MeshiFunLoadingScreen } from "@/components/meshi/meshi-loading";

export default function Loading() {
  return (
    <MeshiFunLoadingScreen
      title="Explore"
      subtitle="Meshi is scanning the latest network signals."
      mode="default"
      progressLabel="Discoveries ready"
      steps={[
        "Collecting discovery signals",
        "Ranking recommended creators",
        "Loading fresh conversations",
        "Assembling explore modules",
      ]}
    />
  );
}
