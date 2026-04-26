import { MeshiFunLoadingScreen } from "@/components/meshi/meshi-loading";

export default function InnovationLoading() {
  return (
    <MeshiFunLoadingScreen
      title="Innovation"
      subtitle="Meshi is staging your innovation workspace."
      mode="default"
      progressLabel="Workspace ready"
      steps={[
        "Loading innovation briefs",
        "Fetching experiment updates",
        "Syncing collaborator notes",
        "Preparing launch checklist",
      ]}
    />
  );
}
