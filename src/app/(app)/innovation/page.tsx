import type { Metadata } from "next";
import { PlatformSuite } from "@/components/platform/platform-suite";

export const metadata: Metadata = { title: "Create" };

export default function InnovationPage() {
  return <PlatformSuite section="create" />;
}
