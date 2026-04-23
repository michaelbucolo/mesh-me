import { MeshiFunLoadingScreen } from "@/components/meshi/meshi-loading";

export default function Loading() {
  return (
    <MeshiFunLoadingScreen
      title="Messages"
      subtitle="Meshi is organizing your conversations."
      mode="message-writing"
    />
  );
}
