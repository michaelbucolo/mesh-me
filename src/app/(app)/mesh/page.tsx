import type { Metadata } from "next";
import { MeshExperience } from "@/components/mesh/mesh-experience";

export const metadata: Metadata = { title: "Mesh Dashboard" };

export default function MeshPage() {
  return <MeshExperience />;
}
