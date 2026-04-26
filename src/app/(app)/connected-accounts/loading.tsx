import { MeshiFunLoadingScreen } from "@/components/meshi/meshi-loading";

export default function Loading() {
  return (
    <MeshiFunLoadingScreen
      title="Connected Accounts"
      subtitle="Meshi is syncing your connected platforms."
      mode="default"
      progressLabel="Accounts synced"
      steps={[
        "Loading linked platforms",
        "Verifying token health",
        "Fetching latest sync status",
        "Preparing connection controls",
      ]}
    />
  );
}
