import { MeshiFunLoadingScreen } from "@/components/meshi/meshi-loading";

export default function Loading() {
  return (
    <MeshiFunLoadingScreen
      title="Messages"
      subtitle="Meshi is organizing your conversations."
      mode="message-writing"
      progressLabel="Threads synced"
      steps={[
        "Authenticating inbox",
        "Loading recent threads",
        "Hydrating drafts",
        "Syncing unread counters",
      ]}
    />
  );
}
