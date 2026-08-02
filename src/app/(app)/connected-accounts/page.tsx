import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConnectedAccountsClient } from "./connected-accounts-client";
import { ImportedHistorySection } from "./imported-history-section";
import { ArchiveImportCard } from "./archive-import-card";
import { browsableCount, getSupplyNotes } from "./public-supply-status";
import { hasSecretEncryptionKey } from "@/lib/secret-store";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConnectedAccountsDashboard } from "@/lib/connected-accounts";
import { getAccountMergeCenter } from "@/lib/account-merge";

export const metadata: Metadata = { title: "One Account" };

export default async function ConnectedAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; platform?: string; preselect?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // The OAuth callback returns here with ?connected=<platform> on success or
  // ?error=…&platform=<platform> on failure — surface either in the client.
  const { connected, error, preselect } = await searchParams;
  const justConnectedPlatform = (connected ?? "").trim().toLowerCase() || null;
  const connectError = (error ?? "").trim() || null;
  // Onboarding's "which platforms do you use?" step redirects here with
  // ?preselect=<ids> — the answer a new user just gave. It was produced and
  // never consumed, so the hand-off dropped their picks on the floor.
  const requestedPreselect = (preselect ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);

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

  // Only ids the dashboard actually offers, and only ones not already
  // connected — a pick that's since been linked has nothing left to say.
  const connectedIds = new Set(dashboard.accounts.map((account) => account.platform));
  const preselectPlatforms = requestedPreselect.filter(
    (id) => !connectedIds.has(id) && dashboard.supportedPlatforms.some((platform) => platform.id === id),
  );

  // `supplyNotes` is what each platform can supply BEFORE you connect it,
  // resolved here from the public-supply registry. The short label rides on
  // that platform's tile and the full reason opens with it, so "Instagram needs
  // connecting, and here is why" arrives while you are looking at Instagram —
  // not as a wall of policy above the grid that nobody reads before they have
  // picked anything to care about.
  return (
    <>
    <ConnectedAccountsClient
      initialDashboard={dashboard}
      mergeCenter={mergeCenter}
      initialPersonas={personas}
      identity={{
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? null,
      }}
      supplyNotes={getSupplyNotes()}
      browsableCount={browsableCount()}
      // A DEPLOYMENT-WIDE blocker, not a per-platform one. Without an
      // encryption key nothing can store a token, so no platform is
      // connectable — and offering twelve buttons that each end in a wasted
      // authorization is worse than saying so once, up front.
      serverKeyMissing={!hasSecretEncryptionKey()}
      justConnectedPlatform={justConnectedPlatform}
      connectError={connectError}
      preselectPlatforms={preselectPlatforms}
    />
    {/* Below the grid on purpose. Connecting is what this page is FOR, and an
        archive import is the answer for the platforms where connecting does not
        get your history back — it belongs after the thing most people came to
        do, not competing with it. Renders nothing until something is imported. */}
    <ImportedHistorySection userId={user.id} />
    <ArchiveImportCard />
    </>
  );
}
