import type { Metadata } from "next";
import { TrailClient } from "./trail-client";

export const metadata: Metadata = {
  title: "Your Trail",
  description: "The literal path you traveled through your world this month.",
};

export default function TrailPage() {
  return <TrailClient />;
}
