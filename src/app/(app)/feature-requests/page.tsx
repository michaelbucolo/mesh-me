import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { listFeatureRequests } from "@/lib/feature-requests";
import { FeatureRequestBoard } from "@/components/feature-requests/feature-request-board";

export const metadata: Metadata = {
  title: "Feature Requests",
};

export default async function FeatureRequestsPage() {
  const user = await getCurrentUser();
  const requests = user ? await listFeatureRequests(user.id) : [];

  return (
    <div className="h-full min-h-0">
      <FeatureRequestBoard initialRequests={requests} isAdmin={Boolean(user?.isAdmin)} />
    </div>
  );
}
