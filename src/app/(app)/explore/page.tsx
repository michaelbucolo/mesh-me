import type { Metadata } from "next";
import { PlatformSuite } from "@/components/platform/platform-suite";

export const metadata: Metadata = { title: "Explore" };

export default function ExplorePage() {
  return <PlatformSuite section="explore" />;
}
