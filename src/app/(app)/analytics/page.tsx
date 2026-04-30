import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { getCurrentUser } from "@/lib/auth";
import { getAnalyticsDashboardData } from "@/lib/analytics-dashboard";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Private Mesh.me analytics, permissions, exports, and data controls.",
};

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/analytics");
  if (!user.onboarded) redirect("/onboarding");

  const data = await getAnalyticsDashboardData();
  if (!data) redirect("/login?next=/analytics");

  return <AnalyticsDashboard data={data} />;
}
