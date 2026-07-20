import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConnectedAccountsClient } from "./connected-accounts-client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConnectedAccountsDashboard } from "@/lib/connected-accounts";

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

  const [dashboard, personaRows] = await Promise.all([
    getConnectedAccountsDashboard(user.id),
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
    <ConnectedAccountsClient
      initialDashboard={dashboard}
      initialPersonas={personas}
      identity={{
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? null,
      }}
      justConnectedPlatform={justConnectedPlatform}
      connectError={connectError}
    />
  );
}
