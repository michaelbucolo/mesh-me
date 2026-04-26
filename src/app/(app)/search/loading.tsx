import { MeshiFunLoadingScreen } from "@/components/meshi/meshi-loading";

export default function Loading() {
  return (
    <MeshiFunLoadingScreen
      title="Search"
      subtitle="Meshi is processing your search context."
      mode="default"
      progressLabel="Results prepared"
      steps={[
        "Indexing your query",
        "Searching people and posts",
        "Ranking relevance",
        "Preparing result cards",
      ]}
    />
  );
}
