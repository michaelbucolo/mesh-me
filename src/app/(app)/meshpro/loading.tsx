import { MeshiFunLoadingScreen } from "@/components/meshi/meshi-loading";

export default function Loading() {
  return (
    <MeshiFunLoadingScreen
      title="MeshPro"
      subtitle="Meshi is activating your professional tools."
      mode="default"
      progressLabel="Tools activated"
      steps={[
        "Verifying MeshPro access",
        "Loading pro dashboards",
        "Syncing workspace integrations",
        "Preparing advanced insights",
      ]}
    />
  );
}
