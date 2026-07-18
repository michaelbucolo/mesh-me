import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { TrailClient } from "./trail-client";

export const metadata: Metadata = {
  title: "Your Trail",
  description: "The literal path you traveled through your world this month.",
};

export default async function TrailPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/trail");
  return <TrailClient isPro={Boolean(user.isMeshPro)} />;
}
