import type { Metadata } from "next";
import { MeshSceneLoader } from "@/components/mesh/scene/mesh-scene-loader";

export const metadata: Metadata = { title: "Mesh Dashboard" };

export default async function MeshPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const viewUser = typeof params.user === "string" ? params.user : undefined;
  return <MeshSceneLoader viewUserId={viewUser} />;
}
