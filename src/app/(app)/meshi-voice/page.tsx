import type { Metadata } from "next";
import { PlatformSuite } from "@/components/platform/platform-suite";

export const metadata: Metadata = {
  title: "Meshi Voice",
  description: "Use Meshi as the private voice interface for Mesh search, analytics, messages, and controls.",
};

export default function MeshiVoicePage() {
  return <PlatformSuite section="voice" />;
}
