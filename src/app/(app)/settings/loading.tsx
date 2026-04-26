import { MeshiFunLoadingScreen } from "@/components/meshi/meshi-loading";

export default function Loading() {
  return (
    <MeshiFunLoadingScreen
      title="Settings"
      subtitle="Meshi is applying your preference profile."
      mode="default"
      progressLabel="Preferences loaded"
      steps={[
        "Fetching account preferences",
        "Loading privacy controls",
        "Syncing notification rules",
        "Preparing customization panels",
      ]}
    />
  );
}
