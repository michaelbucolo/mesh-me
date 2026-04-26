import { MeshiFunLoadingScreen } from "@/components/meshi/meshi-loading";

export default function Loading() {
  return (
    <MeshiFunLoadingScreen
      title="Your Mesh"
      subtitle="Meshi is building your mesh structure."
      mode="mesh-building"
      progressLabel="Nodes linked"
      steps={[
        "Loading your core nodes",
        "Calculating connection strength",
        "Applying mesh filters",
        "Rendering network view",
      ]}
    />
  );
}
