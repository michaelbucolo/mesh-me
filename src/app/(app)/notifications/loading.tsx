import { MeshiFunLoadingScreen } from "@/components/meshi/meshi-loading";

export default function Loading() {
  return (
    <MeshiFunLoadingScreen
      title="Notifications"
      subtitle="Meshi is prioritizing your recent activity alerts."
      mode="default"
      progressLabel="Alerts updated"
      steps={[
        "Fetching recent alerts",
        "Grouping by priority",
        "Syncing read state",
        "Preparing notification feed",
      ]}
    />
  );
}
