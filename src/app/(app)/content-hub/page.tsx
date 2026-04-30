import type { Metadata } from "next";
import { PlatformSuite } from "@/components/platform/platform-suite";

export const metadata: Metadata = { title: "Content Hub" };

export default function ContentHubPage() {
  return <PlatformSuite section="content" />;
}
