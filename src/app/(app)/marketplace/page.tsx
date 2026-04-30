import type { Metadata } from "next";
import { PlatformSuite } from "@/components/platform/platform-suite";

export const metadata: Metadata = {
  title: "Mesh Marketplace",
  description: "Discover creator packs, Meshi accessories, themes, and premium value without ads.",
};

export default function MarketplacePage() {
  return <PlatformSuite section="marketplace" />;
}
