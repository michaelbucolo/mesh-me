import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConnectedAccountsClient } from "./connected-accounts-client";
import { PublicSupplyStatus } from "./public-supply-status";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConnectedAccountsDashboard } from "@/lib/connected-accounts";
import { getAccountMergeCenter } from "@/lib/account-merge";

export const metadata: Metadata = { title: "One Account" };

export default async function ConnectedAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; platform?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // The OAuth callback returns here with ?connected=<platform> on success or
  // ?error=…&platform=<platform> on failure — surface either in the client.
  const { connected, error } = await searchParams;
  const justConnectedPlatform = (connected ?? "").trim().toLowerCase() || null;
  const connectError = (error ?? "").trim() || null;

  const [dashboard, mergeCenter, personaRows] = await Promise.all([
    getConnectedAccountsDashboard(user.id),
    // Two-party account merge: my open requests + requests targeting me.
    getAccountMergeCenter({ id: user.id, email: user.email }),
    // Separate identities (alter egos) that can be folded back into the one
    // mesh.me account — the "One Account" unification lives here now.
    prisma.alterEgo.findMany({
      where: { userId: user.id, isActive: true },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        _count: { select: { connectedAccounts: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const personas = personaRows.map((persona) => ({
    id: persona.id,
    username: persona.username,
    displayName: persona.displayName,
    avatarUrl: persona.avatarUrl,
    accountCount: persona._count.connectedAccounts,
  }));

  return (
    <div className="grid gap-6">
      {/* Answered BEFORE the connect buttons, deliberately. This page's whole
          job is deciding what to link, and the most useful fact is that
          several platforms need no linking at all — while a few cannot be read
          without it, however much anyone wishes otherwise. Someone who learns
          that here decides in seconds; someone who finds out by connecting an
          account they never needed has been wasted. */}
      <PublicSupplyStatus />
      <ConnectedAccountsClient
        initialDashboard={dashboard}
        mergeCenter={mergeCenter}
        initialPersonas={personas}
        identity={{
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl ?? null,
        }}
        justConnectedPlatform={justConnectedPlatform}
        connectError={connectError}
      />
    </div>
  );
}
