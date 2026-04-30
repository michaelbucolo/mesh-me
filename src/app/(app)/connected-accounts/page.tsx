import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConnectedAccountsClient } from "./connected-accounts-client";
import { getCurrentUser } from "@/lib/auth";
import { getConnectedAccountsDashboard } from "@/lib/connected-accounts";

export const metadata: Metadata = { title: "Connected Accounts" };

export default async function ConnectedAccountsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const dashboard = await getConnectedAccountsDashboard(user.id);
  return <ConnectedAccountsClient initialDashboard={dashboard} />;
}
