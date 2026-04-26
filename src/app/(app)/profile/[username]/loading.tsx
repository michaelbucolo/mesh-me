import { MeshiFunLoadingScreen } from "@/components/meshi/meshi-loading";

export default function Loading() {
  return (
    <MeshiFunLoadingScreen
      title="Profile"
      subtitle="Meshi is preparing profile details."
      mode="default"
      progressLabel="Profile data loaded"
      steps={[
        "Fetching profile header",
        "Loading activity timeline",
        "Syncing followers and following",
        "Preparing profile modules",
      ]}
    />
  );
}
