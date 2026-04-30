import type { Metadata } from "next";
import { PlatformSuite } from "@/components/platform/platform-suite";

export const metadata: Metadata = { title: "Feedback" };

export default function FeedbackPage() {
  return <PlatformSuite section="feedback" />;
}
