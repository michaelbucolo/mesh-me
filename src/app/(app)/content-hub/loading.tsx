import { MeshiFunLoadingScreen } from "@/components/meshi/meshi-loading";

export default function Loading() {
  return (
    <MeshiFunLoadingScreen
      title="Content Hub"
      subtitle="Meshi is assembling your content workspace."
      mode="default"
      progressLabel="Assets staged"
      steps={[
        "Fetching drafts and assets",
        "Loading publishing tools",
        "Syncing scheduled posts",
        "Preparing analytics snapshot",
      ]}
    />
  );
}
