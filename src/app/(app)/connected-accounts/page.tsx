import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConnectedAccountsClient } from "./connected-accounts-client";
import { getCurrentUser } from "@/lib/auth";
import { getConnectedAccountsDashboard } from "@/lib/connected-accounts";

export const metadata: Metadata = { title: "Connected Accounts" };

export default async function ConnectedAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; preselect?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { from, preselect } = await searchParams;
  const fromOnboarding = from === "onboarding";
  const preselectPlatforms = (preselect ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const dashboard = await getConnectedAccountsDashboard(user.id);
  return (
    <ConnectedAccountsClient
      initialDashboard={dashboard}
      fromOnboarding={fromOnboarding}
      preselectPlatforms={preselectPlatforms}
    />
  );
}
